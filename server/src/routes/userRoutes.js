import { Router } from 'express';
import { updateProfile, changePassword } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { profileSchema, passwordSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireDatabase, requireAuth);
router.patch('/me', validate(profileSchema), asyncHandler(updateProfile));
router.patch('/me/password', validate(passwordSchema), asyncHandler(changePassword));

export default router;
