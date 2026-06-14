import { Accommodation } from '../integrations/google-sheets/inventory-repo';
import { nightsBetween } from '../utils/date';

export interface PriceBreakdown {
  nights: number;
  nightly_rate: number;
  nightly_total: number;
  cleaning_fee: number;
  taxes: number;
  total: number;
}

export function calculatePrice(
  accommodation: Accommodation,
  checkinDate: string,
  checkoutDate: string
): PriceBreakdown {
  const nights = nightsBetween(checkinDate, checkoutDate);
  if (nights <= 0) throw new Error('Checkout must be after check-in');

  const nightly_total = accommodation.price_per_night * nights;
  const cleaning_fee = accommodation.cleaning_fee;
  const taxable = nightly_total + cleaning_fee;
  const taxes = parseFloat((taxable * (accommodation.taxes_pct / 100)).toFixed(2));
  const total = parseFloat((taxable + taxes).toFixed(2));

  return {
    nights,
    nightly_rate: accommodation.price_per_night,
    nightly_total: parseFloat(nightly_total.toFixed(2)),
    cleaning_fee,
    taxes,
    total,
  };
}

export function formatPriceBreakdown(breakdown: PriceBreakdown, currency = 'USD'): string {
  const fmt = (n: number) => `$${n.toFixed(2)} ${currency}`;
  return [
    `Noches: ${breakdown.nights} × ${fmt(breakdown.nightly_rate)} = ${fmt(breakdown.nightly_total)}`,
    `Limpieza: ${fmt(breakdown.cleaning_fee)}`,
    `Impuestos: ${fmt(breakdown.taxes)}`,
    `──────────────────────`,
    `Total: ${fmt(breakdown.total)}`,
  ].join('\n');
}
