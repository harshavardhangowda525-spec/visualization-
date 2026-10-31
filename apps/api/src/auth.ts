import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Db } from "./db";
import { assert, hash, signature } from "./domain";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { randomBytes } from "node:crypto";
export const Roles = (...roles: string[]) => SetMetadata("roles", roles);
export const Actor = createParamDecorator(
  (_, ctx) => ctx.switchToHttp().getRequest().actor,
);
export type ActorType = {
  id: string;
  role: string;
  phone: string;
  email: string | null;
  name: string;
};
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private db: Db,
    private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token =
      req.cookies?.studio_session ||
      req.headers.authorization?.replace(/^Bearer /, "");
    assert(typeof token === "string", "Authentication required", 401);
    const session = await this.db.authSession.findUnique({
      where: { tokenHash: hash(token) },
    });
    assert(session && session.expiresAt > new Date(), "Session expired", 401);
    const user = await this.db.user.findUnique({
      where: { id: session.userId },
    });
    assert(user?.enabled, "Account unavailable", 403);
    req.actor = user;
    const roles = this.reflector.getAllAndOverride<string[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    assert(!roles || roles.includes(user.role), "Permission denied", 403);
    return true;
  }
}
@Injectable()
export class IdentityService {
  private client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "ap-south-1",
  });
  constructor(private db: Db) {}
  private config() {
    const clientId = process.env.COGNITO_CLIENT_ID;
    assert(
      clientId && process.env.COGNITO_USER_POOL_ID,
      "Cognito is not configured",
      503,
    );
    return clientId;
  }
  private secret(phone: string): Record<string, string> {
    return process.env.COGNITO_CLIENT_SECRET
      ? {
          SECRET_HASH: Buffer.from(
            signature(phone + this.config(), process.env.COGNITO_CLIENT_SECRET),
            "hex",
          ).toString("base64"),
        }
      : {};
  }
  async rate(key: string, limit: number, seconds: number) {
    const now = new Date();
    const rows = await this.db.$queryRaw<
      { count: number }[]
    >`INSERT INTO rate_buckets (key,count,"expiresAt") VALUES (${key},1,${new Date(now.getTime() + seconds * 1000)}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN rate_buckets."expiresAt"<${now} THEN 1 ELSE rate_buckets.count+1 END,"expiresAt"=CASE WHEN rate_buckets."expiresAt"<${now} THEN ${new Date(now.getTime() + seconds * 1000)} ELSE rate_buckets."expiresAt" END RETURNING count`;
    assert(rows[0].count <= limit, "Too many requests; try later", 429);
  }
  async request(phone: string, register: boolean, ip: string) {
    await this.rate(`otp-ip:${ip}`, 10, 600);
    await this.rate(`otp-phone:${hash(phone)}`, 3, 600);
    const ClientId = this.config();
    if (register) {
      try {
        const r = await this.client.send(
          new SignUpCommand({
            ClientId,
            Username: phone,
            UserAttributes: [{ Name: "phone_number", Value: phone }],
            ...(process.env.COGNITO_CLIENT_SECRET
              ? { SecretHash: this.secret(phone).SECRET_HASH }
              : {}),
          }),
        );
        const c = await this.db.authChallenge.create({
          data: {
            phone,
            cognitoSession: "SIGNUP",
            expiresAt: new Date(Date.now() + 180000),
          },
        });
        return { challengeId: c.id, expiresIn: 180, registration: true };
      } catch (e) {
        if ((e as Error).name !== "UsernameExistsException") throw e;
      }
    }
    let result;
    try {
      result = await this.client.send(
        new InitiateAuthCommand({
          ClientId,
          AuthFlow: "USER_AUTH",
          AuthParameters: {
            USERNAME: phone,
            PREFERRED_CHALLENGE: "SMS_OTP",
            ...this.secret(phone),
          },
        }),
      );
    } catch (e) {
      if ((e as Error).name !== "UserNotConfirmedException") throw e;
      await this.client.send(
        new ResendConfirmationCodeCommand({
          ClientId,
          Username: phone,
          ...(process.env.COGNITO_CLIENT_SECRET
            ? { SecretHash: this.secret(phone).SECRET_HASH }
            : {}),
        }),
      );
      const c = await this.db.authChallenge.create({
        data: {
          phone,
          cognitoSession: "SIGNUP",
          expiresAt: new Date(Date.now() + 180000),
        },
      });
      return { challengeId: c.id, expiresIn: 180, registration: true };
    }
    assert(
      result.Session && result.ChallengeName === "SMS_OTP",
      "SMS login unavailable; review Cognito passwordless configuration",
      503,
    );
    const challenge = await this.db.authChallenge.create({
      data: {
        phone,
        cognitoSession: result.Session,
        expiresAt: new Date(Date.now() + 180000),
      },
    });
    return { challengeId: challenge.id, expiresIn: 180 };
  }
  async verify(id: string, code: string) {
    const attempt = await this.db.authChallenge.updateMany({
      where: {
        id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      data: { attempts: { increment: 1 } },
    });
    assert(attempt.count === 1, "Challenge expired or attempts exceeded", 401);
    await this.db.auditLog.create({
      data: { action: "AUTH_VERIFICATION_ATTEMPT", entityId: id, detail: {} },
    });
    const challenge = await this.db.authChallenge.findUniqueOrThrow({
      where: { id },
    });
    if (challenge.cognitoSession === "SIGNUP") {
      await this.client.send(
        new ConfirmSignUpCommand({
          ClientId: this.config(),
          Username: challenge.phone,
          ConfirmationCode: code,
          ...(process.env.COGNITO_CLIENT_SECRET
            ? { SecretHash: this.secret(challenge.phone).SECRET_HASH }
            : {}),
        }),
      );
      await this.db.authChallenge.update({
        where: { id },
        data: { consumedAt: new Date(), cognitoSession: "" },
      });
      return { needsLogin: true } as const;
    }
    const r = await this.client.send(
      new RespondToAuthChallengeCommand({
        ClientId: this.config(),
        ChallengeName: "SMS_OTP",
        Session: challenge.cognitoSession,
        ChallengeResponses: {
          USERNAME: challenge.phone,
          SMS_OTP_CODE: code,
          ...this.secret(challenge.phone),
        },
      }),
    );
    assert(
      r.AuthenticationResult?.AccessToken,
      "Invalid verification code",
      401,
    );
    const verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      clientId: this.config(),
      tokenUse: "access",
    });
    const claims = await verifier.verify(r.AuthenticationResult.AccessToken);
    return this.db.$transaction(async (tx) => {
      const used = await tx.authChallenge.updateMany({
        where: { id, consumedAt: null },
        data: { consumedAt: new Date(), cognitoSession: "" },
      });
      assert(used.count === 1, "Challenge already used", 401);
      const user = await tx.user.upsert({
        where: { cognitoSub: claims.sub },
        create: { cognitoSub: claims.sub, phone: challenge.phone },
        update: {},
      });
      assert(user.enabled, "Account disabled", 403);
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUTH_LOGIN_SUCCESS",
          entityId: user.id,
          detail: {},
        },
      });
      const token = randomBytes(32).toString("hex");
      await tx.authSession.create({
        data: {
          tokenHash: hash(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      return { token, user: { id: user.id, name: user.name, role: user.role } };
    });
  }
}
