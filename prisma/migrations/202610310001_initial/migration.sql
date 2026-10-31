-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "cognitoSub" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "userId" UUID NOT NULL,
    "company" TEXT,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "roles" (
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "studio_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studios" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "equipment" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_images" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "studio_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_facilities" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "studio_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyPaise" INTEGER NOT NULL,
    "minMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxMinutes" INTEGER NOT NULL DEFAULT 480,
    "stepMinutes" INTEGER NOT NULL DEFAULT 30,
    "taxBps" INTEGER NOT NULL DEFAULT 1800,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_pricing" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "hourlyPaise" INTEGER NOT NULL,
    "taxBps" INTEGER NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_availability" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "openMinute" INTEGER NOT NULL,
    "closeMinute" INTEGER NOT NULL,

    CONSTRAINT "studio_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_holds" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "bookingId" UUID,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'HOLD',
    "reason" TEXT,

    CONSTRAINT "booking_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_time_slots" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "blocked_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "subtotalPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "membershipId" UUID,
    "creditMinutes" INTEGER NOT NULL DEFAULT 0,
    "pricingSnapshot" JSONB NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actualStart" TIMESTAMPTZ(3),
    "actualEnd" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bookingId" UUID,
    "subscriptionId" UUID,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedAt" TIMESTAMPTZ(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "gatewayId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "creditMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxBookings" INTEGER NOT NULL DEFAULT 10,
    "benefits" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "remainingMinutes" INTEGER NOT NULL,
    "remainingBookings" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_usage" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "membership_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_verifications" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "staffId" UUID NOT NULL,

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "cognitoSession" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognitoSub_key" ON "users"("cognitoSub");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_role_action_key" ON "permissions"("role", "action");

-- CreateIndex
CREATE UNIQUE INDEX "studio_categories_slug_key" ON "studio_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "studios_slug_key" ON "studios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "studio_facilities_studioId_name_key" ON "studio_facilities"("studioId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "studio_availability_studioId_weekday_key" ON "studio_availability"("studioId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "booking_holds_bookingId_key" ON "booking_holds"("bookingId");

-- CreateIndex
CREATE INDEX "booking_holds_studioId_startsAt_endsAt_idx" ON "booking_holds"("studioId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_time_slots_reservationId_key" ON "blocked_time_slots"("reservationId");

-- CreateIndex
CREATE INDEX "bookings_studioId_startsAt_idx" ON "bookings"("studioId", "startsAt");

-- CreateIndex
CREATE INDEX "bookings_userId_createdAt_idx" ON "bookings"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_userId_idempotencyKey_key" ON "bookings"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_bookingId_key" ON "payments"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_subscriptionId_key" ON "payments"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentId_key" ON "payments"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gatewayId_key" ON "refunds"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_subscriptionId_key" ON "memberships"("subscriptionId");

-- CreateIndex
CREATE INDEX "memberships_userId_status_idx" ON "memberships"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "membership_subscriptions_userId_idempotencyKey_key" ON "membership_subscriptions"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "membership_usage_bookingId_key" ON "membership_usage"("bookingId");

-- CreateIndex
CREATE INDEX "session_verifications_bookingId_purpose_idx" ON "session_verifications"("bookingId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "staff_assignments_bookingId_key" ON "staff_assignments"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");

-- AddForeignKey
ALTER TABLE "studio_images" ADD CONSTRAINT "studio_images_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_facilities" ADD CONSTRAINT "studio_facilities_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_availability" ADD CONSTRAINT "studio_availability_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE booking_holds ADD CONSTRAINT reservation_no_overlap EXCLUDE USING gist ("studioId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&) WHERE (active);
ALTER TABLE booking_holds ADD CONSTRAINT valid_interval CHECK ("endsAt">"startsAt");
ALTER TABLE bookings ADD CONSTRAINT valid_booking_interval CHECK ("endsAt">"startsAt");
ALTER TABLE bookings ADD CONSTRAINT valid_amount CHECK ("totalPaise"="subtotalPaise"-"discountPaise"+"taxPaise" AND "totalPaise">=0 AND "discountPaise">=0 AND "taxPaise">=0);
ALTER TABLE services ADD CONSTRAINT valid_service CHECK ("hourlyPaise">0 AND "taxBps" BETWEEN 0 AND 10000 AND "minMinutes">0 AND "maxMinutes">="minMinutes" AND "stepMinutes">0);
ALTER TABLE memberships ADD CONSTRAINT valid_membership CHECK ("remainingMinutes">=0 AND "remainingBookings">=0 AND "expiresAt">"startsAt");
ALTER TABLE studio_availability ADD CONSTRAINT valid_hours CHECK (weekday BETWEEN 0 AND 6 AND "openMinute">=0 AND "closeMinute"<=1440 AND "closeMinute">"openMinute");
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('CUSTOMER','STAFF','ADMIN'));
ALTER TABLE bookings ADD CONSTRAINT valid_status CHECK (status IN ('HELD','CONFIRMED','IN_PROGRESS','COMPLETED','EXPIRED','CANCELLED'));
ALTER TABLE reviews ADD CONSTRAINT valid_rating CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE payments ADD CONSTRAINT payment_target CHECK (("bookingId" IS NOT NULL)::int+("subscriptionId" IS NOT NULL)::int=1);
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_role_fk" FOREIGN KEY ("role") REFERENCES "roles"("name") ON DELETE RESTRICT;
ALTER TABLE "studios" ADD CONSTRAINT "studios_categoryId_fk" FOREIGN KEY ("categoryId") REFERENCES "studio_categories"("id") ON DELETE RESTRICT;
ALTER TABLE "service_pricing" ADD CONSTRAINT "service_pricing_serviceId_fk" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT;
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_studioId_fk" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT;
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "blocked_time_slots" ADD CONSTRAINT "blocked_time_slots_reservationId_fk" FOREIGN KEY ("reservationId") REFERENCES "booking_holds"("id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studioId_fk" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fk" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_membershipId_fk" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT;
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_actorId_fk" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fk" FOREIGN KEY ("subscriptionId") REFERENCES "membership_subscriptions"("id") ON DELETE RESTRICT;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fk" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_planId_fk" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_subscriptionId_fk" FOREIGN KEY ("subscriptionId") REFERENCES "membership_subscriptions"("id") ON DELETE RESTRICT;
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_planId_fk" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT;
ALTER TABLE "membership_usage" ADD CONSTRAINT "membership_usage_membershipId_fk" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT;
ALTER TABLE "membership_usage" ADD CONSTRAINT "membership_usage_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "session_verifications" ADD CONSTRAINT "session_verifications_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staffId_fk" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fk" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fk" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT;
