import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env, validateAuthConfig } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeUser } from '../utils/serialize.js';

function cookieOptions() {
  const sameSite = env.cookieSameSite;
  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : env.cookieSecure,
    sameSite,
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function issueSession(res, user) {
  validateAuthConfig();
  const token = jwt.sign({ sub: String(user._id) }, env.jwtSecret, { algorithm: 'HS256', expiresIn: env.jwtExpiresIn });
  res.cookie(env.cookieName, token, cookieOptions());
}

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
  const { httpOnly, secure, sameSite, path } = cookieOptions();
  res.clearCookie(env.cookieName, { httpOnly, secure, sameSite, path });
  res.json({ success: true, message: 'You have been signed out.' });
}

export function me(req, res) {
  res.json({ success: true, data: { user: safeUser(req.user) } });
}
