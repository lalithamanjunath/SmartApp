# REST API reference

Base URL: `<api-origin>/api/v1`. JSON responses use `{ "success": true, "data": { ... } }`; errors use `{ "success": false, "message": "...", "errors"?: ... }`. Authenticated browser calls use the `tandem_session` HTTP-only cookie and credentialed CORS. Requests and responses use JSON unless otherwise noted.

## Authentication and health

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | 200 readiness response plus connected/disconnected database state |
| `POST /api/v1/auth/register` | Public, rate-limited | Create a member account and sign in. Body: `{name,email,password}`. Unknown fields, including `role`, are rejected. |
| `POST /api/v1/auth/login` | Public, rate-limited | Sign in. Body: `{email,password}`. Invalid credentials return the same generic message. |
| `POST /api/v1/auth/logout` | Public | Clear the session cookie, even if Atlas is unavailable. |
| `GET /api/v1/auth/me` | Signed-in | Return the current allowlisted user projection. |
| `PATCH /api/v1/users/me` | Signed-in | Update name/email. Duplicate emails return 409. |
| `PATCH /api/v1/users/me/password` | Signed-in | Change password. Body: `{currentPassword,newPassword}`; verifies the current hash, re-hashes the new password. |

Registration expects a trimmed name of 2–100 characters, valid email up to 254 characters and an 8–128 character password. All protected requests re-check the database user and active status. Deactivated accounts receive 401. Admin-only requests by a normal member receive 403.

## Slots

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /api/v1/slots?from=YYYY-MM-DD&to=YYYY-MM-DD` | Public | List genuinely available future slots in an inclusive date range, sorted by date/time. `from`/`to` may be omitted. |
| `GET /api/v1/slots/:id` | Public | Read a slot record by ObjectId. |

## Member bookings

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/v1/bookings` | Signed-in | Create a booking. Body: `{slotId,idempotencyKey?}`. The API re-checks availability, date and time; returns a unique booking reference. |
| `GET /api/v1/bookings/my` | Signed-in | List the current member's bookings, newest first. Optional `status` filter: `confirmed`, `cancelled`, `completed`, `no-show`. |
| `GET /api/v1/bookings/:id` | Owner | Read a member-owned booking; another member receives 404. |
| `PATCH /api/v1/bookings/:id/cancel` | Owner | Cancel an eligible confirmed appointment and release its slot transactionally. Repeated cancellation is idempotent. |

The server rejects unavailable/claimed slots with 409 and past appointment starts with 400. By default, cancellation is allowed only at least 24 hours before start (`CANCELLATION_CUTOFF_HOURS`).

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
| `GET /api/v1/admin/dashboard` | Admin | Counts and recent bookings for the dashboard. |
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

## Status codes and safety

- `200` successful read/update/logout/cancel; `201` registration, slot or booking creation.
- `400` invalid input or past/invalid date/time; `401` missing/invalid session or bad credentials; `403` wrong role; `404` unknown/not-owned record; `409` duplicate/conflicting/unavailable state; `429` auth rate limit; `503` missing/unavailable MongoDB or invalid JWT configuration.
- IDs are MongoDB ObjectId strings. Dates are ISO `YYYY-MM-DD`; appointment times are 24-hour `HH:mm` values interpreted in UTC. API timestamps use MongoDB/JavaScript dates. All slot/booking ownership, status transitions, cancellation cutoffs and admin authorization are checked by the backend.
- The API never returns password hashes, session JWTs, signing secrets, database credentials or private environment values.
