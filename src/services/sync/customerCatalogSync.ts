import {
  getCustomerCount,
  getSyncMeta,
  saveCustomers,
  setSyncMeta,
} from '../../db/sqlite';
import {fetchCustomers, type Customer} from '../app.services';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import type {SyncProgressHandler} from './itemsSync';
import {
  beginCatalogSlice,
  finishCatalogSlice,
  reportCatalogSlice,
} from './catalogSyncProgress';
import SyncApi from './SyncApi';

const LAST_CUSTOMERS_SYNC_KEY = 'last_full_customers_sync_at';
const CUSTOMERS_CATALOG_SINCE_KEY = 'customers_catalog_updated_since';
const DEBOUNCE_MS = 10 * 60 * 1000;
const PAGE_SIZE = 100;
const FULL_CUSTOMER_DELTA_SINCE = '1970-01-01T00:00:00Z';

let customerSyncInFlight: Promise<void> | null = null;

async function runCustomerSync<T>(fn: () => Promise<T>): Promise<T> {
  if (customerSyncInFlight) {
    await customerSyncInFlight;
    throw new Error('A customer sync is already running.');
  }
  let release!: () => void;
  customerSyncInFlight = new Promise<void>(resolve => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    release();
    customerSyncInFlight = null;
  }
}

async function syncAllCustomersFromSyncApi(
  onProgress?: SyncProgressHandler,
): Promise<number> {
  let page = 1;
  let processed = 0;
  let total = 0;

  while (page <= 500) {
    const data = await SyncApi.pullCustomersDelta(
      FULL_CUSTOMER_DELTA_SINCE,
      page,
      PAGE_SIZE,
    );
    const results = (data.results || []) as Customer[];
    if (!results.length) break;

    total = data.total ?? Math.max(total, processed + results.length);
    await saveCustomers(results);
    processed += results.length;
    onProgress?.(
      `Cached ${processed}${total ? ` / ${total}` : ''} customers…`,
      total ? 10 + Math.min(80, (processed / total) * 80) : undefined,
    );

    if (!data.has_more) break;
    page += 1;
  }

  return processed;
}

async function syncAllCustomersFromListApi(
  onProgress?: SyncProgressHandler,
): Promise<number> {
  const results = await fetchCustomers();
  if (results.length) {
    await saveCustomers(results);
  }
  onProgress?.(`Cached ${results.length} customers (list API)…`, 80);
  return results.length;
}

export async function syncFullCustomersToLocal(options?: {
  force?: boolean;
  onProgress?: SyncProgressHandler;
}): Promise<{skipped: boolean; reason?: string; customerCount?: number}> {
  const online = getEffectiveIsOnline();
  if (!online) {
    return {skipped: true, reason: 'offline'};
  }

  if (!options?.force) {
    const raw = await getSyncMeta(LAST_CUSTOMERS_SYNC_KEY);
    if (raw) {
      const ts = Date.parse(raw);
      if (!Number.isNaN(ts) && Date.now() - ts < DEBOUNCE_MS) {
        return {skipped: true, reason: 'debounced'};
      }
    }
  }

  try {
    await runCustomerSync(async () => {
      beginCatalogSlice('customers', 'Downloading customers…');
      try {
        const onProgress = reportCatalogSlice('customers', options?.onProgress);
        onProgress('Downloading customers…', 5);
        let processed = 0;
        try {
          processed = await syncAllCustomersFromSyncApi(onProgress);
        } catch (syncErr) {
          console.warn('[customerCatalogSync] sync API failed, fallback:', syncErr);
          processed = await syncAllCustomersFromListApi(onProgress);
        }
        if (processed === 0) {
          processed = await syncAllCustomersFromListApi(onProgress);
        }
        await setSyncMeta(LAST_CUSTOMERS_SYNC_KEY, new Date().toISOString());
        await setSyncMeta(CUSTOMERS_CATALOG_SINCE_KEY, new Date().toISOString());
        const customerCount = await getCustomerCount();
        finishCatalogSlice(
          'customers',
          'done',
          customerCount
            ? `Cached ${customerCount} customers`
            : 'Customer download finished',
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Customer download failed';
        finishCatalogSlice('customers', 'error', message);
        throw err;
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already running')) {
      return {skipped: true, reason: 'already_running'};
    }
    throw err;
  }

  const customerCount = await getCustomerCount();
  return {skipped: false, customerCount};
}

export function syncFullCustomersToLocalInBackground(): void {
  void syncFullCustomersToLocal().catch(err => {
    console.warn('[customerCatalogSync] background sync failed:', err);
  });
}
