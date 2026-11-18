import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me, csrfToken } from '../controllers/authController.js';
import { requestPasswordReset, resetPassword } from '../controllers/passwordResetController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Try again in 15 minutes.' } });
const resetRequestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many password reset requests. Try again later.' } });
const resetPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many password reset attempts. Try again later.' } });
router.post('/register', requireDatabase, authLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', requireDatabase, authLimiter, validate(loginSchema), asyncHandler(login));
router.post('/forgot-password', requireDatabase, resetRequestLimiter, validate(forgotPasswordSchema), asyncHandler(requestPasswordReset));
router.post('/reset-password', requireDatabase, resetPasswordLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));
router.get('/csrf', csrfToken);
router.post('/logout', logout);
router.get('/me', requireDatabase, requireAuth, asyncHandler(me));

export default router;
