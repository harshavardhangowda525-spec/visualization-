# REST API v1

Base: `/api/v1`. JSON request/response bodies; all money is integer INR paise, dates are ISO UTC. Errors include statusCode, message and requestId. Authentication uses HttpOnly cookie `studio_session`; a bearer session token is accepted by the same guard. Role checks are enforced in the API, irrespective of frontend navigation.

Interactive OpenAPI is generated from actual controllers at `/api/docs` in non-production. It documents routes; DTO property examples and full response schemas still need enrichment. OpenAPI is not exposed publicly in production. Class-validator strips no unexpected fields silently: forbidden fields return 400.

| Route | Access | Behavior |
|---|---|---|
| POST /auth/otp/request | Public, rate limited | `{phone:"+91…",register:boolean}` → challengeId |
| POST /auth/otp/verify | Public, attempts limited | `{challengeId,code}` → session cookie or needsLogin after signup confirmation |
| POST /auth/logout | Signed in | Revoke local session |
| GET /auth/me | Signed in | Sanitized account |
| GET /settings, /categories, /reviews | Public | Approved business content only |
| GET /studios | Public | category, location, capacity, maxPrice(paise), facility, page; 12 per page |
| GET /studios/:slug-or-id | Public | Studio, active services, gallery, facilities and opening hours |
| GET /studios/:uuid/availability | Public | date YYYY-MM-DD, serviceId, minutes → UTC slots and business timezone |
| POST /bookings/hold | Signed in | studioId, serviceId, startsAt, minutes, idempotencyKey, optional membershipId |
| GET /bookings | Owner | Most recent 100 bookings |
| GET /bookings/:uuid | Owner, admin or assigned staff | Booking details |
| POST /bookings/:uuid/cancel | Owner or admin | reason; policy snapshot decides refund eligibility |
| POST /bookings/:uuid/reschedule | Owner or admin | startsAt; same duration/pricing, operating-hours and conflict checks |
| POST /payments/create-order | Owner | `{id:bookingUUID}` → Razorpay order or free-credit confirmation |
| POST /payments/verify | Owner | Standard razorpay_order_id, razorpay_payment_id, razorpay_signature |
| POST /payments/webhook | Razorpay HMAC | Raw body and x-razorpay-signature, x-razorpay-event-id |
| GET /payments | Owner | Payment history |
| GET /memberships | Public | Active prepaid plans |
| GET /memberships/mine | Owner | Membership history and remaining benefits |
| POST /memberships/subscribe | Owner | planId + idempotencyKey → test payment order |
| POST /memberships/:uuid/cancel | Owner | Cancels future benefit use; no automatic refund |
| PATCH /users/me | Owner | name, optional email |
| GET /users/notifications | Owner | In-app notifications |
| POST /users/reviews | Completed booking owner | bookingId, rating 1–5, text → moderation queue |
| GET /staff/bookings | Staff | Assigned bookings only |
| POST /session-verification/code | Booking owner | bookingId, purpose START or END → private code, expiry |
| POST /session-verification/verify | Assigned staff | bookingId, purpose, code → audited state transition |
| GET /admin/dashboard, /analytics, /revenue | Admin | Aggregates and daily captured payment revenue |
| GET /admin/bookings, /customers, /staff | Admin | Bounded operational lists |
| POST /admin/assign | Admin | bookingId, staffId |
| POST /admin/bookings/:uuid/exception | Admin | status IN_PROGRESS/COMPLETED + detailed reason |
| GET/POST /admin/studios | Admin | Studio management |
| PATCH /admin/studios/:uuid | Admin | Validated complete editable studio metadata |
| POST/DELETE /admin/studios/:uuid/hours[/weekday] | Admin | Opening hours/closed days |
| POST /admin/services | Admin | Validated service configuration |
| PATCH /admin/services/:uuid/price | Admin | hourlyPaise, taxBps, price history and audit |
| POST /admin/blocks | Admin | studioId, startsAt, endsAt, reason |
| DELETE /admin/blocks/:uuid | Admin | Release a blocked reservation |
| GET/POST/PATCH /admin/plans[/:uuid] | Admin | Configurable prepaid memberships |
| GET /admin/payments, /refunds | Admin | Transaction and refund records |
| POST /admin/refunds/:uuid/process | Admin | Reconcile gateway receipt then submit refund |
| GET /admin/reviews | Admin | Moderation queue |
| POST /admin/reviews/:uuid/approve | Admin | Publish an authentic completed-booking review |
| POST /admin/staff/role | Admin | Change verified non-admin staff/customer role, revoke sessions |
| GET /admin/settings | Admin | Current configurable content |
| PATCH /admin/settings/:key | Admin | JSON string, allowlisted setting key |
| POST /admin/media/presign | Admin | Allowed image content type and size → private quarantine upload |
| POST /admin/media/publish | Admin | Quarantine key + studioId + alt → validated WebP variants |
| GET /admin/audit | Admin | Latest 200 audit events |

## State transitions
- HELD → CONFIRMED (verified captured payment, or fully covered prepaid credit)
- HELD → EXPIRED (timeout), or CANCELLED
- CONFIRMED → IN_PROGRESS (assigned staff verifies START code)
- IN_PROGRESS → COMPLETED (assigned staff verifies distinct END code)
- CONFIRMED → CANCELLED (policy-bound owner action or audited admin action)
- Administrator exception follows the same state sequence and records a reason.

Availability is polled every 15 seconds in the booking UI and revalidated during the hold transaction. Lists are bounded for the initial workload; not every operational list has full pagination yet. No public endpoint accepts a role, authoritative amount, provider credential, OTP hash or payment state.

Additional catalogue configuration: POST /admin/categories and PATCH /admin/studios/:uuid/facilities are admin-only and audited. Facilities use a validated names array.
