import { Router } from 'express';
import { getPublicSlot, listPublicSlots } from '../controllers/slotController.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validate } from '../middleware/validate.js';
import { slotQuerySchema, idParamSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/ApiError.js';

const router = Router();
router.use(requireDatabase);
router.get('/', validate(slotQuerySchema, 'query'), asyncHandler(listPublicSlots));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getPublicSlot));

export default router;
