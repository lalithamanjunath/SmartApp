import { app } from './app.js';
import { env } from './config/env.js';
import { getEmailDeliveryConfigurationIssues } from './config/email.js';
import { connectDatabase } from './config/database.js';
import { startReminderScheduler } from './services/reminderService.js';
import { isEmailDeliveryConfigured, startEmailWorker } from './services/emailService.js';

let stopReminderScheduler = () => {};
let stopEmailWorker = () => {};
const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`Tandem API listening on http://0.0.0.0:${env.port}`);
  if (!env.mongoUri) {
    console.warn('MongoDB Atlas is not connected. Configure MONGODB_URI before using authenticated or persistent features.');
    return;
  }
  connectDatabase()
    .then(() => {
      console.log('MongoDB Atlas connected.');
      stopReminderScheduler = startReminderScheduler();
      if (isEmailDeliveryConfigured()) {
        stopEmailWorker = startEmailWorker();
        console.info('Email delivery worker started; local configuration checks passed.');
      } else {
        const { missing, invalid } = getEmailDeliveryConfigurationIssues();
        const details = [];
        if (missing.length) details.push(`missing: ${missing.join(', ')}`);
        if (invalid.length) details.push(`invalid: ${invalid.join(', ')}`);
        console.warn(`Email delivery is disabled. ${details.join('; ')}.`);
      }
      if (!env.clientAppUrl) {
        console.warn('Password reset email links are unavailable. Missing configuration variable: CLIENT_APP_URL.');
      }
    })
    .catch((error) => console.error('MongoDB Atlas connection failed:', error.name || 'Error', error.code || ''));
});

function shutdown(signal) {
  console.log(`${signal} received; closing API server.`);
  stopReminderScheduler();
  stopEmailWorker();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
