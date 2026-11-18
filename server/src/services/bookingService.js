import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Slot } from '../models/Slot.js';
import { createAppointmentNotification } from './notificationService.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { slotStart } from '../utils/time.js';

function makeReference(date) {
  const day = date.replaceAll('-', '');
  return `TDM-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function createBooking({ userId, slotId, idempotencyKey }) {
  const session = await mongoose.startSession();
  let bookingId;
  try {
    await session.withTransaction(async () => {
      if (idempotencyKey) {
        const previous = await Booking.findOne({ userId, idempotencyKey }).session(session);
        if (previous) { bookingId = previous._id; return; }
      }
      const existing = await Booking.findOne({ userId, slotId, status: 'confirmed' }).session(session);
      if (existing) { bookingId = existing._id; return; }
      const candidate = await Slot.findOne({ _id: slotId, status: 'available' }).session(session);
      if (!candidate) throw new ApiError(409, 'That appointment slot is no longer available. Please choose another time.');
      if (slotStart(candidate.date, candidate.startTime) <= new Date()) throw new ApiError(400, 'Appointment slots must start in the future.');
      const claimed = await Slot.findOneAndUpdate(
        { _id: slotId, status: 'available' },
        { $set: { status: 'booked' } },
        { new: true, session },
      );
      if (!claimed) throw new ApiError(409, 'That appointment slot was just booked. Please choose another time.');
      const [created] = await Booking.create([{
        userId,
        slotId: claimed._id,
        bookingReference: makeReference(claimed.date),
        status: 'confirmed',
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }], { session });
      bookingId = created._id;
      await createAppointmentNotification({
        userId,
        booking: created,
        slot: claimed,
        type: 'booking-confirmed',
        session,
      });
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'This slot or request has already been booked. Refresh and review your appointments.');
    throw error;
  } finally {
    await session.endSession();
  }
  return Booking.findById(bookingId).populate('slotId').populate('userId', 'name email');
}

export async function listUserBookings(userId, status) {
  const query = { userId };
  if (status) query.status = status;
  return Booking.find(query).sort({ bookedAt: -1 }).populate('slotId').lean();
}

export async function getUserBooking(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Appointment not found.');
  const booking = await Booking.findOne({ _id: id, userId }).populate('slotId').lean();
  if (!booking) throw new ApiError(404, 'Appointment not found.');
  return booking;
}

export async function cancelBooking(userId, id) {
  const session = await mongoose.startSession();
  let updatedId;
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({ _id: id, userId }).session(session);
      if (!booking) throw new ApiError(404, 'Appointment not found.');
      if (booking.status === 'cancelled') { updatedId = booking._id; return; }
      if (booking.status !== 'confirmed') throw new ApiError(409, 'Only confirmed upcoming appointments can be cancelled.');
      const slot = await Slot.findById(booking.slotId).session(session);
      if (!slot) throw new ApiError(409, 'The appointment slot could not be found. Contact support.');
      const cutoff = env.cancellationCutoffHours * 60 * 60 * 1000;
      if (slotStart(slot.date, slot.startTime).getTime() - Date.now() < cutoff) {
        throw new ApiError(409, `Appointments can be cancelled at least ${env.cancellationCutoffHours} hours in advance.`);
      }
      const changed = await Booking.findOneAndUpdate(
        { _id: booking._id, status: 'confirmed' },
        { $set: { status: 'cancelled', cancelledAt: new Date() } },
        { new: true, session },
      );
      if (!changed) throw new ApiError(409, 'This appointment has already changed. Refresh your appointments.');
      const released = await Slot.findOneAndUpdate({ _id: slot._id, status: 'booked' }, { $set: { status: 'available' } }, { new: true, session });
      if (!released) throw new ApiError(409, 'The slot could not be released. No cancellation was saved.');
      await createAppointmentNotification({
        userId,
        booking: changed,
        slot,
        type: 'booking-cancelled',
        session,
      });
      updatedId = changed._id;
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
  return Booking.findById(updatedId).populate('slotId').lean();
}

export async function updateAdminBookingStatus(id, status) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Booking not found.');
  const booking = await Booking.findById(id).populate('slotId');
  if (!booking) throw new ApiError(404, 'Booking not found.');
  if (booking.status !== 'confirmed') throw new ApiError(409, 'Only confirmed bookings can be marked completed or no-show.');
  if (!booking.slotId || slotStart(booking.slotId.date, booking.slotId.endTime) > new Date()) {
    throw new ApiError(409, 'An appointment can be completed or marked no-show after its scheduled end time.');
  }
  booking.status = status;
  await booking.save();
  return Booking.findById(booking._id).populate('userId', 'name email').populate('slotId').lean();
}
