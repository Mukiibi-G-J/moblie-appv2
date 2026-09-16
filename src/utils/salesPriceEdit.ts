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

/** Format a unit price for the cart price-edit TextInput. */
export function formatSalesPriceInput(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return '0';
  }
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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
