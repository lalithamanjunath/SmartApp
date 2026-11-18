# REST API reference

Base URL: `<api-origin>/api/v1`. JSON responses use `{ "success": true, "data": { ... } }`; errors use `{ "success": false, "message": "...", "errors"?: ... }`. Authenticated browser calls use the `tandem_session` HTTP-only cookie and credentialed CORS. Requests and responses use JSON unless otherwise noted.

## Authentication and health

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | 200 readiness response plus connected/disconnected database state |
| `POST /api/v1/auth/register` | Public, rate-limited | Create a member account and sign in. Body: `{name,email,password}`. Unknown fields, including `role`, are rejected. |
| `POST /api/v1/auth/login` | Public, rate-limited | Sign in. Body: `{email,password}`. Invalid credentials return the same generic message. |
| `GET /api/v1/auth/csrf` | Public | Issue/read the signed double-submit CSRF token cookie and return its value for the browser API client. |
| `POST /api/v1/auth/forgot-password` | Public, rate-limited | Body: `{email}`. Returns the same `202` response for known/unknown active emails and queues a time-limited reset email when configured. |
| `POST /api/v1/auth/reset-password` | Public, rate-limited | Body: `{token,password}`. Consumes a single-use token that expires after 30 minutes and invalidates existing sessions. |
| `POST /api/v1/auth/logout` | Public | Clear the session cookie, even if Atlas is unavailable. |
| `GET /api/v1/auth/me` | Signed-in | Return the current allowlisted user projection. |
| `PATCH /api/v1/users/me` | Signed-in | Update name/email. Duplicate emails return 409. |
| `PATCH /api/v1/users/me/password` | Signed-in | Change password. Body: `{currentPassword,newPassword}`; verifies the current hash, re-hashes the new password. |

## Notifications

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/notifications?page=1&limit=20` | Signed-in | Return the current member's notifications, unread count and pagination. Limit is 1–50. |
| `GET /api/v1/notifications/unread-count` | Signed-in | Return the current member's unread notification count. |
| `PATCH /api/v1/notifications/:id/read` | Owner | Mark one owned notification as read. |
| `PATCH /api/v1/notifications/read-all` | Signed-in | Mark all of the current member's notifications as read. |
| `DELETE /api/v1/notifications/:id` | Owner | Delete one owned notification. |

Booking confirmations and eligible cancellations are stored in the same MongoDB transaction as their booking state changes. A MongoDB-backed worker derives 24-hour and 1-hour reminders from confirmed bookings and booked slots once a minute; unique event keys make retries and multiple worker instances idempotent. No Redis service or in-memory appointment timer is required.

Cookie-authenticated state-changing browser requests with an `Origin` header must include the CSRF cookie value in `X-CSRF-Token`. The returned token is HMAC-signed and compared in constant time. The browser API client obtains the token automatically. Non-browser bearer-token clients are not subject to this cookie CSRF check.

Password reset tokens are returned only inside an email link fragment, stored on the user as a SHA-256 hash, and atomically cleared on use. Reset requests are rate limited; account existence is not disclosed in the normal response. Configure the Resend email variables in the backend environment to enable reset delivery.

Registration expects a trimmed name of 2–100 characters, valid email up to 254 characters and a 12–128 character password containing a letter and number. Passwords are limited to 72 UTF-8 bytes to match bcrypt's effective input limit. Existing shorter passwords may still be used to sign in, but new and changed passwords must meet this rule. All protected requests re-check the database user and active status. Deactivated accounts receive 401. Admin-only requests by a normal member receive 403.

## Slots

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/slots?from=YYYY-MM-DD&to=YYYY-MM-DD` | Public | List genuinely available future slots in an inclusive date range, sorted by date/time. `from`/`to` may be omitted. |
| `GET /api/v1/slots/:id` | Public | Read a slot record by ObjectId. |

## Member bookings

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/v1/bookings` | Signed-in | Create a booking. Body: `{slotId,idempotencyKey?}`. The API re-checks availability, date and time; returns a unique booking reference. |
| `GET /api/v1/bookings/my?page=1&limit=20&status=confirmed` | Signed-in | List the current member's bookings, newest first. Supplying `page` or `limit` returns pagination metadata; limit is 1–100. `status` may be `confirmed`, `cancelled` or `completed` (`completed` includes `no-show`). Omitting page/limit retains the unpaged response for existing clients. |
| `GET /api/v1/bookings/:id` | Owner | Read a member-owned booking; another member receives 404. |
| `PATCH /api/v1/bookings/:id/cancel` | Owner | Cancel an eligible confirmed appointment and release its slot transactionally. Repeated cancellation is idempotent. |
| `PATCH /api/v1/bookings/:id/reschedule` | Owner | Body: `{slotId,idempotencyKey}`. Revalidates current availability and the existing 24-hour cutoff; atomically secures the new slot, saves prior slot details to history, then releases the old slot. |

The server rejects unavailable/claimed slots with 409 and past appointment starts with 400. By default, cancellation is allowed only at least 24 hours before start (`CANCELLATION_CUTOFF_HOURS`).
Rescheduling uses the same cutoff. Historical slot date/time values remain immutable, including after a reschedule.

## Administrator slots

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/admin/slots?status=&from=&to=` | Admin | List scheduled slots, optionally filtered by status/date; each slot indicates whether booking history references it. |
| `POST /api/v1/admin/slots` | Admin | Create `{date,startTime,endTime,status?}`. Date/time are UTC; `status` is `available` or `unavailable`. A UTC-day lock and transaction serialize overlap checks, including concurrent admin creates. |
| `PUT /api/v1/admin/slots/:id` | Admin | Update full slot fields; overlapping times and changes that invalidate active bookings return 409. Once referenced by any booking history, date/time fields are immutable; availability alone may be changed if no active booking exists. |
| `DELETE /api/v1/admin/slots/:id` | Admin | Delete only a slot never referenced by a booking; active or historical references return 409. Day-lock transactions protect concurrent schedule writes. |

## Administrator bookings and analytics

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/admin/dashboard` | Admin | Counts, recent bookings, 7-day daily series and 8-week weekly series for one dashboard request. |
| `GET /api/v1/admin/analytics` | Admin | Daily 30-day and ISO-week 8-week booking/cancellation series. |
| `GET /api/v1/admin/bookings?q=&date=&status=&page=1&limit=20` | Admin | Search reference; filter by slot date and status; returns records and pagination metadata. `limit` is 1–100. |
| `GET /api/v1/admin/bookings/:id` | Admin | Read a booking with associated member and slot information, including cancellation timestamp. |
| `PATCH /api/v1/admin/bookings/:id/status` | Admin | Body `{status:"completed"}` or `{status:"no-show"}`. Only confirmed records after their scheduled end may transition. |

## Administrator members

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/admin/users?q=&page=1&limit=25` | Admin | Search by name/email; allowlisted fields and booking counts only. |
| `GET /api/v1/admin/users/:id` | Admin | Read an allowlisted user record and up to 50 recent bookings. |
| `PATCH /api/v1/admin/users/:id/status` | Admin | Body `{isActive:boolean}`. Prevents deactivating the current admin; inactive accounts are blocked by auth middleware. |

## Email delivery

The API queues appointment confirmations, cancellations, reschedules, reminders, reset links, and password-change notices in MongoDB when email delivery is configured. Delivery is asynchronous; the in-app notification is committed independently and remains available if Resend is unavailable. The webhook endpoint requires the raw JSON request and a valid Svix signature:

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/webhooks/resend` | Resend webhook signature | Track provider delivery events. Configure this exact backend URL in Resend and subscribe to sent, delivered, delayed, failed, bounced, complained and suppressed events. |

Set backend-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` and `EMAIL_ENCRYPTION_KEY` to enable the email worker. The encryption key must be canonical base64 for exactly 32 bytes; the webhook secret is normally `whsec_` plus base64 key bytes. `CLIENT_APP_URL` is additionally required for password-reset links, but not for appointment email delivery. Startup warnings report missing or invalid variable names only, never values. Never configure the provider key or encryption key in Vercel `VITE_` variables. Email delivery records are internal and are not exposed through a member API.

## Status codes and safety

- `200` successful read/update/logout/cancel; `201` registration, slot or booking creation; `202` accepted password-reset request.
- `400` invalid input, expired/used token or past/invalid date/time; `401` missing/invalid session or bad credentials; `403` wrong role, failed CSRF check or CORS origin not in the allowlist; `404` unknown/not-owned record; `409` duplicate/conflicting/unavailable state; `429` authentication/reset rate limit; `503` missing/unavailable MongoDB or required service configuration.
- IDs are MongoDB ObjectId strings. Dates are ISO `YYYY-MM-DD`; appointment times are 24-hour `HH:mm` values interpreted in UTC. API timestamps use MongoDB/JavaScript dates. All slot/booking ownership, status transitions, cancellation cutoffs and admin authorization are checked by the backend.
- The API never returns password hashes, session JWTs, signing secrets, database credentials or private environment values.
