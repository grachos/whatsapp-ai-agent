export function parseDate(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return d;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function nightsBetween(checkin: string, checkout: string): number {
  const start = parseDate(checkin);
  const end = parseDate(checkout);
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function datesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function toCalendarDateTime(dateStr: string): string {
  return `${dateStr}T00:00:00Z`;
}

export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}
