import { Injectable } from "@nestjs/common";
import { Db, lockStudio, audit } from "./db";
import { assert, makeCode, codeValid } from "./domain";
import { ActorType } from "./auth";
@Injectable()
export class SessionService {
  constructor(private db: Db) {}
  async issue(actor: ActorType, bookingId: string, purpose: "START" | "END") {
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUnique({ where: { id: bookingId } });
      assert(b && b.userId === actor.id, "Booking not found", 404);
      await lockStudio(tx, b.studioId);
      assert(
        b.status === (purpose === "START" ? "CONFIRMED" : "IN_PROGRESS"),
        "Invalid session state",
        409,
      );
      assert(
        purpose === "END" ||
          Math.abs(b.startsAt.getTime() - Date.now()) <= 30 * 60000,
        "Start code is available within 30 minutes of the scheduled start",
      );
      const last = await tx.sessionVerification.findFirst({
        where: { bookingId, purpose },
        orderBy: { createdAt: "desc" },
      });
      assert(
        !last || Date.now() - last.createdAt.getTime() >= 60000,
        "Wait one minute before requesting another code",
        429,
      );
      const count = await tx.sessionVerification.count({
        where: { bookingId, purpose },
      });
      assert(
        count < 10,
        "Code issue limit reached; contact administrator",
        429,
      );
      const generated = makeCode(process.env.OTP_PEPPER || "");
      await tx.sessionVerification.updateMany({
        where: { bookingId, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const expiresAt = new Date(Date.now() + 180000);
      await tx.sessionVerification.create({
        data: {
          bookingId,
          purpose,
          hash: generated.hash,
          salt: generated.salt,
          expiresAt,
        },
      });
      await audit(tx, actor.id, "SESSION_CODE_ISSUED", bookingId, { purpose });
      return { code: generated.code, expiresAt };
    });
  }
  async verify(
    actor: ActorType,
    bookingId: string,
    purpose: "START" | "END",
    code: string,
  ) {
    const b = await this.db.booking.findUnique({ where: { id: bookingId } });
    assert(b, "Booking not found", 404);
    const result = await this.db.$transaction(async (tx) => {
      await lockStudio(tx, b.studioId);
      const assignment = await tx.staffAssignment.findUnique({
        where: { bookingId },
      });
      assert(
        actor.role === "STAFF" && assignment?.staffId === actor.id,
        "Assigned staff required",
        403,
      );
      const current = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
      });
      assert(
        current.status === (purpose === "START" ? "CONFIRMED" : "IN_PROGRESS"),
        "Invalid session state",
        409,
      );
      const row = await tx.sessionVerification.findFirst({
        where: { bookingId, purpose, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });
      assert(row, "Request a new verification code");
      const valid = codeValid(code, row, process.env.OTP_PEPPER || "");
      await tx.sessionVerification.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          ...(valid ? { consumedAt: new Date() } : {}),
        },
      });
      await audit(
        tx,
        actor.id,
        valid ? "SESSION_VERIFIED" : "SESSION_VERIFY_FAILED",
        bookingId,
        { purpose },
      );
      if (!valid) return { valid: false };
      const status = purpose === "START" ? "IN_PROGRESS" : "COMPLETED";
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status,
          ...(purpose === "START"
            ? { actualStart: new Date() }
            : { actualEnd: new Date() }),
        },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId, status, actorId: actor.id },
      });
      return { valid: true, status };
    });
    assert(result.valid, "Invalid or expired code", 400);
    return result;
  }
  async exception(
    actor: ActorType,
    id: string,
    status: "IN_PROGRESS" | "COMPLETED",
    reason: string,
  ) {
    assert(
      reason.trim().length >= 15,
      "A detailed exception reason is required",
    );
    const b = await this.db.booking.findUniqueOrThrow({ where: { id } });
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, b.studioId);
      const current = await tx.booking.findUniqueOrThrow({ where: { id } });
      assert(
        current.status ===
          (status === "IN_PROGRESS" ? "CONFIRMED" : "IN_PROGRESS"),
        "Invalid transition",
        409,
      );
      await tx.booking.update({
        where: { id },
        data: {
          status,
          ...(status === "IN_PROGRESS"
            ? { actualStart: new Date() }
            : { actualEnd: new Date() }),
        },
      });
      await tx.sessionVerification.updateMany({
        where: { bookingId: id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status, actorId: actor.id, reason },
      });
      await audit(tx, actor.id, "SESSION_ADMIN_EXCEPTION", id, {
        status,
        reason,
      });
      return { status };
    });
  }
}
