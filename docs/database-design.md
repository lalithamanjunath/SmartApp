# Database design

Tandem uses MongoDB Atlas with Mongoose. Collections are created as the models are initialized and the API explicitly builds the indexes required for uniqueness and queries. ObjectId references are populated only for the fields needed by a particular API response.

## Users

| Field | Type | Rules |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB primary key |
| `name` | String | Trimmed; 2–100 characters |
| `email` | String | Trimmed, normalized lowercase, max 254 characters; unique |
| `password` | String | Required bcrypt hash; excluded from default Mongoose selection |
| `role` | String | `user` or `admin`; public registration always writes `user` |
| `isActive` | Boolean | Defaults to true; inactive users cannot authenticate |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

A pre-save hook hashes a modified password using bcrypt. Responses use an explicit safe-user projection and never contain the hash. The unique email index prevents duplicate accounts. The initial administrator is created through `pnpm admin:create`; no public admin-registration field exists.

## Slots

| Field | Type | Rules |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB primary key |
| `date` | String | Valid calendar date `YYYY-MM-DD`, interpreted in UTC |
| `startTime`, `endTime` | String | 24-hour `HH:mm` UTC values; end must be after start |
| `status` | String | `available`, `booked` or `unavailable` |
| `createdBy` | ObjectId ref `User` | Administrator that created the slot |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

A public slot query returns only `available` slots whose UTC start time is still in the future, including filtering out elapsed times earlier on the current UTC date. Admin create/update services reject duplicate/overlapping times, past slots and changes that conflict with active bookings. After any booking has referenced a slot, its date and times are immutable and the slot cannot be deleted; availability may still change if there is no active booking.

Indexes:

- Unique `{ date: 1, startTime: 1 }` protects exact same-date/start duplicates.
- `{ status: 1, date: 1, startTime: 1 }` supports public/admin availability queries and chronological sorting.

## UTC-day schedule locks

The infrastructure-only `SlotScheduleLock` collection stores one `{ date, revision }` document per UTC calendar date, with Mongoose timestamps. Its unique `{ date: 1 }` index is named `unique_schedule_lock_per_utc_day`. Administrator slot creation, date/time changes and deletion acquire/update the affected day document(s) inside a MongoDB transaction before checking for overlap or mutating a slot. Conflicting concurrent creates/updates are serialized and the later overlapping write returns 409 instead of creating an overlapping interval. Moves lock old and new days in sorted order. Lock documents do not replace or snapshot user bookings; they only serialize schedule writes.

## Bookings

| Field | Type | Rules |
| --- | --- | --- |
| `_id` | ObjectId | MongoDB primary key |
| `userId` | ObjectId ref `User` | Owner of the booking |
| `slotId` | ObjectId ref `Slot` | Reserved slot |
| `bookingReference` | String | Unique `TDM-YYYYMMDD-XXXXXX` reference |
| `status` | String | `confirmed`, `cancelled`, `completed` or `no-show` |
| `bookedAt` | Date | Defaults to creation time |
| `cancelledAt` | Date or null | Set when eligible cancellation succeeds |
| `idempotencyKey` | String (optional) | Client retry key; unique within one user when present |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes:

- Unique `{ bookingReference: 1 }` for reference integrity.
- Partial unique `{ slotId: 1 }` where `status: 'confirmed'` ensures only one active booking per slot while preserving canceled/completed/no-show history.
- Partial unique `{ userId: 1, idempotencyKey: 1 }` where the key is a string, for retry safety.
- `{ userId: 1, status: 1, bookedAt: -1 }` supports member history.
- `{ status: 1, bookedAt: -1 }` supports admin status/history queries.

## Relationships and lifecycle

- User 1—many Booking; each Booking points to one Slot; each Slot records its creating User.
- Slot `available` → `booked` occurs only when a booking is atomically created.
- Slot `booked` → `available` occurs with a confirmed booking → `cancelled` transition, in the same Atlas transaction.
- Completed and no-show bookings retain their historical slot in booked state; only confirmed future bookings may be cancelled.
- Administrators may mark a confirmed booking completed or no-show after the slot's end time. The booking record is retained.

## Transaction and deployment note

MongoDB transactions require a replica set or sharded cluster. Atlas deployments provide replica-set transactions; a standalone local server does not. Booking creation wraps the slot claim plus booking insert, cancellation wraps the booking status plus slot release, and schedule writes wrap the UTC-day lock plus overlap check and slot mutation in session transactions. If a transaction fails, it aborts as a unit. For a standalone local database, do not rely on this cross-document atomicity; run the included replica-set integration suite for transaction coverage.
