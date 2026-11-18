import { Router } from 'express';
import { book, myBookings, bookingDetails, cancel, reschedule } from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { bookingSchema, idParamSchema, memberBookingQuerySchema, rescheduleSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireDatabase, requireAuth);
router.post('/', validate(bookingSchema), asyncHandler(book));
router.get('/my', validate(memberBookingQuerySchema, 'query'), asyncHandler(myBookings));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(bookingDetails));
router.patch('/:id/cancel', validate(idParamSchema, 'params'), asyncHandler(cancel));
router.patch('/:id/reschedule', validate(idParamSchema, 'params'), validate(rescheduleSchema), asyncHandler(reschedule));

export default router;
