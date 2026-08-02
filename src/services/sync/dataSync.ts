import {syncFullCatalogToLocal} from './catalogSync';
import {syncFullCustomersToLocal} from './customerCatalogSync';
import {syncFullPaymentMethodsToLocal} from './paymentMethodsCatalogSync';
import {syncFullBranchesToLocal} from './branchCatalogSync';
import {loadReceiptBusinessInfo} from '../companyInfoCache';
import type {SyncProgressHandler} from './itemsSync';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';

export async function syncAllData(onProgress?: SyncProgressHandler): Promise<void> {
  if (!getEffectiveIsOnline()) {
    throw new Error('Internet connection is required to sync.');
  }

  const scale = (pct: number, min: number, max: number) =>
    min + (pct / 100) * (max - min);

  onProgress?.('Syncing branches…', 1);
  try {
    await syncFullBranchesToLocal({
      force: true,
      onProgress: (message, progress) => {
        const p =
          typeof progress === 'number' ? scale(progress, 1, 8) : undefined;
        onProgress?.(message, p);
      },
    });
  } catch (branchError) {
    console.error('[DataSync] Branch sync failed:', branchError);
    onProgress?.('Branch sync failed, continuing…', 8);
  }

  onProgress?.('Syncing products…', 10);
  try {
    await syncFullCatalogToLocal({
      force: true,
      bulkListOnly: true,
      onProgress: (message, progress) => {
        const p =
          typeof progress === 'number' ? scale(progress, 10, 48) : undefined;
        onProgress?.(message, p);
      },
    });
  } catch (itemsError) {
    console.error('[DataSync] Items sync failed:', itemsError);
    onProgress?.('Product sync failed, continuing…', 45);
  }

  onProgress?.('Syncing customers…', 48);
  try {
    await syncFullCustomersToLocal({
      force: true,
      onProgress: (message, progress) => {
        const p =
          typeof progress === 'number' ? scale(progress, 48, 68) : undefined;
        onProgress?.(message, p);
      },
    });
  } catch (customersError) {
    console.error('[DataSync] Customers sync failed:', customersError);
    onProgress?.('Customer sync failed, continuing…', 68);
  }

  onProgress?.('Syncing payment methods…', 70);
  try {
    await syncFullPaymentMethodsToLocal({
      onProgress: (message, progress) => {
        const p =
          typeof progress === 'number' ? scale(progress, 70, 82) : undefined;
        onProgress?.(message, p);
      },
    });
  } catch (paymentError) {
    console.error('[DataSync] Payment methods sync failed:', paymentError);
    onProgress?.('Payment methods sync failed, continuing…', 82);
  }

  onProgress?.('Syncing company info for receipts…', 96);
  try {
    await loadReceiptBusinessInfo();
  } catch (companyError) {
    console.warn('[DataSync] Company info cache failed:', companyError);
  }

  onProgress?.('Sync complete', 100);
}
