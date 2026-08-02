import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {countPendingOutbox, getSyncMeta, setSyncMeta} from '../db/sqlite';
import {BackgroundSyncLifecycle} from '../Components/BackgroundSyncLifecycle';
import {runSyncCycle} from '../services/sync/SyncEngine';
import {
  getEffectiveIsOnline,
  getSimulateOfflinePos,
  loadSimulateOfflineFromStorage,
  refreshServerReachability,
  setNetInfoConnected,
  setSimulateOfflinePos,
  subscribePosConnectivity,
  type SyncStatus,
} from '../utils/posConnectivity';
import {isSimulateOfflineSettingAvailable} from '../utils/simulatedOfflineGate';

type OfflineContextValue = {
  isConnected: boolean;
  isOnline: boolean;
  simulateOfflinePos: boolean;
  syncStatus: SyncStatus;
  outboxCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (iso: string | null) => void;
  setSyncError: (message: string | null) => void;
  refreshOutboxCount: () => Promise<number>;
  applyOutboxCount: (count: number) => void;
  setSimulateOfflinePos: (enabled: boolean) => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({children}: {children: React.ReactNode}) {
  const [isConnected, setIsConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [outboxCount, setOutboxCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setSyncError] = useState<string | null>(null);
  const [connectivityTick, setConnectivityTick] = useState(0);

  const applyOutboxCount = useCallback((count: number) => {
    setOutboxCount(count);
  }, []);

  const refreshOutboxCount = useCallback(async () => {
    const count = await countPendingOutbox();
    setOutboxCount(count);
    return count;
  }, []);

  useEffect(() => {
    void (async () => {
      const stored = await getSyncMeta('last_sync_at');
      if (stored) setLastSyncAt(stored);
      await refreshOutboxCount();
    })();
  }, [refreshOutboxCount]);

  useEffect(() => {
    void loadSimulateOfflineFromStorage();
    return subscribePosConnectivity(() => {
      setConnectivityTick(tick => tick + 1);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = !!state.isConnected;
      setIsConnected(connected);
      setNetInfoConnected(connected);
      if (connected) {
        void refreshServerReachability();
      }
    });
    void NetInfo.fetch().then(state => {
      const connected = !!state.isConnected;
      setIsConnected(connected);
      setNetInfoConnected(connected);
      if (connected) {
        void refreshServerReachability();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSetSimulateOffline = useCallback(async (enabled: boolean) => {
    await setSimulateOfflinePos(enabled);
    setConnectivityTick(tick => tick + 1);
    if (!enabled) {
      void runSyncCycle().then(() => refreshOutboxCount());
    }
  }, [refreshOutboxCount]);

  const value = useMemo<OfflineContextValue>(
    () => ({
      isConnected,
      isOnline: getEffectiveIsOnline(),
      simulateOfflinePos: isSimulateOfflineSettingAvailable()
        ? getSimulateOfflinePos()
        : false,
      syncStatus,
      outboxCount,
      lastSyncAt,
      lastError,
      setSyncStatus,
      setLastSyncAt: (iso: string | null) => {
        setLastSyncAt(iso);
        if (iso) {
          void setSyncMeta('last_sync_at', iso);
        }
      },
      setSyncError,
      refreshOutboxCount,
      applyOutboxCount,
      setSimulateOfflinePos: handleSetSimulateOffline,
    }),
    [
      isConnected,
      connectivityTick,
      syncStatus,
      outboxCount,
      lastSyncAt,
      lastError,
      refreshOutboxCount,
      applyOutboxCount,
      handleSetSimulateOffline,
    ],
  );

  return (
    <OfflineContext.Provider value={value}>
      <BackgroundSyncLifecycle />
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return ctx;
}

export function useOfflineOptional() {
  return useContext(OfflineContext);
}
