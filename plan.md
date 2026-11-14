# Smart Appointment Platform — Implementation Plan

## Product and implementation approach

Build a responsive appointment-booking web application with separate User and Administrator experiences. Keep the requested stack and modular client/server separation: React + Vite + JavaScript for the SPA; Tailwind CSS, React Router DOM, Axios, Lucide React, React Hot Toast and Recharts for the interface; Node.js + Express REST APIs, Mongoose and MongoDB Atlas for persistence; bcrypt password hashing and JWT sessions in HTTP-only cookies.

The managed Webdev server capability is enabled and its managed MySQL database is disabled; this preserves the expressly requested external MongoDB Atlas. `MONGODB_URI` and `JWT_SECRET` have been entered through the project's protected secret flow and remain in the environment rather than source files or chat. The API loads them only at runtime and explicitly ensures its indexes. The current Preview health state is `database: disconnected`; a scheme-only check showed the protected Atlas value is not currently a usable driver URI, so live persistence remains unverified and must not be claimed. Automated integration data remains isolated in a disposable local MongoDB replica set. Prepare local development and the requested Vercel/Render deployment configuration and instructions without claiming external deployment has happened.

Use `/api/v1` as the versioned API surface, modular Express routers/controllers/services/models, centralized validation/error responses and a clear client API layer. Use MongoDB transactions for booking/cancellation and schedule writes where supported. Serialize slot creation and schedule edits/deletions with a uniquely indexed UTC-day lock row so concurrent admin requests cannot insert overlapping intervals; prevent changing or deleting any slot referenced by booking history. Keep atomic slot claims and a partial unique index to prevent more than one active booking per slot. A first-admin CLI will create a role=admin account with a bcrypt hash; public registration always creates role=user. Use a separate application cookie name, JWT signing secret from environment, auth rate limiting, Helmet, strict CORS and server-side role checks. For cross-site HTTPS Preview, set the HTTP-only cookie `SameSite=None; Secure` explicitly; preserve a separate local-HTTP cookie mode.

### Project structure

- `client/` — Vite React application, routes/layouts, reusable UI, pages, auth context, API services and responsive styling.
- `client/src/pages/` — public landing/login/register; user dashboard, booking, appointment list/detail and profile; admin dashboard, slots, bookings/detail, users and settings.
- `client/src/components/` and `client/src/layouts/` — navigation, user/admin sidebars, status badges, dashboard cards, date/slot picker, booking cards, filters, dialogs and loading/empty/error states.
- `server/src/models/` — User, Slot, Booking and UTC-day schedule-lock Mongoose schemas and indexes.
- `server/src/routes/`, `controllers/`, `services/`, `middleware/`, `config/` and `utils/` — versioned APIs, business rules, auth/role guards, validation, database connection, error handling and response helpers.
- `server/scripts/` — secure initial-admin creation utility.
- `docs/` — architecture, database design and API documentation.
- Root — workspace scripts, `.env.example`, `.gitignore`, `.node-version`, `vercel.json`, `render.yaml`, `app.config.ts`, `README.md`, `plan.md` and `TODO.md`; the website manifest is `client/public/manus-routes.json`.

### Core product behavior

- User registration/login/logout, persistent authenticated sessions, protected routes, profile/name updates and secure password changes.
- User dashboard totals, upcoming/completed/cancelled counts, next appointment and recent activity; appointment browsing by date with only server-verified available slots, booking review/confirmation, unique reference, history categories, detail view and cancellation of eligible future appointments.
- Separate administrator dashboard and role-protected management for appointment slots, bookings and users; slot creation/edit/deletion/unavailability with transaction-serialized overlap protection, immutable appointment times for any slot with booking history, and booked-slot safeguards; booking search/reference/date/status filters; completion/no-show updates and cancellation history; user search and booking history, with safe account activation/deactivation if included.
- Server-authoritative date/time and availability validation; atomic booking claims; duplicate-request protection; consistent slot release after cancellation and safe recovery if booking persistence fails; concurrent admin schedule writes serialize on a unique date-lock row.
- REST endpoints as specified in the brief for `/api/v1/auth`, `/api/v1/slots`, `/api/v1/bookings` and `/api/v1/admin`, including analytics/dashboard and admin booking-status updates.

## Visual direction

The supplied Figma file is a multi-page “Modern, Clean SaaS Company” site board. Its Home frame reads as a clean editorial web layout: extensive white space, black/dark headline typography, blue media panels and vivid chartreuse brand/footer panels. Adapt those recognizable motifs to a functional appointment dashboard while preserving the prompt's required indigo primary, slate surfaces and accessible status colors; use chartreuse only as a restrained signature accent rather than replacing indigo.

- **Design Movement:** Modern editorial SaaS, translating the Figma board's clear white canvases, strong typography, saturated blue panels and electric chartreuse highlight into an operational scheduling product.
- **Core Principles:** Calm at-a-glance hierarchy; generous white space; appointment-first information architecture; vivid accents reserved for actions and meaningful status.
- **Color Philosophy:** White and light slate keep records legible; dark navy establishes trust; indigo (#4F46E5) anchors navigation and primary actions; chartreuse marks the distinctive brand accent; green, amber and red communicate success, caution and error.
- **Layout Paradigm:** A fixed desktop app rail with a compact top utility bar opens onto a broad, left-aligned work canvas; appointment lists and calendar/time selection get more room than decorative cards. Collapse the rail and stack content on mobile.
- **Signature Elements:** A crisp calendar-tick wordmark; a narrow chartreuse marker on the active navigation/action edge; blue-tinted editorial panels used selectively for next-appointment and booking summaries.
- **Interaction Philosophy:** Make availability, selection and confirmation explicit; disable unavailable slots; preserve context across booking steps; confirm cancellation and destructive admin actions; give clear toast feedback.
- **Animation:** Subtle 140–200 ms color/opacity/elevation transitions; no looping motion; respect reduced-motion preferences; use skeletons for loading rather than animated decoration.
- **Typography System:** Inter (or a metrically similar system sans-serif) throughout; compact semibold labels, clear 28–32 px page titles and readable 14–16 px body; use large display type sparingly on the public landing page.
- **Brand Essence:** The dependable appointment workspace that makes scheduling and capacity management clear for people and administrators. Personality: composed, precise, welcoming.
- **Brand Voice:** Direct, reassuring, and specific. Example lines: “Your next appointment, already in view.” “Choose a time that works; we’ll hold it while you confirm.”
- **Wordmark & Logo:** The finalized Tandem wordmark pairs a custom calendar mark containing an indigo appointment dot and a small chartreuse tick; use the same mark for the site favicon and project logo metadata.
- **Signature Brand Color:** Appointment Indigo `#4F46E5`, reinforced with a small electric-chartreuse accent borrowed from the Figma reference.

## Hosting and dependencies

The Vite client will proxy `/api` to the Express service during local development; the server serves a health endpoint and the API. In production, Vercel hosts the static SPA and Render hosts the Express service, with MongoDB Atlas configured via `MONGODB_URI`, and `CLIENT_ORIGIN`, JWT/session settings and frontend API URL documented as environment values. Configure SPA fallback and credentialed CORS/cookie behavior for the separate frontend/backend origins. Include install/start/build/test/admin-init scripts and reproducible deployment notes.

The Figma page is visible in the browser but its interactive prototype requires Figma sign-in; design decisions above are based on the publicly visible multi-page board and the palette, accessibility and component requirements in the supplied brief.
