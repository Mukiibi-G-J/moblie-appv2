import NetInfo from '@react-native-community/netinfo';
import SyncApi from './SyncApi';
import {
  refreshServerReachability,
  setNetInfoConnected,
  setServerReachable,
} from '../../utils/posConnectivity';

const PING_INTERVAL_MS = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;
let lastOnline = true;
let onReconnectCallback: (() => void) | undefined;

async function runConnectivityTick(): Promise<void> {
  const state = await NetInfo.fetch();
  const connected = !!state.isConnected;
  setNetInfoConnected(connected);

  if (!connected) {
    setServerReachable(false);
    lastOnline = false;
    return;
  }

  let serverUp = false;
  try {
    await SyncApi.ping();
    serverUp = true;
  } catch {
    serverUp = false;
  }
  setServerReachable(serverUp);

  if (!lastOnline && serverUp) {
    onReconnectCallback?.();
  }
  lastOnline = serverUp;
}

export function refreshConnectivity(): void {
  void runConnectivityTick();
}

export function startConnectivityMonitor(onReconnect?: () => void) {
  if (timer) clearInterval(timer);
  onReconnectCallback = onReconnect;

  void NetInfo.fetch().then(state => {
    setNetInfoConnected(!!state.isConnected);
  });

  void runConnectivityTick();
  timer = setInterval(() => {
    void runConnectivityTick();
  }, PING_INTERVAL_MS);

  NetInfo.addEventListener(state => {
    setNetInfoConnected(!!state.isConnected);
    if (state.isConnected) {
      void runConnectivityTick();
    } else {
      setServerReachable(false);
      lastOnline = false;
    }
  });
}

export function stopConnectivityMonitor() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
