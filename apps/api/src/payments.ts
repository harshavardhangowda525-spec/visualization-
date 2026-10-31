import { Injectable } from "@nestjs/common";
import { Db, lockStudio, lockUser, audit, expire } from "./db";
import { ActorType } from "./auth";
import { assert, signature, constantEqual, hash } from "./domain";
import { PaymentVerifyDto } from "./dto";
@Injectable()
export class PaymentService {
  constructor(private db: Db) {}
  private config() {
    const key = process.env.RAZORPAY_KEY_ID,
      secret = process.env.RAZORPAY_KEY_SECRET;
    assert(
      key?.startsWith("rzp_test_") && secret,
      "Razorpay test mode is not configured",
      503,
    );
    return { key, secret };
  }
  async gateway(path: string, body?: unknown, method?: string) {
    const { key, secret } = this.config();
    const r = await fetch("https://api.razorpay.com/v1/" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        Authorization:
          "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    assert(r.ok, "Payment provider unavailable; retry safely", 502);
    return r.json();
  }
  async order(actor: ActorType, bookingId?: string, subscriptionId?: string) {
    assert(
      Boolean(bookingId) !== Boolean(subscriptionId),
      "Specify one payment target",
    );
    const c = { key: process.env.RAZORPAY_KEY_ID || "" };
    const target = bookingId
      ? await this.db.booking.findUnique({ where: { id: bookingId } })
      : await this.db.subscription.findUnique({
          where: { id: subscriptionId! },
        });
    assert(
      target && target.userId === actor.id,
      "Payment target not found",
      404,
    );
    return this.db.$transaction(
      async (tx) => {
        if (bookingId) {
          await lockStudio(tx, (target as any).studioId);
          await expire(tx, (target as any).studioId);
        }
        await lockUser(tx, actor.id);
        const existing = await tx.payment.findFirst({
          where: bookingId ? { bookingId } : { subscriptionId },
        });
        if (existing) {
          assert(
            existing.status === "CREATED",
            "Payment already processed",
            409,
          );
          return {
            key: c.key,
            orderId: existing.orderId,
            amount: existing.amountPaise,
            currency: "INR",
            paymentId: existing.id,
          };
        }
        let amount: number;
        if (bookingId) {
          const b = await tx.booking.findUniqueOrThrow({
            where: { id: bookingId },
          });
          assert(
            b.status === "HELD" && b.expiresAt > new Date(),
            "Hold has expired",
            409,
          );
          amount = b.totalPaise;
        } else {
          const s = await tx.subscription.findUniqueOrThrow({
            where: { id: subscriptionId! },
          });
          assert(s.status === "PENDING", "Subscription unavailable");
          amount = (s.planSnapshot as any).pricePaise;
        }
        if (bookingId && amount === 0) {
          await tx.reservation.update({
            where: { bookingId },
            data: { kind: "BOOKING", expiresAt: null },
          });
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: "CONFIRMED" },
          });
          await tx.bookingStatusHistory.create({
            data: {
              bookingId,
              status: "CONFIRMED",
              actorId: actor.id,
              reason: "Fully covered by prepaid membership credits",
            },
          });
          await tx.notification.create({
            data: {
              userId: actor.id,
              type: "BOOKING_CONFIRMED",
              content: `Booking ${bookingId} confirmed using membership credits.`,
            },
          });
          await audit(tx, actor.id, "CREDIT_BOOKING_CONFIRMED", bookingId);
          return { free: true, status: "CAPTURED", bookingId };
        }
        const result = await this.gateway("orders", {
          amount,
          currency: "INR",
          receipt: target.id,
          payment_capture: 1,
        });
        assert(
          result.id && result.amount === amount && result.currency === "INR",
          "Invalid gateway order",
          502,
        );
        const payment = await tx.payment.create({
          data: {
            userId: actor.id,
            bookingId,
            subscriptionId,
            orderId: result.id,
            amountPaise: amount,
          },
        });
        await audit(tx, actor.id, "PAYMENT_ORDER_CREATED", payment.id);
        return {
          key: c.key,
          orderId: result.id,
          amount,
          currency: "INR",
          paymentId: payment.id,
        };
      },
      { timeout: 25000, maxWait: 10000 },
    );
  }
  async verify(actor: ActorType, input: PaymentVerifyDto) {
    const payment = await this.db.payment.findUnique({
      where: { orderId: input.razorpay_order_id },
    });
    assert(payment?.userId === actor.id, "Payment not found", 404);
    assert(
      constantEqual(
        input.razorpay_signature,
        signature(
          `${payment.orderId}|${input.razorpay_payment_id}`,
          this.config().secret,
        ),
      ),
      "Invalid payment signature",
      400,
    );
    const remote = await this.gateway(
      "payments/" + encodeURIComponent(input.razorpay_payment_id),
    );
    return this.capture(remote);
  }
  async capture(remote: any) {
    assert(
      remote.status === "captured" && remote.captured === true,
      "Payment has not been captured",
      409,
    );
    const payment = await this.db.payment.findUnique({
      where: { orderId: remote.order_id },
    });
    assert(payment, "Unknown gateway order", 404);
    assert(
      remote.amount === payment.amountPaise &&
        remote.currency === payment.currency &&
        typeof remote.id === "string",
      "Payment amount or currency mismatch",
      400,
    );
    return this.db.$transaction(
      async (tx) => {
        let booking = payment.bookingId
          ? await tx.booking.findUniqueOrThrow({
              where: { id: payment.bookingId },
            })
          : null;
        if (booking) await lockStudio(tx, booking.studioId);
        await lockUser(tx, payment.userId);
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
        if (
          current.status === "CAPTURED" ||
          current.status === "RECONCILIATION_REQUIRED"
        )
          return { status: current.status, bookingId: current.bookingId };
        assert(current.status === "CREATED", "Payment state conflict", 409);
        let status = "CAPTURED";
        if (booking) {
          await expire(tx, booking.studioId);
          booking = await tx.booking.findUniqueOrThrow({
            where: { id: booking.id },
          });
          if (booking.status !== "HELD" || booking.expiresAt <= new Date()) {
            status = "RECONCILIATION_REQUIRED";
            await tx.refund.create({
              data: {
                paymentId: payment.id,
                amountPaise: payment.amountPaise,
                reason: "Captured after hold expired or cancelled",
              },
            });
            await audit(tx, null, "LATE_PAYMENT_REVIEW", payment.id);
          } else {
            await tx.reservation.update({
              where: { bookingId: booking.id },
              data: { kind: "BOOKING", expiresAt: null },
            });
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: "CONFIRMED" },
            });
            await tx.bookingStatusHistory.create({
              data: { bookingId: booking.id, status: "CONFIRMED" },
            });
            await tx.notification.create({
              data: {
                userId: payment.userId,
                type: "BOOKING_CONFIRMED",
                content: `Booking ${booking.id} confirmed for ${booking.startsAt.toISOString()}.`,
              },
            });
          }
        }
        if (payment.subscriptionId) {
          const sub = await tx.subscription.findUniqueOrThrow({
            where: { id: payment.subscriptionId },
          });
          const plan = sub.planSnapshot as any;
          assert(
            sub.status === "PENDING",
            "Subscription already processed",
            409,
          );
          const startsAt = new Date();
          await tx.membership.create({
            data: {
              userId: sub.userId,
              planId: sub.planId,
              subscriptionId: sub.id,
              startsAt,
              expiresAt: new Date(startsAt.getTime() + plan.days * 86400000),
              discountBps: plan.discountBps,
              remainingMinutes: plan.creditMinutes,
              remainingBookings: plan.maxBookings,
            },
          });
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: "ACTIVE" },
          });
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: { paymentId: remote.id, status, capturedAt: new Date() },
        });
        await audit(tx, null, "PAYMENT_CAPTURED", payment.id, {
          gatewayPaymentId: remote.id,
          status,
        });
        return { status, bookingId: payment.bookingId };
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }
  async webhook(raw: Buffer, sig: string, eventId: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    assert(secret, "Webhook is not configured", 503);
    assert(
      eventId &&
        eventId.length <= 200 &&
        constantEqual(sig, signature(raw, secret)),
      "Invalid webhook signature",
      400,
    );
    const payloadHash = hash(raw.toString());
    const existing = await this.db.webhookEvent.findUnique({
      where: { id: eventId },
    });
    if (existing) {
      assert(
        existing.payloadHash === payloadHash,
        "Webhook event id collision",
        409,
      );
      return { received: true, duplicate: true };
    }
    const event = JSON.parse(raw.toString());
    if (event.event === "payment.captured") {
      const entity = event.payload?.payment?.entity;
      assert(entity?.id, "Malformed payment event");
      const remote = await this.gateway(
        "payments/" + encodeURIComponent(entity.id),
      );
      await this.capture(remote);
    } else if (["refund.processed", "refund.failed"].includes(event.event)) {
      const entity = event.payload?.refund?.entity;
      assert(entity?.id, "Malformed refund event");
      await this.db.refund.updateMany({
        where: { gatewayId: entity.id },
        data: {
          status: event.event === "refund.processed" ? "PROCESSED" : "FAILED",
        },
      });
    }
    // A crash before this insert causes a retry; capture and refund updates are independently idempotent.
    await this.db.webhookEvent.upsert({
      where: { id: eventId },
      create: { id: eventId, payloadHash },
      update: {},
    });
    return { received: true };
  }
  async processRefund(actor: ActorType, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM refunds WHERE id=${id}::uuid FOR UPDATE`;
        assert(rows.length, "Refund not found", 404);
        const r = await tx.refund.findUniqueOrThrow({ where: { id } });
        if (r.gatewayId) return r;
        assert(r.status === "REQUESTED", "Refund requires review", 409);
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: r.paymentId },
        });
        assert(payment.paymentId, "No captured payment", 409);
        // Reconcile a prior gateway success if the database commit or response was lost.
        const refunds = await this.gateway(
          "payments/" + encodeURIComponent(payment.paymentId) + "/refunds",
        );
        const previous = refunds.items?.find((x: any) => x.receipt === r.id);
        const remote =
          previous ||
          (await this.gateway(
            "payments/" + encodeURIComponent(payment.paymentId) + "/refund",
            {
              amount: r.amountPaise,
              receipt: r.id,
              notes: { reason: r.reason },
            },
          ));
        assert(
          remote.id && remote.amount === r.amountPaise,
          "Invalid refund response",
          502,
        );
        const result = await tx.refund.update({
          where: { id },
          data: {
            gatewayId: remote.id,
            status: remote.status === "processed" ? "PROCESSED" : "SUBMITTED",
          },
        });
        await audit(tx, actor.id, "REFUND_SUBMITTED", id);
        return result;
      },
      { timeout: 35000 },
    );
  }
}
