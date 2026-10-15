import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import type {CartItem} from '../@types/types.dto';

/** Row from GET /api/sales/favorites/ */
export type SalesFavoriteSlotApiRow = {
  system_id: string;
  position: number;
  sort_order: number;
  item_system_id: string;
  item_no?: string;
  item_name?: string;
  unit_price: string;
};

export type SalesFavoritesGetResponse = {
  slots: SalesFavoriteSlotApiRow[];
  min_slots: number;
  suggested_slot_count: number;
};

export type SalesFavoritePutSlot = {
  position: number;
  item_system_id: string | null;
};

/** Backend minimum (permissions / model). */
export const FAVORITE_API_MIN_SLOTS = 4;

/** Default empty grid size in the app (3×3). Can grow when user fills slots or API suggests more. */
export const FAVORITE_DEFAULT_VISIBLE_SLOTS = 9;

/** Always keep this many empty slots after the last filled cell (2 = one extra row in a 2-col grid). */
export const FAVORITE_TRAILING_EMPTY_SLOTS = 2;

/** Map API row to CartItem for grid + add-to-sale (inventory not on favorites API). */
export function apiFavoriteSlotToCartItem(row: SalesFavoriteSlotApiRow): CartItem {
  const price = parseFloat(String(row.unit_price ?? '0'));
  return {
    system_id: row.item_system_id,
    item_name: row.item_name ?? '',
    unit_price: Number.isFinite(price) ? price : 0,
    quantity: 1,
    inventory: 999999,
    no: row.item_no,
    date_sold: new Date().toISOString(),
  };
}

/** Build a fixed-length grid; extend if any slot position is beyond suggested length. */
export function buildFavoriteGridFromApi(
  res: SalesFavoritesGetResponse,
): (CartItem | null)[] {
  const minSlots = res.min_slots ?? FAVORITE_API_MIN_SLOTS;
  const suggested = res.suggested_slot_count ?? minSlots;
  let len = Math.max(
    minSlots,
    suggested,
    FAVORITE_API_MIN_SLOTS,
    FAVORITE_DEFAULT_VISIBLE_SLOTS,
  );

  const slots = res.slots ?? [];
  for (const s of slots) {
    const pos = s.position ?? s.sort_order ?? 0;
    if (pos + 1 > len) {
      len = pos + 1;
    }
  }

  const grid: (CartItem | null)[] = Array.from({length: len}, () => null);
  for (const s of slots) {
    const pos = s.position ?? s.sort_order ?? 0;
    if (pos >= 0 && pos < grid.length && s.item_system_id) {
      grid[pos] = apiFavoriteSlotToCartItem(s);
    }
  }
  return normalizeFavoriteGridForGrowth(grid);
}

/** Append empty slots at the end so the user can always keep adding (2-col friendly). */
export function normalizeFavoriteGridForGrowth(
  slots: (CartItem | null)[],
): (CartItem | null)[] {
  const out = [...slots];
  let trailing = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] != null) {
      break;
    }
    trailing++;
  }
  while (trailing < FAVORITE_TRAILING_EMPTY_SLOTS) {
    out.push(null);
    trailing++;
  }
  while (out.length < FAVORITE_DEFAULT_VISIBLE_SLOTS) {
    out.push(null);
  }
  return out;
}

/** PUT body: trim trailing empty slots, then pad to at least minLength positions. */
export function favoriteSlotsToPutPayload(
  slots: (CartItem | null)[],
  minLength: number = FAVORITE_API_MIN_SLOTS,
): {slots: SalesFavoritePutSlot[]} {
  let end = slots.length;
  while (end > minLength && end > 0 && slots[end - 1] == null) {
    end -= 1;
  }
  const trimmed = slots.slice(0, end);
  const targetLen = Math.max(trimmed.length, minLength);
  const padded: (CartItem | null)[] = [...trimmed];
  while (padded.length < targetLen) {
    padded.push(null);
  }
  return {
    slots: padded.map((cell, index) => ({
      position: index,
      item_system_id: cell ? cell.system_id : null,
    })),
  };
}

export async function fetchSalesFavorites(): Promise<SalesFavoritesGetResponse> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  const {data} = await api.get<SalesFavoritesGetResponse>('/api/sales/favorites/');
  return data;
}

export async function putSalesFavorites(
  slots: (CartItem | null)[],
  minLength?: number,
): Promise<void> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  const body = favoriteSlotsToPutPayload(slots, minLength ?? FAVORITE_API_MIN_SLOTS);
  await api.put('/api/sales/favorites/', body);
}

export async function patchSalesFavorites(
  slots: SalesFavoritePutSlot[],
): Promise<void> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  await api.patch('/api/sales/favorites/', {slots});
}
