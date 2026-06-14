import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(`API Error: ${err.message}`, { path: req.path, method: req.method, stack: err.stack });
  res.status(500).json({ error: err.message ?? 'Internal server error' });
}
