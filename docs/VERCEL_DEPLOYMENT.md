# Vercel deployment

Status on 31 October 2026: signed in to the existing `infinity-web-and-apps/visualization` project. Its latest production attempt failed with unresolved `@/…` imports. The dashboard reports **No Production Deployment**. No successful Vercel application URL has been verified.

The team is on **Hobby**. Vercel restricts Hobby to personal, non-commercial use. This is a client business project, so deployment is paused until an eligible Pro/Enterprise workspace is selected or the owner approves and completes an upgrade. No upgrade, trial, purchase, subscription or payment has been started. Pro pricing currently starts at USD 20/month for one developer seat, plus applicable taxes and metered overages; check the actual checkout and spend controls before accepting.

Official references: https://vercel.com/docs/plans/hobby and https://vercel.com/pricing .

## Prepared application topology

The root `vercel.json` uses Vercel Services (currently Beta) to deploy the actual applications together. `web` is Next.js at `apps/web`; `api` is NestJS at `apps/api`. Requests under `/api/*` route to Nest and all other paths to Next, with the original paths preserved. Both use the same public origin and host-only secure cookies. The frontend receives a deployment-aware `API_INTERNAL_URL` through a private service binding for server-side data fetching. No browser code receives database or provider secrets.

The frontend disables its legacy localhost API rewrite only when `VERCEL=1`; local/AWS/Render behavior is preserved. Service bindings exist at runtime, not during builds; dynamic server pages continue to fetch from the backend when requested. No background processes or embedded databases run inside Vercel Functions.

`apps/api/server.cjs` starts the compiled Nest app explicitly. Compilation uses `tsc` to preserve dependency-injection decorator metadata; raw webhook body handling, validation, roles, auth and payment checks remain in the existing app. The frontend's explicit TypeScript `baseUrl` and install commands including development build tools address the observed alias-resolution build failure. A successful live Vercel build is still required to confirm the provider-side fix.

The existing maintenance logic is shared by the CLI worker and a new `/api/v1/internal/maintenance` endpoint. The endpoint requires a long `CRON_SECRET` and an exact bearer token, compared via constant-time hashes; missing configuration returns 503, invalid or absent credentials return 401. A once-per-minute Vercel cron invokes it on an eligible plan. Existing transaction/row locks protect expiry and notification processing. Delivery remains at least once, and provider acceptance/recovery testing is still necessary.

Vercel Services reference: https://vercel.com/docs/services . NestJS reference: https://vercel.com/docs/frameworks/backend/nestjs .

## Prevent accidental deployment during setup

Both root `vercel.json` and the compatibility file `apps/web/vercel.json` set `git.deploymentEnabled=false`. Automatic Git deployment is intentionally paused for this setup while plan eligibility, secrets and database ownership are verified. The compatibility file also provides build/install settings for the project's current `apps/web` root; that root serves only the frontend, so do not treat it as the completed full-stack deployment.

After approval, merge the reviewed configuration, change the Vercel project's Root Directory to the repository root, and remove legacy Next-only project build overrides so the root Services configuration owns each build. Review the framework detection and configuration in the deployment preview before invoking Manual Deploy. Re-enable automatic Git deployment only after successful acceptance and a deliberate release workflow decision.

No Render resource is needed by this topology. The failed Render Blueprint created no new application service or database; existing Client-demo- resources remain untouched.

## Existing database entry

Vercel shows a `DATABASE_URL` environment-variable name for this project. Its value was not revealed, copied or logged, and the connection has not been tested. The project's Storage page has no attached managed database. These are separate observations: a manually configured external PostgreSQL database may still exist.

Confirm the database belongs to this project before running migrations. Vercel hosting itself does not replace PostgreSQL. Use approved Supabase, Neon or another PostgreSQL service with TCP connections and transaction support; do not replace the Prisma transactional booking engine with a frontend-only storage API. No new database has been provisioned or connected by this change.

For a new, empty approved database, run `npm run db:migrate` once from an authorized release job using the reviewed migration connection. It creates the custom GiST conflict constraint and foreign keys. Do not use `prisma db push`. For existing databases, inspect schema/ownership and take the appropriate backup first; do not seed demonstration records into a real client's database.

Use a bounded connection pool, for example provider-appropriate `connection_limit`/pool timeout parameters. For transaction pooling, use the provider's Prisma-compatible settings and a direct connection for migration jobs where required. Do not use a publicly reachable local development database.

## Server environment

Set these in Vercel's secure Environment Variables UI for the intended deployment environments:

| Variable                                                                   | Purpose                                                                                                                                 |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                             | Approved PostgreSQL runtime connection; existing entry is unverified.                                                                   |
| `OTP_PEPPER`                                                               | Random secret, at least 32 characters, protecting session codes.                                                                        |
| `CRON_SECRET`                                                              | Separate random secret, at least 32 characters, protecting maintenance.                                                                 |
| `DEPLOYMENT_ENV`                                                           | `preview` for the labelled review environment; use an approved release value for a real launch.                                         |
| `NEXT_PUBLIC_SITE_URL`                                                     | Actual canonical public frontend HTTPS origin.                                                                                          |
| `WEB_ORIGIN`                                                               | Exact frontend HTTPS origin for cookie/CSRF checks. If omitted in the Vercel API entrypoint, the deployment's own `VERCEL_URL` is used. |
| `AWS_REGION`                                                               | Region of the Cognito/S3/SES providers, e.g. the client's approved region.                                                              |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`                                | Existing phone OTP identity setup. Optional `COGNITO_CLIENT_SECRET` if that app client uses one.                                        |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN` | Approved least-privileged AWS access from outside AWS; do not assume an ECS role is available on Vercel.                                |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`        | Reviewed Razorpay **test-mode** credentials only. Live keys stay rejected.                                                              |
| `S3_MEDIA_BUCKET`, `MEDIA_CDN_URL`, `SES_FROM_EMAIL`                       | Optional configured studio media/email integrations.                                                                                    |

`API_INTERNAL_URL` is generated by the service binding; remove a legacy manually configured localhost value instead of overriding the binding. `PORT`, `VERCEL_URL` and Vercel platform variables are provider-controlled. Never use `start:render` or `scripts/dev.mjs` as a Vercel Function entrypoint.

Optional preview catalogue initialization remains a separate explicit one-off step for an empty, dedicated review database: set `NODE_ENV=production`, `DEPLOYMENT_ENV=preview` and `SEED_PREVIEW_CATALOGUE=true` for `npm run db:seed`. It creates no customers/admin accounts or OTP bypasses. Seeding is not automatically run during builds or function startup. Production requires approved client data instead.

## Verification before reporting live

1. Confirm an eligible commercial plan and reviewed spend settings; do not make an unapproved purchase.
2. Verify database ownership, migrations, schema constraints and least-privileged connection.
3. Configure all required secrets securely. Missing identity/payment credentials must continue to fail closed.
4. Deploy the reviewed commit with the root Services configuration and wait for **Ready**.
5. Verify the actual assigned URL, `/api/v1/health`, server-rendered catalogue, filters and available slots.
6. Verify unauthenticated admin denial, real Cognito OTP, cookies/CSRF on the final domain and Razorpay test capture/duplicate webhooks/refunds.
7. Verify the authenticated maintenance cron and provider notifications in Vercel logs; do not assume a cron definition proves execution.
8. Complete real PostgreSQL concurrency, load, mobile/browser, accessibility and recovery acceptance before the client's release.

The code passes local build/type checks, 34 unit/integration tests (one real external PostgreSQL concurrency test skipped), and the integrated web/API/database smoke test. Both Vercel configuration files validate against https://openapi.vercel.sh/vercel.json . Local smoke testing does not certify Vercel Services routing, live database availability, cron execution or external provider success.
