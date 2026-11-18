import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function createCsrfToken() {
  const nonce = crypto.randomBytes(32).toString('base64url');
  const signature = crypto.createHmac('sha256', env.jwtSecret).update(nonce).digest('base64url');
  return `${nonce}.${signature}`;
}

export function isValidCsrfToken(token) {
  const [nonce, signature, extra] = String(token || '').split('.');
  if (!nonce || !signature || extra || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) return false;
  const expected = crypto.createHmac('sha256', env.jwtSecret).update(nonce).digest();
  const provided = Buffer.from(signature, 'base64url');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}
