# Render deployment

Status: deployable source prepared; account sign-in and actual Render build/health verification are required. This is not a claim that a Render service already exists.

[Deploy this repository to Render](https://render.com/deploy?repo=https://github.com/harshavardhangowda525-spec/visualization-)

## What the Blueprint creates

`render.yaml` defines one Free Node web service and one Free PostgreSQL 16 instance in Singapore. Database public access is disabled. No disks, paid workers, paid cron jobs or other billable resources are requested. Review the actual Render resource/cost summary before creating anything. If the workspace already has a free Postgres database or the service cannot be created on Free, stop and select an approved existing database or obtain explicit cost approval; do not upgrade automatically.

Render's free database expires after 30 days. Free web services sleep after 15 minutes without incoming traffic and can take about a minute to wake. They have shared monthly limits. This configuration is for a temporary review, not the client's production release. Check https://render.com/docs/free for current limitations.

Next.js listens on Render's assigned public `PORT`. NestJS binds to 127.0.0.1:4000 in the same service. Browser requests use `/api/v1/*` on the website's own HTTPS origin; Next rewrites them to the internal Nest server. This preserves host-only secure cookies and existing CSRF origin checks without cross-site cookies or public database credentials. The supervisor stops the service if either required process exits and forwards termination signals to its children.

The web and backend share one instance for the preview. Separately scaled production services, independent migrations, tuned resource limits, distributed rate limiting and a dedicated worker remain production architecture work. Never point the static ChatGPT visual preview at a booking API and represent it as this application.

## Deploy

1. Sign in to Render, open the Deploy link above, or use **New → Blueprint** and choose `harshavardhangowda525-spec/visualization-`, branch `main`, file `render.yaml`.
2. Review the two resource definitions. Keep **Free** for both. Do not confirm any upgrade, paid add-on or billing commitment without approval.
3. Render connects `DATABASE_URL` over its private network, generates `OTP_PEPPER`, and copies the service's actual HTTPS URL into `WEB_ORIGIN` and `NEXT_PUBLIC_SITE_URL`. No application secrets need to be committed to GitHub.
4. Create the Blueprint. The build installs locked dependencies, generates Prisma, and compiles Nest and Next. No local embedded database is used.
5. First startup runs `prisma migrate deploy` against the new preview database, including the GiST conflict constraint. It then imports only the explicitly opted-in development catalogue. It creates no customers, admin accounts, bookings, reviews or login shortcuts. The page labels its studios/pricing as sample data and excludes the preview from search indexing.
6. Wait for the web service to report **Live**. Open its actual URL from Render, not a guessed name. Verify `/api/v1/health` returns `{"status":"ok"}`, then check catalogue, search, studio availability and protected routes. The Render health check uses that database-backed endpoint through the Next proxy.
7. Record the service ID, database ID, deployed Git SHA, actual HTTPS origin and database expiration date in the handover. Until these are observed, deployment remains pending.

Automatic deploys are off. Review changes, then use **Manual Deploy → Deploy latest commit** or sync the Blueprint as appropriate. A cold start reruns idempotent preview migrations/seeding; existing fixture records are preserved except the explicitly known generated media update.

## Provider environment variables

Open the web service → **Environment** and securely add the real credentials below. Do not send them in chat or put them in NEXT_PUBLIC variables.

| Capability                      | Variables                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cognito OTP identity            | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, optional `COGNITO_CLIENT_SECRET`                                                                                   |
| AWS provider access from Render | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`; least-privileged IAM and appropriate rotation/short-lived identity must be reviewed |
| Razorpay test checkout          | `RAZORPAY_KEY_ID` beginning `rzp_test_`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`                                                                       |
| Public studio uploads           | `S3_MEDIA_BUCKET`, `MEDIA_CDN_URL`                                                                                                                              |
| Transactional email             | `SES_FROM_EMAIL` plus authorized SES access                                                                                                                     |

Configure Razorpay test webhooks at the service's **actual** origin plus `/api/v1/payments/webhook`, and verify successful, failed and duplicate capture/refund handling. Live Razorpay keys are deliberately rejected. Cognito must be configured for the supported phone OTP flows and SMS delivery. Missing provider credentials fail closed; a successful Render deploy does not make OTP, payments, uploads or email configured.

`AWS_REGION=ap-south-1` describes the external AWS providers; the app/database themselves run in Render Singapore. Render does not inherit an EC2/ECS IAM role. No SMS provider, AWS access or payment API credentials are generated by this Blueprint.

The maintenance worker runs once every minute while the web instance is awake. It expires holds/memberships/sessions and processes notifications when SES is configured. It prevents overlapping runs within that one instance and retries the next interval after failures. It does not run while Free instances are asleep. Production requires a separately scheduled/always-on worker and monitoring.

## Existing Supabase instead of a new Render database

The user previously considered Supabase, but no database URL was supplied or used. This Blueprint creates a separate Render preview database; it does not migrate or overwrite a Supabase project. To retain an existing PostgreSQL/Supabase database, remove the `databases` section and replace the DATABASE_URL reference with a securely entered connection URL before deploying. Review backup/schema compatibility and transaction-capable connection settings before running migrations against an existing database. Never enable demo seeding against a client's real database.

## Move to an approved production deployment

Disable `SEED_PREVIEW_CATALOGUE` and `RUN_DATABASE_MIGRATIONS`, change `DEPLOYMENT_ENV` away from `preview`, import approved business data, run migrations in a reviewed one-off release job, and provision approved durable capacity/backups before accepting clients. Missing identity/payment acceptance, recovery, load, browser/accessibility and real PostgreSQL concurrency checks remain release blockers. No live payments or paid resources are authorized by the preview configuration.

## Local verification

```sh
npm run build
npm test
npm run typecheck
npm run test:render
```

`test:render` starts an isolated embedded test database, applies the real migration SQL, then runs the actual production-mode launcher and built Next/Nest applications. It checks the same-origin health/catalogue proxy, server-rendered sample data notice, unauthenticated admin denial, unconfigured OTP failure and one maintenance cycle. It verifies process cleanup on shutdown. The test does not run Render infrastructure or the real PostgreSQL migration service, and does not certify external provider acceptance.

Render Blueprint structure is validated against https://render.com/schema/render.yaml.json; account-specific provisioning still requires Render-side validation/deployment.
