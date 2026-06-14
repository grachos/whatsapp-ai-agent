import express from 'express';
import cors from 'cors';
import path from 'path';
import cron from 'node-cron';
import { config } from './config';
import { logger } from './utils/logger';
import { connectWhatsApp } from './integrations/whatsapp/client';
import { setMessageHandler } from './integrations/whatsapp/client';
import { handleIncomingMessage } from './integrations/whatsapp/message-handler';
import { runSyncValidation } from './services/sync.service';
import apiRouter from './api';
import { errorHandler } from './middleware/error-handler';
import { apiRateLimiter } from './middleware/rate-limiter';

async function main() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(apiRateLimiter);

  // Serve dashboard static files in production
  const dashboardDist = path.resolve(process.cwd(), 'dashboard', 'dist');
  app.use('/dashboard', express.static(dashboardDist));

  // API routes
  app.use('/api', apiRouter);

  // Global error handler
  app.use(errorHandler);

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  // Connect WhatsApp
  setMessageHandler(handleIncomingMessage);
  await connectWhatsApp();

  // Schedule sync validation
  const cronExpression = `*/${config.sync.intervalMinutes} * * * *`;
  cron.schedule(cronExpression, async () => {
    logger.info('Running scheduled sync validation...');
    await runSyncValidation();
  });

  logger.info(`Sync validation scheduled every ${config.sync.intervalMinutes} minutes`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    process.exit(0);
  });
}

main().catch(err => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
