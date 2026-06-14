import { getSheetsClient, SPREADSHEET_ID } from './client';
import { config } from '../../config';
import { withRetry } from '../../utils/retry';
import { logger } from '../../utils/logger';

export interface Accommodation {
  accommodation_id: string;
  name: string;
  type: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  price_per_night: number;
  cleaning_fee: number;
  taxes_pct: number;
  amenities: string[];
  description: string;
  images: string[];
  min_stay: number;
  max_stay: number;
}

function rowToAccommodation(row: string[]): Accommodation {
  return {
    accommodation_id: row[0] ?? '',
    name: row[1] ?? '',
    type: row[2] ?? '',
    status: (row[3] as Accommodation['status']) ?? 'Inactive',
    max_guests: parseInt(row[4]) || 0,
    bedrooms: parseInt(row[5]) || 0,
    bathrooms: parseInt(row[6]) || 0,
    price_per_night: parseFloat(row[7]) || 0,
    cleaning_fee: parseFloat(row[8]) || 0,
    taxes_pct: parseFloat(row[9]) || 0,
    amenities: row[10] ? row[10].split(',').map(s => s.trim()) : [],
    description: row[11] ?? '',
    images: row[12] ? row[12].split(',').map(s => s.trim()) : [],
    min_stay: parseInt(row[13]) || 1,
    max_stay: parseInt(row[14]) || 365,
  };
}

export async function getAllAccommodations(): Promise<Accommodation[]> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const range = `${config.google.inventorySheetName}!A2:O`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values ?? [];
    const accommodations = rows.filter(r => r[0]).map(r => rowToAccommodation(r as string[]));
    logger.debug(`Fetched ${accommodations.length} accommodations from Sheets`);
    return accommodations;
  }, { label: 'getAllAccommodations' });
}

export async function getAccommodationById(id: string): Promise<Accommodation | null> {
  const all = await getAllAccommodations();
  return all.find(a => a.accommodation_id === id) ?? null;
}

export async function upsertAccommodation(acc: Accommodation): Promise<void> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const all = await getAllAccommodations();
    const idx = all.findIndex(a => a.accommodation_id === acc.accommodation_id);
    const row = [
      acc.accommodation_id, acc.name, acc.type, acc.status,
      acc.max_guests, acc.bedrooms, acc.bathrooms,
      acc.price_per_night, acc.cleaning_fee, acc.taxes_pct,
      acc.amenities.join(', '), acc.description, acc.images.join(', '),
      acc.min_stay, acc.max_stay,
    ];

    if (idx >= 0) {
      const range = `${config.google.inventorySheetName}!A${idx + 2}:O${idx + 2}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
    } else {
      const range = `${config.google.inventorySheetName}!A:O`;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
    }
    logger.info(`Upserted accommodation ${acc.accommodation_id}`);
  }, { label: 'upsertAccommodation' });
}
