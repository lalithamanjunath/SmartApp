import jwt from 'jsonwebtoken';
import { env, validateAuthConfig } from '../config/env.js';
import { createCsrfToken, isValidCsrfToken } from './csrfToken.js';

const durationMultipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function cookieFlags() {
  const sameSite = env.cookieSameSite;
  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : env.cookieSecure,
    sameSite,
    path: '/',
  };
}

export function issueSession(res, user) {
  validateAuthConfig();
  const token = jwt.sign(
    { sub: String(user._id), av: user.authVersion || 0 },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: env.jwtExpiresIn },
  );
  const [, amount, unit] = /^(\d+)(s|m|h|d)$/.exec(env.jwtExpiresIn);
  res.cookie(env.cookieName, token, {
    ...cookieFlags(),
    maxAge: Number(amount) * durationMultipliers[unit],
  });
}

export function clearSession(res) {
  res.clearCookie(env.cookieName, cookieFlags());
  res.clearCookie('tandem_csrf', cookieFlags());
}

export function csrfCookieOptions() {
  validateAuthConfig();
  const [, amount, unit] = /^(\d+)(s|m|h|d)$/.exec(env.jwtExpiresIn);
  return {
    ...cookieFlags(),
    httpOnly: false,
    maxAge: Number(amount) * durationMultipliers[unit],
  };
}

export function issueCsrfToken(req, res) {
  validateAuthConfig();
  const existing = req.cookies?.tandem_csrf;
  const token = existing && isValidCsrfToken(existing) ? existing : createCsrfToken();
  if (token !== existing) res.cookie('tandem_csrf', token, csrfCookieOptions());
  return token;
}
