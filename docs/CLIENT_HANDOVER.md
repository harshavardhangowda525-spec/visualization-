# Client handover guide

## What to demonstrate now
Start the application with the README quick start. Show the homepage, catalogue filters, studio details, date/duration availability, membership plans and published policies. Explain that prices/studios/images are clearly marked development fixtures. Show test output for database and security workflows. Do not describe generated imagery as real photographs of the client's property.

## What the client supplies
Final business name, logo, contact details, locations, real studio assets, facilities/equipment, opening hours, buffer rules, service durations/prices, applicable tax treatment, cancellation/refund terms, membership eligibility and credit/discount rules. Approve the combination rule: included minutes apply first, percentage discount applies to remaining rental, then tax. Confirm whether cancelled member bookings restore benefits (currently yes for eligible cancellations/expired holds).

The client creates/owns AWS, Cognito and Razorpay test accounts. Credentials go into a secret manager, not a message or source repository. Confirm which approved SMS delivery route will be used and who owns its operational approvals. Agree on administrator MFA, support escalation, maintenance scope, backups and alert recipients.

## Administrator workflow after configuration
Register using a verified phone. The deployment operator promotes that existing user with the audited role CLI. Sign in again; visit /admin. Add studios and services; set operating hours; publish media; activate the studio after reviewing its data. Configure plans and settings. Register staff through the normal login flow, assign staff roles and bookings. Review bookings, captures/refunds, customer reviews and audit records. Sensitive financial and session exception operations require an explicit confirmation in the interface.

## Customer and staff session
Customer books and completes test checkout. Backend capture confirms the booking. Customer sees booking in /dashboard. Administrator assigns staff. Near arrival the customer requests a START code; assigned staff enter it in /staff. At completion the customer requests a separate END code. Both parties see the updated session state. If OTP fails, the administrator records a detailed exception rather than disabling security.

## Launch gate
Demonstrate the complete scenario using real staging provider credentials and PostgreSQL 16, including competing customers and failed payments. Reconcile the provider dashboard and audit history. Approve policies and replace fixtures. Complete the security and acceptance checklists, deploy staging, review measured load and recovery results, then obtain production authorization. The current test-only payment guard requires an explicit reviewed code change before live payments.

Mobile applications can reuse the API and database, but are not included in this website source. Native token exchange/refresh, push notifications and platform-specific checkout must be implemented and reviewed before Android/iOS release.
