import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { enqueuePasswordChangedEmail, enqueuePasswordResetEmail, requireEmailDeliveryConfiguration } from '../services/emailService.js';
import { ApiError } from '../utils/ApiError.js';

const genericResponse = {
  success: true,
  message: 'If an active account matches that email, a password reset link will be sent.',
};

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(req, res) {
  requireEmailDeliveryConfiguration({ requireClientUrl: true });
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  const resetUrl = new URL('/reset-password', `${env.clientAppUrl}/`);
  resetUrl.hash = new URLSearchParams({ token }).toString();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ email: req.body.email, isActive: true })
        .select('+passwordResetTokenHash +passwordResetExpiresAt')
        .session(session);
      if (!user) return;
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save({ session });
      await enqueuePasswordResetEmail({
        to: user.email,
        userId: user._id,
        resetUrl: resetUrl.toString(),
        eventKey: `password-reset:${crypto.randomUUID()}`,
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  res.status(202).json(genericResponse);
}

export async function resetPassword(req, res) {
  requireEmailDeliveryConfiguration();
  const tokenHash = hashResetToken(req.body.token);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
        isActive: true,
      }).select('+password +passwordResetTokenHash +passwordResetExpiresAt').session(session);
      if (!user) throw new ApiError(400, 'This password reset link is invalid or has expired.');
      user.password = req.body.password;
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
    });
  } finally {
    await session.endSession();
  }
  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
}
