import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env, validateAuthConfig } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function readToken(req) {
  const cookie = req.cookies?.[env.cookieName];
  if (cookie) return cookie;
  const authorization = req.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
}

export async function requireAuth(req, _res, next) {
  try {
    validateAuthConfig();
    const token = readToken(req);
    if (!token) throw new ApiError(401, 'Please sign in to continue.');
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findById(payload.sub).select('name email role isActive createdAt authVersion');
    if (!user || !user.isActive) throw new ApiError(401, 'Your session is no longer valid. Please sign in again.');
    if ((payload.av ?? 0) !== user.authVersion) throw new ApiError(401, 'Your session is no longer valid. Please sign in again.');
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Your session has expired. Please sign in again.'));
    }
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to access this resource.'));
    next();
  };
}
