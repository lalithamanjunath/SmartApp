# Tandem — Smart Appointment Platform

Tandem is a full-stack appointment scheduling platform with separate member and administrator workspaces. Members browse server-confirmed availability, book appointments with unique references, manage their profile, and review or cancel eligible appointments. Administrators manage slots, bookings, users, cancellation history and activity analytics.

## Technology

- **Frontend:** React 18, Vite 6, JavaScript, Tailwind CSS, React Router DOM, Axios, Lucide React, React Hot Toast and Recharts.
- **Backend:** Node.js 22, Express 4, REST, Mongoose, MongoDB Atlas, JWT and bcrypt.
- **Deployment preparation:** Vercel static SPA and Render Node web service. No live deployment is claimed by this repository.

## Project structure

```text
client/                    React/Vite SPA
  public/manus-routes.json Page-route manifest
  public/brand-mark.svg     Site favicon
  src/components/          Shared UI, status, card and state components
  src/context/             Cookie-backed authentication state
  src/layouts/             Public, member and admin application shells
  src/pages/               Public, member and administrator pages
  src/routes/              Protected role-aware route guard
  src/services/            Axios API client
server/                    Express/Mongoose REST service
  scripts/createAdmin.js   Interactive, password-hidden first-admin initializer
  src/config/              Environment and Atlas connection/index initialization
  src/controllers/         Request/response handlers
  src/middleware/          Auth, role, database and validation/error middleware
  src/models/              User, Slot, Booking and UTC-day lock schemas/indexes
  src/routes/              Versioned auth, slots, bookings, user and admin routes
  src/services/            Slot schedule-lock, slot and booking rules
  src/utils/               Errors, safe serialization and UTC date helpers
  test/platform.test.js    In-memory replica-set integration tests
docs/                       Architecture, data model, API reference and verification report
vercel.json                 Vercel SPA build and route fallback
render.yaml                 Render API deployment blueprint
```

## Requirements and local setup

Use Node.js 22 and pnpm 11.25 (the workspace pins pnpm). From the repository root:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit the ignored `.env` and provide a MongoDB Atlas URI and a cryptographically random `JWT_SECRET` with at least 32 characters. Do not commit or share `.env`. The server loads this root file whether it is started from the workspace root or the `server/` package.

For local HTTP, the example uses `COOKIE_SAME_SITE=lax` and `COOKIE_SECURE=false`. The managed HTTPS Preview and cross-origin production deployment instead need `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`; do not use the local cookie settings in HTTPS Preview. Browser privacy settings can restrict third-party cookies in embedded Preview contexts.

Start the REST API and Vite client together:

```bash
pnpm dev
```

- Vite client: `http://localhost:3000`
- Express API: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

The client proxies `/api` to the local Express service. For local use, leave `VITE_API_BASE_URL` empty; do not hardcode a production API URL in source.

## MongoDB Atlas

1. Create an Atlas deployment and database user with least-privilege access to the selected application database.
2. Allow network access from the environment that runs the backend. Prefer a restricted deployment IP policy over a public allow-all rule.
3. Copy the Atlas connection URI into `MONGODB_URI`. URL-encode any special characters in the database username or password.
4. Choose the database name in the URI. The application creates its collections and required indexes when the connection is initialized. Use a dedicated development database for Preview/testing and a separate production database when appropriate.
5. Atlas deployments support replica-set transactions. A standalone local `mongod` does not provide the same transaction guarantee.

The project can be used without an Atlas URI for the public landing page and health check, but authentication and durable application features deliberately return a clear service-unavailable error until `MONGODB_URI` and `JWT_SECRET` are configured. No fake login or in-memory production fallback is used.

## Initial administrator

Public registration always creates a `user` role. To create the first administrator, run the interactive initializer in a terminal attached to an environment whose `MONGODB_URI` is configured:

```bash
pnpm admin:create
```

Enter the administrator's name, email and a strong password. Password input is hidden. The account is stored with a bcrypt hash. For a deployed Render service, use an authorized Render shell with its server environment loaded; do not create an administrator by changing a browser request or registering through the public form.

## Tests and build

```bash
pnpm test
pnpm build
```

The API integration suite starts an isolated one-node in-memory MongoDB replica set and shuts it down after use. It does not connect to or write to the configured Atlas database. It exercises member-only registration, password hashing/login/logout, authentication and admin-role isolation, Helmet headers, slot create/update/unavailable/delete and overlap rules, parallel overlapping and non-overlapping admin slot writes, immutable canceled-booking history, day-lock and booking indexes, past same-day availability filtering, concurrent booking attempts, booking idempotency/ownership, admin booking/user filters and details, profile/password changes, account activation/deactivation, completion/no-show transitions, the cancellation cutoff and slot release. A successful suite is not a substitute for valid Atlas credentials and checking the target environment. See [`docs/testing-report.md`](docs/testing-report.md) for the current verification results and limitations.

## Vercel frontend

The root `vercel.json` configures install/build/output commands (`client/dist`) and a single-page-app fallback for nested React routes. Import the repository into Vercel with the repository root as the project root. Configure:

```text
VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api/v1
```

Set this value in Vercel's build environment before each build. `VITE_` variables are public and must never contain secrets. The frontend is hosted on Vercel; do not set the Express service's private keys in Vercel.

## Render backend

`render.yaml` describes the Node service. Create the service from the repository root with:

- **Build:** `corepack enable && pnpm install --frozen-lockfile`
- **Start:** `pnpm --filter @tandem/server start`
- **Health path:** `/api/health`
- **Environment:** `NODE_ENV=production`, `MONGODB_URI`, a strong private `JWT_SECRET`, `CLIENT_ORIGIN` (the exact Vercel HTTPS origin, or a comma-separated allowlist), `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, and optionally `JWT_EXPIRES_IN=8h` and `CANCELLATION_CUTOFF_HOURS=24`.

Render supplies `PORT`. Do not add wildcard credentialed CORS origins. After the Vercel origin is known, set it in Render's `CLIENT_ORIGIN`; the browser API base and the backend CORS allowlist must agree. Both services must be HTTPS for Secure cookies.

For managed Preview, the project uses protected `MONGODB_URI` and `JWT_SECRET` values. Keep separate development and production secrets/data stores where possible; the platform's protected secret input stores credentials without putting them in the repository or chat.

## Time and cancellation rules

Appointment dates are stored as ISO `YYYY-MM-DD`, times as 24-hour `HH:mm` UTC values, and API date ranges as ISO calendar dates. Server-side checks interpret times as UTC. Confirm the operating timezone with administrators before creating real slots. By default, cancellation must be requested at least 24 hours before the slot start; `CANCELLATION_CUTOFF_HOURS` controls this policy. A successful cancellation and slot release happen inside one MongoDB transaction.

## Security and operational notes

- `tandem_session` is an HTTP-only, signed JWT cookie. The Secure/SameSite policy is configured independently of `NODE_ENV` so HTTPS Preview is not inferred from the internal proxy request.
- Login and registration are rate-limited; passwords use bcrypt; protected routes reload active users from MongoDB; all admin APIs enforce the role server-side.
- Responses serialize only an allowlisted set of user fields. Database credentials and JWT keys are read only from environment variables.
- Slot availability is authoritative on the backend. MongoDB transactions, conditional state changes, unique booking references, an idempotency index and a partial unique index prevent conflicting active slot bookings. Cancellation releases the slot atomically.
- Administrator schedule writes are serialized by unique UTC-day lock documents before overlap checks; parallel overlapping slot creates cannot both succeed. A slot referenced by booking history cannot have its date/time changed or be deleted; its availability may still be changed when no active booking exists.
- Completed/no-show status changes are only permitted after a booking's scheduled end time. Active booked slots cannot be edited/deleted in a way that invalidates their booking.
- Review `docs/architecture.md`, `docs/database-design.md` and `docs/api-documentation.md` before operational changes.
