import {
  getCustomerCount,
  getItemCount,
  getPaymentMethodCount,
} from '../../db/sqlite';
import {loadReceiptBusinessInfo} from '../companyInfoCache';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import {syncFullBranchesToLocalInBackground} from './branchCatalogSync';
import {
  syncFullCatalogToLocal,
  syncFullCatalogToLocalInBackground,
} from './catalogSync';
import {
  syncFullCustomersToLocal,
  syncFullCustomersToLocalInBackground,
} from './customerCatalogSync';
import {
  syncFullPaymentMethodsToLocal,
  syncFullPaymentMethodsToLocalInBackground,
} from './paymentMethodsCatalogSync';

export type CatalogEmptyFlags = {
  items: boolean;
  customers: boolean;
  paymentMethods: boolean;
};

let hydrationInFlight: Promise<void> | null = null;

export async function getCatalogEmptyFlags(): Promise<CatalogEmptyFlags> {
  const [items, customers, paymentMethods] = await Promise.all([
    getItemCount(),
    getCustomerCount(),
    getPaymentMethodCount(),
  ]);
  return {
    items: items === 0,
    customers: customers === 0,
    paymentMethods: paymentMethods === 0,
  };
}

export async function syncEmptyCatalogSlicesInBackground(): Promise<void> {
  if (!getEffectiveIsOnline()) {
    return;
  }

  if (hydrationInFlight) {
    await hydrationInFlight;
    return;
  }

  hydrationInFlight = (async () => {
    const empty = await getCatalogEmptyFlags();
    const jobs: Promise<unknown>[] = [];

    if (empty.items) {
      jobs.push(
        syncFullCatalogToLocal({force: true, bulkListOnly: true}).catch(err =>
          console.warn('[backgroundCatalogSync] items failed:', err),
        ),
      );
    }
    if (empty.customers) {
      jobs.push(
        syncFullCustomersToLocal({force: true}).catch(err =>
          console.warn('[backgroundCatalogSync] customers failed:', err),
        ),
      );
    }
    if (empty.paymentMethods) {
      jobs.push(
        syncFullPaymentMethodsToLocal({}).catch(err =>
          console.warn('[backgroundCatalogSync] payment methods failed:', err),
        ),
      );
    }

    if (jobs.length) {
      await Promise.all(jobs);
    }
  })();

  try {
    await hydrationInFlight;
  } finally {
    hydrationInFlight = null;
  }
}

/** Fire-and-forget: fill SQLite when online and any catalog table is empty. */
export function triggerEmptyCatalogSyncInBackground(): void {
  void syncEmptyCatalogSlicesInBackground();
}

/**
 * Silent background refresh of all offline POS master data (items, customers,
 * branches, payment methods, receipt company info). Respects per-slice debounce
 * unless `force` is set. Safe to call on login, reconnect, and periodic timers.
 */
export function syncMasterDataInBackground(options?: {force?: boolean}): void {
  if (!getEffectiveIsOnline()) {
    return;
  }

  void (async () => {
    await syncEmptyCatalogSlicesInBackground();
    syncFullCatalogToLocalInBackground({force: options?.force});
    syncFullCustomersToLocalInBackground();
    syncFullBranchesToLocalInBackground();
    syncFullPaymentMethodsToLocalInBackground();
    try {
      await loadReceiptBusinessInfo();
    } catch {
      // Non-fatal; receipts can still use cached values.
    }
  })();
}
