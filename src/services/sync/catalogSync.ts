import {
  getItemCount,
  getSyncMeta,
  saveItemsBatch,
  setSyncMeta,
  type LocalItem,
} from '../../db/sqlite';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import {syncAllItemData, type SyncProgressHandler} from './itemsSync';
import SyncApi from './SyncApi';

export type {SyncProgressHandler};

const LAST_CATALOG_SYNC_KEY = 'last_full_catalog_sync_at';
const ITEMS_CATALOG_SINCE_KEY = 'items_catalog_updated_since';
const DEBOUNCE_MS = 10 * 60 * 1000;

let catalogSyncInFlight: Promise<void> | null = null;

async function getLastCatalogSyncAt(): Promise<number> {
  const raw = await getSyncMeta(LAST_CATALOG_SYNC_KEY);
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

async function setLastCatalogSyncAt() {
  await setSyncMeta(LAST_CATALOG_SYNC_KEY, new Date().toISOString());
}

async function setItemsCatalogUpdatedSince(iso: string) {
  await setSyncMeta(ITEMS_CATALOG_SINCE_KEY, iso);
}

async function runCatalogSync<T>(fn: () => Promise<T>): Promise<T> {
  if (catalogSyncInFlight) {
    await catalogSyncInFlight;
    throw new Error('A product sync is already running.');
  }
  let release!: () => void;
  catalogSyncInFlight = new Promise<void>(resolve => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    release();
    catalogSyncInFlight = null;
  }
}

export async function syncFullCatalogToLocal(options?: {
  force?: boolean;
  onProgress?: SyncProgressHandler;
  bulkListOnly?: boolean;
}): Promise<{skipped: boolean; reason?: string; itemCount?: number}> {
  const online = getEffectiveIsOnline();
  if (!online) {
    return {skipped: true, reason: 'offline'};
  }

  if (!options?.force) {
    const last = await getLastCatalogSyncAt();
    if (last && Date.now() - last < DEBOUNCE_MS) {
      return {skipped: true, reason: 'debounced'};
    }
  }

  try {
    await runCatalogSync(async () => {
      await syncAllItemData(options?.onProgress, {
        bulkListOnly: options?.bulkListOnly,
      });
      await setLastCatalogSyncAt();
      await setItemsCatalogUpdatedSince(new Date().toISOString());
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already running')) {
      return {skipped: true, reason: 'already_running'};
    }
    throw err;
  }

  const itemCount = await getItemCount();
  return {skipped: false, itemCount};
}

export function syncFullCatalogToLocalInBackground(options?: {
  force?: boolean;
}): void {
  void syncFullCatalogToLocal(options).catch(err => {
    console.warn('[catalogSync] background sync failed:', err);
  });
}
