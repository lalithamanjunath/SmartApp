import mongoose from 'mongoose';
import { addDays, format, startOfDay, subDays, subWeeks } from 'date-fns';
import { User } from '../models/User.js';
import { Slot } from '../models/Slot.js';
import { Booking } from '../models/Booking.js';
import { updateAdminBookingStatus } from '../services/bookingService.js';
import { ApiError } from '../utils/ApiError.js';
import { safeUser } from '../utils/serialize.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function recentSeries(days) {
  const today = startOfDay(new Date());
  const start = subDays(today, days - 1);
  const grouped = await Booking.aggregate([
    { $match: { createdAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  const byDay = new Map(grouped.map((item) => [item._id, item]));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const key = format(date, 'yyyy-MM-dd');
    const item = byDay.get(key);
    return { label: format(date, 'EEE'), date: key, bookings: item?.total || 0, cancelled: item?.cancelled || 0 };
  });
}

async function weeklySeries() {
  const since = subWeeks(startOfDay(new Date()), 7);
  const weeklyRaw = await Booking.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%G-W%V', date: '$createdAt' } }, bookings: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  return weeklyRaw.map((item) => ({ label: item._id, bookings: item.bookings, cancelled: item.cancelled }));
}

export async function dashboard(_req, res) {
  const [totalUsers, totalSlots, availableSlots, bookedSlots, totalBookings, cancelledBookings, completedAppointments, recentBookings, daily, weekly] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Slot.countDocuments(),
    Slot.countDocuments({ status: 'available' }),
    Slot.countDocuments({ status: 'booked' }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.find().sort({ createdAt: -1 }).limit(6).populate('userId', 'name email').populate('slotId').lean(),
    recentSeries(30),
    weeklySeries(),
  ]);
  res.json({ success: true, data: { stats: { totalUsers, totalSlots, availableSlots, bookedSlots, totalBookings, cancelledBookings, completedAppointments }, recentBookings, daily: daily.slice(-7), weekly } });
}

export async function analytics(_req, res) {
  const [daily, weekly] = await Promise.all([recentSeries(30), weeklySeries()]);
  res.json({ success: true, data: { daily, weekly } });
}

export async function adminBookings(req, res) {
  const { q, date, status, page, limit } = req.validatedQuery || req.query;
  const query = {};
  if (status) query.status = status;
  if (q) query.bookingReference = { $regex: escapeRegExp(q), $options: 'i' };
  if (date) {
    const slots = await Slot.find({ date }).select('_id').lean();
    const ids = slots.map((slot) => slot._id);
    if (ids.length === 0) return res.json({ success: true, data: { bookings: [], pagination: { page, limit, total: 0, pages: 0 } } });
    query.slotId = { $in: ids };
  }
  const [bookings, total] = await Promise.all([
    Booking.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'name email isActive').populate('slotId').lean(),
    Booking.countDocuments(query),
  ]);
  res.json({ success: true, data: { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

export async function adminBookingDetails(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Booking not found.');
  const booking = await Booking.findById(req.params.id).populate('userId', 'name email isActive createdAt').populate('slotId').lean();
  if (!booking) throw new ApiError(404, 'Booking not found.');
  res.json({ success: true, data: { booking } });
}

export async function setBookingStatus(req, res) {
  const booking = await updateAdminBookingStatus(req.params.id, req.body.status);
  res.json({ success: true, data: { booking } });
}

export async function users(req, res) {
  const { q, page, limit } = req.validatedQuery || req.query;
  const query = { role: 'user' };
  if (q) {
    const pattern = new RegExp(escapeRegExp(q), 'i');
    query.$or = [{ name: pattern }, { email: pattern }];
  }
  const [records, total] = await Promise.all([
    User.find(query).select('name email role isActive createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  const userIds = records.map((user) => user._id);
  const counts = await Booking.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', bookings: { $sum: 1 } } }]);
  const countByUser = new Map(counts.map((item) => [String(item._id), item.bookings]));
  res.json({ success: true, data: { users: records.map((user) => ({ ...safeUser(user), bookingCount: countByUser.get(String(user._id)) || 0 })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

export async function userDetails(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'User not found.');
  const user = await User.findOne({ _id: req.params.id, role: 'user' }).select('name email role isActive createdAt').lean();
  if (!user) throw new ApiError(404, 'User not found.');
  const bookings = await Booking.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).populate('slotId').lean();
  res.json({ success: true, data: { user: safeUser(user), bookings } });
}

export async function setUserStatus(req, res) {
  if (String(req.params.id) === String(req.user._id) && !req.body.isActive) throw new ApiError(409, 'You cannot deactivate your own administrator account.');
  const update = { $set: { isActive: req.body.isActive } };
  if (!req.body.isActive) update.$inc = { authVersion: 1 };
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'user' }, update, { new: true }).select('name email role isActive createdAt');
  if (!user) throw new ApiError(404, 'User not found.');
  res.json({ success: true, data: { user: safeUser(user) } });
}
