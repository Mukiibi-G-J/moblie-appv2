import AsyncStorage from '@react-native-async-storage/async-storage';
import type {InternalAxiosRequestConfig} from 'axios';
import {SIMULATE_OFFLINE_POS, USE_TEST_ENV} from '../config/api.config';

const SIMULATE_STORAGE_KEY = 'dev.simulate_offline_pos';

let simulateOfflineOverride: boolean | null = null;

type GateListener = () => void;
const listeners = new Set<GateListener>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function subscribeSimulatedOfflineGate(listener: GateListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isSimulateFeatureEnabled(): boolean {
  return USE_TEST_ENV && SIMULATE_OFFLINE_POS;
}

export async function loadSimulateOfflineFromStorage(): Promise<void> {
  if (!isSimulateFeatureEnabled()) {
    simulateOfflineOverride = null;
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(SIMULATE_STORAGE_KEY);
    if (raw === '1' || raw === '0') {
      simulateOfflineOverride = raw === '1';
      notifyListeners();
    }
  } catch {
    /* ignore */
  }
}

/** True only when USE_TEST_ENV and SIMULATE_OFFLINE_POS are both true (Settings toggle optional). */
export function getSimulateOfflinePos(): boolean {
  if (!isSimulateFeatureEnabled()) {
    return false;
  }
  if (simulateOfflineOverride !== null) {
    return simulateOfflineOverride;
  }
  return true;
}

export function isSimulateOfflineSettingAvailable(): boolean {
  return isSimulateFeatureEnabled();
}

export async function setSimulateOfflinePos(enabled: boolean): Promise<void> {
  if (!isSimulateFeatureEnabled()) {
    return;
  }
  simulateOfflineOverride = enabled;
  await AsyncStorage.setItem(SIMULATE_STORAGE_KEY, enabled ? '1' : '0');
  notifyListeners();
}

export const SIMULATED_OFFLINE_API_MESSAGE =
  'Simulated offline — all API calls are blocked. Turn off "Simulate offline POS" in Settings.';

export function createSimulatedOfflineAxiosError(
  config?: InternalAxiosRequestConfig,
) {
  const error = new Error(SIMULATED_OFFLINE_API_MESSAGE) as Error & {
    code: string;
    config?: InternalAxiosRequestConfig;
    isAxiosError: boolean;
  };
  error.code = 'SIMULATED_OFFLINE';
  error.config = config;
  error.isAxiosError = true;
  return error;
}

/** Reject before any HTTP request when test offline simulation is active. */
export function assertApiNotSimulatedOffline(
  config: InternalAxiosRequestConfig,
): void {
  if (getSimulateOfflinePos()) {
    throw createSimulatedOfflineAxiosError(config);
  }
}
