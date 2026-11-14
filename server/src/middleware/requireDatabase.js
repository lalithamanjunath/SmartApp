import { connectDatabase } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';

export async function requireDatabase(_req, _res, next) {
  try {
    await connectDatabase();
    next();
  } catch {
    next(new ApiError(503, 'MongoDB Atlas is not connected. Configure MONGODB_URI and try again.'));
  }
}
