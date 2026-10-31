import { Injectable } from "@nestjs/common";
import { Db, Tx, lockStudio, lockUser, expire, audit } from "./db";
import {
  assert,
  hash,
  price,
  validateSlot,
  canAccess,
  localParts,
} from "./domain";
import { HoldDto } from "./dto";
import { ActorType } from "./auth";
@Injectable()
export class BookingService {
  constructor(public db: Db) {}
  async hold(actor: ActorType, input: HoldDto) {
    return this.db.$transaction(
      async (tx) => {
        await lockStudio(tx, input.studioId);
        await lockUser(tx, actor.id);
        await expire(tx, input.studioId);
        const requestHash = hash(
          JSON.stringify([
            input.studioId,
            input.serviceId,
            input.startsAt,
            input.minutes,
            input.membershipId || null,
          ]),
        );
        const existing = await tx.booking.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: actor.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          assert(
            existing.requestHash === requestHash,
            "Idempotency key reused for another request",
            409,
          );
          return existing;
        }
        const studio = await tx.studio.findUnique({
          where: { id: input.studioId },
          include: { hours: true },
        });
        assert(studio?.active, "Studio unavailable", 404);
        const service = await tx.service.findFirst({
          where: { id: input.serviceId, studioId: studio.id, active: true },
        });
        assert(service, "Service unavailable", 404);
        const start = new Date(input.startsAt),
          end = new Date(start.getTime() + input.minutes * 60000);
        const minutes = validateSlot(
          start,
          end,
          service,
          studio.hours,
          studio.timezone,
        );
        let membership = null;
        let discount = 0,
          credits = 0;
        if (input.membershipId) {
          membership = await tx.membership.findUnique({
            where: { id: input.membershipId },
          });
          assert(
            membership &&
              membership.userId === actor.id &&
              membership.status === "ACTIVE" &&
              membership.startsAt <= new Date() &&
              membership.expiresAt > end &&
              membership.remainingBookings > 0,
            "Membership not eligible",
          );
          discount = membership.discountBps;
          credits = membership.remainingMinutes;
        }
        const amount = price(
          service.hourlyPaise,
          minutes,
          discount,
          service.taxBps,
          credits,
        );
        const policy = await tx.setting.findUnique({
          where: { key: "bookingPolicy" },
        });
        assert(policy, "Booking policy not configured", 503);
        const expiresAt = new Date(Date.now() + 600000);
        const b = await tx.booking.create({
          data: {
            userId: actor.id,
            studioId: studio.id,
            serviceId: service.id,
            startsAt: start,
            endsAt: end,
            expiresAt,
            ...amount,
            membershipId: membership?.id,
            pricingSnapshot: {
              hourlyPaise: service.hourlyPaise,
              taxBps: service.taxBps,
              discountBps: discount,
            },
            policySnapshot: policy.value!,
            idempotencyKey: input.idempotencyKey,
            requestHash,
          },
        });
        await tx.reservation.create({
          data: {
            studioId: studio.id,
            bookingId: b.id,
            startsAt: start,
            endsAt: new Date(end.getTime() + studio.bufferMinutes * 60000),
            expiresAt,
          },
        });
        if (membership) {
          await tx.membership.update({
            where: { id: membership.id },
            data: {
              remainingMinutes: { decrement: amount.creditMinutes },
              remainingBookings: { decrement: 1 },
            },
          });
          await tx.membershipUsage.create({
            data: {
              membershipId: membership.id,
              bookingId: b.id,
              minutes: amount.creditMinutes,
              discountPaise: amount.discountPaise,
            },
          });
        }
        await tx.bookingStatusHistory.create({
          data: { bookingId: b.id, status: "HELD", actorId: actor.id },
        });
        await audit(tx, actor.id, "BOOKING_HELD", b.id);
        return b;
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
  async availability(
    id: string,
    date: string,
    serviceId: string,
    minutes: number,
  ) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "Invalid date");
    assert(
      Number.isInteger(minutes) && minutes >= 30 && minutes <= 480,
      "Invalid duration",
    );
    const studio = await this.db.studio.findUnique({
      where: { id },
      include: {
        hours: true,
        services: { where: { id: serviceId, active: true } },
      },
    });
    assert(
      studio?.active && studio.services.length,
      "Studio or service unavailable",
      404,
    );
    // Scan UTC instants and match business-local date; also supports non-Indian timezones and DST.
    const base = Date.parse(date + "T00:00:00Z");
    const reservations = await this.db.reservation.findMany({
      where: {
        studioId: id,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    const slots = [];
    for (
      let t = base - 14 * 3600000;
      t < base + 38 * 3600000;
      t += 15 * 60000
    ) {
      const s = new Date(t),
        e = new Date(t + minutes * 60000);
      if (localParts(s, studio.timezone).date !== date) continue;
      try {
        validateSlot(s, e, studio.services[0], studio.hours, studio.timezone);
      } catch {
        continue;
      }
      const buffered = e.getTime() + studio.bufferMinutes * 60000;
      slots.push({
        startsAt: s.toISOString(),
        endsAt: e.toISOString(),
        available: !reservations.some(
          (r) => r.startsAt.getTime() < buffered && r.endsAt > s,
        ),
      });
    }
    return { date, timezone: studio.timezone, slots };
  }
  async get(actor: ActorType, id: string) {
    const b = await this.db.booking.findUnique({ where: { id } });
    assert(b, "Booking not found", 404);
    const assignment = await this.db.staffAssignment.findUnique({
      where: { bookingId: id },
    });
    assert(
      canAccess(actor, b.userId, assignment?.staffId),
      "Permission denied",
      403,
    );
    return { ...b, assignment };
  }
  async release(tx: Tx, b: { id: string; membershipId: string | null }) {
    await tx.reservation.updateMany({
      where: { bookingId: b.id },
      data: { active: false },
    });
    const usage = await tx.membershipUsage.findUnique({
      where: { bookingId: b.id },
    });
    if (b.membershipId && usage && !usage.released) {
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
  async cancel(actor: ActorType, id: string, reason: string) {
    const current = await this.get(actor, id);
    assert(
      actor.role === "ADMIN" || actor.id === current.userId,
      "Cannot cancel another customer booking",
      403,
    );
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, current.studioId);
      await lockUser(tx, current.userId);
      const b = await tx.booking.findUniqueOrThrow({ where: { id } });
      assert(
        ["HELD", "CONFIRMED"].includes(b.status),
        "Booking cannot be cancelled",
        409,
      );
      const p = b.policySnapshot as {
        cancellationHours: number;
        refundBps: number;
      };
      const eligible =
        b.startsAt.getTime() - Date.now() >= p.cancellationHours * 3600000;
      assert(
        actor.role === "ADMIN" || eligible,
        "Cancellation window has closed",
        409,
      );
      await this.release(tx, b);
      await tx.booking.update({ where: { id }, data: { status: "CANCELLED" } });
      const payment = await tx.payment.findUnique({ where: { bookingId: id } });
      if (eligible && payment?.status === "CAPTURED")
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            amountPaise: Math.floor(
              (payment.amountPaise * p.refundBps) / 10000,
            ),
            reason,
          },
        });
      await tx.bookingStatusHistory.create({
        data: { bookingId: id, status: "CANCELLED", actorId: actor.id, reason },
      });
      await audit(tx, actor.id, "BOOKING_CANCELLED", id, {
        reason,
        refundEligible: eligible,
      });
      return { status: "CANCELLED", refundEligible: eligible };
    });
  }
  async reschedule(actor: ActorType, id: string, startsAt: string) {
    const old = await this.get(actor, id);
    assert(
      actor.role === "ADMIN" || actor.id === old.userId,
      "Permission denied",
      403,
    );
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, old.studioId);
      await expire(tx, old.studioId);
      const b = await tx.booking.findUniqueOrThrow({ where: { id } });
      assert(
        b.status === "CONFIRMED",
        "Only confirmed sessions can be rescheduled",
        409,
      );
      const policy = b.policySnapshot as { cancellationHours: number };
      assert(
        b.startsAt.getTime() - Date.now() >= policy.cancellationHours * 3600000,
        "Rescheduling window closed",
      );
      const studio = await tx.studio.findUniqueOrThrow({
        where: { id: b.studioId },
        include: { hours: true },
      });
      const service = await tx.service.findUniqueOrThrow({
        where: { id: b.serviceId },
      });
      const s = new Date(startsAt),
        e = new Date(s.getTime() + b.endsAt.getTime() - b.startsAt.getTime());
      validateSlot(s, e, service, studio.hours, studio.timezone);
      if (b.membershipId) {
        const m = await tx.membership.findUniqueOrThrow({
          where: { id: b.membershipId },
        });
        assert(
          m.status === "ACTIVE" && m.expiresAt > e,
          "Membership expires before new session",
        );
      }
      await tx.reservation.update({
        where: { bookingId: id },
        data: {
          startsAt: s,
          endsAt: new Date(e.getTime() + studio.bufferMinutes * 60000),
        },
      });
      await tx.booking.update({
        where: { id },
        data: { startsAt: s, endsAt: e },
      });
      await audit(tx, actor.id, "BOOKING_RESCHEDULED", id, {
        from: b.startsAt.toISOString(),
        to: s.toISOString(),
      });
      return { status: "CONFIRMED" };
    });
  }
}
