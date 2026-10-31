# AWS deployment preparation

Status: configuration supplied, not applied. No paid infrastructure or live processing is authorized by this delivery. Terraform source was syntax-parsed; provider validation, planning, account-level controls and deployment are still required. Never run `terraform apply` without the client's explicit infrastructure/cost approval.

## Architecture
An HTTPS Application Load Balancer routes to Next.js on port 3000. The Next API proxy routes only to NestJS at loopback port 4000 within the same ECS task. Two Fargate tasks share private RDS PostgreSQL. Media is stored privately in S3; CloudFront OAC may access only the public studio-asset prefix. Quarantine and any future customer-private objects are outside that scope. Cognito provides passwordless identity; Secrets Manager provides application secrets; CloudWatch provides structured logs and 5xx alarms. An SNS subscription requires the recipient's confirmation. A budget notification is an alert, not a spend cap.

`infra/main.tf` assumes an existing VPC, two private subnets, public ALB subnets, NAT or equivalent outbound endpoints, an ACM certificate in the load-balancer region, verified SES identity, Cognito user pool/client, ECR images and an application Secrets Manager secret ARN. Supplying a subnet without working outbound access will prevent image pulls and provider calls. The template intentionally does not create these account-specific prerequisites or DNS records automatically.

## Prepare images
```sh
docker build -f infra/Dockerfile --target api -t studio-api:review .
docker build -f infra/Dockerfile --target web -t studio-web:review .
```
The Dockerfiles prioritize reproducibility and retain build dependencies. Review image size, SBOM, CVEs and runtime hardening before a release; then trim dependencies into dedicated runtime stages. Test immutable image digests, not mutable tags. Never bake production secrets into images.

Next.js configuration such as public origin, remote image host and proxy rules may be captured during build. Supply NEXT_PUBLIC_SITE_URL, API_INTERNAL_URL and MEDIA_CDN_URL while building, and rebuild when they change. API_INTERNAL_URL remains loopback within the two-container ECS task. A separate frontend hosting provider needs a different private network and proxy configuration.

## Database and migration
1. Provision approved encrypted RDS with backups and deletion protection.
2. Create a least-privileged application database user and a separate migration role; do not use the master user at runtime. Store the application DATABASE_URL with TLS verification in the app secret.
3. Run `prisma migrate deploy` as a one-off ECS task on private subnets using the migration role. Enable btree_gist. Test the exclusion constraint. Do not let each application replica independently run migrations on startup.
4. Import client-approved catalogue and settings. Production seeding is deliberately disabled.
5. Keep the migration artifact with the image release. Prefer additive migrations; take a recovery point before irreversible data work.

## Secrets and identity
The application secret JSON must contain DATABASE_URL, OTP_PEPPER, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET. The included task uses a Cognito app client without a secret. If an app-client secret is enabled, add COGNITO_CLIENT_SECRET to the task's secret references. If the secret uses a customer KMS key, scope kms:Decrypt for the execution role; the template currently assumes the Secrets Manager managed key.

Configure Cognito Essentials/Plus, phone-number sign-in, signup phone verification, SMS_OTP allowed first factor and ALLOW_USER_AUTH. Confirm Indian SMS delivery, spending limits, production access and DLT sender/template compliance in the specific account. An approved third-party Indian SMS provider requires a deployed Cognito Custom SMS Sender Lambda with narrowly scoped KMS decryption; its provider-specific delivery adapter is not included. Do not enable a fixed code or unauthenticated test login to work around missing setup.

The local session expires after one hour. Logout and role changes revoke it. Refresh-token rotation, long-lived mobile sessions, lost-number recovery and administrator phishing-resistant MFA require follow-up identity work before broad production access.

## Storage
250 GB is a planning target, not a preallocated S3 disk. Monitor bytes, request counts, egress, versions, backups and video transcoding separately. CloudFront origin path must be `/public`; its bucket policy grants only `/public/*`. Never move private customer media under that prefix. Set the exact frontend CORS origin for presigned PUT. Configure the CloudFront host in the web image's image allowlist.

Large video streaming/transcoding, signed private video playback and customer deliverable uploads require a separate design. Public portfolio videos may use optimized provided renditions; do not upload full-resolution masters into a page.

## Worker, monitoring and release
Schedule `node scripts/worker.mjs` every minute as a separate ECS task using the API image, same environment, private network and task role; override its default command. SES_FROM_EMAIL must be supplied to that worker. The provided Terraform does not yet create the EventBridge schedule or worker task. Notification dispatch is at least once; review duplicate delivery behavior. Alert on pending outbox age, reconciliation-required captures, refund failures, expired-hold cleanup, failed logins, error rate, DB storage and connection count.

Before deployment run `terraform init -backend=false`, `terraform fmt -check`, `terraform validate`, then an account-authenticated plan reviewed by the operator. Use encrypted remote state with locking for real environments; configure state separately, never commit it. Validate provider schemas and tune resources from load testing. The initial RDS/Fargate sizes in this template are review defaults, not a capacity guarantee or quoted price.

After approval deploy to staging, execute docs/ACCEPTANCE_TESTS.md, verify HTTPS, cookie flags and origin checks through the actual ALB. Configure HSTS only after verifying the final domain and TLS. Add a restrictive CSP compatible with the actual Razorpay checkout, then validate it in report-only mode before enforcing. Conduct backup restore and release rollback drills. Live Razorpay is intentionally rejected by code; changing that requires a separate reviewed release and explicit authorization.

## Dependency overrides
The lockfile uses patched multer, js-yaml, effect and deepmerge-ts overrides, plus sharp 0.35.5. Exact upstream Nest pins may appear as invalid under npm ls even though they are intentional overrides. Clean npm ci, Prisma generation, build and tests succeeded. Review these with the release engineer and move to patched upstream-compatible releases when available.
