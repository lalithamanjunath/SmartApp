import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  bookingReference: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'completed', 'no-show'], default: 'confirmed', required: true },
  bookedAt: { type: Date, default: Date.now, required: true },
  cancelledAt: { type: Date, default: null },
  idempotencyKey: { type: String, default: undefined },
  rescheduleHistory: {
    type: [{
      slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
      date: { type: String, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      rescheduledAt: { type: Date, required: true },
    }],
    default: [],
  },
  rescheduleRequestHashes: { type: [String], default: [], select: false },
}, { timestamps: true, versionKey: false });

bookingSchema.index(
  { slotId: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' }, name: 'one_active_booking_per_slot' },
);
bookingSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } }, name: 'user_idempotency_key' },
);
bookingSchema.index({ userId: 1, status: 1, bookedAt: -1 });
bookingSchema.index({ userId: 1, bookedAt: -1 });
bookingSchema.index({ status: 1, bookedAt: -1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ 'rescheduleHistory.slotId': 1 });

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
