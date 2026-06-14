import { getAllReservations } from '../integrations/google-sheets/reservation-repo';
import { createCalendarEvent, eventExists, getCalendarEventsForRange } from '../integrations/google-calendar/client';
import { updateReservation } from '../integrations/google-sheets/reservation-repo';
import { datesOverlap } from '../utils/date';
import { logger } from '../utils/logger';

export interface SyncReport {
  ranAt: string;
  orphanedCalendarEvents: string[];
  missingCalendarEvents: string[];
  conflicts: { reservation_id: string; conflicts_with: string }[];
  repairedCount: number;
  errors: string[];
}

let lastReport: SyncReport | null = null;

export async function runSyncValidation(): Promise<SyncReport> {
  const report: SyncReport = {
    ranAt: new Date().toISOString(),
    orphanedCalendarEvents: [],
    missingCalendarEvents: [],
    conflicts: [],
    repairedCount: 0,
    errors: [],
  };

  logger.info('Starting sync validation...');

  try {
    const reservations = await getAllReservations();
    const confirmed = reservations.filter(r => r.status === 'Confirmed');

    // Check each confirmed reservation has a valid calendar event
    for (const res of confirmed) {
      if (!res.calendar_event_id) {
        report.missingCalendarEvents.push(res.reservation_id);
        try {
          const eventId = await createCalendarEvent(
            res.reservation_id, res.accommodation_name, res.guest_name,
            res.num_guests, res.checkin_date, res.checkout_date
          );
          res.calendar_event_id = eventId;
          await updateReservation(res);
          report.repairedCount++;
          logger.info(`Repaired missing calendar event for reservation ${res.reservation_id}`);
        } catch (err) {
          report.errors.push(`Failed to repair reservation ${res.reservation_id}: ${err}`);
        }
        continue;
      }

      const exists = await eventExists(res.calendar_event_id);
      if (!exists) {
        report.missingCalendarEvents.push(res.reservation_id);
        try {
          const eventId = await createCalendarEvent(
            res.reservation_id, res.accommodation_name, res.guest_name,
            res.num_guests, res.checkin_date, res.checkout_date
          );
          res.calendar_event_id = eventId;
          await updateReservation(res);
          report.repairedCount++;
          logger.info(`Recreated missing calendar event for reservation ${res.reservation_id}`);
        } catch (err) {
          report.errors.push(`Failed to recreate event for reservation ${res.reservation_id}: ${err}`);
        }
      }
    }

    // Detect overlapping confirmed reservations for the same accommodation
    for (let i = 0; i < confirmed.length; i++) {
      for (let j = i + 1; j < confirmed.length; j++) {
        const a = confirmed[i];
        const b = confirmed[j];
        if (
          a.accommodation_id === b.accommodation_id &&
          datesOverlap(a.checkin_date, a.checkout_date, b.checkin_date, b.checkout_date)
        ) {
          report.conflicts.push({ reservation_id: a.reservation_id, conflicts_with: b.reservation_id });
          logger.error(`Conflict detected: ${a.reservation_id} overlaps with ${b.reservation_id}`);
        }
      }
    }
  } catch (err) {
    report.errors.push(`Sync error: ${err}`);
    logger.error('Sync validation failed', { err });
  }

  lastReport = report;
  logger.info(`Sync complete. Conflicts: ${report.conflicts.length}, Repaired: ${report.repairedCount}, Errors: ${report.errors.length}`);
  return report;
}

export function getLastSyncReport(): SyncReport | null {
  return lastReport;
}
