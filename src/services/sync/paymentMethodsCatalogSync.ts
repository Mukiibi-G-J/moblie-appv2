import {
  getPaymentMethodCount,
  savePaymentMethods,
  setSyncMeta,
} from '../../db/sqlite';
import {fetchPaymentMethods, type PaymentMethod} from '../app.services';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import type {SyncProgressHandler} from './itemsSync';
import SyncApi from './SyncApi';

const FULL_DELTA_SINCE = '1970-01-01T00:00:00Z';
const PAGE_SIZE = 100;

let paymentSyncInFlight: Promise<void> | null = null;

async function runPaymentSync<T>(fn: () => Promise<T>): Promise<T> {
  if (paymentSyncInFlight) {
    await paymentSyncInFlight;
    throw new Error('A payment method sync is already running.');
  }
  let release!: () => void;
  paymentSyncInFlight = new Promise<void>(resolve => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    release();
    paymentSyncInFlight = null;
  }
}

async function syncAllPaymentMethodsFromApi(
  onProgress?: SyncProgressHandler,
): Promise<void> {
  let page = 1;
  let processed = 0;
  let total = 0;

  while (page <= 500) {
    const data = await SyncApi.pullPaymentMethodsDelta(
      FULL_DELTA_SINCE,
      page,
      PAGE_SIZE,
    );
    const results = (data.results || []) as PaymentMethod[];
    if (!results.length) break;

    total = data.total ?? Math.max(total, processed + results.length);
    await savePaymentMethods(results);
    processed += results.length;
    onProgress?.(
      `Cached ${processed}${total ? ` / ${total}` : ''} payment methods…`,
      total ? 10 + Math.min(80, (processed / total) * 80) : undefined,
    );

    if (!data.has_more) break;
    page += 1;
  }

  if (processed === 0) {
    const fallback = await fetchPaymentMethods();
    if (fallback.length) {
      await savePaymentMethods(fallback);
    }
  }

  await setSyncMeta(
    'payment_methods_catalog_updated_since',
    new Date().toISOString(),
  );
}

export async function syncFullPaymentMethodsToLocal(options?: {
  onProgress?: SyncProgressHandler;
}): Promise<{skipped: boolean; reason?: string; count?: number}> {
  const online = getEffectiveIsOnline();
  if (!online) {
    return {skipped: true, reason: 'offline'};
  }

  try {
    await runPaymentSync(async () => {
      options?.onProgress?.('Downloading payment methods…', 5);
      await syncAllPaymentMethodsFromApi(options?.onProgress);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already running')) {
      return {skipped: true, reason: 'already_running'};
    }
    throw err;
  }

  const count = await getPaymentMethodCount();
  return {skipped: false, count};
}

export function syncFullPaymentMethodsToLocalInBackground(): void {
  void syncFullPaymentMethodsToLocal().catch(err => {
    console.warn('[paymentMethodsCatalogSync] background sync failed:', err);
  });
}
