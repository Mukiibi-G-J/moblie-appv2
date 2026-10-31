/** Barcodes stored on one item are separated by |. */
export function barcodeTokens(value: string | null | undefined): string[] {
  return String(value ?? '')
    .split('|')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
}

type ScannableItem = {
  bar_code_no?: string | null;
  no?: string | null;
};

/**
 * Pick the catalog row for a scanned code.
 * Any one barcode on the item counts. Two items sharing that code do not resolve.
 */
export function pickItemByScanCode<T extends ScannableItem>(
  results: T[],
  code: string,
): T | null {
  const trimmed = code.trim();
  if (!trimmed || results.length === 0) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  const exact = results.filter(item => {
    const no = String(item.no ?? '').trim().toLowerCase();
    return no === lower || barcodeTokens(item.bar_code_no).includes(lower);
  });
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    return null;
  }
  if (results.length === 1) {
    return results[0];
  }
  return null;
}
