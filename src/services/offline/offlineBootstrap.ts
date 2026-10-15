import AsyncStorage from '@react-native-async-storage/async-storage';
import {openPosDatabase} from '../../db/persistence';
import SyncApi from '../sync/SyncApi';
import {
  ensureSyncEngineStarted,
  initialSyncAfterLogin,
} from '../sync/SyncEngine';
import {getOrCreateDeviceId, setSyncMeta} from '../../db/sqlite';
import {resolveEffectiveBranchDimensionId} from '../../utils/effectiveBranch';
import type {SyncProgressHandler} from '../sync/itemsSync';

const BOOTSTRAP_DONE_KEY = 'offline.bootstrap_done';

let bootstrapInFlight: Promise<void> | null = null;

export type OfflineBootstrapCallbacks = {
  setSyncStatus: (status: 'idle' | 'syncing' | 'error') => void;
  setLastSyncAt: (iso: string | null) => void;
  setSyncError: (message: string | null) => void;
  setOutboxCount: (count: number) => void;
};

export async function registerMobileSyncDevice(): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const branchId = await resolveEffectiveBranchDimensionId();
  const data = await SyncApi.registerDevice({
    device_id: deviceId,
    name: 'Mobile POS',
    client_type: 'mobile',
    branch_id: branchId,
  });
  if (data.device_id) {
    await setSyncMeta('device_id', data.device_id);
  }
}

export async function runOfflineBootstrapIfNeeded(
  callbacks: OfflineBootstrapCallbacks,
  onProgress?: SyncProgressHandler,
  options?: {force?: boolean},
): Promise<{ran: boolean; skipped?: string}> {
  ensureSyncEngineStarted(callbacks);
  await openPosDatabase();

  const done = await AsyncStorage.getItem(BOOTSTRAP_DONE_KEY);
  if (done === '1' && !options?.force) {
    const {getCatalogEmptyFlags} = await import('../sync/backgroundCatalogSync');
    const empty = await getCatalogEmptyFlags();
    if (!empty.items && !empty.customers && !empty.paymentMethods) {
      return {ran: false, skipped: 'already_done'};
    }
  }

  if (bootstrapInFlight) {
    await bootstrapInFlight;
    return {ran: true};
  }

  bootstrapInFlight = (async () => {
    await registerMobileSyncDevice();
    await initialSyncAfterLogin(onProgress);
    await AsyncStorage.setItem(BOOTSTRAP_DONE_KEY, '1');
  })();

  try {
    await bootstrapInFlight;
    return {ran: true};
  } finally {
    bootstrapInFlight = null;
  }
}

export async function clearOfflineBootstrapFlag() {
  await AsyncStorage.removeItem(BOOTSTRAP_DONE_KEY);
}
