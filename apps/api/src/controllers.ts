import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Db, lockStudio, audit } from "./db";
import { Actor, ActorType, Roles, SessionGuard, IdentityService } from "./auth";
import { BookingService } from "./bookings";
import { PaymentService } from "./payments";
import { SessionService } from "./sessions";
import * as D from "./dto";
import { assert, hash, validateSlot, localParts } from "./domain";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
const uuid = new ParseUUIDPipe();
async function bookingLabels(db: Db, rows: any[]) {
  const studios = await db.studio.findMany({
    where: { id: { in: [...new Set(rows.map((b) => b.studioId))] } },
  });
  const customers = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((b) => b.userId))] } },
    select: { id: true, name: true, phone: true },
  });
  return rows.map((b) => ({
    ...b,
    studioName: studios.find((s) => s.id === b.studioId)?.name,
    customerName: customers.find((u) => u.id === b.userId)?.name || "Customer",
    customerPhone: customers.find((u) => u.id === b.userId)?.phone,
  }));
}
@Controller("auth")
export class AuthController {
  constructor(
    private identity: IdentityService,
    private db: Db,
  ) {}
  @Post("otp/request") request(@Body() d: D.OtpRequest, @Req() r: Request) {
    return this.identity.request(d.phone, d.register, r.ip || "unknown");
  }
  @Post("otp/verify") async verify(
    @Body() d: D.OtpVerify,
    @Res({ passthrough: true }) r: Response,
  ) {
    const result = await this.identity.verify(d.challengeId, d.code);
    if ("needsLogin" in result) return { needsLogin: true };
    r.cookie("studio_session", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600000,
      path: "/",
    });
    return { user: result.user };
  }
  @Post("logout") @UseGuards(SessionGuard) async logout(
    @Req() r: Request,
    @Res({ passthrough: true }) s: Response,
  ) {
    await this.db.authSession.deleteMany({
      where: {
        tokenHash: hash(
          r.cookies.studio_session ||
            r.headers.authorization?.replace(/^Bearer /, "") ||
            "",
        ),
      },
    });
    s.clearCookie("studio_session", { path: "/" });
    return { success: true };
  }
  @Get("me") @UseGuards(SessionGuard) me(@Actor() a: ActorType) {
    return {
      id: a.id,
      name: a.name,
      phone: a.phone,
      email: a.email,
      role: a.role,
    };
  }
}
@Controller()
export class CatalogController {
  constructor(
    private db: Db,
    private bookings: BookingService,
  ) {}
  @Get("health") async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("settings") async settings() {
    const rows = await this.db.setting.findMany({
      where: {
        key: {
          in: ["business", "faq", "bookingPolicy", "portfolio", "policies"],
        },
      },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  @Get("categories") async categories() {
    const cats = await this.db.category.findMany();
    return Promise.all(
      cats.map(async (c) => ({
        ...c,
        startingPaise: (
          await this.db.service.aggregate({
            where: { active: true, studio: { active: true, categoryId: c.id } },
            _min: { hourlyPaise: true },
          })
        )._min.hourlyPaise,
      })),
    );
  }
  @Get("studios") async list(@Query() q: Record<string, string>) {
    const page = Math.max(1, Math.min(1000, Number(q.page) || 1));
    const take = 12;
    const capacity = Number(q.capacity) || 0;
    assert(capacity >= 0 && capacity <= 500, "Invalid capacity");
    const max = Number(q.maxPrice) || 100000000;
    assert(Number.isFinite(max) && max > 0, "Invalid price");
    const where: any = {
      active: true,
      capacity: { gte: capacity },
      services: { some: { active: true, hourlyPaise: { lte: max } } },
      ...(q.category ? { categoryId: q.category } : {}),
      ...(q.location
        ? {
            location: {
              contains: q.location.slice(0, 100),
              mode: "insensitive",
            },
          }
        : {}),
      ...(q.facility
        ? { facilities: { some: { name: q.facility.slice(0, 100) } } }
        : {}),
    };
    const rows = await this.db.studio.findMany({
      where,
      include: {
        images: { orderBy: { sort: "asc" } },
        facilities: true,
        services: { where: { active: true } },
      },
      skip: (page - 1) * take,
      take,
    });
    return {
      items: rows,
      total: await this.db.studio.count({ where }),
      page,
      pages: Math.ceil((await this.db.studio.count({ where })) / take),
    };
  }
  @Get("studios/:id/availability") availability(
    @Param("id", uuid) id: string,
    @Query("date") date: string,
    @Query("serviceId") serviceId: string,
    @Query("minutes") minutes: string,
  ) {
    assert(/^[a-f0-9-]{36}$/i.test(serviceId), "Invalid service");
    return this.bookings.availability(
      id,
      date,
      serviceId,
      Number(minutes) || 60,
    );
  }
  @Get("studios/:id") async detail(@Param("id") id: string) {
    const s = await this.db.studio.findFirst({
      where: {
        OR: [{ slug: id }, ...(/^[a-f0-9-]{36}$/i.test(id) ? [{ id }] : [])],
        active: true,
      },
      include: {
        images: { orderBy: { sort: "asc" } },
        facilities: true,
        hours: true,
        services: { where: { active: true } },
      },
    });
    assert(s, "Studio not found", 404);
    return s;
  }
  @Get("memberships") plans() {
    return this.db.membershipPlan.findMany({
      where: { active: true },
      orderBy: { pricePaise: "asc" },
    });
  }
  @Get("reviews") async reviews() {
    const rows = await this.db.review.findMany({
      where: { approved: true },
      take: 12,
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        name:
          (await this.db.user.findUnique({ where: { id: r.userId } }))?.name ||
          "Verified customer",
      })),
    );
  }
}
@Controller("bookings")
@UseGuards(SessionGuard)
export class BookingsController {
  constructor(
    private bookings: BookingService,
    private db: Db,
  ) {}
  @Post("hold") hold(@Actor() a: ActorType, @Body() d: D.HoldDto) {
    return this.bookings.hold(a, d);
  }
  @Get() async list(@Actor() a: ActorType) {
    return bookingLabels(
      this.db,
      await this.db.booking.findMany({
        where: { userId: a.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }
  @Get(":id") get(@Actor() a: ActorType, @Param("id", uuid) id: string) {
    return this.bookings.get(a, id);
  }
  @Post(":id/cancel") cancel(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.CancelDto,
  ) {
    return this.bookings.cancel(a, id, d.reason);
  }
  @Post(":id/reschedule") reschedule(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.RescheduleDto,
  ) {
    return this.bookings.reschedule(a, id, d.startsAt);
  }
  @Post(":id/session-code") code() {
    assert(false, "Use /session-verification/code");
  }
}
@Controller("payments")
export class PaymentsController {
  constructor(
    private payments: PaymentService,
    private db: Db,
  ) {}
  @Post("create-order") @UseGuards(SessionGuard) order(
    @Actor() a: ActorType,
    @Body() d: D.IdDto,
  ) {
    return this.payments.order(a, d.id);
  }
  @Post("verify") @UseGuards(SessionGuard) verify(
    @Actor() a: ActorType,
    @Body() d: D.PaymentVerifyDto,
  ) {
    return this.payments.verify(a, d);
  }
  @Get() @UseGuards(SessionGuard) list(@Actor() a: ActorType) {
    return this.db.payment.findMany({
      where: { userId: a.id },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("webhook") webhook(@Req() r: Request & { rawBody?: Buffer }) {
    assert(r.rawBody, "Raw webhook body unavailable");
    return this.payments.webhook(
      r.rawBody,
      String(r.headers["x-razorpay-signature"] || ""),
      String(r.headers["x-razorpay-event-id"] || ""),
    );
  }
}
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private db: Db) {}
  @Patch("me") async profile(@Actor() a: ActorType, @Body() d: D.ProfileDto) {
    return this.db.user.update({
      where: { id: a.id },
      data: d,
      select: { id: true, name: true, email: true, phone: true },
    });
  }
  @Get("notifications") notifications(@Actor() a: ActorType) {
    return this.db.notification.findMany({
      where: { userId: a.id },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("reviews") async review(@Actor() a: ActorType, @Body() d: D.ReviewDto) {
    const b = await this.db.booking.findUnique({ where: { id: d.bookingId } });
    assert(
      b?.userId === a.id && b.status === "COMPLETED",
      "Only completed bookings can be reviewed",
    );
    return this.db.review.create({ data: { ...d, userId: a.id } });
  }
}
@Controller("memberships")
@UseGuards(SessionGuard)
export class MembershipController {
  constructor(
    private db: Db,
    private payments: PaymentService,
  ) {}
  @Get("mine") mine(@Actor() a: ActorType) {
    return this.db.membership.findMany({
      where: { userId: a.id },
      orderBy: { expiresAt: "desc" },
    });
  }
  @Post("subscribe") async subscribe(
    @Actor() a: ActorType,
    @Body() d: D.SubscribeDto,
  ) {
    const plan = await this.db.membershipPlan.findUnique({
      where: { id: d.planId },
    });
    assert(plan?.active, "Plan unavailable");
    const sub = await this.db.subscription.upsert({
      where: {
        userId_idempotencyKey: {
          userId: a.id,
          idempotencyKey: d.idempotencyKey,
        },
      },
      create: {
        userId: a.id,
        planId: plan.id,
        planSnapshot: plan,
        idempotencyKey: d.idempotencyKey,
      },
      update: {},
    });
    assert(sub.planId === d.planId, "Idempotency key reused", 409);
    return this.payments.order(a, undefined, sub.id);
  }
  @Post(":id/cancel") async cancel(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const m = await tx.membership.findUnique({ where: { id } });
      assert(m?.userId === a.id, "Membership not found", 404);
      await tx.membership.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await audit(tx, a.id, "MEMBERSHIP_CANCELLED", id);
      return {
        status: "CANCELLED",
        message: "Prepaid plan cancelled. No automatic renewal or refund.",
      };
    });
  }
}
@Controller("session-verification")
@UseGuards(SessionGuard)
export class SessionController {
  constructor(private sessions: SessionService) {}
  @Post("code") code(@Actor() a: ActorType, @Body() d: D.SessionCodeDto) {
    return this.sessions.issue(a, d.bookingId, d.purpose);
  }
  @Post("verify") @Roles("STAFF") verify(
    @Actor() a: ActorType,
    @Body() d: D.SessionVerifyDto,
  ) {
    return this.sessions.verify(a, d.bookingId, d.purpose, d.code);
  }
}
@Controller("staff")
@UseGuards(SessionGuard)
@Roles("STAFF")
export class StaffController {
  constructor(private db: Db) {}
  @Get("bookings") async list(@Actor() a: ActorType) {
    const assignments = await this.db.staffAssignment.findMany({
      where: { staffId: a.id },
    });
    return bookingLabels(
      this.db,
      await this.db.booking.findMany({
        where: { id: { in: assignments.map((x) => x.bookingId) } },
        orderBy: { startsAt: "asc" },
        take: 100,
      }),
    );
  }
}
@Controller("admin")
@UseGuards(SessionGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(
    private db: Db,
    private sessions: SessionService,
    private payments: PaymentService,
  ) {}
  @Get("dashboard") async dashboard() {
    const [bookings, payments, memberships, customers] = await Promise.all([
      this.db.booking.findMany({ take: 10000 }),
      this.db.payment.findMany({ take: 10000, where: { status: "CAPTURED" } }),
      this.db.membership.count({
        where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
      }),
      this.db.user.count({ where: { role: "CUSTOMER" } }),
    ]);
    return {
      bookings: bookings.length,
      today: bookings.filter(
        (b) =>
          localParts(b.startsAt, "Asia/Kolkata").date ===
          localParts(new Date(), "Asia/Kolkata").date,
      ).length,
      upcoming: bookings.filter(
        (b) => b.startsAt > new Date() && b.status === "CONFIRMED",
      ).length,
      completed: bookings.filter((b) => b.status === "COMPLETED").length,
      cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
      revenuePaise: payments.reduce((s, p) => s + p.amountPaise, 0),
      activeMemberships: memberships,
      customers,
      reportLimit: 10000,
    };
  }
  @Get("analytics") async analytics() {
    const since = new Date(Date.now() - 90 * 86400000);
    const [bookings, payments, members, studios] = await Promise.all([
      this.db.booking.findMany({
        where: { createdAt: { gte: since } },
        take: 10000,
      }),
      this.db.payment.findMany({
        where: { capturedAt: { gte: since }, status: "CAPTURED" },
        take: 10000,
      }),
      this.db.membership.findMany({
        where: { startsAt: { gte: since } },
        take: 10000,
      }),
      this.db.studio.findMany({ include: { services: true, hours: true } }),
    ]);
    const sum = (
      rows: any[],
      dateKey: string,
      value: (r: any) => number,
      bucket: "day" | "month",
    ) => {
      const values: Record<string, number> = {};
      for (const r of rows) {
        const date = localParts(r[dateKey], "Asia/Kolkata").date.slice(
          0,
          bucket === "month" ? 7 : 10,
        );
        values[date] = (values[date] || 0) + value(r);
      }
      return Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value }));
    };
    const popular = studios.flatMap((st) =>
      st.services.map((service) => ({
        label: service.name + " / " + st.name,
        value: bookings.filter(
          (b) =>
            b.serviceId === service.id &&
            ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.status),
        ).length,
      })),
    );
    const utilization = studios.map((st) => {
      let available = 0;
      for (let i = 0; i < 90; i++) {
        const parts = localParts(
          new Date(since.getTime() + i * 86400000),
          st.timezone,
        );
        const h = st.hours.find((h) => h.weekday === parts.weekday);
        if (h) available += h.closeMinute - h.openMinute;
      }
      const booked = bookings
        .filter(
          (b) =>
            b.studioId === st.id &&
            b.startsAt >= since &&
            b.startsAt <= new Date() &&
            ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.status),
        )
        .reduce(
          (n, b) => n + (b.endsAt.getTime() - b.startsAt.getTime()) / 60000,
          0,
        );
      return {
        label: st.name,
        value: available ? Math.round((booked / available) * 10000) / 100 : 0,
      };
    });
    return {
      dailyRevenue: sum(payments, "capturedAt", (p) => p.amountPaise, "day"),
      monthlyRevenue: sum(
        payments,
        "capturedAt",
        (p) => p.amountPaise,
        "month",
      ),
      bookingTrends: sum(bookings, "createdAt", () => 1, "day"),
      popularServices: popular,
      studioUtilization: utilization,
      membershipGrowth: sum(members, "startsAt", () => 1, "month"),
      notes:
        "90-day window; utilization is scheduled session time over current nominal operating hours, before blocked-time adjustments. Revenue is gross captured INR paise, before refunds and gateway fees. Initial report limit is 10,000 records per dataset.",
    };
  }
  @Get("revenue") async revenue() {
    return this.db
      .$queryRaw`SELECT date_trunc('day',"capturedAt" AT TIME ZONE 'Asia/Kolkata') AS day,SUM("amountPaise")::float AS paise,COUNT(*)::int AS transactions FROM payments WHERE status='CAPTURED' AND "capturedAt">now()-interval '90 days' GROUP BY 1 ORDER BY 1`;
  }
  @Get("bookings") bookings(@Query("status") status: string) {
    assert(
      !status ||
        [
          "HELD",
          "CONFIRMED",
          "IN_PROGRESS",
          "COMPLETED",
          "CANCELLED",
          "EXPIRED",
        ].includes(status),
      "Invalid status",
    );
    return this.db.booking.findMany({
      where: status ? { status } : {},
      take: 200,
      orderBy: { startsAt: "desc" },
    });
  }
  @Get("customers") customers() {
    return this.db.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
      },
      take: 200,
    });
  }
  @Get("staff") staff() {
    return this.db.user.findMany({
      where: { role: "STAFF", enabled: true },
      select: { id: true, name: true, phone: true },
      take: 100,
    });
  }
  @Post("assign") async assign(@Actor() a: ActorType, @Body() d: D.AssignDto) {
    return this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUnique({ where: { id: d.bookingId } });
      assert(b, "Booking not found", 404);
      await lockStudio(tx, b.studioId);
      assert(
        ["CONFIRMED", "HELD"].includes(b.status),
        "Cannot assign this booking",
      );
      const staff = await tx.user.findUnique({ where: { id: d.staffId } });
      assert(staff?.role === "STAFF" && staff.enabled, "Staff unavailable");
      const result = await tx.staffAssignment.upsert({
        where: { bookingId: d.bookingId },
        create: d,
        update: { staffId: d.staffId },
      });
      await tx.notification.create({
        data: {
          userId: d.staffId,
          type: "STAFF_ASSIGNMENT",
          content: `Booking ${d.bookingId} has been assigned to you.`,
        },
      });
      await audit(tx, a.id, "STAFF_ASSIGNED", d.bookingId, {
        staffId: d.staffId,
      });
      return result;
    });
  }
  @Post("bookings/:id/exception") exception(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.ExceptionDto,
  ) {
    return this.sessions.exception(a, id, d.status, d.reason);
  }
  @Post("categories") async createCategory(
    @Actor() a: ActorType,
    @Body() d: D.CategoryDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const c = await tx.category.create({ data: d });
      await audit(tx, a.id, "CATEGORY_CREATED", c.id);
      return c;
    });
  }
  @Patch("studios/:id/facilities") async facilities(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.FacilitiesDto,
  ) {
    assert(
      d.names.every((n) => n.trim().length > 0 && n.length <= 80),
      "Invalid facility name",
    );
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, id);
      await tx.studioFacility.deleteMany({ where: { studioId: id } });
      await tx.studioFacility.createMany({
        data: [...new Set(d.names)].map((name) => ({ studioId: id, name })),
      });
      await audit(tx, a.id, "FACILITIES_UPDATED", id);
      return { success: true };
    });
  }
  @Get("studios") studios() {
    return this.db.studio.findMany({
      include: { images: true, facilities: true, hours: true, services: true },
    });
  }
  @Post("studios") async createStudio(
    @Actor() a: ActorType,
    @Body() d: D.StudioDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const s = await tx.studio.create({ data: d });
      await audit(tx, a.id, "STUDIO_CREATED", s.id);
      return s;
    });
  }
  @Patch("studios/:id") async editStudio(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.StudioDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, id);
      const s = await tx.studio.update({ where: { id }, data: d });
      await audit(tx, a.id, "STUDIO_UPDATED", id);
      return s;
    });
  }
  @Patch("services/:id/price") async price(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.PriceDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data: d });
      await tx.servicePricing.create({ data: { serviceId: id, ...d } });
      await audit(tx, a.id, "PRICE_CHANGED", id, d as any);
      return { success: true };
    });
  }
  @Post("blocks") async block(@Actor() a: ActorType, @Body() d: D.BlockDto) {
    assert(new Date(d.endsAt) > new Date(d.startsAt), "Invalid interval");
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, d.studioId);
      const r = await tx.reservation.create({
        data: {
          studioId: d.studioId,
          startsAt: new Date(d.startsAt),
          endsAt: new Date(d.endsAt),
          kind: "BLOCK",
          reason: d.reason,
        },
      });
      await tx.blockedTimeSlot.create({
        data: { reservationId: r.id, reason: d.reason },
      });
      await audit(tx, a.id, "STUDIO_BLOCKED", r.id);
      return r;
    });
  }
  @Get("plans") plans() {
    return this.db.membershipPlan.findMany();
  }
  @Post("plans") async plan(@Actor() a: ActorType, @Body() d: D.PlanDto) {
    return this.db.$transaction(async (tx) => {
      const p = await tx.membershipPlan.create({ data: d });
      await audit(tx, a.id, "PLAN_CREATED", p.id);
      return p;
    });
  }
  @Patch("plans/:id") async editPlan(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.PlanDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const p = await tx.membershipPlan.update({ where: { id }, data: d });
      await audit(tx, a.id, "PLAN_UPDATED", id);
      return p;
    });
  }
  @Get("payments") transactions() {
    return this.db.payment.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
    });
  }
  @Get("refunds") refunds() {
    return this.db.refund.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("refunds/:id/process") refund(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
  ) {
    return this.payments.processRefund(a, id);
  }
  @Get("reviews") reviews() {
    return this.db.review.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("reviews/:id/approve") async approve(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { approved: true } });
      await audit(tx, a.id, "REVIEW_APPROVED", id);
      return { success: true };
    });
  }
  @Post("staff/role") async staffRole(
    @Actor() a: ActorType,
    @Body() d: D.StaffRoleDto,
  ) {
    assert(a.id !== d.userId, "Cannot change your own role");
    return this.db.$transaction(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: d.userId } });
      assert(
        u.role !== "ADMIN",
        "Administrator role changes require the operator CLI",
      );
      await tx.user.update({
        where: { id: u.id },
        data: { role: d.role, enabled: d.enabled },
      });
      if (d.role === "STAFF")
        await tx.staffProfile.upsert({
          where: { userId: u.id },
          create: { userId: u.id, title: d.title, active: d.enabled },
          update: { title: d.title, active: d.enabled },
        });
      await tx.authSession.deleteMany({ where: { userId: u.id } });
      await audit(tx, a.id, "STAFF_ROLE_UPDATED", u.id, {
        role: d.role,
        enabled: d.enabled,
      });
      return { success: true };
    });
  }
  @Post("studios/:id/hours") async hours(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Body() d: D.HoursDto,
  ) {
    assert(d.closeMinute > d.openMinute, "Closing must follow opening");
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, id);
      await tx.studioHours.upsert({
        where: { studioId_weekday: { studioId: id, weekday: d.weekday } },
        create: { studioId: id, ...d },
        update: d,
      });
      await audit(tx, a.id, "HOURS_UPDATED", id, d as any);
      return { success: true };
    });
  }
  @Delete("studios/:id/hours/:day") async closeDay(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
    @Param("day") day: string,
  ) {
    const weekday = Number(day);
    assert(
      Number.isInteger(weekday) && weekday >= 0 && weekday <= 6,
      "Invalid weekday",
    );
    return this.db.$transaction(async (tx) => {
      await lockStudio(tx, id);
      await tx.studioHours.deleteMany({ where: { studioId: id, weekday } });
      await audit(tx, a.id, "DAY_CLOSED", id, { weekday });
      return { success: true };
    });
  }
  @Post("services") async service(
    @Actor() a: ActorType,
    @Body() d: D.ServiceDto,
  ) {
    assert(d.maxMinutes >= d.minMinutes, "Invalid duration limits");
    return this.db.$transaction(async (tx) => {
      const r = await tx.service.create({ data: d });
      await audit(tx, a.id, "SERVICE_CREATED", r.id);
      return r;
    });
  }
  @Delete("blocks/:id") async unblock(
    @Actor() a: ActorType,
    @Param("id", uuid) id: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.reservation.findUniqueOrThrow({ where: { id } });
      assert(r.kind === "BLOCK", "Only blocked periods may be unblocked");
      await lockStudio(tx, r.studioId);
      await tx.reservation.update({ where: { id }, data: { active: false } });
      await audit(tx, a.id, "STUDIO_UNBLOCKED", id);
      return { success: true };
    });
  }
  @Get("settings") settings() {
    return this.db.setting.findMany();
  }
  @Patch("settings/:key") async setting(
    @Actor() a: ActorType,
    @Param("key") key: string,
    @Body() d: D.SettingDto,
  ) {
    assert(
      ["business", "bookingPolicy", "faq", "portfolio", "policies"].includes(
        key,
      ),
      "Unknown setting",
    );
    let value: any;
    try {
      value = JSON.parse(d.json);
    } catch {
      assert(false, "Invalid JSON");
    }
    assert(value && typeof value === "object", "Invalid settings");
    if (key === "bookingPolicy")
      assert(
        Number.isInteger(value.cancellationHours) &&
          value.cancellationHours >= 0 &&
          value.cancellationHours <= 720 &&
          Number.isInteger(value.refundBps) &&
          value.refundBps >= 0 &&
          value.refundBps <= 10000,
        "Invalid booking policy",
      );
    if (key === "faq")
      assert(
        Array.isArray(value) &&
          value.length <= 30 &&
          value.every(
            (f: any) =>
              typeof f.question === "string" && typeof f.answer === "string",
          ),
        "Invalid FAQ",
      );
    return this.db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      await audit(tx, a.id, "SETTING_UPDATED", key);
      return { success: true };
    });
  }
  @Post("media/publish") async publish(
    @Actor() a: ActorType,
    @Body() d: D.MediaPublishDto,
  ) {
    const Bucket = process.env.S3_MEDIA_BUCKET,
      cdn = process.env.MEDIA_CDN_URL;
    assert(
      Bucket && cdn?.startsWith("https://"),
      "Media storage not configured",
      503,
    );
    const client = new S3Client({ region: process.env.AWS_REGION });
    const source = await client.send(
      new GetObjectCommand({ Bucket, Key: d.key }),
    );
    assert(
      source.ContentLength && source.ContentLength <= 10485760,
      "Image exceeds size limit",
    );
    const bytes = await source.Body!.transformToByteArray();
    const pipeline = sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: "warning",
    });
    const meta = await pipeline.metadata();
    assert(
      ["jpeg", "png", "webp", "avif"].includes(meta.format || ""),
      "Invalid image bytes",
    );
    const name = randomUUID();
    const variants: { width: number; url: string }[] = [];
    for (const width of [640, 1280, 1920]) {
      const key = `public/studios/${d.studioId}/${name}-${width}.webp`;
      const result = await sharp(bytes, { limitInputPixels: 40000000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: result,
          ContentType: "image/webp",
          ServerSideEncryption: "AES256",
          CacheControl: "public,max-age=31536000,immutable",
        }),
      );
      variants.push({
        width,
        url: cdn!.replace(/\/$/, "") + "/" + key.replace("public/", ""),
      });
    }
    const image = await this.db.$transaction(async (tx) => {
      const r = await tx.studioImage.create({
        data: { studioId: d.studioId, url: variants[1].url, alt: d.alt },
      });
      await audit(tx, a.id, "STUDIO_IMAGE_PUBLISHED", r.id);
      return r;
    });
    await client.send(new DeleteObjectCommand({ Bucket, Key: d.key }));
    return { image, variants };
  }
  @Get("audit") logs() {
    return this.db.auditLog.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("media/presign") async presign(@Body() d: D.UploadDto) {
    assert(process.env.S3_MEDIA_BUCKET, "Media storage not configured", 503);
    const key = "quarantine/" + randomUUID();
    const command = new PutObjectCommand({
      Bucket: process.env.S3_MEDIA_BUCKET,
      Key: key,
      ContentType: d.contentType,
      ContentLength: d.size,
      ServerSideEncryption: "AES256",
    });
    const url = await getSignedUrl(
      new S3Client({ region: process.env.AWS_REGION }),
      command,
      { expiresIn: 120 },
    );
    return {
      key,
      url,
      expiresIn: 120,
      publication:
        "Quarantined. Validate image bytes and strip metadata before publishing.",
    };
  }
}
