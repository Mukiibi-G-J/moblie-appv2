import {
  fetchCategories,
  fetchItems,
} from '../app.services';
import {
  saveCategories,
  saveItemsBatch,
  saveTrackingCodes,
  saveUnits,
  type LocalItem,
} from '../../db/sqlite';

export type SyncProgressHandler = (
  message: string,
  progress?: number,
) => void;

export async function syncAllItemData(
  onProgress?: SyncProgressHandler,
  options?: {bulkListOnly?: boolean},
): Promise<void> {
  const bulkListOnly = options?.bulkListOnly !== false;
  onProgress?.('Syncing lookup data (categories, units)…', 5);

  try {
    const [categories] = await Promise.all([
      fetchCategories().catch(() => []),
    ]);
    if (Array.isArray(categories) && categories.length) {
      await saveCategories(categories);
    }
    await saveUnits([]);
    await saveTrackingCodes([]);
  } catch (error) {
    console.warn('[ItemSync] lookup data failed:', error);
  }

  onProgress?.('Syncing products…', 10);
  let page = 1;
  let processed = 0;
  let total = 0;

  while (page <= 1000) {
    const response = await fetchItems(page, '');
    const items = (response?.results ?? []) as LocalItem[];
    total = response?.count ?? Math.max(total, processed + items.length);

    if (!items.length) break;

    if (bulkListOnly) {
      await saveItemsBatch(items);
      processed += items.length;
      onProgress?.(
        `Cached ${processed}${total ? ` / ${total}` : ''} products…`,
        total ? 10 + Math.min(80, (processed / total) * 80) : undefined,
      );
    }

    if (!response?.next) break;
    page += 1;
  }

  onProgress?.('Product sync complete', 80);
}
