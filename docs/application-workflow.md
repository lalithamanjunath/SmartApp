# Application and release workflows

This guide describes how a member books an appointment, how an administrator
manages availability, and how the application moves from local development to
production. Tandem is split into a Vercel-hosted React client, an Express API,
and MongoDB Atlas. Deploying only the client does not provide a working
booking service; the API and database must also be configured.

## 1. Start the application locally

Requirements: Node.js 22 and pnpm 11.25.

1. From the repository root, install the locked dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Copy `.env.example` to `.env`. Set a valid `MONGODB_URI` and a private
   `JWT_SECRET` of at least 32 characters. Keep `.env` local; never commit or
   send it to anyone.
3. Start the client and API:

   ```sh
   pnpm dev
   ```

4. Open `http://localhost:3000`. The client sends `/api` requests through its
   development proxy to the API on port 4000.
5. Check `http://localhost:4000/api/health`. The API can start while Atlas is
   disconnected, but registration, sign-in, and persistent features require
   the health response to report the database as connected.

See the root [README](../README.md) for Atlas setup and environment details.

## 2. First-time administrator setup

Public registration always creates a member account. It cannot grant an admin
role. Create the first administrator from a terminal with the configured
database environment:

```sh
pnpm admin:create
```

The interactive initializer asks for the administrator's name, email, and
password; password entry is hidden. For a deployed API, run it only in an
authorized server shell with that service's environment loaded. Never put
administrator credentials into source code, a browser request, or a GitHub
commit.

## 3. Administrator: publish appointment availability

1. Sign in with the administrator account and open the admin workspace.
2. Go to **Slots** and choose **Add a slot**.
3. Enter a future date, start time, and end time. Dates and times are UTC.
4. Save the slot as **Available**. The server rejects invalid or past times,
   duplicate slots, and overlapping times, including concurrent edits.
5. Refresh the schedule as needed. A slot that is booked cannot be edited or
   deleted in a way that changes its appointment; historical slot times are
   preserved for booking records.

Only future slots marked `available` are offered on the member booking
calendar. If no dates have availability dots, create future available slots
or check the UTC date/time and slot status.

## 4. Member: create an account and book

1. Open **Create an account** and enter a name, email, and password. The
   password must be 12–128 characters, include a letter and a number, and use
   at most 72 UTF-8 bytes. Email is normalized to lowercase and
   must not already belong to an account.
2. Registration signs the member in. Alternatively, an existing member can
   use **Sign in** with the same email and password used at registration.
3. Choose a calendar date marked as available, select a time, review the
   details, then confirm the appointment.
4. The API checks availability again and reserves the slot transactionally.
   The confirmation includes a unique booking reference; review it in
   **Appointments**.

The current application does not send an email-verification message. A
valid-looking email address is accepted, but ownership is not verified.
Sessions use an HTTP-only cookie; the JWT is not exposed to browser
JavaScript.

If a selected slot is booked by someone else before confirmation, refresh the
calendar and select another time. A booking failure does not create a
success-shaped confirmation.

## 5. Member: manage appointments and profile

- View upcoming and past records in **Appointments** and open an appointment
  for its reference and details.
- Cancel an eligible confirmed booking from its details page. By default,
  cancellation must be at least 24 hours before the slot start; the policy is
  controlled by `CANCELLATION_CUTOFF_HOURS`.
- Cancellation and release of the slot happen together. The cancellation
  record remains in history, and its original date and time are retained.
- Update personal details in **Profile**. Changing a password requires the
  current password and a new password that meets the same 12-character strength rule.

## 6. Administrator: manage bookings and members

- **Dashboard** and **Analytics** summarize booking activity.
- **Bookings** supports searching and filtering records. An administrator may
  mark a confirmed appointment completed or no-show only after its scheduled
  end time.
- **Members** displays account details and booking history. An administrator
  can deactivate an account; inactive users cannot sign in or continue using
  protected routes.
- Admin pages are a user-interface convenience only. The API independently
  checks the signed-in user's role on every administrator endpoint.

## 7. Deploy the production application

The repository is configured for a **Vercel frontend and Render API**, with
Atlas as the production database. The steps must be completed in this order;
Vercel alone hosts only the SPA.

### MongoDB Atlas

1. Create a production database and a dedicated database user.
2. Allow network access from the API host.
3. Store the complete Atlas driver URI as the API's private `MONGODB_URI`.
   URL-encode special characters in the username or password.
4. Keep production credentials separate from local development credentials.

### Render API

1. Connect the GitHub repository to Render using the repository root and the
   settings in `render.yaml` (or the equivalent documented settings in the
   root README).
2. Configure the private API environment: `NODE_ENV=production`,
   `MONGODB_URI`, a strong private `JWT_SECRET`, the exact Vercel HTTPS origin
   in `CLIENT_ORIGIN`, `COOKIE_SAME_SITE=none`, and `COOKIE_SECURE=true`.
   Render provides `PORT`.
3. Deploy and verify the service's `/api/health` reports the database as
   connected.
4. Create the administrator using `pnpm admin:create` in an authorized
   Render shell.

### Vercel frontend

1. Import the same GitHub repository into Vercel with the repository root as
   the project root. `vercel.json` defines the pnpm install, client build,
   `client/dist` output, and SPA fallback for nested routes.
2. Set `VITE_API_BASE_URL` to
   `https://<your-render-service>.onrender.com/api/v1` in the Vercel build
   environment. This is a public client setting; it must not contain secrets.
3. Deploy the frontend, then add its exact HTTPS origin to Render's
   `CLIENT_ORIGIN` and redeploy/restart the API if needed.
4. Test the public site, registration, sign-in, booking, cancellation, and
   direct navigation to nested client routes. Confirm the API health check and
   browser network requests use the production API.

When GitHub auto-deploy is enabled, pushing the chosen branch can trigger
Vercel and Render deployments. Confirm the target branch, project, and
environment before pushing. Never commit `.env`, Atlas URIs, JWT secrets, or
other private values. Vercel variables prefixed with `VITE_` are delivered to
the browser and are not suitable for secrets.

## 8. Verify before release

From the repository root, run:

```sh
pnpm test
pnpm build
```

The API tests use an isolated in-memory replica set; they do not prove that a
production Atlas URI or deployment is configured correctly. After deployment,
check `/api/health` and exercise a real account and appointment flow in the
intended environment.

## 9. Troubleshooting checklist

| Symptom | First checks |
| --- | --- |
| Database reports disconnected or authentication failure | Check the API host's `MONGODB_URI`, Atlas database-user password, URL-encoding of special characters, and Atlas network access. Restart/redeploy the API after changing a secret. |
| Sign-in or registration returns service unavailable | Verify Atlas health and the API's private `JWT_SECRET`. |
| Booking calendar has no available dates | Create future slots as an administrator; confirm slots are `available` and use UTC. |
| Sign-in works locally but not on the deployed site | Check HTTPS, the Vercel `VITE_API_BASE_URL`, Render `CLIENT_ORIGIN`, and `COOKIE_SAME_SITE=none` with `COOKIE_SECURE=true`. Browser third-party-cookie restrictions can affect cross-origin cookie sessions. |
| A slot could not be booked | Refresh; another member may have claimed it, or its start time may no longer be in the future. |
| Administrator pages redirect or return forbidden | Confirm the account was created by the admin initializer and is active; public registration creates members only. |

## Related documentation

- [Architecture](./architecture.md)
- [Database design](./database-design.md)
- [REST API reference](./api-documentation.md)
- [Verification report](./testing-report.md)
