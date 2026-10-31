# Release acceptance tests

Automated public browser flows are in e2e/public.spec.ts. The unit and integration suite executes actual domain services, SQL migrations, Prisma operations, guards and HTTP validation against isolated embedded PostgreSQL. Provider behavior is simulated only where explicitly mocked (the authenticated webhook gateway fetch). It is not a claim of a real Razorpay charge.

`npm run build && npm test` runs isolated unit/integration tests. `npm run test:e2e` starts the full local application. `E2E_BASE_URL=https://YOUR-STAGING-ORIGIN npm run test:e2e` targets a configured staging instance. Do not target production with development fixtures.

## Required provider acceptance in staging
1. Register a real Indian phone with consent; receive signup SMS; verify it; request login SMS; verify and confirm a secure HttpOnly session. Retry incorrect code 5 times, check expiry, replay and cross-phone challenges. Resend unconfirmed signup must be checked with your Cognito policy.
2. Create two independent customer browser contexts. Select the same studio/service/date. Click reserve together. Exactly one succeeds. Repeat the eight-client test against PostgreSQL 16 using TEST_POSTGRES_URL (dedicated migrated, seeded disposable database). Embedded PGlite serializes work and is not a replacement for this test.
3. Pay through Razorpay test checkout. Verify signed callback, captured amount/order/currency, booking confirmation and durable notification. Replay webhook and callback. Delay capture beyond hold expiry. No lost reservation may be restored over another customer.
4. Close checkout; interrupt network after order creation, after capture, and during webhook acknowledgement. Reconcile remote gateway state before manual intervention. A timed-out order creation can leave an unused orphan order; do not charge it.
5. Subscribe to each plan in test mode, confirm only after capture, test expiry and limits, combined credits and discounts, cancellation, zero-total credits, simultaneous membership usage, and release of benefits from expired/cancelled holds.
6. Promote verified accounts through the audited operator CLI. Assign a staff member. Customer views a start code, assigned staff verify it near the scheduled start. Check incorrect attempts persist. Reuse, expiry and non-assigned staff must fail. Repeat with separate end code. Review actual timestamps and history.
7. Cancel an eligible session, approve/process refund once. Deliver refund.processed and refund.failed events. Match gateway dashboard IDs and amounts. Confirm no booking is re-enabled by duplicate captures.
8. Test administrator settings, pricing snapshots, media quarantine/publish, staff role changes and session revocation. Verify unauthorized roles cannot call these operations directly.
9. Verify SES delivery, in-app-only behavior without an email, retries, sender verification, alarms and backups. Restore a snapshot into a disposable RDS instance and test application reads.
10. Test keyboard-only operation, screen reader labels, 200% zoom, reduced motion, 360px mobile, slow mobile network and load. Measure actual Core Web Vitals and database latency. Set launch thresholds from measured traffic expectations.

No real registration/payment/notification acceptance is claimed until provider credentials and a staging environment are configured.
