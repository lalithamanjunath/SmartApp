import { Router } from 'express';
import { adminCreateSlot, adminDeleteSlot, adminListSlots, adminUpdateSlot } from '../controllers/adminSlotController.js';
import { adminBookingDetails, adminBookings, analytics, dashboard, setBookingStatus, setUserStatus, userDetails, users } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { bookingQuerySchema, bookingStatusSchema, idParamSchema, slotQuerySchema, slotSchema, userQuerySchema, userStatusSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireDatabase, requireAuth, requireRole('admin'));
router.get('/dashboard', asyncHandler(dashboard));
router.get('/analytics', asyncHandler(analytics));
router.get('/slots', validate(slotQuerySchema, 'query'), asyncHandler(adminListSlots));
router.post('/slots', validate(slotSchema), asyncHandler(adminCreateSlot));
router.put('/slots/:id', validate(idParamSchema, 'params'), validate(slotSchema), asyncHandler(adminUpdateSlot));
router.delete('/slots/:id', validate(idParamSchema, 'params'), asyncHandler(adminDeleteSlot));
router.get('/bookings', validate(bookingQuerySchema, 'query'), asyncHandler(adminBookings));
router.get('/bookings/:id', validate(idParamSchema, 'params'), asyncHandler(adminBookingDetails));
router.patch('/bookings/:id/status', validate(idParamSchema, 'params'), validate(bookingStatusSchema), asyncHandler(setBookingStatus));
router.get('/users', validate(userQuerySchema, 'query'), asyncHandler(users));
router.get('/users/:id', validate(idParamSchema, 'params'), asyncHandler(userDetails));
router.patch('/users/:id/status', validate(idParamSchema, 'params'), validate(userStatusSchema), asyncHandler(setUserStatus));

export default router;
