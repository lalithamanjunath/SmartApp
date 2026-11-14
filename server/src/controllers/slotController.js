import { getSlot, listAvailableSlots } from '../services/slotService.js';

export async function listPublicSlots(req, res) {
  const slots = await listAvailableSlots(req.validatedQuery || req.query);
  res.json({ success: true, data: { slots } });
}

export async function getPublicSlot(req, res) {
  const slot = await getSlot(req.params.id);
  res.json({ success: true, data: { slot } });
}
