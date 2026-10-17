/** Small display helpers. They only format values received from the API. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-05-15" -> "15 May 2024". Returns the input unchanged if it is not an ISO date. */
export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return iso;
  return `${Number(m[3])} ${MONTHS[month - 1]} ${m[1]}`;
}

/** "2024-05-22" -> "22 May". */
export function formatShortDate(iso: string): string {
  const full = formatIsoDate(iso);
  return full === iso ? iso : full.replace(/ \d{4}$/, '');
}

/** "mmol m-3" -> "mmol m⁻³" (the API sends plain ASCII units). */
export function formatUnit(unit: string): string {
  return unit.replace(/m-3\b/g, 'm⁻³');
}

/** Elapsed time in ms, rounded for display. */
export function formatMs(ms: number): string {
  return ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}

/**
 * Concentration with enough decimals for small values (PO₄ is often ~0.001 mmol m⁻³).
 * The API already rounds to 5 decimals; this only shortens for display.
 */
export function formatConc(value: number): string {
  if (value === 0) return '0';
  const a = Math.abs(value);
  const decimals = a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 3 : 4;
  return value.toFixed(decimals);
}

/** Signed change, e.g. "+0.081" or "−1.37". Uses a real minus sign. */
export function formatChange(value: number): string {
  if (value === 0) return '0';
  const text = formatConc(Math.abs(value));
  return `${value > 0 ? '+' : '−'}${text}`;
}
