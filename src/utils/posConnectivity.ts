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
  if (serverReachable === reachable) {
    return;
  }
  serverReachable = reachable;
  notifyConnectivityListeners();
}

/**
 * Online only when the device has a link and the last sync ping reached the API.
 * Simulated offline stays offline even if both are true.
 */
export function getEffectiveIsOnline(): boolean {
  if (getSimulateOfflinePos()) {
    return false;
  }
  return netInfoConnected && serverReachable;
}

/** True when checkout should queue locally instead of showing a hard failure. */
export function isCheckoutNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as {
    code?: unknown;
    message?: unknown;
    response?: unknown;
    isAxiosError?: boolean;
  };
  const code = String(err.code ?? '');
  if (code === 'SIMULATED_OFFLINE') {
    return true;
  }
  if (/ERR_NETWORK|ECONNABORTED|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(code)) {
    return true;
  }
  const message = typeof err.message === 'string' ? err.message : '';
  if (/network error|timeout|failed to fetch|cannot reach/i.test(message)) {
    return true;
  }
  return Boolean(err.isAxiosError && err.response == null);
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
