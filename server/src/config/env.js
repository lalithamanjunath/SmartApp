import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

const sameSite = (process.env.COOKIE_SAME_SITE || 'none').toLowerCase();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
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
}
