import {useCallback, useEffect, useRef, useState} from 'react';
import {useAppContext, useAuth} from '../context/Store';
import {useOffline} from '../context/OfflineContext';
import {
  clearOfflineBootstrapFlag,
  runOfflineBootstrapIfNeeded,
} from '../services/offline/offlineBootstrap';
import {openPosDatabase} from '../db/persistence';
import {
  getCatalogEmptyFlags,
  syncMasterDataInBackground,
} from '../services/sync/backgroundCatalogSync';
import {getEffectiveIsOnline} from '../utils/posConnectivity';

export function useOfflineBootstrap() {
  const auth = useAuth();
  const ctx = useAppContext();
  const offline = useOffline();
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState<number | undefined>();
  const startedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);
  const prevBranchIdRef = useRef<number | null>(null);
  const prevBranchPendingRef = useRef(false);

  const branchId = ctx?.branchSession?.active_branch_id ?? null;
  const branchSelectionPending =
    ctx?.branchSession?.branchSelectionPending ?? false;

  const callbacks = {
    setSyncStatus: offline.setSyncStatus,
    setLastSyncAt: offline.setLastSyncAt,
    setSyncError: offline.setSyncError,
    setOutboxCount: offline.applyOutboxCount,
  };

  const runBootstrap = useCallback(
    async (force?: boolean) => {
      if (!auth?.user_id || !getEffectiveIsOnline()) {
        return;
      }

      try {
        await openPosDatabase();
        const empty = await getCatalogEmptyFlags();
        const showProgress =
          !!force || empty.items || empty.customers || empty.paymentMethods;

        if (showProgress) {
          setSyncModalVisible(true);
          setSyncMessage('Preparing offline catalog…');
        }

        const result = await runOfflineBootstrapIfNeeded(
          callbacks,
          showProgress
            ? (message, progress) => {
                setSyncMessage(message);
                setSyncProgress(progress);
              }
            : undefined,
          {force},
        );

        if (!result.ran) {
          syncMasterDataInBackground({force});
        }
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : 'Offline sync failed';
        offline.setSyncError(msg);
      } finally {
        setSyncModalVisible(false);
        setSyncProgress(undefined);
        await offline.refreshOutboxCount();
      }
    },
    [auth?.user_id, offline],
  );

  useEffect(() => {
    const userId = auth?.user_id ?? null;

    if (!userId) {
      startedRef.current = false;
      prevUserIdRef.current = null;
      prevBranchIdRef.current = null;
      prevBranchPendingRef.current = false;
      return;
    }

    if (prevUserIdRef.current !== userId) {
      startedRef.current = false;
      prevBranchIdRef.current = null;
      prevUserIdRef.current = userId;
    }

    const branchJustConfirmed =
      prevBranchPendingRef.current && !branchSelectionPending;

    if (branchSelectionPending || branchId == null) {
      prevBranchPendingRef.current = branchSelectionPending;
      return;
    }

    if (!getEffectiveIsOnline()) {
      prevBranchPendingRef.current = branchSelectionPending;
      return;
    }

    const branchChanged =
      prevBranchIdRef.current != null &&
      prevBranchIdRef.current !== branchId;

    prevBranchIdRef.current = branchId;
    prevBranchPendingRef.current = branchSelectionPending;

    if (branchChanged || branchJustConfirmed) {
      startedRef.current = false;
      void clearOfflineBootstrapFlag().then(() => runBootstrap(true));
      return;
    }

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    void runBootstrap(false);
  }, [
    auth?.user_id,
    branchId,
    branchSelectionPending,
    offline.isConnected,
    runBootstrap,
  ]);

  return {
    syncModalVisible,
    syncMessage,
    syncProgress,
    runBootstrap,
  };
}
