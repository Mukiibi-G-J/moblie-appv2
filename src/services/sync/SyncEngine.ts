import {countPendingOutbox} from '../../db/sqlite';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import {
  syncEmptyCatalogSlicesInBackground,
  syncMasterDataInBackground,
} from './backgroundCatalogSync';
import {startConnectivityMonitor} from './ConnectivityMonitor';
import {syncAllData} from './dataSync';
import {drainOutbox, refreshOutboxCount, setOutboxCountListener} from './OutboxProcessor';
import {runIncrementalPull} from './PullEngine';
import type {SyncProgressHandler} from './itemsSync';

const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 1000;

let started = false;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let syncCycleInFlight: Promise<unknown> | null = null;
let syncStatusSetter:
  | ((status: 'idle' | 'syncing' | 'error') => void)
  | null = null;
let lastSyncSetter: ((iso: string | null) => void) | null = null;
let syncErrorSetter: ((message: string | null) => void) | null = null;

export type SyncEngineCallbacks = {
  setSyncStatus: (status: 'idle' | 'syncing' | 'error') => void;
  setLastSyncAt: (iso: string | null) => void;
  setSyncError: (message: string | null) => void;
  setOutboxCount: (count: number) => void;
};

export function configureSyncEngineCallbacks(callbacks: SyncEngineCallbacks) {
  syncStatusSetter = callbacks.setSyncStatus;
  lastSyncSetter = callbacks.setLastSyncAt;
  syncErrorSetter = callbacks.setSyncError;
  setOutboxCountListener(callbacks.setOutboxCount);
}

async function runSyncCycleInternal() {
  const online = getEffectiveIsOnline();
  if (!online) {
    return {skipped: true, reason: 'offline' as const};
  }

  syncStatusSetter?.('syncing');
  syncErrorSetter?.(null);

  try {
    const pushResult = await drainOutbox();
    await runIncrementalPull();
    await syncEmptyCatalogSlicesInBackground();
    const now = new Date().toISOString();
    lastSyncSetter?.(now);
    syncStatusSetter?.('idle');
    await refreshOutboxCount();
    syncMasterDataInBackground();
    return {pushResult};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    syncStatusSetter?.('error');
    syncErrorSetter?.(message);
    throw error;
  }
}

/** Push outbox + pull deltas + hydrate empty catalog. Safe to call often. */
export function runSyncCycle() {
  if (syncCycleInFlight) {
    return syncCycleInFlight;
  }
  syncCycleInFlight = runSyncCycleInternal().finally(() => {
    syncCycleInFlight = null;
  });
  return syncCycleInFlight;
}

function startPeriodicBackgroundSync() {
  if (periodicTimer) {
    return;
  }
  periodicTimer = setInterval(() => {
    if (!getEffectiveIsOnline()) {
      return;
    }
    void (async () => {
      const pending = await countPendingOutbox();
      if (pending > 0) {
        runSyncCycle().catch(() => undefined);
        return;
      }
      syncMasterDataInBackground();
    })();
  }, BACKGROUND_SYNC_INTERVAL_MS);
}

export function ensureSyncEngineStarted(callbacks: SyncEngineCallbacks) {
  configureSyncEngineCallbacks(callbacks);
  startSyncEngine();
}

export function startSyncEngine() {
  if (started) return;
  started = true;
  startConnectivityMonitor(() => {
    runSyncCycle().catch(() => undefined);
  });
  startPeriodicBackgroundSync();
}

export async function runFullOfflineSync(onProgress?: SyncProgressHandler) {
  const online = getEffectiveIsOnline();
  if (!online) {
    return {skipped: true, reason: 'offline' as const};
  }

  syncStatusSetter?.('syncing');
  syncErrorSetter?.(null);

  try {
    onProgress?.('Uploading pending sales…', 1);
    const pushResult = await drainOutbox();
    await refreshOutboxCount();

    await syncAllData((message, progress) => {
      const scaled =
        typeof progress === 'number'
          ? Math.max(5, Math.min(100, progress))
          : undefined;
      onProgress?.(message, scaled);
    });

    const now = new Date().toISOString();
    lastSyncSetter?.(now);
    syncStatusSetter?.('idle');
    return {pushResult};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    syncStatusSetter?.('error');
    syncErrorSetter?.(message);
    throw error instanceof Error ? error : new Error(message);
  }
}

export async function initialSyncAfterLogin(onProgress?: SyncProgressHandler) {
  startSyncEngine();
  onProgress?.('Uploading and downloading data for offline use…', 5);
  await runFullOfflineSync(onProgress);
}
