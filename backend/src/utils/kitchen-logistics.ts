/** Safe kitchen logistics math — mirrors frontend kitchen-logistics.ts */

export const DEFAULT_PORTIONS_PER_GN = 40;
export const DEFAULT_MEAT_GRAMS_PER_PORTION = 200;

export function roundLogistics(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function safePortions(portions: unknown): number {
  const n = Number(portions);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function safePositiveDivisor(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function computeGastronorms(
  portions: unknown,
  portionsPerGastronorm?: unknown
): number {
  const safe = safePortions(portions);
  if (safe <= 0) return 0;
  const divisor = safePositiveDivisor(portionsPerGastronorm, DEFAULT_PORTIONS_PER_GN);
  return roundLogistics(safe / divisor);
}

export function computeMeatKg(portions: unknown, gramsPerPortion?: unknown): number {
  const safe = safePortions(portions);
  if (safe <= 0) return 0;
  const grams = safePositiveDivisor(gramsPerPortion, DEFAULT_MEAT_GRAMS_PER_PORTION);
  return roundLogistics((safe * grams) / 1000);
}
