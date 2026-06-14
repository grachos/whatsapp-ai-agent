import { logger } from './logger';

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffFactor?: number;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 500, backoffFactor = 2, label = 'operation' } = options;
  let attempt = 0;
  let delay = delayMs;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        logger.error(`${label} failed after ${maxAttempts} attempts`, { error: err });
        throw err;
      }
      logger.warn(`${label} attempt ${attempt} failed, retrying in ${delay}ms`, { error: err });
      await sleep(delay);
      delay *= backoffFactor;
    }
  }
  throw new Error('unreachable');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
