import { Accommodation, getAllAccommodations, getAccommodationById, upsertAccommodation } from '../integrations/google-sheets/inventory-repo';
import { config } from '../config';
import { logger } from '../utils/logger';

interface CacheEntry {
  data: Accommodation[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < config.inventory.cacheTtlSeconds * 1000;
}

export function invalidateInventoryCache(): void {
  cache = null;
}

export async function getInventory(): Promise<Accommodation[]> {
  if (isCacheValid()) return cache!.data;
  const data = await getAllAccommodations();
  cache = { data, fetchedAt: Date.now() };
  logger.debug(`Inventory cache refreshed (${data.length} items)`);
  return data;
}

export async function getActiveInventory(): Promise<Accommodation[]> {
  const all = await getInventory();
  return all.filter(a => a.status === 'Active');
}

export async function getAccommodation(id: string): Promise<Accommodation | null> {
  const all = await getInventory();
  return all.find(a => a.accommodation_id === id) ?? null;
}

export async function saveAccommodation(accommodation: Accommodation): Promise<void> {
  await upsertAccommodation(accommodation);
  invalidateInventoryCache();
}

export { Accommodation };
