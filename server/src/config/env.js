import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

export function normalizeOrigin(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate) return '';

  try {
    return new URL(candidate).origin;
  } catch {
    return candidate.replace(/\/+$/, '');
  }
}

export function normalizeOrigins(rawValue) {
  const list = (rawValue ?? '')
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);

  return [...new Set(list)];
}

const sameSite = (process.env.COOKIE_SAME_SITE || 'none').toLowerCase();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  mongoDnsServers: (process.env.MONGODB_DNS_SERVERS || '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigins: normalizeOrigins(process.env.CLIENT_ORIGIN || 'http://localhost:3000'),
  clientAppUrl: (process.env.CLIENT_APP_URL || '').replace(/\/+$/, ''),
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || '',
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  emailEncryptionKey: process.env.EMAIL_ENCRYPTION_KEY || '',
  cookieName: 'tandem_session',
  cookieSameSite: ['lax', 'strict', 'none'].includes(sameSite) ? sameSite : 'none',
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, sameSite === 'none'),
  cancellationCutoffHours: Math.max(0, Number(process.env.CANCELLATION_CUTOFF_HOURS) || 24),
};

export function validateAuthConfig() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    const error = new Error('Authentication is not configured. Set JWT_SECRET to at least 32 characters.');
    error.status = 503;
    throw error;
  }
  if (!/^(\d+)(s|m|h|d)$/.test(env.jwtExpiresIn)) {
    const error = new Error('Authentication is not configured. JWT_EXPIRES_IN must be a duration such as 8h or 30m.');
    error.status = 503;
    throw error;
  }
}
