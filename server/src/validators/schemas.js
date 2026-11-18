import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record identifier.');
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const strongPassword = z.string()
  .min(12, 'Use at least 12 characters.')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password: strongPassword,
}).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const profileSchema = z.object({ name: z.string().trim().min(2).max(100), email }).strict();
export const passwordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: strongPassword }).strict();

export const slotSchema = z.object({
  date: isoDate,
  startTime: time,
  endTime: time,
  status: z.enum(['available', 'unavailable']).optional(),
}).strict().refine((value) => value.startTime < value.endTime, { message: 'End time must be after start time.', path: ['endTime'] });

export const bookingSchema = z.object({
  slotId: objectId,
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
}).strict();

export const bookingStatusSchema = z.object({ status: z.enum(['completed', 'no-show']) }).strict();
export const userStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const idParamSchema = z.object({ id: objectId });
export const slotQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(['available', 'booked', 'unavailable']).optional(),
});
export const bookingQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  date: isoDate.optional(),
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no-show']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const userQuerySchema = z.object({ q: z.string().trim().max(80).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
