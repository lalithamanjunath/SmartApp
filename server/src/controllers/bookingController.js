import { createBooking, listUserBookings, getUserBooking, cancelBooking } from '../services/bookingService.js';
import { ApiError } from '../utils/ApiError.js';

export async function book(req, res) {
  const booking = await createBooking({ userId: req.user._id, ...req.body });
  res.status(201).json({ success: true, data: { booking } });
}

export async function myBookings(req, res) {
  const status = req.query.status;
  if (status && !['confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) throw new ApiError(400, 'Choose a valid booking status.');
  const bookings = await listUserBookings(req.user._id, status);
  res.json({ success: true, data: { bookings } });
}

export async function bookingDetails(req, res) {
  const booking = await getUserBooking(req.user._id, req.params.id);
  res.json({ success: true, data: { booking } });
}

export async function cancel(req, res) {
  const booking = await cancelBooking(req.user._id, req.params.id);
  res.json({ success: true, data: { booking } });
}
