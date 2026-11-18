import mongoose from 'mongoose';
import { Slot } from '../models/Slot.js';
import { SlotScheduleLock } from '../models/SlotScheduleLock.js';
import { Booking } from '../models/Booking.js';
import { ApiError } from '../utils/ApiError.js';
import { assertFutureSlot, formatDateKey, isValidDateString, slotStart } from '../utils/time.js';

const transactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

async function inScheduleTransaction(work) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      }, transactionOptions);
      return result;
    } catch (error) {
      if (error.code === 11000) {
        if (attempt < 2) continue;
        throw new ApiError(409, 'A duplicate or overlapping appointment slot already exists. Refresh the schedule and try again.');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new ApiError(409, 'The schedule changed at the same time. Refresh and try again.');
}

async function lockScheduleDates(dates, session) {
  for (const date of [...new Set(dates)].filter(Boolean).sort()) {
    await SlotScheduleLock.updateOne(
      { date },
      { $inc: { revision: 1 } },
      { upsert: true, session, setDefaultsOnInsert: true },
    );
  }
}

async function assertNoOverlap({ date, startTime, endTime, excludeId }, session) {
  const query = { date, startTime: { $lt: endTime }, endTime: { $gt: startTime } };
  if (excludeId) query._id = { $ne: excludeId };
  const overlapQuery = Slot.exists(query);
  const overlap = session ? await overlapQuery.session(session) : await overlapQuery;
  if (overlap) throw new ApiError(409, 'This appointment overlaps another slot on the selected date.');
}

function assertValidSlotInput({ date, startTime, endTime }) {
  if (!isValidDateString(date)) throw new ApiError(400, 'Choose a valid appointment date.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '')
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || '')
    || startTime >= endTime) {
    throw new ApiError(400, 'Choose a valid start and end time; the end must be after the start.');
  }
}

export async function listAvailableSlots({ from, to }) {
  const today = formatDateKey(new Date());
  const start = !from || from < today ? today : from;
  const end = to || start;
  if (!isValidDateString(start) || !isValidDateString(end) || end < start) throw new ApiError(400, 'Choose a valid date range.');
  const now = new Date();
  const slots = await Slot.find({ status: 'available', date: { $gte: start, $lte: end } }).sort({ date: 1, startTime: 1 }).lean();
  return slots.filter((slot) => slotStart(slot.date, slot.startTime) > now);
}

export async function listSlots(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.from || filters.to) query.date = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
  else query.date = { $gte: formatDateKey(new Date()) };
  const slots = await Slot.find(query).sort({ date: 1, startTime: 1 }).populate('createdBy', 'name email').lean();
  if (!slots.length) return [];
  const slotIds = slots.map((slot) => slot._id);
  const [currentBookingSlotIds, rescheduledSlotIds] = await Promise.all([
    Booking.distinct('slotId', { slotId: { $in: slotIds } }),
    Booking.distinct('rescheduleHistory.slotId', { 'rescheduleHistory.slotId': { $in: slotIds } }),
  ]);
  const hasHistory = new Set([...currentBookingSlotIds, ...rescheduledSlotIds].map(String));
  return slots.map((slot) => ({ ...slot, hasBookingHistory: hasHistory.has(String(slot._id)) }));
}

export async function getSlot(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Appointment slot not found.');
  const slot = await Slot.findById(id).lean();
  if (!slot) throw new ApiError(404, 'Appointment slot not found.');
  return slot;
}

export async function createSlot(input, adminId) {
  assertValidSlotInput(input);
  assertFutureSlot(input.date, input.startTime);
  return inScheduleTransaction(async (session) => {
    await lockScheduleDates([input.date], session);
    await assertNoOverlap(input, session);
    const [slot] = await Slot.create([{
      ...input,
      status: input.status || 'available',
      createdBy: adminId,
    }], { session });
    return slot;
  });
}

export async function updateSlot(id, input) {
  return inScheduleTransaction(async (session) => {
    const slot = await Slot.findById(id).session(session);
    if (!slot) throw new ApiError(404, 'Appointment slot not found.');

    const next = {
      date: input.date ?? slot.date,
      startTime: input.startTime ?? slot.startTime,
      endTime: input.endTime ?? slot.endTime,
      status: input.status || slot.status,
    };
    assertValidSlotInput(next);
    const timeChanged = next.date !== slot.date || next.startTime !== slot.startTime || next.endTime !== slot.endTime;
    await lockScheduleDates([slot.date, next.date], session);

    const activeBooking = await Booking.exists({ slotId: slot._id, status: 'confirmed' }).session(session);
    const hasBookingHistory = await Booking.exists({
      $or: [{ slotId: slot._id }, { 'rescheduleHistory.slotId': slot._id }],
    }).session(session);
    if (activeBooking && (timeChanged || next.status !== 'booked')) {
      throw new ApiError(409, 'This slot has an active booking and cannot be changed.');
    }
    if (hasBookingHistory && timeChanged) {
      throw new ApiError(409, 'This slot has booking history; its date and times are locked. Change availability or create a new slot instead.');
    }
    if (timeChanged) {
      assertFutureSlot(next.date, next.startTime);
      await assertNoOverlap({ ...next, excludeId: slot._id }, session);
    }
    if (next.status === 'unavailable' && activeBooking) {
      throw new ApiError(409, 'Cancel or complete the existing booking before marking this slot unavailable.');
    }

    Object.assign(slot, next);
    await slot.save({ session });
    return slot;
  });
}

export async function deleteSlot(id) {
  return inScheduleTransaction(async (session) => {
    const slot = await Slot.findById(id).session(session);
    if (!slot) throw new ApiError(404, 'Appointment slot not found.');
    await lockScheduleDates([slot.date], session);

    const hasBookingHistory = await Booking.exists({
      $or: [{ slotId: slot._id }, { 'rescheduleHistory.slotId': slot._id }],
    }).session(session);
    if (hasBookingHistory) {
      throw new ApiError(409, 'A slot with booking history cannot be deleted; its appointment record must be preserved.');
    }
    if (slot.status === 'booked') throw new ApiError(409, 'A booked slot cannot be deleted.');

    const deleted = await Slot.findOneAndDelete(
      { _id: slot._id, status: { $in: ['available', 'unavailable'] } },
      { session },
    );
    if (!deleted) throw new ApiError(409, 'This slot changed while it was being deleted. Refresh the schedule and try again.');
    return deleted;
  });
}
