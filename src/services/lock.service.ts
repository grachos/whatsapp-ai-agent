import { config } from '../config';
import { logger } from '../utils/logger';

interface Lock {
  lockedAt: Date;
  reservationId: string;
}

const locks = new Map<string, Lock>();

function sweepExpiredLocks(): void {
  const now = Date.now();
  const ttlMs = config.lock.ttlSeconds * 1000;
  for (const [key, lock] of locks.entries()) {
    if (now - lock.lockedAt.getTime() > ttlMs) {
      locks.delete(key);
      logger.warn(`Lock for ${key} expired and was swept`);
    }
  }
}

export function acquireLock(accommodationId: string, reservationId: string): void {
  sweepExpiredLocks();
  const existing = locks.get(accommodationId);
  if (existing) {
    throw new Error(
      `Accommodation ${accommodationId} is temporarily locked for another reservation. Please try again in a moment.`
    );
  }
  locks.set(accommodationId, { lockedAt: new Date(), reservationId });
  logger.debug(`Lock acquired for ${accommodationId} by ${reservationId}`);
}

export function releaseLock(accommodationId: string): void {
  locks.delete(accommodationId);
  logger.debug(`Lock released for ${accommodationId}`);
}

export function isLocked(accommodationId: string): boolean {
  sweepExpiredLocks();
  return locks.has(accommodationId);
}
