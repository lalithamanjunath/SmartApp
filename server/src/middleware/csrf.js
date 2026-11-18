import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { isValidCsrfToken } from '../utils/csrfToken.js';

const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireCsrfForCookieRequests(req, _res, next) {
  if (!stateChangingMethods.has(req.method) || !req.cookies?.[env.cookieName] || !req.get('origin')) return next();
  const cookieToken = req.cookies.tandem_csrf || '';
  const headerToken = req.get('x-csrf-token') || '';
  const cookieBytes = Buffer.from(cookieToken);
  const headerBytes = Buffer.from(headerToken);
  if (!cookieBytes.length || cookieBytes.length !== headerBytes.length
    || !crypto.timingSafeEqual(cookieBytes, headerBytes) || !isValidCsrfToken(cookieToken)) {
    return next(new ApiError(403, 'The request could not be verified. Refresh and try again.'));
  }
  next();
}
