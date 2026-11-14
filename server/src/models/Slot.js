import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  startTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  status: { type: String, enum: ['available', 'booked', 'unavailable'], default: 'available', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, versionKey: false });

slotSchema.index({ date: 1, startTime: 1 }, { unique: true });
slotSchema.index({ status: 1, date: 1, startTime: 1 });

export const Slot = mongoose.models.Slot || mongoose.model('Slot', slotSchema);
