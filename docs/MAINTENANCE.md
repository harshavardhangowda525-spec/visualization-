# Maintenance runbook

## Daily
Review health checks, 5xx alarms, payment captures awaiting reconciliation, refund status, pending notifications and SMS failures. Match captured Razorpay payments to local order IDs and amounts. Investigate unknown/late captures; never manually confirm a reservation over another active reservation. Run the worker every minute. Check logs by requestId, not by dumping personal data or webhook bodies.

## Weekly
Reconcile gross captures minus processed refunds against the gateway export and bank settlements. Gateway fees and payout timing are separate from captured revenue shown in the dashboard. Check studio availability and member benefit balances. Review staff role changes, OTP exceptions, moderation and unused media. Confirm backup jobs, RDS storage, connection headroom and AWS spend alerts.

## Monthly
Apply reviewed dependency/security patches in staging, run test/build/E2E/provider acceptance as appropriate, deploy a versioned release and retain rollback images. Perform a sample restore, verify alert destinations and review access. Review PII retention and delete only under an approved retention process that preserves financial/audit obligations. Review S3 object versions and CDN usage before removing assets.

## Incidents
- Database unavailable: API fails closed; do not accept reservations in a frontend-only queue. Restore connectivity, verify transaction outcomes and reconcile pending captures. API returns 503 for recognized Prisma connection failures.
- Slot conflict: 409 is expected for a racing customer. Reload availability and create a new hold key for a genuinely new booking.
- Payment captured but no confirmation: fetch gateway payment, check order/amount/currency and hold expiry. A reconciliation-required record needs a refund decision. Do not reactivate a released slot without checking the ledger.
- Refund timeout: query provider refunds by receipt (local refund UUID) before retrying. The server does this before submission, but manual provider review is required after unknown failures.
- SMS unavailable: do not share static codes or create bypass sessions. Use Cognito/approved-provider incident process. Session OTP exceptions require an admin reason and remain audited.
- Session cannot be completed: assigned staff retry only within attempt limits. Customer can request a fresh code after the cooldown. Admin may use the recorded exception process with identity/attendance checks.
- Secret compromised: rotate in Secrets Manager, redeploy tasks, revoke local sessions, rotate OTP pepper, review audit/payment activity. Coordinate webhook secret rotation with provider event retry behavior.

## Recovery targets
RPO and RTO are not promised until the client selects backup/availability requirements and a restore drill measures them. The Terraform default retains RDS backups for 14 days and uses Multi-AZ. Keep S3 versioning and database backups in the approved region/account. Restoring data can replay provider events; idempotent handlers help, but reconciliation remains necessary.

## Handover ownership
The client owns AWS, Cognito, Razorpay, SMS, domain and business data. Infinity Web & Apps owns the agreed development/maintenance work. Document named alert owners and support hours in the contract. Third-party charges are billed separately. New scope such as live tracking, mobile apps, video pipelines and mandates is not covered by an assumption that the current web project includes it.
