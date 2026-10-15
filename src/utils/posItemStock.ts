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

export function buildSoldQuantityMaps(soldLines: CartItem[]): {
  bySystemId: Map<string, number>;
  byNo: Map<string, number>;
} {
  const bySystemId = new Map<string, number>();
  const byNo = new Map<string, number>();
  for (const line of soldLines) {
    if (!isInventoryPosItem(line)) {
      continue;
    }
    const qty = Number(line.quantity) || 0;
    if (!(qty > 0)) {
      continue;
    }
    if (line.system_id) {
      const key = String(line.system_id);
      bySystemId.set(key, (bySystemId.get(key) || 0) + qty);
    }
    if (line.no) {
      const key = String(line.no);
      byNo.set(key, (byNo.get(key) || 0) + qty);
    }
  }
  return {bySystemId, byNo};
}

export function applySoldQuantitiesToItem(
  item: CartItem,
  soldBySystemId: Map<string, number>,
  soldByNo: Map<string, number>,
): CartItem {
  if (!isInventoryPosItem(item)) {
    return item;
  }
  const soldQty =
    (item.system_id ? soldBySystemId.get(String(item.system_id)) : undefined) ??
    (item.no ? soldByNo.get(String(item.no)) : undefined) ??
    0;
  if (!(soldQty > 0)) {
    return item;
  }
  const nextInventory = Math.max(0, (Number(item.inventory) || 0) - soldQty);
  if (nextInventory === Number(item.inventory)) {
    return item;
  }
  return {...item, inventory: nextInventory};
}

export function mergeCatalogInventoryIntoFavorites(
  slots: (CartItem | null)[],
  catalogItems: CartItem[],
): (CartItem | null)[] {
  if (!catalogItems.length) {
    return slots;
  }
  return slots.map(cell => {
    if (!cell) {
      return cell;
    }
    const fresh = catalogItems.find(
      item =>
        (cell.system_id && item.system_id === cell.system_id) ||
        Boolean(cell.no && item.no && String(item.no) === String(cell.no)),
    );
    if (!fresh || Number(fresh.inventory) === Number(cell.inventory)) {
      return cell;
    }
    return {...cell, inventory: fresh.inventory, type: fresh.type || cell.type};
  });
}
