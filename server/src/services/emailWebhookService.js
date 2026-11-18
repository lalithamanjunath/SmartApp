import crypto from 'node:crypto';
import { EmailDelivery } from '../models/EmailDelivery.js';
import { getResendWebhookSigningKey } from '../config/email.js';
import { ApiError } from '../utils/ApiError.js';

const trackedEvents = {
  'email.sent': 'accepted',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.failed': 'failed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.suppressed': 'failed',
};

function isValidSignature(rawBody, { id, timestamp, signature }, key) {
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest();
  return signature.split(' ').some((entry) => {
    const [version, encodedSignature] = entry.split(',');
    if (version !== 'v1' || !encodedSignature) return false;
    const provided = Buffer.from(encodedSignature, 'base64');
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  });
}

export async function verifyResendWebhook(rawBody, headers) {
  const key = getResendWebhookSigningKey();
  if (!key) throw new ApiError(503, 'Email delivery webhooks are not configured.');
  if (!Buffer.isBuffer(rawBody)) throw new ApiError(400, 'Invalid webhook request.');
  const body = rawBody.toString('utf8');
  if (!isValidSignature(body, headers, key)) throw new ApiError(400, 'Invalid webhook signature.');

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    throw new ApiError(400, 'Invalid webhook payload.');
  }
  const status = trackedEvents[event.type];
  const emailId = event.data?.email_id;
  if (!status || !emailId) return { ignored: true };

  const current = await EmailDelivery.findOne({ providerMessageId: emailId })
    .select('status lastProviderEventAt providerEventIds');
  if (!current || current.providerEventIds.includes(headers.id)) return { ignored: true };
  const eventAt = new Date(event.created_at);
  if (Number.isNaN(eventAt.getTime())) throw new ApiError(400, 'Invalid webhook event time.');

  const shouldUpdateStatus = !current.lastProviderEventAt || eventAt >= current.lastProviderEventAt;
  const update = { $addToSet: { providerEventIds: headers.id } };
  const filter = { _id: current._id, providerEventIds: { $ne: headers.id } };
  if (shouldUpdateStatus) {
    filter.$or = [{ lastProviderEventAt: null }, { lastProviderEventAt: { $lte: eventAt } }];
    update.$set = { status, lastProviderEventAt: eventAt };
    if (status === 'delivered') update.$set.deliveredAt = eventAt;
    if (status === 'failed' || status === 'bounced' || status === 'complained') {
      update.$set.lastError = `Resend reported ${event.type}.`;
    }
  }
  await EmailDelivery.updateOne(filter, update);
  return { received: true };
}
