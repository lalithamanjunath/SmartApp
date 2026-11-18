import { Router } from 'express';
import { notifications, unreadCount, markRead, markReadAll, removeNotification } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema, notificationQuerySchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireDatabase, requireAuth);
router.get('/unread-count', asyncHandler(unreadCount));
router.get('/', validate(notificationQuerySchema, 'query'), asyncHandler(notifications));
router.patch('/read-all', asyncHandler(markReadAll));
router.patch('/:id/read', validate(idParamSchema, 'params'), asyncHandler(markRead));
router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(removeNotification));

export default router;
