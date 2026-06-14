import { google, calendar_v3 } from 'googleapis';
import { config } from '../../config';
import { withRetry } from '../../utils/retry';
import { logger } from '../../utils/logger';

let _calendar: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (_calendar) return _calendar;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.google.serviceAccountEmail,
      private_key: config.google.privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  _calendar = google.calendar({ version: 'v3', auth });
  logger.debug('Google Calendar client initialized');
  return _calendar;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
}

export async function createCalendarEvent(
  reservationId: string,
  accommodationName: string,
  guestName: string,
  numGuests: number,
  checkinDate: string,
  checkoutDate: string
): Promise<string> {
  return withRetry(async () => {
    const calendar = getCalendarClient();
    const res = await calendar.events.insert({
      calendarId: config.google.calendarId,
      requestBody: {
        summary: `[${accommodationName}] ${guestName} (${numGuests} guests)`,
        description: `Reservation ID: ${reservationId}\nGuest: ${guestName}\nGuests: ${numGuests}`,
        start: { date: checkinDate },
        end: { date: checkoutDate },
        extendedProperties: {
          private: { reservationId, accommodationName },
        },
      },
    });
    const eventId = res.data.id!;
    logger.info(`Created calendar event ${eventId} on calendar "${config.google.calendarId}" for reservation ${reservationId} (${checkinDate} → ${checkoutDate})`);
    return eventId;
  }, { label: 'createCalendarEvent' });
}

export async function updateCalendarEvent(
  eventId: string,
  accommodationName: string,
  guestName: string,
  numGuests: number,
  checkinDate: string,
  checkoutDate: string
): Promise<void> {
  return withRetry(async () => {
    const calendar = getCalendarClient();
    await calendar.events.patch({
      calendarId: config.google.calendarId,
      eventId,
      requestBody: {
        summary: `[${accommodationName}] ${guestName} (${numGuests} guests)`,
        start: { date: checkinDate },
        end: { date: checkoutDate },
      },
    });
    logger.info(`Updated calendar event ${eventId}`);
  }, { label: 'updateCalendarEvent' });
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  return withRetry(async () => {
    const calendar = getCalendarClient();
    await calendar.events.delete({
      calendarId: config.google.calendarId,
      eventId,
    });
    logger.info(`Deleted calendar event ${eventId}`);
  }, { label: 'deleteCalendarEvent' });
}

export async function getCalendarEventsForRange(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  return withRetry(async () => {
    const calendar = getCalendarClient();
    const res = await calendar.events.list({
      calendarId: config.google.calendarId,
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
      singleEvents: true,
    });
    return (res.data.items ?? []).map(e => ({
      id: e.id ?? '',
      summary: e.summary ?? '',
      description: e.description ?? '',
      start: e.start?.date ?? e.start?.dateTime ?? '',
      end: e.end?.date ?? e.end?.dateTime ?? '',
    }));
  }, { label: 'getCalendarEventsForRange' });
}

export async function eventExists(eventId: string): Promise<boolean> {
  try {
    const calendar = getCalendarClient();
    await calendar.events.get({ calendarId: config.google.calendarId, eventId });
    return true;
  } catch {
    return false;
  }
}
