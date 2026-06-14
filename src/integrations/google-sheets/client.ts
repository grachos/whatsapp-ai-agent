import { google, sheets_v4 } from 'googleapis';
import { config } from '../../config';
import { logger } from '../../utils/logger';

let _sheets: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.google.serviceAccountEmail,
      private_key: config.google.privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  logger.debug('Google Sheets client initialized');
  return _sheets;
}

export const SPREADSHEET_ID = config.google.spreadsheetId;
