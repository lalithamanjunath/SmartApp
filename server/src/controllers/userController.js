import { User } from '../models/User.js';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { safeUser } from '../utils/serialize.js';
import { enqueuePasswordChangedEmail } from '../services/emailService.js';
import { issueSession } from '../utils/session.js';

export async function updateProfile(req, res) {
  const duplicate = await User.exists({ email: req.body.email, _id: { $ne: req.user._id } });
  if (duplicate) throw new ApiError(409, 'An account with that email already exists.');
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { name: req.body.name, email: req.body.email } }, { new: true, runValidators: true }).select('name email role isActive createdAt');
  res.json({ success: true, data: { user: safeUser(user) } });
}

export async function changePassword(req, res) {
  const session = await mongoose.startSession();
  let updatedUser;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).select('+password +passwordResetTokenHash +passwordResetExpiresAt').session(session);
      if (!user || !(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect.');
      user.password = req.body.newPassword;
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      user.authVersion = (user.authVersion || 0) + 1;
      await user.save({ session });
      await enqueuePasswordChangedEmail({
        to: user.email,
        userId: user._id,
        eventKey: `password-changed:${user._id}:${user.authVersion}`,
        session,
      });
      updatedUser = user;
    });
  } finally {
    await session.endSession();
  }
  issueSession(res, updatedUser);
  res.json({ success: true, message: 'Password updated successfully.' });
}
