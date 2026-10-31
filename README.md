# Infinity Studio Booking Platform

A Next.js / NestJS / PostgreSQL application built for Infinity Web & Apps. STILL / HOUSE is the provisional studio identity. The application has real database-backed catalogues, reservations, payments, membership benefits and staff verification. It has **not been approved as production ready**. Read PROJECT_STATUS.md before demonstrating or deploying.

## Quick start (Node.js 24 LTS)

```sh
npm ci
npm run db:generate
npm run build
npm run dev
```

Open http://localhost:3000. With no DATABASE_URL, the local launcher creates a persistent development-only embedded PostgreSQL database in `.local-db`, applies the actual migration, seeds clearly marked catalogue fixtures, starts the Nest API at port 4000 and serves the compiled Next application. It does not add customers, staff, administrators, bookings, reviews or authentication bypasses. Changes require rebuilding the relevant app before restarting this preview.

The embedded database is intended for a safe local evaluation. For release testing use PostgreSQL 16. A PGlite socket server serializes queries; it cannot prove behavior under independent PostgreSQL processes, production isolation or RDS failover.

For normal frontend hot reload use `npm run dev:web` after starting an externally configured API with `npm run dev:api`. These do not share an embedded database automatically. Run `npm run build` before returning to the compiled preview.

## Configure PostgreSQL and external services

Copy `.env.example` to `.env`, replace DATABASE_URL with a private PostgreSQL 16 connection and configure the required providers. Do not commit `.env`. The local preview launcher loads it using Node's env-file support. For separate backend/worker processes inject the environment through your process manager or run Node with `--env-file=.env`.

```sh
# With a shell-injected POSTGRES_PASSWORD, start a local PostgreSQL 16 container:
docker compose up -d
# Set DATABASE_URL to match the chosen password, then:
node --env-file=.env node_modules/prisma/build/index.js migrate deploy
node --env-file=.env --import tsx prisma/seed.ts
```

Development seed refuses NODE_ENV=production except the explicitly opted-in Render preview catalogue. For a real deployment import approved catalogue and settings instead. `prisma/schema.prisma` is the ORM model; the SQL migration adds the GiST reservation exclusion constraint, checks and additional foreign keys. **Never replace migrations with prisma db push**, which cannot reconstruct the full constraint design. Future migrations must preserve custom SQL foreign keys and exclusion constraints.

## Credentials and provider behavior

- Cognito: configure an Essentials/Plus user pool with phone sign-in, passwordless SMS_OTP and ALLOW_USER_AUTH. Set pool ID and app client ID. Use a server-side app client; optional client secret is supported. The implemented registration flow confirms signup and then requests a separate login challenge. No provider-free login or fixed OTP exists. Recovery is via the verified phone; lost-phone support needs a business-approved identity process.
- Indian SMS: configure Cognito's approved delivery route, production access, sender identity and DLT requirements for the account. An alternative Indian provider can use Cognito Custom SMS Sender; the Lambda/KMS/provider-specific sender is a separate deployment task, not implemented by setting the unused SMS*PROVIDER*\* template values.
- Razorpay: only `rzp_test_` keys are accepted by this implementation. Configure key ID, secret and separate webhook secret. Register `/api/v1/payments/webhook` for payment.captured, refund.processed and refund.failed. The site remains test-only until a reviewed live-mode change is approved.
- OTP_PEPPER: generate at least 32 random characters in a secret manager. Rotation invalidates outstanding session verification codes. Start/end codes are securely viewed by the owning customer, not sent through unconfigured SMS.
- S3 and CloudFront: supply a private bucket, a CDN with origin path `/public`, and MEDIA_CDN_URL to both web build and runtime. Private files and quarantine keys must never be exposed by CloudFront. The upload flow accepts admin studio imagery only, re-encodes it to WebP variants and strips metadata.
- SES: verify the sending identity and leave sandbox restrictions through the account process. Supply SES_FROM_EMAIL. The worker dispatches durable booking notifications; users without an email retain in-app notifications. Email delivery is at least once and may duplicate after a send/commit interruption.

Never paste provider secrets in chat. Set them in a local environment or AWS Secrets Manager.

## Commands

| Command                                   | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| npm run build                             | Compile NestJS and build Next.js                              |
| npm run typecheck                         | Strict TypeScript checks                                      |
| npm test                                  | Build backend, then execute isolated unit/integration tests   |
| npm run test:e2e                          | Public browser flows on desktop and mobile                    |
| npm run db:migrate                        | Deploy PostgreSQL migrations with injected DATABASE_URL       |
| npm run db:seed                           | Development catalogue only                                    |
| npm run worker                            | Expire holds/memberships, clean sessions, dispatch SES outbox |
| node scripts/set-role.mjs USER_UUID ADMIN | Audited role promotion of an existing verified account        |

The real PostgreSQL concurrency test is opt-in: set TEST_POSTGRES_URL to a dedicated, migrated and development-seeded PostgreSQL 16 test database before `npm test`. It creates test users and reservations; never use a client database. Public E2E requires installed Playwright Chromium. Provider acceptance steps are documented in docs/ACCEPTANCE_TESTS.md.

## Architecture

```
apps/web        Next.js App Router, responsive editorial UI, same-origin API proxy
apps/api/src    Nest modules, guards, DTOs, domain services, controllers
prisma          normalized data model, SQL migration, development fixtures
scripts         local launcher, background maintenance, operator role changes
infra           Docker targets and AWS Terraform preparation
unit/integration tests: tests/
browser tests: e2e/
docs/           API, deployment, security, maintenance and handover
```

The shared REST API is versioned `/api/v1`. Browser sessions use an opaque token stored only in a secure HttpOnly SameSite cookie; the database stores its SHA-256 hash. The API also accepts a bearer session token, but a mobile-specific Cognito exchange/refresh workflow is still required before shipping native mobile clients.

## Booking correctness

All amounts are integer paise. The server reads service prices and membership state; it never accepts a checkout total from the client. A studio row lock serializes reservation mutations. A PostgreSQL GiST exclusion constraint covers active temporary holds, permanent bookings and blocked periods, including the studio buffer. A per-user lock serializes membership reservations. Idempotency binds the key to the original reservation request.

Holds last ten minutes. Availability ignores expired holds, and transactional cleanup deactivates them before insertion. Run the maintenance worker every minute. Verified captures convert an active hold into a confirmed booking. A late capture never steals a replacement reservation; it creates a reconciliation/refund record. Fully prepaid zero-total credit bookings are confirmed without creating a Razorpay charge.

## Delivery and release

No AWS resources have been provisioned and no site has been published. Review docs/DEPLOYMENT.md, docs/SECURITY_CHECKLIST.md and PROJECT_STATUS.md. The complete user request is broader than a verified staging release; pending acceptance is explicit. No claimed ratings, real customers, business revenue or real studio photography have been fabricated. Generated photographs are concept assets and must be replaced or approved for client use.

## Render preview deployment

A Render Blueprint and production-mode process supervisor are included. [Deploy on Render](https://render.com/deploy?repo=https://github.com/harshavardhangowda525-spec/visualization-) or read [the deployment guide](docs/RENDER_DEPLOYMENT.md). The configuration requests only a Free web service and a Free PostgreSQL preview database; that database expires after 30 days. Account sign-in, actual deployment and health verification remain required. Real OTP, Razorpay and AWS provider credentials are not supplied.

`npm run start:render` serves the real Next.js application and NestJS API on one origin with private PostgreSQL. `npm run test:render` runs a local integrated deployment smoke test after a successful build. Preview catalogue import is explicitly gated by both `DEPLOYMENT_ENV=preview` and `SEED_PREVIEW_CATALOGUE=true`; production catalogue seeding stays blocked.
