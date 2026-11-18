import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { isDatabaseReady } from './config/database.js';
import { errorHandler } from './middleware/validate.js';
import authRoutes from './routes/authRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

export const app = express();

const allowedOrigins = new Set(env.clientOrigins);

app.disable('x-powered-by');
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.once('finish', () => {
    if (env.nodeEnv !== 'production') return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const record = {
      method: req.method,
      route: `${req.baseUrl}${req.route?.path || '/unmatched'}`,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    };
    const log = JSON.stringify(record);
    if (res.statusCode >= 500) console.error('[http-error]', log);
    else if (durationMs >= 1000) console.warn('[http-slow]', log);
    else console.info('[http-request]', log);
  });
  next();
});
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('This origin is not allowed by CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('This origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'ok', database: isDatabaseReady() ? 'connected' : 'disconnected' });
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/slots', slotRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use((_req, res) => res.status(404).json({ success: false, message: 'The requested API route was not found.' }));
app.use(errorHandler);
