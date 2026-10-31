# Implementation plan
1. Audit: empty workspace, no existing work to preserve. Next.js + NestJS monorepo; REST v1 shared with future mobile clients.
2. Design: original warm editorial identity, STILL / HOUSE is a configurable provisional name. Responsive public discovery, studio detail booking, customer, staff, administration screens.
3. Data: normalized PostgreSQL / Prisma, real SQL migrations, one reservation ledger covering holds, bookings and blocked periods. GiST exclusion constraint is the final conflict gate. Studio row locks serialize mutations. UTC instants, business-local opening hours.
4. Identity: Cognito passwordless SMS_OTP; server-side sessions in HttpOnly cookies; role data in PostgreSQL. No development bypass. Account registration is explicit.
5. Booking: validate studio service, hours, duration, availability and membership; price in integer paise; hold for 10 minutes, request-body bound idempotency; payment capture confirms or flags reconciliation if slot expired.
6. Payments: Razorpay test keys only, raw-body HMAC webhooks, gateway fetch and amount/currency/order binding, durable event deduplication, refunds tracked separately.
7. Operations: assigned staff only; independently salted start/end code hashes; limited attempts and expiry; admin exceptions with reason and audit.
8. Membership: prepaid, fixed-duration plans, snapshots, per-customer locks and credit usage. Recurring mandates require separate approved work.
9. Validate: typecheck/build, unit/integration concurrency tests where a real database is available, browser responsive and interaction QA. Record exact gaps in PROJECT_STATUS.md.
10. Delivery: source archive, configuration, runbook, deployment preparation, security checklist and handover. No paid resources, production deployment or live payment.
