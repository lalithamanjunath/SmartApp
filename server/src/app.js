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
import { requireCsrfForCookieRequests } from './middleware/csrf.js';
import { verifyResendWebhook } from './services/emailWebhookService.js';
import { ApiError, asyncHandler } from './utils/ApiError.js';

export const app = express();

const allowedOrigins = new Set(env.clientOrigins);

function allowOrigin(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  return callback(new ApiError(403, 'This origin is not allowed by CORS.'));
}

const corsOptions = {
  origin: allowOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};

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
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.post('/api/webhooks/resend', express.raw({ type: 'application/json', limit: '256kb' }), asyncHandler(async (req, res) => {
  const result = await verifyResendWebhook(req.body, {
    id: req.get('svix-id'),
    timestamp: req.get('svix-timestamp'),
    signature: req.get('svix-signature'),
  });
  res.json({ success: true, data: result });
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requireCsrfForCookieRequests);

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
