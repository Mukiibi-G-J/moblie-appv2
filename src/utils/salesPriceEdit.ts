/** User Setup + Sales Setup rules for editing unit price on POS/cart. */

export type SalesPriceEditFlags = {
  disablePriceEditing: boolean;
  preventBelowOriginal: boolean;
};

export function canEditSalesUnitPrice(options: {
  canEditSalesPrice?: boolean | null;
  disablePriceEditing?: boolean | null;
}): boolean {
  return (
    Boolean(options.canEditSalesPrice) && options.disablePriceEditing !== true
  );
}

export function salesPriceEditFlagsFromSetup(raw: unknown): SalesPriceEditFlags {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const disable =
    d.disable_price_editing === true ||
    d.disablePriceEditing === true ||
    d.allow_price_editing === false;
  return {
    disablePriceEditing: disable,
    preventBelowOriginal:
      d.prevent_price_below_original === true ||
      d.preventPriceBelowOriginal === true,
  };
}

export function parseSalesPriceInput(text: string): number {
  const n = Number.parseFloat(String(text).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

function groupIntegerDigits(intRaw: string): string {
  const stripped = intRaw.replace(/^0+(?=\d)/, '');
  const digits = stripped === '' ? '0' : stripped;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format a price string as the user types. Keeps a trailing decimal point. */
export function formatSalesPriceDraft(text: string): string {
  const cleaned = String(text).replace(/[^0-9.]/g, '');
  if (!cleaned) {
    return '';
  }
  const dot = cleaned.indexOf('.');
  const intRaw = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const decRaw =
    dot === -1 ? '' : cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const grouped = groupIntegerDigits(intRaw);
  return dot === -1 ? grouped : `${grouped}.${decRaw}`;
}

/** Format a unit price for the cart price-edit TextInput. */
export function formatSalesPriceInput(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return '0';
  }
  const rounded = Math.round(n * 100) / 100;
  const [whole, frac = ''] = rounded.toFixed(2).split('.');
  const grouped = groupIntegerDigits(whole);
  const trimmed = frac.replace(/0+$/, '');
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export function resolveEditedSalesPrice(options: {
  requested: number;
  originalPrice: number;
  preventBelowOriginal: boolean;
}): {price: number; blockedBelowOriginal: boolean} {
  const requested = Math.max(0, options.requested);
  const original = Number.isFinite(options.originalPrice)
    ? options.originalPrice
    : 0;
  if (options.preventBelowOriginal && requested < original) {
    return {price: original, blockedBelowOriginal: true};
  }
  return {price: requested, blockedBelowOriginal: false};
}
