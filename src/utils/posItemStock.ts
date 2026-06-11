import type {CartItem} from '../@types/types.dto';

/** Match web POS: only `Inventory` items are stock-tracked. */
export function isInventoryPosItem(
  item: Pick<CartItem, 'type'>,
): boolean {
  return item.type === 'Inventory';
}

export function isPosItemOutOfStock(
  item: Pick<CartItem, 'type' | 'inventory'>,
): boolean {
  return isInventoryPosItem(item) && (Number(item.inventory) || 0) <= 0;
}

export function posItemStockLabel(
  item: Pick<CartItem, 'type' | 'inventory' | 'unit_of_measure'>,
): string {
  if (!isInventoryPosItem(item)) {
    if (item.type === 'Service') {
      return 'Service';
    }
    if (item.type === 'Non-Inventory') {
      return 'Non-inventory';
    }
    return 'Available';
  }
  const inv = Number(item.inventory) || 0;
  const uom = item.unit_of_measure ? ` • ${item.unit_of_measure}` : '';
  return inv <= 0 ? 'Out of stock' : `Stock ${inv}${uom}`;
}

export function posItemMaxSaleQuantity(
  item: Pick<CartItem, 'type' | 'inventory'>,
  currentQty = 1,
): number {
  if (!isInventoryPosItem(item)) {
    return Number.MAX_SAFE_INTEGER;
  }
  const inventoryLimit = Number(item.inventory) || 0;
  return Math.max(currentQty, inventoryLimit, 1);
}
