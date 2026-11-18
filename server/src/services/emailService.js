import crypto from 'node:crypto';
import { EmailDelivery } from '../models/EmailDelivery.js';
import { env } from '../config/env.js';
import {
  getEmailDeliveryConfigurationIssues,
  getEmailEncryptionKey,
  isEmailDeliveryConfigured,
} from '../config/email.js';
import { ApiError } from '../utils/ApiError.js';

export { getEmailDeliveryConfigurationIssues, isEmailDeliveryConfigured } from '../config/email.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const MAX_ATTEMPTS = 8;
const REQUEST_TIMEOUT_MS = 10_000;
const LEASE_MS = 30_000;
const PROVIDER_IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;

export function requireEmailDeliveryConfiguration({ requireClientUrl = false } = {}) {
  if (!isEmailDeliveryConfigured() || (requireClientUrl && !env.clientAppUrl)) {
    throw new ApiError(503, 'Password reset email is not configured. Contact support or try again later.');
  }
}

function encryptPayload(payload) {
  const key = getEmailEncryptionKey();
  if (!key) throw new ApiError(503, 'Email delivery is not configured.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptEmailPayload(payloadCiphertext) {
  const key = getEmailEncryptionKey();
  if (!key) throw new Error('Email encryption key is unavailable.');
  const [encodedIv, encodedTag, encodedCiphertext] = payloadCiphertext.split('.');
  if (!encodedIv || !encodedTag || !encodedCiphertext) throw new Error('Queued email payload is malformed.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  const cleartext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(cleartext);
}

export async function enqueueEmail({ eventKey, userId, type, payload, session }) {
  if (!isEmailDeliveryConfigured()) return null;
  const record = {
    eventKey,
    userId: userId || null,
    type,
    payloadCiphertext: encryptPayload(payload),
    status: 'queued',
    nextAttemptAt: new Date(),
  };
  try {
    return await EmailDelivery.findOneAndUpdate(
      { eventKey },
      { $setOnInsert: record },
      { upsert: true, new: true, ...(session ? { session } : {}) },
    );
  } catch (error) {
    if (error.code === 11000 && !session) return EmailDelivery.findOne({ eventKey });
    throw error;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function buildAppointmentEmail({ to, eventKey, type, booking, slot }) {
  const copy = {
    'booking-confirmed': {
      deliveryType: 'appointment-confirmation',
      subject: 'Your Tandem appointment is confirmed',
      heading: 'Appointment confirmed',
      intro: 'Your appointment has been successfully registered.',
    },
    'booking-cancelled': {
      deliveryType: 'appointment-cancellation',
      subject: 'Your Tandem appointment was cancelled',
      heading: 'Appointment cancelled',
      intro: 'Your appointment has been cancelled.',
    },
    'booking-rescheduled': {
      deliveryType: 'appointment-rescheduled',
      subject: 'Your Tandem appointment was rescheduled',
      heading: 'Appointment rescheduled',
      intro: 'Your appointment time has been updated.',
    },
    'reminder-24h': {
      deliveryType: 'appointment-reminder-24h',
      subject: 'Reminder: your Tandem appointment is tomorrow',
      heading: 'Appointment reminder',
      intro: 'Your appointment is coming up in about 24 hours.',
    },
    'reminder-1h': {
      deliveryType: 'appointment-reminder-1h',
      subject: 'Reminder: your Tandem appointment is in one hour',
      heading: 'Appointment reminder',
      intro: 'Your appointment is coming up in about one hour.',
    },
  }[type];
  if (!copy) throw new Error('Unsupported appointment email type.');
  const date = escapeHtml(slot.date);
  const time = escapeHtml(`${slot.startTime}–${slot.endTime} UTC`);
  const reference = escapeHtml(booking.bookingReference);
  const text = `${copy.intro}\n\nDate: ${slot.date}\nTime: ${slot.startTime}–${slot.endTime} UTC\nBooking reference: ${booking.bookingReference}`;
  const html = `<main><h1>${copy.heading}</h1><p>${copy.intro}</p><p><strong>Date:</strong> ${date}<br><strong>Time:</strong> ${time}<br><strong>Booking reference:</strong> ${reference}</p></main>`;
  return {
    eventKey,
    userId: booking.userId || null,
    type: copy.deliveryType,
    payload: { from: env.resendFromEmail, to: [to], subject: copy.subject, text, html },
  };
}

export async function enqueueAppointmentEmail({ to, type, booking, slot, eventKey, session }) {
  if (!isEmailDeliveryConfigured()) return null;
  const email = buildAppointmentEmail({ to, type, booking, slot, eventKey });
  return enqueueEmail({ ...email, session });
}

export async function enqueuePasswordResetEmail({ to, userId, resetUrl, eventKey, session }) {
  const safeUrl = escapeHtml(resetUrl);
  const text = `A password reset was requested for your Tandem account. This link expires in 30 minutes and can only be used once:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  const html = `<main><h1>Reset your Tandem password</h1><p>A password reset was requested for your account.</p><p><a href="${safeUrl}">Reset password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p></main>`;
  return enqueueEmail({
    eventKey,
    userId,
    type: 'password-reset',
    payload: { from: env.resendFromEmail, to: [to], subject: 'Reset your Tandem password', text, html },
    session,
  });
}

export async function enqueuePasswordChangedEmail({ to, userId, eventKey, session }) {
  const text = 'Your Tandem account password was changed. If you did not make this change, contact support immediately.';
  const html = '<main><h1>Password changed</h1><p>Your Tandem account password was changed.</p><p>If you did not make this change, contact support immediately.</p></main>';
  return enqueueEmail({
    eventKey,
    userId,
    type: 'password-changed',
    payload: { from: env.resendFromEmail, to: [to], subject: 'Your Tandem password was changed', text, html },
    session,
  });
}

async function updateDeliveryAfterFailure(job, { retryable, errorMessage }) {
  const now = new Date();
  if (retryable && job.attempts < MAX_ATTEMPTS) {
    const delay = Math.min(60 * 60 * 1000, 30_000 * (2 ** (job.attempts - 1)));
    await EmailDelivery.updateOne(
      { _id: job._id, status: 'sending' },
      {
        $set: { status: 'queued', nextAttemptAt: new Date(now.getTime() + delay), leaseUntil: null, lastError: errorMessage },
      },
    );
    return;
  }
  await EmailDelivery.updateOne(
    { _id: job._id, status: 'sending' },
    { $set: { status: 'failed', leaseUntil: null, lastError: errorMessage } },
  );
}

export async function processEmailJob(id) {
  if (!isEmailDeliveryConfigured()) return false;
  const now = new Date();
  const job = await EmailDelivery.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { status: 'queued', nextAttemptAt: { $lte: now } },
        { status: 'sending', leaseUntil: { $lte: now } },
      ],
    },
    { $set: { status: 'sending', leaseUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
    { new: true },
  ).select('+payloadCiphertext');
  if (!job) return false;

  const firstAttemptAt = job.firstAttemptAt || now;
  if (now.getTime() - firstAttemptAt.getTime() >= PROVIDER_IDEMPOTENCY_WINDOW_MS) {
    await EmailDelivery.updateOne(
      { _id: job._id, status: 'sending' },
      { $set: { status: 'failed', leaseUntil: null, lastError: 'The provider retry window expired before delivery was confirmed.' } },
    );
    return true;
  }
  if (!job.firstAttemptAt) {
    const recorded = await EmailDelivery.updateOne(
      { _id: job._id, status: 'sending', firstAttemptAt: null },
      { $set: { firstAttemptAt } },
    );
    if (recorded.modifiedCount !== 1) return false;
  }

  let payload;
  try {
    payload = decryptEmailPayload(job.payloadCiphertext);
  } catch {
    await EmailDelivery.updateOne(
      { _id: job._id, status: 'sending' },
      { $set: { status: 'failed', leaseUntil: null, lastError: 'Queued email could not be decrypted.' } },
    );
    return true;
  }

  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': job.eventKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      await updateDeliveryAfterFailure(job, {
        retryable,
        errorMessage: `Email provider returned HTTP ${response.status}.`,
      });
      return true;
    }
    const result = await response.json();
    if (!result.id) {
      await updateDeliveryAfterFailure(job, { retryable: true, errorMessage: 'Email provider response did not include a message ID.' });
      return true;
    }
    await EmailDelivery.updateOne(
      { _id: job._id, status: 'sending' },
      { $set: { status: 'accepted', providerMessageId: result.id, acceptedAt: new Date(), leaseUntil: null, lastError: null } },
    );
    return true;
  } catch (error) {
    await updateDeliveryAfterFailure(job, {
      retryable: true,
      errorMessage: error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Email provider request timed out.'
        : 'Email provider could not be reached.',
    });
    return true;
  }
}

export async function processEmailQueue({ batchSize = 10 } = {}) {
  if (!isEmailDeliveryConfigured()) return 0;
  let processed = 0;
  for (let index = 0; index < batchSize; index += 1) {
    const now = new Date();
    const candidate = await EmailDelivery.findOne({
      $or: [
        { status: 'queued', nextAttemptAt: { $lte: now } },
        { status: 'sending', leaseUntil: { $lte: now } },
      ],
    }).sort({ nextAttemptAt: 1, createdAt: 1 }).select('_id').lean();
    if (!candidate) break;
    if (await processEmailJob(candidate._id)) processed += 1;
  }
  return processed;
}

export function startEmailWorker({ intervalMs = 5_000, logger = console } = {}) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processEmailQueue();
    } catch (error) {
      logger.error('[email-worker] Queue processing failed:', error.name);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
