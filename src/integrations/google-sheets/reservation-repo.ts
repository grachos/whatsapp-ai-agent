import { getSheetsClient, SPREADSHEET_ID } from './client';
import { config } from '../../config';
import { withRetry } from '../../utils/retry';
import { logger } from '../../utils/logger';

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export interface Reservation {
  reservation_id: string;
  guest_name: string;
  phone: string;
  email: string;
  accommodation_id: string;
  accommodation_name: string;
  accommodation_type: string;
  checkin_date: string;
  checkout_date: string;
  num_guests: number;
  status: ReservationStatus;
  calendar_event_id: string;
  created_at: string;
  updated_at: string;
}

function rowToReservation(row: string[]): Reservation {
  return {
    reservation_id: row[0] ?? '',
    guest_name: row[1] ?? '',
    phone: row[2] ?? '',
    email: row[3] ?? '',
    accommodation_id: row[4] ?? '',
    accommodation_name: row[5] ?? '',
    accommodation_type: row[6] ?? '',
    checkin_date: row[7] ?? '',
    checkout_date: row[8] ?? '',
    num_guests: parseInt(row[9]) || 0,
    status: (row[10] as ReservationStatus) ?? 'Pending',
    calendar_event_id: row[11] ?? '',
    created_at: row[12] ?? '',
    updated_at: row[13] ?? '',
  };
}

function reservationToRow(r: Reservation): (string | number)[] {
  return [
    r.reservation_id, r.guest_name, r.phone, r.email,
    r.accommodation_id, r.accommodation_name, r.accommodation_type,
    r.checkin_date, r.checkout_date, r.num_guests,
    r.status, r.calendar_event_id, r.created_at, r.updated_at,
  ];
}

export async function getAllReservations(): Promise<Reservation[]> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const range = `${config.google.reservationsSheetName}!A2:N`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values ?? [];
    return rows.filter(r => r[0]).map(r => rowToReservation(r as string[]));
  }, { label: 'getAllReservations' });
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const all = await getAllReservations();
  return all.find(r => r.reservation_id === id) ?? null;
}

export async function getReservationsByPhone(phone: string): Promise<Reservation[]> {
  const all = await getAllReservations();
  return all.filter(r => r.phone === phone);
}

export async function getActiveReservationsForAccommodation(
  accommodationId: string
): Promise<Reservation[]> {
  const all = await getAllReservations();
  return all.filter(
    r => r.accommodation_id === accommodationId &&
         (r.status === 'Confirmed' || r.status === 'Pending')
  );
}

export async function appendReservation(reservation: Reservation): Promise<void> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const range = `${config.google.reservationsSheetName}!A:N`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range,
      valueInputOption: 'RAW',
      requestBody: { values: [reservationToRow(reservation)] },
    });
    logger.info(`Appended reservation ${reservation.reservation_id}`);
  }, { label: 'appendReservation' });
}

export async function updateReservation(reservation: Reservation): Promise<void> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const all = await getAllReservations();
    const idx = all.findIndex(r => r.reservation_id === reservation.reservation_id);
    if (idx < 0) throw new Error(`Reservation ${reservation.reservation_id} not found in sheet`);

    reservation.updated_at = new Date().toISOString();
    const range = `${config.google.reservationsSheetName}!A${idx + 2}:N${idx + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range,
      valueInputOption: 'RAW',
      requestBody: { values: [reservationToRow(reservation)] },
    });
    logger.info(`Updated reservation ${reservation.reservation_id} status=${reservation.status}`);
  }, { label: 'updateReservation' });
}

export async function getConfigValue(key: string): Promise<string | null> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const range = `${config.google.configSheetName}!A2:B`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values ?? [];
    const row = rows.find(r => r[0] === key);
    return row ? (row[1] as string) : null;
  }, { label: 'getConfigValue' });
}

export async function getAllConfigValues(): Promise<Record<string, string>> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const range = `${config.google.configSheetName}!A2:B`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values ?? [];
    return Object.fromEntries(rows.filter(r => r[0]).map(r => [r[0] as string, r[1] as string ?? '']));
  }, { label: 'getAllConfigValues' });
}

export interface ConfigRow {
  key: string;
  value: string;
  description: string;
}

export async function getConfigRows(): Promise<ConfigRow[]> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const range = `${config.google.configSheetName}!A2:C`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values ?? [];
    return rows.filter(r => r[0]).map(r => ({
      key: r[0] as string,
      value: (r[1] as string) ?? '',
      description: (r[2] as string) ?? '',
    }));
  }, { label: 'getConfigRows' });
}

export async function upsertConfigRow(row: ConfigRow): Promise<void> {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const rows = await getConfigRows();
    const idx = rows.findIndex(r => r.key === row.key);
    const values = [row.key, row.value, row.description];

    if (idx >= 0) {
      const range = `${config.google.configSheetName}!A${idx + 2}:C${idx + 2}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    } else {
      const range = `${config.google.configSheetName}!A:C`;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range,
        valueInputOption: 'RAW',
        requestBody: { values: [values] },
      });
    }
    logger.info(`Upserted config key "${row.key}"`);
  }, { label: 'upsertConfigRow' });
}
