# Verification report

**Project:** Tandem Smart Appointment Platform  
**Check date:** 2026-11-10
**Scope:** production build, API regression suite and browser tests against the bound Preview forwarding to the configured port 3000. No live Vercel or Render deployment was performed.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Frozen dependency install | Pass | `pnpm install --frozen-lockfile` completed using the pinned pnpm workspace. |
| Frontend production build | Pass | `pnpm build` produced the Vite SPA and Tailwind CSS. The build reported an outdated Browserslist database notice; it did not fail. The largest lazy admin chunk remained below 500 kB. |
| Backend JavaScript syntax | Pass | `node --check` passed across `server/src`, `server/scripts` and `server/test`. |
| Integration API suite | Pass | `pnpm test`: 9 tests passed, 0 failed, using an isolated one-node MongoDB in-memory replica set. The suite does not write to the configured Atlas database. |
| Route manifest and direct SPA paths | Pass | `GET /manus-routes.json` returned HTTP 200 with valid JSON and all 14 public/member/admin routes (12 static paths and two dynamic detail patterns). All 12 exact static paths and both dynamic route prefixes returned HTTP 200 with the application shell; no entity IDs were invented. |
| Browser UI — public guest flows | Pass | At 1280×900 and 375×812, the landing, login and registration pages rendered. Landing→login, registration→login and login→registration navigation worked. Password visibility toggled. Empty login/registration and malformed registration email were blocked by native constraints; blank submissions made zero corresponding auth requests. Mismatched passwords showed the inline alert and made zero registration requests. The browser console showed no output/errors during the inspected flow. |
| Browser UI — protected routing | Pass (unauthenticated state) | Direct `/app/dashboard` and `/admin/dashboard` navigation both redirected to `/login`. Authenticated member/admin dashboards and booking interactions could not be exercised without a real connected database/session. |
| Preview API proxy/CORS | Pass after fix | Initially, Preview-origin auth requests were rejected as HTTP 500 by the backend CORS allowlist. The dev-only Vite `/api` proxy now forwards the configured local development origin to Express. The same dummy Preview login now reaches Express and returns its expected HTTP 503 Atlas message, not a CORS 500. Production continues to require its explicit `CLIENT_ORIGIN` allowlist. |
| Responsive and reduced-motion source check | Pass | Four responsive queries are present: `max-width:1180px`, `max-width:900px`, `max-width:680px`, and `prefers-reduced-motion:reduce`. Full-page mobile captures showed no obvious horizontal overflow or clipped public form components. |
| Secret-file hygiene | Pass | No environment file is tracked; generated Tailwind CSS is ignored. Project secrets are not present in source or this report. |
| Atlas-backed Preview readiness | **Blocked** | `/api/health` returned HTTP 200 with `database: disconnected`. A scheme-only check against the protected project value did not match `mongodb://` or `mongodb+srv://`. The value itself was never printed. Replace it with the full Atlas driver URI to enable live persistence. |

## Covered integration behavior

The passing API tests exercise member-only registration (including rejected admin self-registration), password hashing, login/logout and persistent cookie sessions; authentication, role rejection and security headers; administrator slot creation, overlap rejection, availability/unavailability, eligible deletion, protected booked-slot deletion and filtering past same-day availability; parallel overlapping slot creation (exactly one succeeds), parallel non-overlapping same-day creates (both succeed), canceled-booking history time/delete protection, the public `hasBookingHistory` indicator and its unique UTC-day lock index; two-user concurrent booking contention; same-user idempotent requests; booking references, ownership/privacy, administrator booking and user search/details; profile/password updates, account activation/deactivation and self-deactivation protection; completion/no-show transitions; cancellation cutoff enforcement and slot release; and identity/reference/active-booking/idempotency indexes.

## Known limits

The public guest UI and its validation states were browser-tested, but the authenticated member/admin surfaces, live successful sign-in, real account creation, bookings and durable reads/writes could not be exercised until a valid MongoDB Atlas URI is stored as the project's protected `MONGODB_URI`. The health route intentionally stays public and answers with database state; persistence-dependent endpoints fail safely rather than switching to fake or in-memory production data. Test form values used the reserved `.invalid` domain and did not create records. Vercel and Render configuration files are deployment preparation only—neither provider was connected or deployed.

## Follow-up verification — 2026-11-18

After adding in-app notifications, database-derived appointment reminders, password-strength validation and production request-duration logging:

| Check | Result | Evidence |
| --- | --- | --- |
| API tests | Pass | `pnpm test`: 12 tests passed, 0 failed. Added coverage for confirmation/cancellation notifications, notification ownership/read/delete, reminder due windows, duplicate prevention, inactive booking filtering and password-strength rejection. |
| Frontend production build | Pass | `pnpm build` completed. Initial entry bundle: 445.80 kB (136.76 kB gzip); updated entry bundle: 446.59 kB (136.94 kB gzip). The notification bell is a separate 11.94 kB (3.18 kB gzip) lazy chunk. This is not evidence of a latency improvement. |
| Patch whitespace | Pass | `git diff --check` reported no whitespace errors. |
| Database teardown | Pass | The final test run completed without teardown errors. An earlier intermediate run printed a MongoDB Memory Server `ECONNRESET`; baseline and final test exit statuses were both 0. |

No Atlas-backed or production request-latency benchmark was run. Notification date/time messages use UTC; the current slot model has no provider/service identity fields, so rescheduling is member-to-slot only.

## Production-readiness implementation — 2026-11-18

| Check | Result | Evidence |
| --- | --- | --- |
| API integration suite | Pass | `pnpm test`: 15 tests passed, 0 failed. Coverage now includes reset expiry/reuse and auth-version invalidation, signed CSRF checks, encrypted email retry/idempotency and webhook signatures, expired-lease recovery, duplicate reminder email prevention, notification persistence with email disabled, rescheduling history/ownership/cutoff/concurrency, paginated member history and query/index assertions. The final test process exited 0 without teardown errors. |
| Backend syntax | Pass | `node --check` passed for all JavaScript files under `server/src`, `server/scripts` and `server/test`. |
| Production frontend build | Pass | `pnpm build` completed. Entry bundle: 447.84 kB (137.15 kB gzip). `AdminDashboardPage`: 10.17 kB (2.22 kB gzip); deferred chart module: 431.94 kB (117.42 kB gzip). |
| Admin dashboard split | Measured bundle change | The dashboard page module fell from the previously measured 440.25 kB to 10.17 kB (97.7% smaller); chart code now loads separately near the viewport. The entry bundle is 1.25 kB larger than the prior 446.59 kB baseline, and total chart bytes were not removed. This is deferred route/component loading, not a claim of overall bundle-size or latency improvement. |
| Admin dashboard API/query work | Verified in code/tests | The dashboard now obtains its daily and weekly series in one request instead of separately calling dashboard and analytics. Its data work uses two booking aggregation pipelines (daily and weekly), rather than the previous three across the two requests. The existing analytics endpoint remains available. |
| Booking-history query plan | Pass in test environment | Explain-plan integration assertion confirms an index scan for `{userId}` sorted by `bookedAt`, with documents examined equal to matching bookings in the isolated replica set. This is not a production Atlas benchmark. |
| Patch whitespace | Pass | `git diff --check` reported no whitespace errors. |
| Live provider / Atlas checks | Not performed | Tests mock Resend and verify signed webhook delivery events. No provider credentials or connected production Atlas database were used; actual mail delivery, Atlas query statistics and production API latency remain to be verified after deployment. |

Schema additions are backward-compatible defaults and new indexes/collections; the startup process creates indexes but does not drop existing indexes or rewrite existing booking records. See [`database-design.md`](./database-design.md) for the exact additions and operational notes.
