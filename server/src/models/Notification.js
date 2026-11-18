import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  eventKey: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['booking-confirmed', 'reminder-24h', 'reminder-1h', 'booking-cancelled', 'booking-rescheduled'],
    required: true,
  },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 500 },
  isRead: { type: Boolean, default: false, required: true },
  readAt: { type: Date, default: null },
  metadata: {
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    bookingReference: { type: String, required: true },
  },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification
  || mongoose.model('Notification', notificationSchema);
