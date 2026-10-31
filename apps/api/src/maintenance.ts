import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Db, expire, lockStudio } from "./db";
import { assert, hash, constantEqual } from "./domain";

export async function runMaintenance(db: Db) {
  const ses = new SESClient({ region: process.env.AWS_REGION || "ap-south-1" });
  const studios = await db.studio.findMany({ select: { id: true } });
  for (const s of studios)
    await db.$transaction(async (tx) => {
      await lockStudio(tx, s.id);
      await expire(tx, s.id);
    });
  await db.membership.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
  await db.authSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  if (!process.env.SES_FROM_EMAIL) return;
  for (let i = 0; i < 25; i++) {
    const sent = await db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          any[]
        >`SELECT * FROM notifications WHERE status='PENDING' AND attempts<5 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows.length) return false;
        const job = rows[0] as any;
        const user = await tx.user.findUnique({ where: { id: job.userId } });
        if (!user?.email) {
          await tx.notification.update({
            where: { id: job.id },
            data: { status: "IN_APP_ONLY" },
          });
          return true;
        }
        try {
          await ses.send(
            new SendEmailCommand({
              Source: process.env.SES_FROM_EMAIL,
              Destination: { ToAddresses: [user.email] },
              Message: {
                Subject: { Data: "Your studio booking update" },
                Body: { Text: { Data: job.content } },
              },
            }),
          );
          await tx.notification.update({
            where: { id: job.id },
            data: { status: "SENT", attempts: { increment: 1 } },
          });
        } catch {
          await tx.notification.update({
            where: { id: job.id },
            data: { attempts: { increment: 1 } },
          });
        }
        return true;
      },
      { timeout: 30000 },
    );
    if (!sent) break;
  }
}

@Controller("internal")
export class MaintenanceController {
  constructor(private readonly db: Db) {}
  @Get("maintenance")
  async maintenance(@Req() req: Request) {
    const secret = process.env.CRON_SECRET;
    assert(
      secret && secret.length >= 32,
      "Maintenance scheduler is not configured",
      503,
    );
    assert(
      constantEqual(
        hash(req.headers.authorization || ""),
        hash("Bearer " + secret),
      ),
      "Unauthorized",
      401,
    );
    await runMaintenance(this.db);
    return { status: "ok" };
  }
}
