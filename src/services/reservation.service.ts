import { v4 as uuidv4 } from 'uuid';
import {
  Reservation,
  appendReservation,
  getReservationById,
  updateReservation,
  getAllReservations,
} from '../integrations/google-sheets/reservation-repo';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../integrations/google-calendar/client';
import { checkAccommodationAvailability } from './availability.service';
import { getAccommodation } from './inventory.service';
import { acquireLock, releaseLock } from './lock.service';
import { logger } from '../utils/logger';

export interface CreateReservationInput {
  guest_name: string;
  phone: string;
  email?: string;
  accommodation_id: string;
  checkin_date: string;
  checkout_date: string;
  num_guests: number;
}

export async function createReservation(input: CreateReservationInput): Promise<Reservation> {
  const reservationId = uuidv4();
  acquireLock(input.accommodation_id, reservationId);
  let reservation: Reservation | null = null;
  let calendarEventId: string | null = null;

  try {
    // Re-validate availability under the lock
    const { available, reason, accommodation } = await checkAccommodationAvailability(
      input.accommodation_id, input.checkin_date, input.checkout_date, input.num_guests
    );
    if (!available) throw new Error(reason ?? 'Accommodation is not available for the selected dates');

    const now = new Date().toISOString();
    reservation = {
      reservation_id: reservationId,
      guest_name: input.guest_name,
      phone: input.phone,
      email: input.email ?? '',
      accommodation_id: accommodation.accommodation_id,
      accommodation_name: accommodation.name,
      accommodation_type: accommodation.type,
      checkin_date: input.checkin_date,
      checkout_date: input.checkout_date,
      num_guests: input.num_guests,
      status: 'Pending',
      calendar_event_id: '',
      created_at: now,
      updated_at: now,
    };

    await appendReservation(reservation);

    calendarEventId = await createCalendarEvent(
      reservationId, accommodation.name, input.guest_name,
      input.num_guests, input.checkin_date, input.checkout_date
    );

    reservation.status = 'Confirmed';
    reservation.calendar_event_id = calendarEventId;
    await updateReservation(reservation);

    logger.info(`Reservation ${reservationId} confirmed for ${input.guest_name}`);
    releaseLock(input.accommodation_id);
    return reservation;
  } catch (err) {
    // Rollback
    if (reservation) {
      try {
        reservation.status = 'Cancelled';
        await updateReservation(reservation);
      } catch (rollbackErr) {
        logger.error('Failed to rollback reservation row', { rollbackErr });
      }
    }
    if (calendarEventId) {
      try {
        await deleteCalendarEvent(calendarEventId);
      } catch (calErr) {
        logger.error('Failed to rollback calendar event', { calErr });
      }
    }
    releaseLock(input.accommodation_id);
    throw err;
  }
}

export interface ModifyReservationInput {
  reservation_id: string;
  new_checkin_date?: string;
  new_checkout_date?: string;
  new_num_guests?: number;
}

export async function modifyReservation(input: ModifyReservationInput): Promise<Reservation> {
  const reservation = await getReservationById(input.reservation_id);
  if (!reservation) throw new Error(`Reservation ${input.reservation_id} not found`);
  if (reservation.status === 'Cancelled') throw new Error('Cannot modify a cancelled reservation');

  const newCheckin = input.new_checkin_date ?? reservation.checkin_date;
  const newCheckout = input.new_checkout_date ?? reservation.checkout_date;
  const newGuests = input.new_num_guests ?? reservation.num_guests;

  acquireLock(reservation.accommodation_id, reservation.reservation_id);
  try {
    const { available, reason } = await checkAccommodationAvailability(
      reservation.accommodation_id, newCheckin, newCheckout, newGuests,
      reservation.reservation_id
    );
    if (!available) throw new Error(reason ?? 'Dates not available');

    reservation.checkin_date = newCheckin;
    reservation.checkout_date = newCheckout;
    reservation.num_guests = newGuests;

    if (reservation.calendar_event_id) {
      await updateCalendarEvent(
        reservation.calendar_event_id, reservation.accommodation_name,
        reservation.guest_name, newGuests, newCheckin, newCheckout
      );
    }

    await updateReservation(reservation);
    logger.info(`Reservation ${reservation.reservation_id} modified`);
  } finally {
    releaseLock(reservation.accommodation_id);
  }

  return reservation;
}

export async function cancelReservation(reservationId: string): Promise<Reservation> {
  const reservation = await getReservationById(reservationId);
  if (!reservation) throw new Error(`Reservation ${reservationId} not found`);
  if (reservation.status === 'Cancelled') throw new Error('Reservation is already cancelled');

  reservation.status = 'Cancelled';
  await updateReservation(reservation);

  if (reservation.calendar_event_id) {
    try {
      await deleteCalendarEvent(reservation.calendar_event_id);
    } catch (err) {
      logger.error(`Failed to delete calendar event ${reservation.calendar_event_id}`, { err });
    }
  }

  logger.info(`Reservation ${reservationId} cancelled`);
  return reservation;
}

export { Reservation, getAllReservations, getReservationById };
