import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(new ApiError(400, 'Please check the submitted information.', result.error.flatten()));
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({ success: false, message: 'Please check the submitted information.', errors: error.flatten() });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: 'That record already exists.' });
  }
  const status = Number(error.status) || 500;
  const message = status >= 500 && status !== 503 ? 'Something went wrong. Please try again.' : error.message;
  if (status >= 500) console.error('[api-error]', error.message);
  return res.status(status).json({ success: false, message, ...(error.details ? { errors: error.details } : {}) });
}
