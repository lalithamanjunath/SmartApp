import { env } from './env.js';

function decodeBase64(value) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length && decoded.toString('base64') === value ? decoded : null;
}

export function getEmailEncryptionKey() {
  const key = decodeBase64(env.emailEncryptionKey);
  return key?.length === 32 ? key : null;
}

export function getResendWebhookSigningKey() {
  const secret = env.resendWebhookSecret.startsWith('whsec_')
    ? env.resendWebhookSecret.slice(6)
    : env.resendWebhookSecret;
  return decodeBase64(secret);
}

export function getEmailDeliveryConfigurationIssues() {
  const missing = [];
  const invalid = [];

  if (!env.resendApiKey.trim()) missing.push('RESEND_API_KEY');
  if (!env.resendFromEmail.trim()) missing.push('RESEND_FROM_EMAIL');
  if (!env.resendWebhookSecret.trim()) {
    missing.push('RESEND_WEBHOOK_SECRET');
  } else if (!getResendWebhookSigningKey()) {
    invalid.push('RESEND_WEBHOOK_SECRET');
  }
  if (!env.emailEncryptionKey.trim()) {
    missing.push('EMAIL_ENCRYPTION_KEY');
  } else if (!getEmailEncryptionKey()) {
    invalid.push('EMAIL_ENCRYPTION_KEY');
  }

  return { missing, invalid };
}

export function isEmailDeliveryConfigured() {
  const { missing, invalid } = getEmailDeliveryConfigurationIssues();
  return missing.length === 0 && invalid.length === 0;
}
