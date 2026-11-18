import { User } from '../models/User.js';
import { validateAuthConfig } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeUser } from '../utils/serialize.js';
import { clearSession, issueCsrfToken, issueSession } from '../utils/session.js';

export async function register(req, res) {
  validateAuthConfig();
  const existing = await User.exists({ email: req.body.email });
  if (existing) throw new ApiError(409, 'An account with that email already exists.');
  const user = await User.create({ name: req.body.name, email: req.body.email, password: req.body.password, role: 'user' });
  issueSession(res, user);
  res.status(201).json({ success: true, data: { user: safeUser(user) } });
}

export async function login(req, res) {
  validateAuthConfig();
  const user = await User.findOne({ email: req.body.email }).select('+password');
  const valid = user ? await user.comparePassword(req.body.password) : false;
  if (!valid || !user.isActive) throw new ApiError(401, 'Email or password is incorrect.');
  issueSession(res, user);
  res.json({ success: true, data: { user: safeUser(user) } });
}

export function logout(_req, res) {
  clearSession(res);
  res.json({ success: true, message: 'You have been signed out.' });
}

export function me(req, res) {
  res.json({ success: true, data: { user: safeUser(req.user) } });
}

export function csrfToken(req, res) {
  res.json({ success: true, data: { csrfToken: issueCsrfToken(req, res) } });
}
