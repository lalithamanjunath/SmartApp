import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Try again in 15 minutes.' } });
router.post('/register', requireDatabase, authLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', requireDatabase, authLimiter, validate(loginSchema), asyncHandler(login));
router.post('/logout', logout);
router.get('/me', requireDatabase, requireAuth, asyncHandler(me));

export default router;
