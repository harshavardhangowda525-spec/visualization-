import "reflect-metadata";
import {
  Module,
  Global,
  ValidationPipe,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from "@nestjs/common";
import { NestFactory, APP_GUARD } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { Db } from "./db";
import { IdentityService, SessionGuard } from "./auth";
import { BookingService } from "./bookings";
import { PaymentService } from "./payments";
import { SessionService } from "./sessions";
import { DomainError } from "./domain";
import * as Controllers from "./controllers";
@Catch()
class Errors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      res = ctx.getResponse(),
      req = ctx.getRequest();
    let status = 500,
      message = "Internal server error";
    if (error instanceof DomainError) {
      status = error.status;
      message = error.message;
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse() as any;
      message = typeof body === "string" ? body : body.message;
    } else if (
      error.code === "P2002" ||
      error.code === "P2004" ||
      (error.code === "P2010" && error.meta?.code === "23P01")
    ) {
      status = 409;
      message =
        "This reservation conflicts with existing data; refresh and retry";
    } else if (
      [
        "CodeMismatchException",
        "ExpiredCodeException",
        "NotAuthorizedException",
        "UserNotFoundException",
      ].includes(error.name)
    ) {
      status = 401;
      message = "Invalid or expired authentication challenge";
    } else if (error.name === "TooManyRequestsException") {
      status = 429;
      message = "Too many requests; try later";
    } else if (["P1001", "P1002", "P2024"].includes(error.code)) {
      status = 503;
      message = "Database temporarily unavailable";
    }
    if (status === 500)
      Logger.error(
        JSON.stringify({
          requestId: req.requestId,
          errorType: error.name,
          code: error.code,
        }),
      );
    res.status(status).json({
      statusCode: status,
      message,
      requestId: req.requestId,
      ...(process.env.NODE_ENV !== "production"
        ? {
            errorType: error.name,
            errorCode: error.code || error.errorCode,
            databaseCode: error.meta?.code,
          }
        : {}),
    });
  }
}
@Global()
@Module({
  providers: [
    Db,
    IdentityService,
    SessionGuard,
    BookingService,
    PaymentService,
    SessionService,
  ],
  exports: [
    Db,
    IdentityService,
    SessionGuard,
    BookingService,
    PaymentService,
    SessionService,
  ],
})
class DomainModule {}
@Module({ controllers: [Controllers.AuthController] })
class AuthModule {}
@Module({ controllers: [Controllers.CatalogController] })
class CatalogModule {}
@Module({ controllers: [Controllers.BookingsController] })
class BookingModule {}
@Module({ controllers: [Controllers.PaymentsController] })
class PaymentsModule {}
@Module({ controllers: [Controllers.UsersController] })
class UsersModule {}
@Module({ controllers: [Controllers.MembershipController] })
class MembershipModule {}
@Module({
  controllers: [Controllers.StaffController, Controllers.SessionController],
})
class StaffModule {}
@Module({ controllers: [Controllers.AdminController] })
class AdminModule {}
@Module({
  imports: [
    DomainModule,
    AuthModule,
    CatalogModule,
    BookingModule,
    PaymentsModule,
    UsersModule,
    MembershipModule,
    StaffModule,
    AdminModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class AppModule {}
export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
    ...(process.env.LOG_LEVEL === "warn"
      ? { logger: ["error", "warn"] as ("error" | "warn")[] }
      : {}),
  });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN || "http://localhost:3000",
    credentials: true,
  });
  app.use((req: any, res: any, next: any) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-ID", req.requestId);
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    const cookie = Boolean(req.cookies?.studio_session);
    if (
      cookie &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      origin !== (process.env.WEB_ORIGIN || "http://localhost:3000")
    )
      return res.status(403).json({ message: "Origin validation failed" });
    res.on("finish", () =>
      Logger.log(
        JSON.stringify({
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
        }),
      ),
    );
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new Errors());
  if (process.env.NODE_ENV !== "production") {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Infinity Studio API")
        .setVersion("1.0")
        .addCookieAuth("studio_session")
        .build(),
    );
    SwaggerModule.setup("api/docs", app, doc);
  }
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT) || 4000,
    process.env.API_BIND_HOST || "0.0.0.0",
  );
  return app;
}
if (require.main === module)
  bootstrap().catch((e) => {
    Logger.error(e.message);
    process.exit(1);
  });
