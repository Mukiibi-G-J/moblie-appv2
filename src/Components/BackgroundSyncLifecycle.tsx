import {useEffect, useRef} from 'react';
import {useAuth} from '../context/Store';
import {useOffline} from '../context/OfflineContext';
import {openPosDatabase} from '../db/persistence';
import {
  ensureSyncEngineStarted,
  runSyncCycle,
} from '../services/sync/SyncEngine';
import {syncMasterDataInBackground} from '../services/sync/backgroundCatalogSync';
import {getEffectiveIsOnline} from '../utils/posConnectivity';

/**
 * Keeps the sync engine running while authenticated: drains the outbox on
 * reconnect, periodically retries pending sales, and fills empty SQLite
 * catalogs when the device is online.
 */
export function BackgroundSyncLifecycle() {
  const auth = useAuth();
  const offline = useOffline();
  const wasOnlineRef = useRef(getEffectiveIsOnline());

  useEffect(() => {
    if (!auth?.user_id) {
      return;
    }

    ensureSyncEngineStarted({
      setSyncStatus: offline.setSyncStatus,
      setLastSyncAt: offline.setLastSyncAt,
      setSyncError: offline.setSyncError,
      setOutboxCount: offline.applyOutboxCount,
    });

    void (async () => {
      await openPosDatabase();
      await offline.refreshOutboxCount();
      if (getEffectiveIsOnline()) {
        runSyncCycle().catch(() => undefined);
        syncMasterDataInBackground();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync callbacks are stable
  }, [auth?.user_id]);

  useEffect(() => {
    const online = offline.isOnline;
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = online;

    if (!auth?.user_id || !online) {
      return;
    }

    if (!wasOnline && online) {
      runSyncCycle().catch(() => undefined);
      syncMasterDataInBackground();
      return;
    }

    if (online) {
      syncMasterDataInBackground();
    }
  }, [auth?.user_id, offline.isOnline]);

  return null;
}
