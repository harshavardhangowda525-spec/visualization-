import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
@Injectable()
export class Db extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
export type Tx = Prisma.TransactionClient;
export async function lockStudio(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM studios WHERE id=${id}::uuid FOR UPDATE`;
}
export async function lockUser(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
}
export async function expire(tx: Tx, studioId: string) {
  const now = new Date();
  const rows = await tx.booking.findMany({
    where: { studioId, status: "HELD", expiresAt: { lte: now } },
  });
  for (const b of rows) {
    await tx.reservation.updateMany({
      where: { bookingId: b.id, kind: "HOLD" },
      data: { active: false },
    });
    await tx.booking.update({
      where: { id: b.id },
      data: { status: "EXPIRED" },
    });
    if (b.membershipId) {
      const usage = await tx.membershipUsage.findUnique({
        where: { bookingId: b.id },
      });
      if (usage && !usage.released) {
        await tx.membership.update({
          where: { id: b.membershipId },
          data: {
            remainingMinutes: { increment: usage.minutes },
            remainingBookings: { increment: 1 },
          },
        });
        await tx.membershipUsage.update({
          where: { id: usage.id },
          data: { released: true },
        });
      }
    }
  }
}
export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  entityId: string,
  detail: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({ data: { actorId, action, entityId, detail } });
}
