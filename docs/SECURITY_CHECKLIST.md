# Security and release checklist

Implemented and exercised locally:
- [x] Authoritative integer pricing, role/ownership guards, strict validated DTOs, no frontend-supplied amounts.
- [x] PostgreSQL overlap exclusion, row locks, idempotency-key/body binding and UTC reservation storage.
- [x] Raw-body Razorpay HMAC, callback HMAC, capture fetch, amount/order/currency binding and deduplicated processing.
- [x] Late capture reconciliation instead of stealing another customer's slot.
- [x] Local session token hashes; HttpOnly SameSite cookies, secure flag in production, logout and role-change revocation.
- [x] Origin validation for cookie-authenticated writes, no-store API responses and CORS origin allowlist.
- [x] Cognito challenge expiry/attempts and durable phone/IP request rate buckets; no authentication bypass.
- [x] Random, separately salted HMAC session codes, single-use semantics, attempt persistence, assigned staff checks and audited exceptions.
- [x] Quarantined image uploads, size/byte-format/dimension validation, metadata stripping and image re-encoding code.

Required release verification:
- [ ] Real Cognito registration/login/recovery, signup resend, SMS delivery and abuse tests.
- [ ] Administrator MFA and reviewed account recovery/phone-change policy.
- [ ] Multi-process PostgreSQL concurrency/load/connection-failure/failover tests.
- [ ] Razorpay real test checkout, webhook delivery/retries, network interruption and provider refund acceptance.
- [ ] S3/CloudFront policy, presign size enforcement and blocked private-file paths verified in the account.
- [ ] SES sender/production setup, outbox retries/monitoring and worker schedule.
- [ ] Cross-browser WCAG 2.2 AA audit, keyboard, screen reader, zoom, contrast and mobile checks.
- [ ] Dependency audit, SBOM, container scan and provider schema validation recorded for final immutable images.
- [ ] CSP/HSTS, reverse-proxy trust/IP forwarding and distributed non-auth throttling reviewed for actual topology.
- [ ] Redaction/retention/deletion policies, encryption, least-privilege SQL user, KMS scope and restore drill.
- [ ] Approved legal policies, taxes, brand/media rights and business contact details.

Known boundaries: global Nest throttling is per-process; phone/IP OTP request limits are durable PostgreSQL buckets. Session verification uses booking-scoped limits. Financial dashboard revenue is gross captured value, not net settlement. All admin operational lists are bounded; several need full pagination and export for larger volumes. This checklist is not a penetration-test certificate.
