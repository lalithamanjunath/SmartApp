import mongoose from 'mongoose';

const emailDeliverySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  eventKey: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: [
      'appointment-confirmation',
      'appointment-cancellation',
      'appointment-reminder-24h',
      'appointment-reminder-1h',
      'appointment-rescheduled',
      'password-reset',
      'password-changed',
    ],
    required: true,
  },
  payloadCiphertext: { type: String, required: true, select: false },
  status: {
    type: String,
    enum: ['queued', 'sending', 'accepted', 'delayed', 'delivered', 'failed', 'bounced', 'complained'],
    default: 'queued',
    required: true,
  },
  attempts: { type: Number, default: 0, required: true },
  nextAttemptAt: { type: Date, default: Date.now, required: true },
  firstAttemptAt: { type: Date, default: null },
  leaseUntil: { type: Date, default: null },
  providerMessageId: { type: String, default: null },
  providerEventIds: { type: [String], default: [] },
  lastProviderEventAt: { type: Date, default: null },
  lastError: { type: String, default: null, maxlength: 200 },
  acceptedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

emailDeliverySchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
emailDeliverySchema.index({ status: 1, leaseUntil: 1 });
emailDeliverySchema.index({ providerMessageId: 1 }, { sparse: true });

export const EmailDelivery = mongoose.models.EmailDelivery
  || mongoose.model('EmailDelivery', emailDeliverySchema);
