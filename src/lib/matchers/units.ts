/**
 * Net-contents parsing: "750 mL", "0.75 L", "12 FL OZ", "1.75L" → millilitres.
 */

const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  cl: 10,
  centiliter: 10,
  centiliters: 10,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  floz: 29.5735,
  oz: 29.5735,
  ounce: 29.5735,
  ounces: 29.5735,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,
};

export interface Volume {
  millilitres: number;
  /** The unit as written, normalized, e.g. "fl oz". */
  unit: string;
}

/** Returns null when no number+unit pair can be found. */
export function parseVolume(text: string | null | undefined): Volume | null {
  if (!text) return null;
  const m = text
    .toLowerCase()
    .replace(/,/g, "")
    .match(/(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|[a-z]+)\.?/);
  if (!m) return null;
  const amount = parseFloat(m[1]);
  const unitKey = m[2].replace(/[\s.]/g, "");
  const factor = ML_PER_UNIT[unitKey];
  if (!factor || !Number.isFinite(amount)) return null;
  return { millilitres: amount * factor, unit: unitKey === "floz" ? "fl oz" : unitKey };
}

/** Same volume within a small tolerance (unit conversions are never exact). */
export function sameVolume(a: Volume, b: Volume, tolerance = 0.01): boolean {
  const larger = Math.max(a.millilitres, b.millilitres);
  return Math.abs(a.millilitres - b.millilitres) <= larger * tolerance;
}

/** "45% Alc./Vol.", "ALC. 13.5% BY VOL", "40" → 45, 13.5, 40. */
export function parseAbv(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*%?/);
  return m ? parseFloat(m[1]) : null;
}
