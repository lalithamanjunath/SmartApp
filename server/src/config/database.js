import mongoose from 'mongoose';
import { env } from './env.js';
import { User } from '../models/User.js';
import { Slot } from '../models/Slot.js';
import { Booking } from '../models/Booking.js';
import { SlotScheduleLock } from '../models/SlotScheduleLock.js';

mongoose.set('strictQuery', true);
let connectionPromise = null;

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(uri = env.mongoUri) {
  if (!uri) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to connect to MongoDB Atlas.');
  }
  if (isDatabaseReady()) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        autoIndex: env.nodeEnv !== 'production',
      });
      await Promise.all([User.createIndexes(), Slot.createIndexes(), Booking.createIndexes(), SlotScheduleLock.createIndexes()]);
      return mongoose.connection;
    } catch (error) {
      await mongoose.disconnect();
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();
  return connectionPromise;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
