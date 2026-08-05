import type {ItemUnitOfMeasure} from '../services/app.services';
import {resolveSalesUnitPrice} from '../services/app.services';
import type {CartItem} from '../@types/types.dto';

/**
 * Offline / fallback sell price for a UOM when price-list resolve is unavailable.
 * Prefer explicit IUOM price, else effective_price, else base × quantity_per_unit.
 */
export function displayPriceForUom(
  baseUnitPrice: number,
  uom: Pick<ItemUnitOfMeasure, 'price' | 'quantity_per_unit' | 'effective_price'>,
): number {
  const qtyPerUnit =
    uom.quantity_per_unit && uom.quantity_per_unit > 0
      ? uom.quantity_per_unit
      : 1;
  if (uom.price != null && Number.isFinite(Number(uom.price))) {
    return Number(uom.price);
  }
  if (
    uom.effective_price != null &&
    Number.isFinite(Number(uom.effective_price))
  ) {
    return Number(uom.effective_price);
  }
  return baseUnitPrice * qtyPerUnit;
}

/**
 * Resolve sell price like web POS (Sales Price List → IUOM → item card).
 * Falls back to displayPriceForUom when the API call fails.
 */
export async function resolvePosUnitPrice(options: {
  itemNo?: string | null;
  itemSystemId?: string | null;
  unitOfMeasure?: string | null;
  itemUnitOfMeasureId?: number | null;
  customerNo?: string | null;
  quantity?: number | null;
  fallbackBasePrice?: number;
  fallbackUom?: Pick<
    ItemUnitOfMeasure,
    'price' | 'quantity_per_unit' | 'effective_price'
  > | null;
}): Promise<number> {
  const fallback = () => {
    if (options.fallbackUom) {
      return displayPriceForUom(
        Number(options.fallbackBasePrice) || 0,
        options.fallbackUom,
      );
    }
    return Number(options.fallbackBasePrice) || 0;
  };

  const itemNo = (options.itemNo || '').trim();
  const itemSystemId = (options.itemSystemId || '').trim();
  if (!itemNo && !itemSystemId) {
    return fallback();
  }

  try {
    const resolved = await resolveSalesUnitPrice({
      item_no: itemNo || undefined,
      item_system_id: itemSystemId || undefined,
      unit_of_measure: options.unitOfMeasure || undefined,
      item_unit_of_measure_id: options.itemUnitOfMeasureId || undefined,
      customer_no: options.customerNo || undefined,
      quantity: options.quantity && options.quantity > 0 ? options.quantity : 1,
    });
    const n = Number(resolved.unit_price);
    if (Number.isFinite(n)) {
      return n;
    }
  } catch {
    // Keep offline / IUOM fallback.
  }
  return fallback();
}

/** Resolve a price for each UOM option (parallel). Keys are unit_of_measure codes. */
export async function resolvePricesForUoms(options: {
  itemNo: string;
  customerNo?: string | null;
  quantity?: number | null;
  uoms: ItemUnitOfMeasure[];
  fallbackBasePrice: number;
}): Promise<Record<string, number>> {
  const entries = await Promise.all(
    options.uoms.map(async uom => {
      const code = String(uom.unit_of_measure || '');
      const price = await resolvePosUnitPrice({
        itemNo: options.itemNo,
        unitOfMeasure: code,
        itemUnitOfMeasureId: uom.id || undefined,
        customerNo: options.customerNo,
        quantity: options.quantity,
        fallbackBasePrice: options.fallbackBasePrice,
        fallbackUom: uom,
      });
      return [code, price] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** Ensure cart line has original_price / quantity_per_unit defaults. */
export function withCartUomDefaults(item: CartItem): CartItem {
  const original =
    item.original_price != null && Number.isFinite(Number(item.original_price))
      ? Number(item.original_price)
      : Number(item.unit_price) || 0;
  const qpu =
    item.quantity_per_unit && item.quantity_per_unit > 0
      ? item.quantity_per_unit
      : 1;
  return {
    ...item,
    original_price: original,
    quantity_per_unit: qpu,
    unit_of_measure: item.unit_of_measure || 'PCS',
  };
}
