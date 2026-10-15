import AsyncStorage from '@react-native-async-storage/async-storage';
import type {CartItem} from '../@types/types.dto';
import {
  FAVORITE_DEFAULT_VISIBLE_SLOTS,
  normalizeFavoriteGridForGrowth,
} from './salesFavoritesApi';

const STORAGE_KEY = 'salesFavoriteGridSlots';

/** Strip heavy fields before persisting (images can be re-fetched via items API). */
export function slimFavoriteItemForStorage(item: CartItem): CartItem {
  const {item_images: _i, ...rest} = item;
  return rest as CartItem;
}

export async function loadFavoriteGridSlots(): Promise<(CartItem | null)[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return Array.from({length: FAVORITE_DEFAULT_VISIBLE_SLOTS}, () => null);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return Array.from({length: FAVORITE_DEFAULT_VISIBLE_SLOTS}, () => null);
    }
    const slots = parsed.map((cell: unknown) =>
      cell && typeof cell === 'object' && (cell as CartItem).system_id
        ? (cell as CartItem)
        : null,
    ) as (CartItem | null)[];
    while (slots.length < FAVORITE_DEFAULT_VISIBLE_SLOTS) {
      slots.push(null);
    }
    return normalizeFavoriteGridForGrowth(slots);
  } catch {
    return Array.from({length: FAVORITE_DEFAULT_VISIBLE_SLOTS}, () => null);
  }
}

export async function saveFavoriteGridSlots(
  slots: (CartItem | null)[],
): Promise<void> {
  try {
    const toStore = slots.map(cell =>
      cell ? slimFavoriteItemForStorage(cell) : null,
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to save favorite grid:', error);
  }
}
