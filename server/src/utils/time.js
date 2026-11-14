import { ApiError } from './ApiError.js';

export function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function slotStart(date, time) {
  const value = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(value.getTime())) throw new ApiError(400, 'The appointment date or time is invalid.');
  return value;
}

export function assertFutureSlot(date, time, now = new Date()) {
  if (!isValidDateString(date) || slotStart(date, time) <= now) {
    throw new ApiError(400, 'Appointment slots must start in the future.');
  }
}

export function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}
