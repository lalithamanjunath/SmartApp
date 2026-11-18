import { Booking } from '../models/Booking.js';
import { Slot } from '../models/Slot.js';
import { createReminderIfMissing } from './notificationService.js';
import { formatDateKey, slotStart } from '../utils/time.js';

const reminderWindows = [
  { type: 'reminder-24h', hours: 24 },
  { type: 'reminder-1h', hours: 1 },
];

export async function generateDueReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const slots = await Slot.find({
    status: 'booked',
    date: { $gte: formatDateKey(now), $lte: formatDateKey(horizon) },
  }).select('_id date startTime endTime').lean();
  if (!slots.length) return 0;

  const slotById = new Map(slots.map((slot) => [String(slot._id), slot]));
  const bookings = await Booking.find({
    status: 'confirmed',
    slotId: { $in: slots.map((slot) => slot._id) },
  }).select('_id userId slotId bookingReference').lean();

  let created = 0;
  for (const booking of bookings) {
    const slot = slotById.get(String(booking.slotId));
    const startsAt = slotStart(slot.date, slot.startTime).getTime();
    if (startsAt <= now.getTime()) continue;
    for (const reminder of reminderWindows) {
      if (startsAt <= now.getTime() + reminder.hours * 60 * 60 * 1000) {
        if (await createReminderIfMissing({ booking, slot, type: reminder.type })) created += 1;
      }
    }
  }
  return created;
}

export function startReminderScheduler({ intervalMs = 60_000, logger = console } = {}) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await generateDueReminders();
    } catch (error) {
      logger.error('[reminder-worker] Failed to generate appointment reminders:', error.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
