/** Sale quantities such as 0.2 kg and 0.5 kg. Whole counts stay whole numbers. */

export function formatSaleQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function parseSaleQuantity(raw: string): number | null {
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned || cleaned === '.') {
    return null;
  }
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) {
    return null;
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 1000) / 1000;
}

export function stepSaleQuantity(
  current: number,
  delta: number,
  max?: number,
): number {
  const base = Number.isFinite(current) && current > 0 ? current : 1;
  const next = Math.round((base + delta) * 1000) / 1000;
  if (next <= 0) {
    return base;
  }
  if (max != null && Number.isFinite(max) && max >= 0) {
    return Math.min(next, max);
  }
  return next;
}
