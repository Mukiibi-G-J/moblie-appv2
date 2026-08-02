import {fetchItems, searchItems as apiSearchItems} from './app.services';
import {getItemCount, saveItemsBatch, type LocalItem} from '../db/sqlite';
import {localItemById, localItems} from './localData';
import {triggerEmptyCatalogSyncInBackground} from './sync/backgroundCatalogSync';
import {getPosConnectivityMode} from '../utils/posConnectivity';

export type ItemListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  categoryId?: number;
};

export type ItemListResponse = {
  results: LocalItem[];
  count: number;
  next?: string | null;
};

export function cacheItemsLocally(items: LocalItem[]): void {
  if (!items.length) return;
  void saveItemsBatch(items).catch(err => {
    console.warn('[itemCatalog] cacheItemsLocally failed:', err);
  });
}

async function ensureLocalCatalogHydrationIfNeeded(): Promise<void> {
  if (getPosConnectivityMode() !== 'online') {
    return;
  }
  const count = await getItemCount();
  if (count === 0) {
    triggerEmptyCatalogSyncInBackground();
  }
}

export async function listItems(
  params: ItemListParams = {},
): Promise<ItemListResponse> {
  const mode = getPosConnectivityMode();

  if (mode === 'offline') {
    const local = await localItems({
      q: params.q,
      page: params.page,
      pageSize: params.pageSize ?? 50,
    });
    return {results: local.results, count: local.count, next: null};
  }

  void ensureLocalCatalogHydrationIfNeeded();

  try {
    const response = await fetchItems(
      params.page ?? 1,
      params.q ?? '',
      params.categoryId,
    );
    const results = (response.results ?? []) as LocalItem[];
    cacheItemsLocally(results);
    return {
      results,
      count: response.count ?? results.length,
      next: response.next ?? null,
    };
  } catch (err) {
    console.warn('[itemCatalog] listItems API failed, using local cache:', err);
    const local = await localItems({
      q: params.q,
      page: params.page,
      pageSize: params.pageSize ?? 50,
    });
    return {results: local.results, count: local.count, next: null};
  }
}

export async function searchItems(query: string): Promise<LocalItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (getPosConnectivityMode() === 'offline') {
    const {results} = await localItems({q: trimmed, page: 1, pageSize: 50});
    return results;
  }

  void ensureLocalCatalogHydrationIfNeeded();

  try {
    const response = await apiSearchItems(trimmed);
    const results = (response?.results ?? response ?? []) as LocalItem[];
    if (Array.isArray(results) && results.length) {
      cacheItemsLocally(results);
      return results;
    }
  } catch {
    /* fallback below */
  }

  const {results} = await localItems({q: trimmed, page: 1, pageSize: 50});
  return results;
}

export async function getItemById(id: string): Promise<LocalItem | null> {
  if (getPosConnectivityMode() === 'offline') {
    return localItemById(id);
  }

  try {
    const response = await fetchItems(1, id);
    const results = (response?.results ?? []) as LocalItem[];
    const match =
      results.find(r => r.no === id || r.system_id === id) ?? results[0];
    if (match) {
      cacheItemsLocally([match]);
      return match;
    }
  } catch {
    /* fallback */
  }
  return localItemById(id);
}
