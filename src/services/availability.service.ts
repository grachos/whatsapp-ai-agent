import { getActiveInventory, getAccommodation, Accommodation } from './inventory.service';
import { getActiveReservationsForAccommodation } from '../integrations/google-sheets/reservation-repo';
import { datesOverlap, nightsBetween } from '../utils/date';
import { logger } from '../utils/logger';

export interface AvailabilityResult {
  accommodation: Accommodation;
  available: boolean;
  reason?: string;
}

export async function checkAccommodationAvailability(
  accommodationId: string,
  checkinDate: string,
  checkoutDate: string,
  numGuests?: number,
  excludeReservationId?: string
): Promise<AvailabilityResult> {
  const accommodation = await getAccommodation(accommodationId);
  if (!accommodation) {
    return { accommodation: {} as Accommodation, available: false, reason: 'Accommodation not found' };
  }
  if (accommodation.status !== 'Active') {
    return { accommodation, available: false, reason: `Accommodation status is ${accommodation.status}` };
  }
  if (numGuests && numGuests > accommodation.max_guests) {
    return { accommodation, available: false, reason: `Exceeds capacity (max ${accommodation.max_guests} guests)` };
  }

  const nights = nightsBetween(checkinDate, checkoutDate);
  if (nights < accommodation.min_stay) {
    return { accommodation, available: false, reason: `Minimum stay is ${accommodation.min_stay} nights` };
  }
  if (nights > accommodation.max_stay) {
    return { accommodation, available: false, reason: `Maximum stay is ${accommodation.max_stay} nights` };
  }

  const reservations = await getActiveReservationsForAccommodation(accommodationId);
  const conflict = reservations.find(r =>
    r.reservation_id !== excludeReservationId &&
    datesOverlap(r.checkin_date, r.checkout_date, checkinDate, checkoutDate)
  );

  if (conflict) {
    return { accommodation, available: false, reason: `Dates overlap with reservation ${conflict.reservation_id}` };
  }

  return { accommodation, available: true };
}

export async function getAvailableAccommodations(
  checkinDate: string,
  checkoutDate: string,
  numGuests?: number
): Promise<Accommodation[]> {
  const active = await getActiveInventory();
  const results = await Promise.all(
    active.map(acc =>
      checkAccommodationAvailability(acc.accommodation_id, checkinDate, checkoutDate, numGuests)
    )
  );
  const available = results.filter(r => r.available).map(r => r.accommodation);
  logger.info(`Availability check: ${available.length}/${active.length} available for ${checkinDate}–${checkoutDate}`);
  return available;
}
