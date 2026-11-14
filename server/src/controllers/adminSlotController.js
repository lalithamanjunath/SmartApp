import { createSlot, deleteSlot, listSlots, updateSlot } from '../services/slotService.js';

export async function adminListSlots(req, res) {
  const slots = await listSlots(req.validatedQuery || req.query);
  res.json({ success: true, data: { slots } });
}

export async function adminCreateSlot(req, res) {
  const slot = await createSlot(req.body, req.user._id);
  res.status(201).json({ success: true, data: { slot } });
}

export async function adminUpdateSlot(req, res) {
  const slot = await updateSlot(req.params.id, req.body);
  res.json({ success: true, data: { slot } });
}

export async function adminDeleteSlot(req, res) {
  await deleteSlot(req.params.id);
  res.json({ success: true, message: 'Appointment slot deleted.' });
}
