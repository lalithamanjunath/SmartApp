import mongoose from 'mongoose';

const slotScheduleLockSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  revision: { type: Number, required: true, default: 0 },
}, { timestamps: true, versionKey: false });

slotScheduleLockSchema.index({ date: 1 }, { unique: true, name: 'unique_schedule_lock_per_utc_day' });

export const SlotScheduleLock = mongoose.models.SlotScheduleLock
  || mongoose.model('SlotScheduleLock', slotScheduleLockSchema);
