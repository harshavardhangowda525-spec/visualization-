import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { Db } = require("../apps/api/dist/db.js"),
  { BookingService } = require("../apps/api/dist/bookings.js"),
  { PaymentService } = require("../apps/api/dist/payments.js"),
  { SessionService } = require("../apps/api/dist/sessions.js");
let app: any,
  pg: any,
  server: any,
  db: any,
  bookings: any,
  payments: any,
  sessions: any,
  actor: any,
  other: any,
  staff: any,
  studio: any,
  service: any;
const at = (days = 1, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const input = (extra: any = {}) => ({
  studioId: studio.id,
  serviceId: service.id,
  startsAt: at(),
  minutes: 60,
  idempotencyKey: randomUUID(),
  ...extra,
});
beforeAll(async () => {
  process.env.OTP_PEPPER = "x".repeat(40);
  pg = await PGlite.create({ extensions: { btree_gist } });
  await pg.exec(
    readFileSync(
      "prisma/migrations/202610310001_initial/migration.sql",
      "utf8",
    ),
  );
  server = new PGLiteSocketServer({
    db: pg,
    port: 0,
    host: "127.0.0.1",
    maxConnections: 10,
  });
  await server.start();
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@" +
    server.getServerConn() +
    "/postgres?connection_limit=1";
  db = new Db();
  await db.$connect();
  bookings = new BookingService(db);
  payments = new PaymentService(db);
  sessions = new SessionService(db);
  for (const role of ["CUSTOMER", "STAFF", "ADMIN"])
    await db.role.create({ data: { name: role } });
  actor = await db.user.create({
    data: { cognitoSub: randomUUID(), phone: "+919999999991" },
  });
  other = await db.user.create({
    data: { cognitoSub: randomUUID(), phone: "+919999999992" },
  });
  staff = await db.user.create({
    data: { cognitoSub: randomUUID(), phone: "+919999999993", role: "STAFF" },
  });
  const c = await db.category.create({
    data: {
      slug: "test",
      name: "Creative Category",
      description: "Test",
      image: "/test",
    },
  });
  studio = await db.studio.create({
    data: {
      slug: "test",
      name: "Test",
      description: "Test",
      location: "Test",
      capacity: 10,
      categoryId: c.id,
      equipment: [],
      hours: {
        create: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          openMinute: 0,
          closeMinute: 1440,
        })),
      },
    },
  });
  service = await db.service.create({
    data: { studioId: studio.id, name: "Rental", hourlyPaise: 100000 },
  });
  await db.setting.create({
    data: {
      key: "bookingPolicy",
      value: { cancellationHours: 0, refundBps: 10000 },
    },
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await app?.close();
  await db?.$disconnect();
  await server?.stop();
  await pg?.close();
});
describe.sequential(
  "database and integrated domain workflows (embedded PostgreSQL)",
  () => {
    let booking: any;
    it("creates an authoritative priced hold", async () => {
      booking = await bookings.hold(actor, input());
      expect(booking.status).toBe("HELD");
      expect(booking.totalPaise).toBe(118000);
    });
    it("rejects an overlapping hold including buffer", async () => {
      await expect(
        bookings.hold(
          other,
          input({
            startsAt: new Date(
              Date.parse(booking.endsAt) + 5 * 60000,
            ).toISOString(),
          }),
        ),
      ).rejects.toThrow();
    });
    it("returns same booking for same idempotency key, rejects different body", async () => {
      const i = input({ startsAt: at(2) }),
        a = await bookings.hold(actor, i),
        b = await bookings.hold(actor, i);
      expect(a.id).toBe(b.id);
      await expect(bookings.hold(actor, { ...i, minutes: 90 })).rejects.toThrow(
        "Idempotency",
      );
    });
    it("enforces exclusion constraint even when application checks are bypassed", async () => {
      await expect(
        db.reservation.create({
          data: {
            studioId: studio.id,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            kind: "BLOCK",
          },
        }),
      ).rejects.toThrow();
    });
    it("accepts exact adjacency after buffer but rejects unauthorized reads", async () => {
      const b = await bookings.hold(
        other,
        input({
          startsAt: new Date(
            Date.parse(booking.endsAt) + 30 * 60000,
          ).toISOString(),
        }),
      );
      expect(b.status).toBe("HELD");
      await expect(bookings.get(other, booking.id)).rejects.toThrow(
        "Permission denied",
      );
    });
    it("rejects expired and invalid memberships", async () => {
      await expect(
        bookings.hold(
          actor,
          input({ startsAt: at(3), membershipId: randomUUID() }),
        ),
      ).rejects.toThrow("Membership not eligible");
    });
    it("validates payment amount, currency and capture state", async () => {
      await db.payment.create({
        data: {
          userId: actor.id,
          bookingId: booking.id,
          orderId: "order_test",
          amountPaise: booking.totalPaise,
        },
      });
      await expect(
        payments.capture({
          order_id: "order_test",
          id: "pay_1",
          amount: 1,
          currency: "INR",
          status: "captured",
          captured: true,
        }),
      ).rejects.toThrow("mismatch");
      await expect(
        payments.capture({ order_id: "order_test", status: "authorized" }),
      ).rejects.toThrow("not been captured");
    });
    it("confirms only a verified captured payment and is idempotent", async () => {
      const remote = {
        order_id: "order_test",
        id: "pay_1",
        amount: booking.totalPaise,
        currency: "INR",
        status: "captured",
        captured: true,
      };
      expect((await payments.capture(remote)).status).toBe("CAPTURED");
      await payments.capture(remote);
      expect(
        (await db.booking.findUnique({ where: { id: booking.id } })).status,
      ).toBe("CONFIRMED");
      expect(await db.notification.count()).toBe(1);
    });
    it("rejects forged webhooks and deduplicates authenticated events", async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
      const { signature } = require("../apps/api/dist/domain.js");
      const raw = Buffer.from(
        JSON.stringify({
          event: "payment.captured",
          payload: { payment: { entity: { id: "pay_1" } } },
        }),
      );
      await expect(
        payments.webhook(raw, "0".repeat(64), "event-1"),
      ).rejects.toThrow("Invalid webhook");
      vi.spyOn(payments, "gateway").mockResolvedValue({
        order_id: "order_test",
        id: "pay_1",
        amount: booking.totalPaise,
        currency: "INR",
        status: "captured",
        captured: true,
      });
      await payments.webhook(raw, signature(raw, "webhook-secret"), "event-1");
      expect(
        (
          await payments.webhook(
            raw,
            signature(raw, "webhook-secret"),
            "event-1",
          )
        ).duplicate,
      ).toBe(true);
      vi.restoreAllMocks();
    });
    it("does not confirm a late capture, creates one reconciliation refund", async () => {
      const b = await bookings.hold(actor, input({ startsAt: at(4) }));
      await db.booking.update({
        where: { id: b.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await db.reservation.update({
        where: { bookingId: b.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await db.payment.create({
        data: {
          userId: actor.id,
          bookingId: b.id,
          orderId: "late_order",
          amountPaise: b.totalPaise,
        },
      });
      const remote = {
        order_id: "late_order",
        id: "late_pay",
        amount: b.totalPaise,
        currency: "INR",
        status: "captured",
        captured: true,
      };
      expect((await payments.capture(remote)).status).toBe(
        "RECONCILIATION_REQUIRED",
      );
      await payments.capture(remote);
      expect(
        (await db.booking.findUnique({ where: { id: b.id } })).status,
      ).toBe("EXPIRED");
      expect(await db.refund.count()).toBe(1);
    });
    it("records failed OTP attempts without rolling them back, requires assigned staff", async () => {
      await db.staffAssignment.create({
        data: { bookingId: booking.id, staffId: staff.id },
      });
      const { makeCode } = require("../apps/api/dist/domain.js");
      const c = makeCode(process.env.OTP_PEPPER);
      const row = await db.sessionVerification.create({
        data: {
          bookingId: booking.id,
          purpose: "START",
          salt: c.salt,
          hash: c.hash,
          expiresAt: new Date(Date.now() + 180000),
        },
      });
      await expect(
        sessions.verify(
          { ...staff, id: other.id },
          booking.id,
          "START",
          c.code,
        ),
      ).rejects.toThrow("Assigned staff");
      await expect(
        sessions.verify(staff, booking.id, "START", "000000"),
      ).rejects.toThrow("Invalid or expired");
      expect(
        (await db.sessionVerification.findUnique({ where: { id: row.id } }))
          .attempts,
      ).toBe(1);
      await sessions.verify(staff, booking.id, "START", c.code);
      expect(
        (await db.booking.findUnique({ where: { id: booking.id } })).status,
      ).toBe("IN_PROGRESS");
      await expect(
        sessions.verify(staff, booking.id, "START", c.code),
      ).rejects.toThrow("Invalid session state");
      const end = await sessions.issue(actor, booking.id, "END");
      await sessions.verify(staff, booking.id, "END", end.code);
      expect(
        (await db.booking.findUnique({ where: { id: booking.id } })).status,
      ).toBe("COMPLETED");
    });
    it("cancels eligible confirmed bookings and releases the slot", async () => {
      const b = await bookings.hold(actor, input({ startsAt: at(5) }));
      await db.booking.update({
        where: { id: b.id },
        data: { status: "CONFIRMED" },
      });
      await db.reservation.update({
        where: { bookingId: b.id },
        data: { expiresAt: null, kind: "BOOKING" },
      });
      const c = await bookings.cancel(actor, b.id, "Changed plans");
      expect(c.status).toBe("CANCELLED");
      expect(
        (await db.reservation.findUnique({ where: { bookingId: b.id } }))
          .active,
      ).toBe(false);
      await expect(sessions.issue(actor, b.id, "START")).rejects.toThrow();
    });
    it("activates membership only once after captured payment", async () => {
      const plan = await db.membershipPlan.create({
        data: {
          name: "Test",
          description: "Test",
          pricePaise: 100000,
          days: 30,
          discountBps: 1000,
          creditMinutes: 60,
          maxBookings: 5,
          benefits: [],
        },
      });
      const sub = await db.subscription.create({
        data: {
          userId: actor.id,
          planId: plan.id,
          planSnapshot: plan,
          idempotencyKey: randomUUID(),
        },
      });
      await db.payment.create({
        data: {
          userId: actor.id,
          subscriptionId: sub.id,
          orderId: "membership_order",
          amountPaise: 100000,
        },
      });
      const remote = {
        order_id: "membership_order",
        id: "membership_pay",
        amount: 100000,
        currency: "INR",
        status: "captured",
        captured: true,
      };
      await payments.capture(remote);
      await payments.capture(remote);
      expect(
        await db.membership.count({ where: { subscriptionId: sub.id } }),
      ).toBe(1);
      const m = await db.membership.findFirst({
        where: { subscriptionId: sub.id },
      });
      const b = await bookings.hold(
        actor,
        input({ startsAt: at(6), minutes: 120, membershipId: m.id }),
      );
      expect(b.creditMinutes).toBe(60);
      expect(b.totalPaise).toBe(106200);
    });
    it("handles simultaneous hold attempts with one winner through the application", async () => {
      const startsAt = at(8);
      const result = await Promise.allSettled([
        bookings.hold(actor, input({ startsAt })),
        bookings.hold(other, input({ startsAt })),
      ]);
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    });
    it("expires holds and permits a new owner to reserve the same period", async () => {
      const b = await bookings.hold(actor, input({ startsAt: at(9) }));
      await db.booking.update({
        where: { id: b.id },
        data: { expiresAt: new Date(0) },
      });
      await db.reservation.update({
        where: { bookingId: b.id },
        data: { expiresAt: new Date(0) },
      });
      const next = await bookings.hold(other, input({ startsAt: at(9) }));
      expect(next.id).not.toBe(b.id);
      expect(
        (await db.booking.findUnique({ where: { id: b.id } })).status,
      ).toBe("EXPIRED");
    });
    it("confirms fully credit-covered bookings without creating a gateway order", async () => {
      const m = await db.membership.findFirst({
        where: { userId: actor.id, status: "ACTIVE" },
      });
      await db.membership.update({
        where: { id: m.id },
        data: { remainingMinutes: 120 },
      });
      const b = await bookings.hold(
        actor,
        input({ startsAt: at(10), minutes: 60, membershipId: m.id }),
      );
      expect(b.totalPaise).toBe(0);
      const result = await payments.order(actor, b.id);
      expect(result.free).toBe(true);
      expect(
        (await db.booking.findUnique({ where: { id: b.id } })).status,
      ).toBe("CONFIRMED");
      expect(await db.payment.count({ where: { bookingId: b.id } })).toBe(0);
    });
    it("protects HTTP routes, rejects mass assignment and fails closed without credentials", async () => {
      const { Logger } = require("@nestjs/common");
      Logger.overrideLogger(false);
      process.env.PORT = "4101";
      const { bootstrap } = require("../apps/api/dist/main.js");
      app = await bootstrap();
      const base = "http://127.0.0.1:4101/api/v1";
      expect((await fetch(base + "/health")).status).toBe(200);
      delete process.env.CRON_SECRET;
      expect((await fetch(base + "/internal/maintenance")).status).toBe(503);
      process.env.CRON_SECRET = "local-test-cron-secret-" + randomUUID();
      expect((await fetch(base + "/internal/maintenance")).status).toBe(401);
      expect(
        (
          await fetch(base + "/internal/maintenance", {
            headers: { Authorization: "Bearer invalid" },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(base + "/internal/maintenance", {
            headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
          })
        ).status,
      ).toBe(200);
      delete process.env.CRON_SECRET;
      for (const term of ["test", "RENTAL", "creative"]) {
        const found = await (
          await fetch(base + "/studios?search=" + term)
        ).json();
        expect(found.items.map((s: any) => s.id)).toContain(studio.id);
      }
      const missing = await (
        await fetch(base + "/studios?search=nonexistent-space")
      ).json();
      expect(missing.items).toEqual([]);
      const locations = await (await fetch(base + "/locations")).json();
      expect(locations).toContain("Test");
      const wrongLocation = await (
        await fetch(base + "/studios?search=test&location=nowhere")
      ).json();
      expect(wrongLocation.items).toEqual([]);
      expect((await fetch(base + "/admin/dashboard")).status).toBe(401);
      const { hash } = require("../apps/api/dist/domain.js");
      const token = randomUUID();
      await db.authSession.create({
        data: {
          tokenHash: hash(token),
          userId: actor.id,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const headers = {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      };
      expect((await fetch(base + "/admin/dashboard", { headers })).status).toBe(
        403,
      );
      expect(
        (
          await fetch(base + "/users/me", {
            method: "PATCH",
            headers,
            body: JSON.stringify({ name: "Tester", role: "ADMIN" }),
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(base + "/auth/otp/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: "+919999999991", register: false }),
          })
        ).status,
      ).toBe(503);
      expect(
        (
          await fetch(base + "/users/me", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Cookie: "studio_session=" + token,
              Origin: "https://evil.example",
            },
            body: JSON.stringify({ name: "Hacked" }),
          })
        ).status,
      ).toBe(403);
    });
  },
);
