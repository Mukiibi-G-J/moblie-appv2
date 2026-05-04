import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  APP_UPDATE_ANDROID_STORE_URL_FALLBACK,
  APP_UPDATE_CHECK_IN_DEV,
  APP_UPDATE_CONFIG_URL,
  APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR,
  APP_UPDATE_IOS_STORE_URL_FALLBACK,
} from '../constants/appUpdateGate';

export type AppUpdatePolicy = {
  minBuild: number;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
};

const FETCH_TIMEOUT_MS = 12000;

export type AppUpdateCheckResult =
  | { status: 'allowed' }
  | { status: 'update_required'; storeUrl: string };

function shouldRunRemoteCheck(): boolean {
  if (!APP_UPDATE_CONFIG_URL.trim()) {
    return false;
  }
  if (__DEV__ && !APP_UPDATE_CHECK_IN_DEV) {
    return false;
  }
  return true;
}

function resolveStoreUrl(policy: Partial<AppUpdatePolicy>): string {
  if (Platform.OS === 'ios') {
    return (
      policy.iosStoreUrl?.trim() ||
      APP_UPDATE_IOS_STORE_URL_FALLBACK.trim() ||
      ''
    );
  }
  return (
    policy.androidStoreUrl?.trim() ||
    APP_UPDATE_ANDROID_STORE_URL_FALLBACK.trim() ||
    ''
  );
}

async function fetchPolicy(url: string): Promise<AppUpdatePolicy> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON');
    }
    const o = data as Record<string, unknown>;
    const rawMin = o.minBuild;
    const minBuild =
      typeof rawMin === 'number'
        ? rawMin
        : typeof rawMin === 'string'
          ? parseInt(rawMin, 10)
          : 0;
    return {
      minBuild: Number.isFinite(minBuild) ? Math.floor(minBuild) : 0,
      iosStoreUrl:
        typeof o.iosStoreUrl === 'string' ? o.iosStoreUrl : undefined,
      androidStoreUrl:
        typeof o.androidStoreUrl === 'string' ? o.androidStoreUrl : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAppUpdatePolicy(): Promise<AppUpdateCheckResult> {
  if (!shouldRunRemoteCheck()) {
    return { status: 'allowed' };
  }

  const installedBuild = parseInt(DeviceInfo.getBuildNumber(), 10);
  if (!Number.isFinite(installedBuild) || installedBuild < 0) {
    return { status: 'allowed' };
  }

  let policy: AppUpdatePolicy;
  try {
    policy = await fetchPolicy(APP_UPDATE_CONFIG_URL.trim());
  } catch {
    if (APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR) {
      return { status: 'allowed' };
    }
    const url = resolveStoreUrl({});
    if (!url) {
      return { status: 'allowed' };
    }
    return { status: 'update_required', storeUrl: url };
  }

  const minBuild =
    typeof policy.minBuild === 'number' && Number.isFinite(policy.minBuild)
      ? Math.floor(policy.minBuild)
      : 0;

  if (minBuild <= 0 || installedBuild >= minBuild) {
    return { status: 'allowed' };
  }

  const storeUrl = resolveStoreUrl(policy);
  if (!storeUrl) {
    return { status: 'allowed' };
  }

  return { status: 'update_required', storeUrl };
}
