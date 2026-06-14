import { Accommodation } from './inventory.service';
import { getAvailableAccommodations } from './availability.service';
import { calculatePrice } from './pricing.service';

export interface RecommendationInput {
  checkin_date: string;
  checkout_date: string;
  num_guests?: number;
  max_budget?: number;
  desired_amenities?: string[];
  accommodation_type?: string;
}

export interface RecommendationResult {
  accommodation: Accommodation;
  score: number;
  total_price: number;
  match_reasons: string[];
}

export async function getRecommendations(input: RecommendationInput): Promise<RecommendationResult[]> {
  const available = await getAvailableAccommodations(
    input.checkin_date, input.checkout_date, input.num_guests
  );

  const results: RecommendationResult[] = [];

  for (const acc of available) {
    let score = 0;
    const match_reasons: string[] = [];

    let total_price = 0;
    try {
      const breakdown = calculatePrice(acc, input.checkin_date, input.checkout_date);
      total_price = breakdown.total;
    } catch {
      continue;
    }

    if (input.max_budget && total_price > input.max_budget) continue;

    if (input.accommodation_type && acc.type.toLowerCase() === input.accommodation_type.toLowerCase()) {
      score += 30;
      match_reasons.push(`Type matches: ${acc.type}`);
    }

    if (input.num_guests) {
      const guestFit = 1 - (acc.max_guests - input.num_guests) / acc.max_guests;
      score += Math.max(0, Math.round(guestFit * 20));
      match_reasons.push(`Fits ${input.num_guests}/${acc.max_guests} guests`);
    }

    if (input.desired_amenities?.length) {
      const accAmenities = acc.amenities.map(a => a.toLowerCase());
      const matched = input.desired_amenities.filter(a => accAmenities.includes(a.toLowerCase()));
      score += matched.length * 10;
      if (matched.length > 0) match_reasons.push(`Amenities: ${matched.join(', ')}`);
    }

    if (input.max_budget) {
      const budgetRatio = 1 - total_price / input.max_budget;
      score += Math.round(budgetRatio * 15);
    }

    results.push({ accommodation: acc, score, total_price, match_reasons });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}
