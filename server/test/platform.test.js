import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dns from 'node:dns';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import supertest from 'supertest';

const testDnsServers = ['192.0.2.53', '198.51.100.53'];
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.MONGODB_DNS_SERVERS = testDnsServers.join(', ');
process.env.COOKIE_SAME_SITE = 'lax';
process.env.COOKIE_SECURE = 'false';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.CLIENT_APP_URL = 'http://localhost:3000';
process.env.CANCELLATION_CUTOFF_HOURS = '24';
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'Tandem <noreply@example.com>';
process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.alloc(32, 8).toString('base64')}`;
process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

let replica;
let server;
let request;
let User;
let Slot;
let Booking;
let SlotScheduleLock;
let Notification;
let EmailDelivery;
let disconnectDatabase;
let memberC;
let originalMemberCookie;

before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = replica.getUri();
  const database = await import('../src/config/database.js');
  const models = await Promise.all([
    import('../src/models/User.js'),
    import('../src/models/Slot.js'),
    import('../src/models/Booking.js'),
    import('../src/models/SlotScheduleLock.js'),
    import('../src/models/Notification.js'),
    import('../src/models/EmailDelivery.js'),
  ]);
  const { app } = await import('../src/app.js');
  User = models[0].User;
  Slot = models[1].Slot;
  Booking = models[2].Booking;
  SlotScheduleLock = models[3].SlotScheduleLock;
  Notification = models[4].Notification;
  EmailDelivery = models[5].EmailDelivery;
  disconnectDatabase = database.disconnectDatabase;
  await database.connectDatabase(process.env.MONGODB_URI);
  server = app.listen(0, '127.0.0.1');
  request = supertest(server);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (disconnectDatabase) await disconnectDatabase();
  if (replica) await replica.stop();
});

test('secure appointment platform integration and booking consistency', async (t) => {
  assert.deepEqual(dns.getServers(), testDnsServers);
  const memberA = supertest.agent(server);
  const memberB = supertest.agent(server);
  const admin = supertest.agent(server);
  const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await t.test('registration validates input, creates members only, hashes passwords, and logs in securely', async () => {
    const health = await request.get('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers['x-powered-by'], undefined);
    assert.equal(health.headers['x-content-type-options'], 'nosniff');
    const invalidRole = await memberA.post('/api/v1/auth/register').send({ name: 'Morgan Lee', email: 'morgan@example.com', password: 'strong-password-123', role: 'admin' });
    assert.equal(invalidRole.status, 400);
    const weakPassword = await memberA.post('/api/v1/auth/register').send({ name: 'Morgan Lee', email: 'morgan@example.com', password: 'onlylowercase' });
    assert.equal(weakPassword.status, 400);
    const registered = await memberA.post('/api/v1/auth/register').send({ name: 'Morgan Lee', email: 'MORGAN@example.com', password: 'strong-password-123' });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.data.user.role, 'user');
    assert.equal(Object.hasOwn(registered.body.data.user, 'password'), false);
    assert.match(registered.headers['set-cookie'][0], /HttpOnly/i);
    originalMemberCookie = registered.headers['set-cookie'][0].split(';')[0];
    const stored = await User.findOne({ email: 'morgan@example.com' }).select('+password');
    assert.notEqual(stored.password, 'strong-password-123');
    assert.equal(await stored.comparePassword('strong-password-123'), true);
    assert.equal((await memberA.get('/api/v1/auth/me')).status, 200);
    assert.equal((await request.post('/api/v1/auth/login').send({ email: 'morgan@example.com', password: 'incorrect-password' })).status, 401);
    assert.equal((await memberA.post('/api/v1/auth/register').send({ name: 'Morgan Lee', email: 'morgan@example.com', password: 'strong-password-123' })).status, 409);
    assert.equal((await memberA.post('/api/v1/auth/logout')).status, 200);
    assert.equal((await memberA.get('/api/v1/auth/me')).status, 401);
    assert.equal((await memberA.post('/api/v1/auth/login').send({ email: 'morgan@example.com', password: 'strong-password-123' })).status, 200);
  });

  await t.test('authorization denies anonymous and non-admin access while admin routes are available', async () => {
    assert.equal((await request.get('/api/v1/admin/dashboard')).status, 401);
    assert.equal((await memberA.get('/api/v1/admin/dashboard')).status, 403);
    const rootAdmin = await User.create({ name: 'Tandem Admin', email: 'admin@example.com', password: 'admin-password-123', role: 'admin' });
    const loggedIn = await admin.post('/api/v1/auth/login').send({ email: 'admin@example.com', password: 'admin-password-123' });
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.body.data.user.role, 'admin');
    assert.equal(Object.hasOwn(loggedIn.body.data.user, 'password'), false);
    assert.ok(rootAdmin._id);
  });

  let slotId;
  await t.test('admin slot management prevents overlapping times and public availability is truthful', async () => {
    const adminId = (await User.findOne({ role: 'admin' }))._id;
    const today = new Date().toISOString().slice(0, 10);
    const pastTodaySlot = await Slot.create({ date: today, startTime: '00:00', endTime: '00:30', status: 'available', createdBy: adminId });
    const todaysSlots = await request.get(`/api/v1/slots?from=${today}&to=${today}`);
    assert.equal(todaysSlots.status, 200);
    assert.equal(todaysSlots.body.data.slots.some((slot) => slot._id === String(pastTodaySlot._id)), false);
    const created = await admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '13:00', endTime: '13:30' });
    assert.equal(created.status, 201, created.body.message);
    slotId = created.body.data.slot._id;
    const disabled = await admin.put(`/api/v1/admin/slots/${slotId}`).send({ date: futureDate, startTime: '13:00', endTime: '13:30', status: 'unavailable' });
    assert.equal(disabled.status, 200);
    assert.equal((await request.get(`/api/v1/slots?from=${futureDate}&to=${futureDate}`)).body.data.slots.length, 0);
    const restored = await admin.put(`/api/v1/admin/slots/${slotId}`).send({ date: futureDate, startTime: '13:00', endTime: '13:30', status: 'available' });
    assert.equal(restored.status, 200);
    const overlap = await admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '13:15', endTime: '13:45' });
    assert.equal(overlap.status, 409);
    const overlappingRace = await Promise.all([
      admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '16:00', endTime: '16:30' }),
      admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '16:15', endTime: '16:45' }),
    ]);
    assert.deepEqual(overlappingRace.map((response) => response.status).sort(), [201, 409]);
    const raceWinner = overlappingRace.find((response) => response.status === 201).body.data.slot;
    assert.equal((await admin.delete(`/api/v1/admin/slots/${raceWinner._id}`)).status, 200);
    const separateRace = await Promise.all([
      admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '17:00', endTime: '17:30' }),
      admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '18:00', endTime: '18:30' }),
    ]);
    assert.deepEqual(separateRace.map((response) => response.status).sort(), [201, 201]);
    for (const response of separateRace) assert.equal((await admin.delete(`/api/v1/admin/slots/${response.body.data.slot._id}`)).status, 200);
    const extra = await admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '15:00', endTime: '15:30' });
    assert.equal(extra.status, 201);
    assert.equal((await admin.delete(`/api/v1/admin/slots/${extra.body.data.slot._id}`)).status, 200);
    assert.equal((await request.get(`/api/v1/slots/${extra.body.data.slot._id}`)).status, 404);
    const available = await request.get(`/api/v1/slots?from=${futureDate}&to=${futureDate}`);
    assert.equal(available.status, 200);
    assert.equal(available.body.data.slots.length, 1);
    assert.equal(available.body.data.slots[0]._id, slotId);
  });

  await t.test('two authenticated users cannot book the same slot concurrently', async () => {
    const signupA = await memberB.post('/api/v1/auth/register').send({ name: 'Riley West', email: 'riley@example.com', password: 'another-password-123' });
    assert.equal(signupA.status, 201);
    memberC = supertest.agent(server);
    const signupB = await memberC.post('/api/v1/auth/register').send({ name: 'Jamie North', email: 'jamie@example.com', password: 'third-password-123' });
    assert.equal(signupB.status, 201);
    const results = await Promise.all([
      memberB.post('/api/v1/bookings').send({ slotId, idempotencyKey: 'member-a-booking-01' }),
      memberC.post('/api/v1/bookings').send({ slotId, idempotencyKey: 'member-b-booking-01' }),
    ]);
    assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
    const success = results.find((response) => response.status === 201);
    const loser = results.find((response) => response.status === 409);
    const winningAgent = results[0] === success ? memberB : memberC;
    const booking = success.body.data.booking;
    assert.match(booking.bookingReference, /^TDM-\d{8}-[A-F0-9]{6}$/);
    const confirmationEmail = await EmailDelivery.findOne({ eventKey: `booking:${booking._id}:booking-confirmed:email` });
    assert.equal(confirmationEmail.type, 'appointment-confirmation');
    assert.equal(confirmationEmail.status, 'queued');
    assert.equal(loser.body.success, false);
    assert.equal(await Booking.countDocuments({ slotId, status: 'confirmed' }), 1);
    assert.equal((await Slot.findById(slotId)).status, 'booked');
    assert.equal((await admin.delete(`/api/v1/admin/slots/${slotId}`)).status, 409);
    const myBookings = await winningAgent.get('/api/v1/bookings/my');
    assert.equal(myBookings.status, 200);
    assert.equal(myBookings.body.data.bookings.length, 1);
    const pagedBookings = await winningAgent.get('/api/v1/bookings/my?page=1&limit=1');
    assert.equal(pagedBookings.status, 200);
    assert.equal(pagedBookings.body.data.bookings.length, 1);
    assert.equal(pagedBookings.body.data.pagination.total, 1);
    assert.equal((await winningAgent.get('/api/v1/bookings/my?page=0&limit=1')).status, 400);
    const otherUser = winningAgent === memberB ? memberC : memberB;
    assert.equal((await otherUser.get(`/api/v1/bookings/${booking._id}`)).status, 404);
    const inbox = await winningAgent.get('/api/v1/notifications');
    assert.equal(inbox.status, 200);
    assert.equal(inbox.body.data.unreadCount, 1);
    const confirmation = inbox.body.data.notifications.find((item) => item.type === 'booking-confirmed');
    assert.ok(confirmation);
    assert.equal(confirmation.metadata.date, futureDate);
    assert.equal((await otherUser.patch(`/api/v1/notifications/${confirmation._id}/read`)).status, 404);
    assert.equal((await winningAgent.patch(`/api/v1/notifications/${confirmation._id}/read`)).status, 200);
    assert.equal((await winningAgent.get('/api/v1/notifications/unread-count')).body.data.count, 0);
    assert.equal((await request.get(`/api/v1/slots?from=${futureDate}&to=${futureDate}`)).body.data.slots.length, 0);
    const tooEarly = await admin.patch(`/api/v1/admin/bookings/${booking._id}/status`).send({ status: 'completed' });
    assert.equal(tooEarly.status, 409);
    assert.equal((await winningAgent.patch(`/api/v1/bookings/${booking._id}/cancel`)).status, 200);
    assert.equal((await Booking.findById(booking._id)).status, 'cancelled');
    const afterCancellation = await winningAgent.get('/api/v1/notifications');
    assert.ok(afterCancellation.body.data.notifications.some((item) => item.type === 'booking-cancelled'));
    assert.equal((await winningAgent.patch('/api/v1/notifications/read-all')).status, 200);
    const cancellationNotice = afterCancellation.body.data.notifications.find((item) => item.type === 'booking-cancelled');
    assert.equal(await EmailDelivery.countDocuments({ eventKey: `booking:${booking._id}:booking-cancelled:email` }), 1);
    assert.equal((await winningAgent.delete(`/api/v1/notifications/${cancellationNotice._id}`)).status, 200);
    assert.equal((await otherUser.delete(`/api/v1/notifications/${confirmation._id}`)).status, 404);
    assert.equal((await Slot.findById(slotId)).status, 'available');
    assert.equal((await request.get(`/api/v1/slots?from=${futureDate}&to=${futureDate}`)).body.data.slots.length, 1);
    const historySlot = (await admin.get(`/api/v1/admin/slots?from=${futureDate}&to=${futureDate}`)).body.data.slots.find((slot) => slot._id === slotId);
    assert.equal(historySlot.hasBookingHistory, true);
    const historyEdit = await admin.put(`/api/v1/admin/slots/${slotId}`).send({ date: futureDate, startTime: '13:30', endTime: '14:00', status: 'available' });
    assert.equal(historyEdit.status, 409);
    assert.equal((await admin.delete(`/api/v1/admin/slots/${slotId}`)).status, 409);
    assert.equal((await Slot.findById(slotId)).startTime, '13:00');
  });

  await t.test('rescheduling is member-owned, transactional, idempotent and preserves previous slots', async () => {
    const makeSlot = async (startTime) => {
      const endTime = `${String(Number(startTime.slice(0, 2))).padStart(2, '0')}:${String(Number(startTime.slice(3)) + 30).padStart(2, '0')}`;
      const response = await admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime, endTime });
      assert.equal(response.status, 201, response.body.message);
      return response.body.data.slot;
    };
    const original = await makeSlot('19:00');
    const firstTarget = await makeSlot('20:00');
    const secondOriginal = await makeSlot('21:00');
    const contestedTarget = await makeSlot('22:00');
    const firstBooking = await memberB.post('/api/v1/bookings').send({ slotId: original._id, idempotencyKey: 'reschedule-source-001' });
    const secondBooking = await memberC.post('/api/v1/bookings').send({ slotId: secondOriginal._id, idempotencyKey: 'reschedule-source-002' });
    assert.equal(firstBooking.status, 201);
    assert.equal(secondBooking.status, 201);

    const changed = await memberB.patch(`/api/v1/bookings/${firstBooking.body.data.booking._id}/reschedule`)
      .send({ slotId: firstTarget._id, idempotencyKey: 'reschedule-request-001' });
    assert.equal(changed.status, 200, changed.body.message);
    assert.equal(changed.body.data.booking.slotId._id, firstTarget._id);
    assert.equal(changed.body.data.booking.rescheduleHistory.length, 1);
    assert.equal(changed.body.data.booking.rescheduleHistory[0].slotId, original._id);
    const rescheduleEmail = await EmailDelivery.findOne({ eventKey: `booking:${firstBooking.body.data.booking._id}:reschedule:${crypto.createHash('sha256').update('reschedule-request-001').digest('hex')}:email` });
    assert.equal(rescheduleEmail.type, 'appointment-rescheduled');
    assert.equal((await Slot.findById(original._id)).status, 'available');
    assert.equal((await Slot.findById(firstTarget._id)).status, 'booked');
    const replay = await memberB.patch(`/api/v1/bookings/${firstBooking.body.data.booking._id}/reschedule`)
      .send({ slotId: firstTarget._id, idempotencyKey: 'reschedule-request-001' });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.booking.rescheduleHistory.length, 1);
    assert.equal((await memberC.get(`/api/v1/bookings/${firstBooking.body.data.booking._id}`)).status, 404);
    const protectedHistory = await admin.put(`/api/v1/admin/slots/${original._id}`)
      .send({ date: futureDate, startTime: '19:30', endTime: '20:00', status: 'available' });
    assert.equal(protectedHistory.status, 409);

    const races = await Promise.all([
      memberB.patch(`/api/v1/bookings/${firstBooking.body.data.booking._id}/reschedule`)
        .send({ slotId: contestedTarget._id, idempotencyKey: 'reschedule-race-member-a' }),
      memberC.patch(`/api/v1/bookings/${secondBooking.body.data.booking._id}/reschedule`)
        .send({ slotId: contestedTarget._id, idempotencyKey: 'reschedule-race-member-b' }),
    ]);
    assert.deepEqual(races.map((response) => response.status).sort(), [200, 409]);
    assert.equal(await Booking.countDocuments({ slotId: contestedTarget._id, status: 'confirmed' }), 1);
    assert.equal((await Slot.findById(contestedTarget._id)).status, 'booked');
  });

  await t.test('persistent reminder generation is due-based, idempotent and status-aware', async () => {
    const owner = await User.create({ name: 'Reminder Member', email: 'reminder@example.com', password: 'reminder-password-123' });
    const adminId = (await User.findOne({ role: 'admin' }))._id;
    const reminderStart = new Date(Date.now() + 30 * 60 * 60 * 1000);
    const fixtures = [];
    for (let index = 0; index < 3; index += 1) {
      const start = new Date(reminderStart.getTime() + index * 30 * 60 * 1000);
      const date = start.toISOString().slice(0, 10);
      const startTime = start.toISOString().slice(11, 16);
      const endTime = new Date(start.getTime() + 30 * 60 * 1000).toISOString().slice(11, 16);
      const slot = await Slot.create({ date, startTime, endTime, status: 'booked', createdBy: adminId });
      const statuses = ['confirmed', 'cancelled', 'completed'];
      const booking = await Booking.create({
        userId: owner._id,
        slotId: slot._id,
        bookingReference: `TDM-${date.replaceAll('-', '')}-REM${index}00`,
        status: statuses[index],
      });
      fixtures.push({ slot, booking });
    }

    const dueAt = new Date(reminderStart.getTime() - 23 * 60 * 60 * 1000);
    const { generateDueReminders } = await import('../src/services/reminderService.js');
    assert.equal(await generateDueReminders(dueAt), 1);
    assert.equal(await generateDueReminders(dueAt), 0);
    assert.equal(await Notification.countDocuments({ appointmentId: fixtures[0].booking._id, type: 'reminder-24h' }), 1);
    assert.equal(await EmailDelivery.countDocuments({ eventKey: `booking:${fixtures[0].booking._id}:reminder-24h:email` }), 1);
    assert.equal(await Notification.countDocuments({ type: 'reminder-1h' }), 0);

    const oneHourDueAt = new Date(reminderStart.getTime() - 30 * 60 * 1000);
    assert.equal(await generateDueReminders(oneHourDueAt), 1);
    assert.equal(await generateDueReminders(oneHourDueAt), 0);
    assert.equal(await Notification.countDocuments({ appointmentId: fixtures[0].booking._id, type: 'reminder-1h' }), 1);
    assert.equal(await EmailDelivery.countDocuments({ eventKey: `booking:${fixtures[0].booking._id}:reminder-1h:email` }), 1);
    assert.equal(await Notification.countDocuments({ appointmentId: { $in: fixtures.slice(1).map(({ booking }) => booking._id) } }), 0);
  });

  await t.test('same-user idempotency returns one booking and admin filters/details hide secrets', async () => {
    const replayAgent = memberA;
    const first = await replayAgent.post('/api/v1/bookings').send({ slotId, idempotencyKey: 'retry-safe-request-002' });
    const replay = await replayAgent.post('/api/v1/bookings').send({ slotId, idempotencyKey: 'retry-safe-request-002' });
    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    assert.equal(first.body.data.booking._id, replay.body.data.booking._id);
    assert.equal(await Booking.countDocuments({ slotId, status: 'confirmed' }), 1);
    const reference = first.body.data.booking.bookingReference;
    const filtered = await admin.get(`/api/v1/admin/bookings?q=${reference}&date=${futureDate}&status=confirmed`);
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.bookings.length, 1);
    assert.equal(filtered.body.data.bookings[0].userId.email, 'morgan@example.com');
    assert.equal(Object.hasOwn(filtered.body.data.bookings[0].userId, 'password'), false);
    const people = await admin.get('/api/v1/admin/users?q=morgan&page=1&limit=25');
    assert.equal(people.status, 200);
    assert.equal(people.body.data.users.length, 1);
    assert.equal(Object.hasOwn(people.body.data.users[0], 'password'), false);
    const personDetails = await admin.get(`/api/v1/admin/users/${people.body.data.users[0].id}`);
    assert.equal(personDetails.status, 200);
    assert.equal(personDetails.body.data.user.email, 'morgan@example.com');
    assert.ok(Array.isArray(personDetails.body.data.bookings));
    const dashboard = await admin.get('/api/v1/admin/dashboard');
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.data.stats.totalUsers, 4);
    assert.equal(dashboard.body.data.daily.length, 7);
    assert.ok(Array.isArray(dashboard.body.data.weekly));
    assert.equal((await admin.get('/api/v1/admin/analytics')).status, 200);
  });

  await t.test('profile/password changes, account deactivation and completion history are guarded', async () => {
    const profile = await memberA.patch('/api/v1/users/me').send({ name: 'Morgan R. Lee', email: 'morgan@example.com' });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.user.name, 'Morgan R. Lee');
    assert.equal(Object.hasOwn(profile.body.data.user, 'password'), false);
    assert.equal((await memberA.patch('/api/v1/users/me/password').send({ currentPassword: 'strong-password-123', newPassword: 'new-strong-password-456' })).status, 200);
    assert.equal((await request.get('/api/v1/auth/me').set('Cookie', originalMemberCookie)).status, 401);
    assert.equal((await memberA.patch('/api/v1/users/me/password').send({ currentPassword: 'new-strong-password-456', newPassword: 'weakpasswordonly' })).status, 400);

    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const historicalSlot = await Slot.create({ date: pastDate, startTime: '10:00', endTime: '10:30', status: 'booked', createdBy: (await User.findOne({ role: 'admin' }))._id });
    const completedCandidate = await Booking.create({ userId: (await User.findOne({ email: 'morgan@example.com' }))._id, slotId: historicalSlot._id, bookingReference: `TDM-${pastDate.replaceAll('-', '')}-C0FFEE`, status: 'confirmed' });
    const completed = await admin.patch(`/api/v1/admin/bookings/${completedCandidate._id}/status`).send({ status: 'completed' });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.booking.status, 'completed');
    const member = await User.findOne({ email: 'morgan@example.com' });
    const noShowSlot = await Slot.create({ date: pastDate, startTime: '11:00', endTime: '11:30', status: 'booked', createdBy: (await User.findOne({ role: 'admin' }))._id });
    const noShowCandidate = await Booking.create({ userId: member._id, slotId: noShowSlot._id, bookingReference: `TDM-${pastDate.replaceAll('-', '')}-DEADBE`, status: 'confirmed' });
    const noShow = await admin.patch(`/api/v1/admin/bookings/${noShowCandidate._id}/status`).send({ status: 'no-show' });
    assert.equal(noShow.status, 200);
    assert.equal(noShow.body.data.booking.status, 'no-show');
    const completedHistory = await memberA.get('/api/v1/bookings/my?status=completed&page=1&limit=20');
    assert.ok(completedHistory.body.data.bookings.some((booking) => booking.status === 'no-show'));

    const deactivated = await admin.patch(`/api/v1/admin/users/${member._id}/status`).send({ isActive: false });
    assert.equal(deactivated.status, 200);
    assert.equal((await memberA.get('/api/v1/auth/me')).status, 401);
    const activated = await admin.patch(`/api/v1/admin/users/${member._id}/status`).send({ isActive: true });
    assert.equal(activated.status, 200);
    assert.equal((await memberA.get('/api/v1/auth/me')).status, 401);
    const adminUser = await User.findOne({ role: 'admin' });
    const selfDeactivation = await admin.patch(`/api/v1/admin/users/${adminUser._id}/status`).send({ isActive: false });
    assert.equal(selfDeactivation.status, 409);
  });

  await t.test('cancellation cutoff and changed-password login/logout are enforced', async () => {
    const migratedSession = supertest.agent(server);
    const newPasswordLogin = await migratedSession.post('/api/v1/auth/login').send({ email: 'morgan@example.com', password: 'new-strong-password-456' });
    assert.equal(newPasswordLogin.status, 200);
    let soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (soon.getUTCHours() > 21) {
      soon.setUTCDate(soon.getUTCDate() + 1);
      soon.setUTCHours(1, 0, 0, 0);
    }
    const end = new Date(soon.getTime() + 30 * 60 * 1000);
    const shortNoticeSlot = await admin.post('/api/v1/admin/slots').send({ date: soon.toISOString().slice(0, 10), startTime: soon.toISOString().slice(11, 16), endTime: end.toISOString().slice(11, 16) });
    assert.equal(shortNoticeSlot.status, 201, shortNoticeSlot.body.message);
    const imminentBooking = await migratedSession.post('/api/v1/bookings').send({ slotId: shortNoticeSlot.body.data.slot._id, idempotencyKey: 'short-notice-cancel-check' });
    assert.equal(imminentBooking.status, 201);
    const deniedCancellation = await migratedSession.patch(`/api/v1/bookings/${imminentBooking.body.data.booking._id}/cancel`);
    assert.equal(deniedCancellation.status, 409);
    const farSlot = await admin.post('/api/v1/admin/slots').send({ date: futureDate, startTime: '14:00', endTime: '14:30' });
    assert.equal(farSlot.status, 201, farSlot.body.message);
    const deniedReschedule = await migratedSession.patch(`/api/v1/bookings/${imminentBooking.body.data.booking._id}/reschedule`)
      .send({ slotId: farSlot.body.data.slot._id, idempotencyKey: 'short-notice-reschedule-check' });
    assert.equal(deniedReschedule.status, 409);
    assert.equal((await Slot.findById(farSlot.body.data.slot._id)).status, 'available');
    assert.equal((await Booking.findById(imminentBooking.body.data.booking._id)).status, 'confirmed');
    assert.equal((await Slot.findById(shortNoticeSlot.body.data.slot._id)).status, 'booked');
    assert.equal((await migratedSession.post('/api/v1/auth/logout')).status, 200);
    assert.equal((await migratedSession.get('/api/v1/auth/me')).status, 401);
  });

  await t.test('reset links are hashed, expiring, single-use and invalidate old sessions', async () => {
    const resetUser = await User.findOne({ email: 'morgan@example.com' });
    const initialAuthVersion = resetUser.authVersion;
    const resetAgent = memberA;
    const unknown = await request.post('/api/v1/auth/forgot-password').send({ email: 'unknown@example.com' });
    const known = await request.post('/api/v1/auth/forgot-password').send({ email: resetUser.email });
    assert.equal(unknown.status, 202);
    assert.deepEqual(known.body, unknown.body);

    const { decryptEmailPayload, enqueueEmail, processEmailJob, processEmailQueue } = await import('../src/services/emailService.js');
    let delivery = await EmailDelivery.findOne({ userId: resetUser._id, type: 'password-reset' })
      .sort({ createdAt: -1 }).select('+payloadCiphertext');
    assert.ok(delivery);
    let payload = decryptEmailPayload(delivery.payloadCiphertext);
    let token = new URL(payload.text.match(/http:\/\/localhost:3000\/reset-password#token=([^\s]+)/)[0]).hash.slice(7);
    let storedUser = await User.findById(resetUser._id).select('+passwordResetTokenHash +passwordResetExpiresAt');
    assert.equal(storedUser.passwordResetTokenHash, crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(storedUser.passwordResetExpiresAt > new Date());

    await User.updateOne({ _id: resetUser._id }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await request.post('/api/v1/auth/reset-password').send({ token, password: 'replacement-password-456' })).status, 400);
    const refreshed = await request.post('/api/v1/auth/forgot-password').send({ email: resetUser.email });
    assert.deepEqual(refreshed.body, unknown.body);
    delivery = await EmailDelivery.findOne({ userId: resetUser._id, type: 'password-reset' })
      .sort({ createdAt: -1 }).select('+payloadCiphertext');
    payload = decryptEmailPayload(delivery.payloadCiphertext);
    token = new URL(payload.text.match(/http:\/\/localhost:3000\/reset-password#token=([^\s]+)/)[0]).hash.slice(7);
    const reset = await request.post('/api/v1/auth/reset-password').send({ token, password: 'replacement-password-456' });
    assert.equal(reset.status, 200, reset.body.message);
    storedUser = await User.findById(resetUser._id).select('+password +passwordResetTokenHash +passwordResetExpiresAt');
    assert.equal(storedUser.passwordResetTokenHash, null);
    assert.equal(storedUser.passwordResetExpiresAt, null);
    assert.equal(storedUser.authVersion, initialAuthVersion + 1);
    assert.equal(await storedUser.comparePassword('replacement-password-456'), true);
    assert.equal((await resetAgent.get('/api/v1/auth/me')).status, 401);
    assert.equal((await request.post('/api/v1/auth/reset-password').send({ token, password: 'another-password-789' })).status, 400);

    const csrfAgent = memberB;
    const csrfDenied = await csrfAgent.post('/api/v1/auth/logout').set('Origin', 'http://localhost:3000');
    assert.equal(csrfDenied.status, 403);
    const csrf = await csrfAgent.get('/api/v1/auth/csrf');
    assert.equal(csrf.status, 200);
    assert.equal((await csrfAgent.post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000').set('X-CSRF-Token', 'invalid-token')).status, 403);
    const forgedToken = `${'a'.repeat(43)}.${'b'.repeat(43)}`;
    assert.equal((await request.post('/api/v1/auth/logout')
      .set('Cookie', `tandem_session=fake; tandem_csrf=${forgedToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', forgedToken)).status, 403);
    const csrfAccepted = await csrfAgent.post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000').set('X-CSRF-Token', csrf.body.data.csrfToken);
    assert.equal(csrfAccepted.status, 200);

    const originalFetch = globalThis.fetch;
    const providerCalls = [];
    globalThis.fetch = async (url, options) => {
      providerCalls.push({ url, options });
      if (providerCalls.length === 1) return { ok: false, status: 503 };
      return { ok: true, json: async () => ({ id: 're_test_message' }) };
    };
    try {
      assert.equal(await processEmailJob(delivery._id), true);
      let failedAttempt = await EmailDelivery.findById(delivery._id);
      assert.equal(failedAttempt.status, 'queued');
      assert.equal(failedAttempt.attempts, 1);
      await EmailDelivery.updateOne({ _id: delivery._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
      assert.equal(await processEmailJob(delivery._id), true);
      const accepted = await EmailDelivery.findById(delivery._id);
      assert.equal(accepted.status, 'accepted');
      assert.equal(accepted.attempts, 2);
      assert.equal(accepted.providerMessageId, 're_test_message');
      assert.equal(providerCalls[0].url, 'https://api.resend.com/emails');
      assert.equal(providerCalls[0].options.headers['Idempotency-Key'], delivery.eventKey);

      const recovery = await enqueueEmail({
        eventKey: 'test:expired-email-lease',
        userId: resetUser._id,
        type: 'password-changed',
        payload: { from: process.env.RESEND_FROM_EMAIL, to: [resetUser.email], subject: 'Test', text: 'Test', html: '<p>Test</p>' },
      });
      await EmailDelivery.updateOne({ _id: recovery._id }, {
        $set: { status: 'sending', leaseUntil: new Date(Date.now() - 1000), nextAttemptAt: new Date('2000-01-01') },
      });
      assert.equal(await processEmailQueue({ batchSize: 1 }), 1);
      assert.equal((await EmailDelivery.findById(recovery._id)).status, 'accepted');
      const expiredRetry = await enqueueEmail({
        eventKey: 'test:expired-provider-idempotency-window',
        userId: resetUser._id,
        type: 'password-changed',
        payload: { from: process.env.RESEND_FROM_EMAIL, to: [resetUser.email], subject: 'Test', text: 'Test', html: '<p>Test</p>' },
      });
      await EmailDelivery.updateOne({ _id: expiredRetry._id }, {
        $set: { status: 'sending', leaseUntil: new Date(Date.now() - 1000), firstAttemptAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      const callCountBeforeExpiredRetry = providerCalls.length;
      assert.equal(await processEmailJob(expiredRetry._id), true);
      assert.equal((await EmailDelivery.findById(expiredRetry._id)).status, 'failed');
      assert.equal(providerCalls.length, callCountBeforeExpiredRetry);
      assert.equal(await enqueueEmail({
        eventKey: 'test:expired-email-lease',
        userId: resetUser._id,
        type: 'password-changed',
        payload: { from: process.env.RESEND_FROM_EMAIL, to: [resetUser.email], subject: 'Duplicate', text: 'Duplicate', html: '<p>Duplicate</p>' },
      }).then((record) => String(record._id)), String(recovery._id));
      assert.equal(await EmailDelivery.countDocuments({ eventKey: 'test:expired-email-lease' }), 1);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const webhookBody = JSON.stringify({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: 're_test_message' },
    });
    const webhookId = 'evt_test_delivery_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const webhookSecret = Buffer.from(process.env.RESEND_WEBHOOK_SECRET.slice(6), 'base64');
    const signature = crypto.createHmac('sha256', webhookSecret)
      .update(`${webhookId}.${timestamp}.${webhookBody}`).digest('base64');
    const invalidWebhook = await request.post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', webhookId)
      .set('svix-timestamp', timestamp)
      .set('svix-signature', 'v1,invalid')
      .send(webhookBody);
    assert.equal(invalidWebhook.status, 400);
    const deliveredWebhook = await request.post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', webhookId)
      .set('svix-timestamp', timestamp)
      .set('svix-signature', `v1,${signature}`)
      .send(webhookBody);
    assert.equal(deliveredWebhook.status, 200, deliveredWebhook.body.message);
    assert.equal((await EmailDelivery.findOne({ providerMessageId: 're_test_message' })).status, 'delivered');
    const duplicateWebhook = await request.post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', webhookId)
      .set('svix-timestamp', timestamp)
      .set('svix-signature', `v1,${signature}`)
      .send(webhookBody);
    assert.equal(duplicateWebhook.body.data.ignored, true);
  });

  await t.test('in-app booking notifications persist when email delivery is unavailable', async () => {
    const { env } = await import('../src/config/env.js');
    const { createAppointmentNotification } = await import('../src/services/notificationService.js');
    const user = await User.create({ name: 'Email Offline', email: 'email-offline@example.com', password: 'offline-password-123' });
    const slot = await Slot.create({
      date: futureDate,
      startTime: '23:00',
      endTime: '23:30',
      status: 'booked',
      createdBy: (await User.findOne({ role: 'admin' }))._id,
    });
    const booking = await Booking.create({
      userId: user._id,
      slotId: slot._id,
      bookingReference: `TDM-${futureDate.replaceAll('-', '')}-OFFLINE`,
      status: 'confirmed',
    });
    const originalConfiguration = {
      resendApiKey: env.resendApiKey,
      resendFromEmail: env.resendFromEmail,
      resendWebhookSecret: env.resendWebhookSecret,
      emailEncryptionKey: env.emailEncryptionKey,
    };
    try {
      env.resendApiKey = '';
      env.resendFromEmail = '';
      env.resendWebhookSecret = '';
      env.emailEncryptionKey = '';
      await createAppointmentNotification({
        userId: user._id,
        userEmail: user.email,
        booking,
        slot,
        type: 'booking-confirmed',
        eventKey: 'email-disabled-notification',
      });
      assert.equal(await Notification.countDocuments({ eventKey: 'email-disabled-notification' }), 1);
      assert.equal(await EmailDelivery.countDocuments({ eventKey: 'email-disabled-notification:email' }), 0);
    } finally {
      Object.assign(env, originalConfiguration);
    }
  });

  await t.test('unique MongoDB indexes exist for identities, references, active bookings and idempotency', async () => {
    const [users, slots, bookings, scheduleLocks, notifications] = await Promise.all([
      User.collection.indexes(),
      Slot.collection.indexes(),
      Booking.collection.indexes(),
      SlotScheduleLock.collection.indexes(),
      Notification.collection.indexes(),
    ]);
    assert.ok(users.some((index) => index.key.email === 1 && index.unique));
    assert.ok(slots.some((index) => index.key.date === 1 && index.key.startTime === 1 && index.unique));
    assert.ok(bookings.some((index) => index.name === 'one_active_booking_per_slot' && index.unique));
    assert.ok(bookings.some((index) => index.name === 'user_idempotency_key' && index.unique));
    assert.ok(bookings.some((index) => index.key.bookingReference === 1 && index.unique));
    assert.ok(bookings.some((index) => index.key.userId === 1 && index.key.bookedAt === -1));
    assert.ok(bookings.some((index) => index.key.createdAt === -1));
    const ownerId = (await User.findOne({ email: 'morgan@example.com' }))._id;
    const ownerBookingCount = await Booking.countDocuments({ userId: ownerId });
    const queryPlan = await Booking.find({ userId: ownerId }).sort({ bookedAt: -1 }).explain('executionStats');
    assert.match(JSON.stringify(queryPlan.queryPlanner.winningPlan), /IXSCAN/);
    assert.equal(queryPlan.executionStats.totalDocsExamined, ownerBookingCount);
    assert.ok(scheduleLocks.some((index) => index.name === 'unique_schedule_lock_per_utc_day' && index.unique));
    assert.ok(notifications.some((index) => index.key.eventKey === 1 && index.unique));
    assert.ok(notifications.some((index) => index.key.userId === 1 && index.key.isRead === 1));
  });
});
