import { createBooking, listUserBookings, getUserBooking, cancelBooking, rescheduleBooking } from '../services/bookingService.js';

export async function book(req, res) {
  const booking = await createBooking({ userId: req.user._id, userEmail: req.user.email, ...req.body });
  res.status(201).json({ success: true, data: { booking } });
}

export async function myBookings(req, res) {
  const { status, page, limit } = req.validatedQuery;
  const result = await listUserBookings(req.user._id, {
    status,
    page: req.query.page === undefined && req.query.limit === undefined ? undefined : page || 1,
    limit: req.query.page === undefined && req.query.limit === undefined ? undefined : limit || 20,
  });
  res.json({ success: true, data: result });
}

export async function bookingDetails(req, res) {
  const booking = await getUserBooking(req.user._id, req.params.id);
  res.json({ success: true, data: { booking } });
}

export async function cancel(req, res) {
  const booking = await cancelBooking(req.user._id, req.user.email, req.params.id);
  res.json({ success: true, data: { booking } });
}

export async function reschedule(req, res) {
  const booking = await rescheduleBooking({
    userId: req.user._id,
    userEmail: req.user.email,
    id: req.params.id,
    ...req.body,
  });
  res.json({ success: true, data: { booking } });
}
