import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`Tandem API listening on http://0.0.0.0:${env.port}`);
  if (!env.mongoUri) {
    console.warn('MongoDB Atlas is not connected. Configure MONGODB_URI before using authenticated or persistent features.');
    return;
  }
  connectDatabase().then(() => console.log('MongoDB Atlas connected.')).catch((error) => {
    console.error('MongoDB Atlas connection failed:', error.message);
  });
});

function shutdown(signal) {
  console.log(`${signal} received; closing API server.`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
