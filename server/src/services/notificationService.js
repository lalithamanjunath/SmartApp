import { Notification } from '../models/Notification.js';
import { enqueueAppointmentEmail } from './emailService.js';

const notificationCopy = {
  'booking-confirmed': { title: 'Appointment confirmed', prefix: 'Your appointment is confirmed' },
  'reminder-24h': { title: 'Appointment tomorrow', prefix: 'A reminder: your appointment is coming up' },
  'reminder-1h': { title: 'Appointment in one hour', prefix: 'Your appointment is coming up soon' },
  'booking-cancelled': { title: 'Appointment cancelled', prefix: 'Your appointment has been cancelled' },
  'booking-rescheduled': { title: 'Appointment rescheduled', prefix: 'Your appointment has been rescheduled' },
};

function notificationRecord({ userId, booking, slot, type, eventKey }) {
  const copy = notificationCopy[type];
  return {
    userId,
    appointmentId: booking._id,
    eventKey: eventKey || `booking:${booking._id}:${type}`,
    type,
    title: copy.title,
    message: `${copy.prefix} for ${slot.date} at ${slot.startTime}–${slot.endTime} UTC. Booking reference: ${booking.bookingReference}.`,
    metadata: {
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      bookingReference: booking.bookingReference,
    },
  };
}

export async function createAppointmentNotification({ userId, userEmail, booking, slot, type, session, eventKey }) {
  const record = notificationRecord({ userId, booking, slot, type, eventKey });
  const [notification] = await Notification.create(
    [record],
    session ? { session } : undefined,
  );
  await enqueueAppointmentEmail({
    to: userEmail,
    type,
    booking,
    slot,
    eventKey: `${record.eventKey}:email`,
    session,
  });
  return notification;
}

export async function createReminderIfMissing({ booking, slot, type }) {
  const record = notificationRecord({ userId: booking.userId, booking, slot, type });
  try {
    const result = await Notification.updateOne(
      { eventKey: record.eventKey },
      { $setOnInsert: record },
      { upsert: true },
    );
    return result.upsertedCount === 1;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

export async function enqueueReminderEmail({ userEmail, booking, slot, type }) {
  return enqueueAppointmentEmail({
    to: userEmail,
    type,
    booking,
    slot,
    eventKey: `booking:${booking._id}:${type}:email`,
  });
}

export async function listNotifications(userId, { page, limit }) {
  const query = { userId };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, isRead: false }),
  ]);
  return { notifications, unreadCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getUnreadNotificationCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}

export async function markNotificationRead(userId, id) {
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  ).lean();
  return notification;
}

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function deleteNotification(userId, id) {
  return Notification.findOneAndDelete({ _id: id, userId }).lean();
}
