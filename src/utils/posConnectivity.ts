import SyncApi from '../services/sync/SyncApi';
import {
  getSimulateOfflinePos,
  loadSimulateOfflineFromStorage,
  setSimulateOfflinePos,
  subscribeSimulatedOfflineGate,
} from './simulatedOfflineGate';

export type PosConnectivityMode = 'online' | 'offline';
export type SyncStatus = 'idle' | 'syncing' | 'error';

export {
  getSimulateOfflinePos,
  loadSimulateOfflineFromStorage,
  setSimulateOfflinePos,
};

let netInfoConnected = true;
let serverReachable = true;

type ConnectivityListener = () => void;
const listeners = new Set<ConnectivityListener>();

function notifyConnectivityListeners() {
  listeners.forEach(listener => listener());
}

export function subscribePosConnectivity(listener: ConnectivityListener) {
  listeners.add(listener);
  const unsubGate = subscribeSimulatedOfflineGate(listener);
  return () => {
    listeners.delete(listener);
    unsubGate();
  };
}

export function setNetInfoConnected(connected: boolean) {
  netInfoConnected = connected;
  notifyConnectivityListeners();
}

export function setServerReachable(reachable: boolean) {
  serverReachable = reachable;
}

export function getEffectiveIsOnline(): boolean {
  if (getSimulateOfflinePos()) {
    return false;
  }
  return netInfoConnected;
}

export function getServerReachable(): boolean {
  return serverReachable;
}

export function getPosConnectivityMode(): PosConnectivityMode {
  return getEffectiveIsOnline() ? 'online' : 'offline';
}

export function isStockEnforcedOnline(isOnline: boolean): boolean {
  return isOnline;
}

export function getCartTrackingMode(isOnline: boolean): 'strict' | 'offline' {
  return isOnline ? 'strict' : 'offline';
}

export const OFFLINE_BANNER_MESSAGE =
  'Offline — sales are saved on this device and will post when online. Stock is checked when syncing.';

export const OFFLINE_SIMULATED_BANNER_MESSAGE =
  'Test offline mode — APIs blocked; sales use local SQLite only.';

export const OFFLINE_LOT_PICKER_MESSAGE =
  'Lot picker needs internet. You can complete the sale now; the server may require a lot when syncing.';

export async function refreshServerReachability(): Promise<boolean> {
  if (!netInfoConnected || getSimulateOfflinePos()) {
    setServerReachable(false);
    return false;
  }
  try {
    await SyncApi.ping();
    setServerReachable(true);
    return true;
  } catch {
    setServerReachable(false);
    return false;
  }
}
