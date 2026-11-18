# Architecture

## System boundaries

Tandem is a React single-page client and a separate Express REST service. The client is static and deploys to Vercel; the API deploys to Render; MongoDB Atlas stores durable accounts, appointment slots and booking history. The browser never connects directly to MongoDB and never receives a JWT signing key or Atlas URI.

```text
Browser
  ├── Vercel SPA (React/Vite)
  │     └── Axios with credentials → Render API /api/v1
  └── HTTP-only tandem_session cookie
                         │
                 Express API + Mongoose
                    ┌────┴────┐
                    │         └── MongoDB email outbox worker → Resend
                    └── MongoDB Atlas
                                ↑
                      signed Resend webhook
```

During local development Vite serves port 3000 and proxies `/api/*` to Express on port 4000. Preview uses the project-configured Vite runtime port. Production uses `VITE_API_BASE_URL`, credentialed CORS and an explicit `CLIENT_ORIGIN` allowlist.

## Client modules

- `src/context/AuthContext.jsx` restores the signed-in member through `GET /auth/me`, then holds only the public user projection in memory.
- `src/services/api.js` centralizes the API base URL, credentialed cookies, timeout and safe user-facing error extraction.
- `src/routes/ProtectedRoute.jsx` handles pending authentication, sign-in redirects and role-aware workspace redirection.
- `src/layouts/` separates the public website from the member and admin shells. The admin navigation is distinct and is not an authorization boundary by itself.
- `src/pages/` binds booking, profile, user history, slot administration, analytics and account recovery to the corresponding backend APIs. The administrator chart module is separately lazy-loaded and deferred until near the viewport. All business-critical availability and permission decisions are repeated on the server.
- Shared components provide status, loading/error/empty states, page headings, metric cards, booking cards and dialogs.

## Server modules

`server/src/app.js` assembles Helmet, credentialed CORS, the raw-body Resend webhook before JSON parsing, health/API routes, 404 handling and safe centralized errors. `server/src/server.js` starts Express and, after Atlas connects, starts the reminder scheduler and configured email worker. Routes delegate to controllers; Zod validates public request shapes; auth middleware verifies HS256 tokens and reloads active users; role middleware enforces admin-only APIs; services own slot and booking invariants. Authenticated members can read and manage their own in-app notifications. MongoDB-backed workers make reminder generation and pending email delivery recoverable after process restarts.

In production, the API logs request method, route template, response status and duration without query strings or credentials. Responses over one second are marked as slow and 5xx responses as errors. Database-query-level timings and production latency baselines are not currently available.

`requireDatabase` fails closed when Atlas is not configured or unavailable. The landing page and `/api/health` can load without credentials, but persistence-dependent routes return `503` rather than simulating successful operations. The database connector explicitly creates required model indexes after the connection succeeds.

## Authentication and access

Registration accepts only name, email and password, rejects unknown fields such as `role`, and always inserts a `user` role. Admin accounts are created only by the protected interactive CLI. Login signs an eight-hour-by-default HS256 JWT in the `tandem_session` HTTP-only cookie. Its `av` claim is checked against the user's `authVersion`; password changes, password resets and account deactivation invalidate prior sessions. Cookies use explicit `SameSite`/`Secure` environment settings; public HTTPS Preview must use `SameSite=None; Secure`, while local plain HTTP can use Lax/false. State-changing cookie-authenticated requests with an Origin require the matching signed double-submit CSRF cookie/header. Third-party-cookie blocking in a browser remains an external constraint.

Password reset uses 256-bit random tokens, stores only a SHA-256 token hash and expires after 30 minutes. The token is placed in the URL fragment so normal HTTP requests and referrers do not transmit it. One transaction consumes the token, changes the bcrypt password and increments `authVersion`.

Every protected request verifies the token, loads the current user and rejects inactive accounts. Admin routes then enforce `role=admin`. The serializer exposes only `id`, `name`, `email`, `role`, `isActive` and `createdAt`; password hashes and tokens are never returned in JSON.

## Booking integrity flow

1. Public slot browsing reads `status=available`, limits the query to the requested/current-or-later UTC calendar-date range, and filters out UTC start times at or before now, including elapsed times earlier today.
2. The member submits a slot ID and optional idempotency key. The server re-loads the slot, checks that it is available and starts in the future, and begins a MongoDB transaction.
3. The transaction conditionally changes only an available slot to `booked`, then inserts a confirmed booking with a cryptographically random reference. If booking creation fails, the transaction rolls back the claim.
4. A partial unique index permits at most one `confirmed` booking per slot. A separate unique `(userId, idempotencyKey)` index protects retryable requests. Exact duplicate slots are rejected by a unique `(date,startTime)` index. Admin slot creates and schedule edits lock the UTC-day document inside a transaction before checking for interval overlap.
5. Eligible cancellation changes the booking to `cancelled`, records `cancelledAt`, and releases the slot in the same transaction. Transactions are required for the strongest consistency guarantees and are supported by Atlas replica sets.
6. Admin completion/no-show changes are allowed only after the scheduled end time. Cancellation history is retained; booking records are not erased by cancellation. A slot referenced by a booking keeps its original date/time and cannot be deleted; an administrator may still change its availability when there is no active booking.
7. Member rescheduling checks ownership, confirmed status, the existing cancellation cutoff and target availability. It claims the target slot, updates the booking with an immutable snapshot of the old slot, then releases the old slot in one transaction. A request hash makes retries idempotent.

## Email outbox

When Resend, webhook, encryption-key and client-URL configuration is present, application events enqueue encrypted email payloads in the same booking/reset transaction where applicable. A persistent worker leases jobs, retries transient provider failures with bounded backoff, and uses Resend's idempotency key. Retrying stops before the provider's idempotency window expires, avoiding a delayed duplicate after a prolonged outage. The webhook verifies Svix signatures against the raw request body and records provider delivery state. In-app notifications do not depend on email delivery. Without configuration, email is disabled with a non-secret startup warning.

## Admin schedule-write serialization

`SlotScheduleLock` contains one uniquely indexed `{date}` document per UTC calendar day. Within a MongoDB transaction, every administrator create/update/delete increments the lock for its affected date or sorted set of dates, then checks and mutates slots. Concurrent writes for the same day therefore serialize before interval overlap validation. Duplicate-key races on first creation are retried against the now-existing lock. A write that overlaps a concurrently committed slot returns `409`; a non-overlapping write retries and can succeed. Times of any slot referenced by a booking are immutable, preserving member/admin history even after cancellation.

## Time convention

Dates use `YYYY-MM-DD`; times use 24-hour `HH:mm`. Slot start/end and cutoff comparisons interpret these values in UTC. Admins must create appointments using that documented convention. A business-local timezone and daylight-saving policy are an operational choice that should be agreed before importing schedules.

## Operational separation

- `.env` is local-only and ignored. `.env.example` contains names and placeholder values only.
- Manus protected project secrets configure Preview; Vercel public build variables contain only the API origin; Render stores API secrets and the allowed frontend origin.
- Integration tests use an isolated in-memory replica set and do not use the configured Atlas URI.
- Resend API, webhook and encryption credentials are backend-only; the email payload is encrypted at rest in MongoDB because password reset links contain bearer tokens.
- New authentication/reset fields, booking history, email-outbox collection and indexes are additive; startup creates indexes but does not drop existing indexes or rewrite existing bookings.
- `render.yaml` and `vercel.json` are deployment preparation; repository configuration does not mean a service was actually deployed.
