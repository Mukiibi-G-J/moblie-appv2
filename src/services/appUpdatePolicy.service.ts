import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  APP_UPDATE_API_URL,
  APP_UPDATE_CHECK_IN_DEV,
  APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR,
  APP_DOWNLOAD_FALLBACK_URL,
  APP_UPDATE_FETCH_TIMEOUT_MS,
} from '../constants/appUpdateGate';

export type AppVersionCheckResponse = {
  latest_build: number;
  latest_version: string;
  min_required_build: number;
  grace_period_ends_at: string;
  download_url: string;
  release_notes: string;
};

export type AppUpdateStatus =
  | { status: 'allowed' }
  | {
      status: 'soft_update';
      latestVersion: string;
      downloadUrl: string;
      releaseNotes: string;
      gracePeriodEndsAt: Date;
    }
  | {
      status: 'hard_block';
      downloadUrl: string;
    };

function shouldRunCheck(): boolean {
  if (!APP_UPDATE_API_URL.trim()) {
    return false;
  }
  if (__DEV__ && !APP_UPDATE_CHECK_IN_DEV) {
    return false;
  }
  return true;
}

async function fetchVersionInfo(): Promise<AppVersionCheckResponse | null> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const url = `${APP_UPDATE_API_URL.trim()}?platform=${platform}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_UPDATE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data?.status === 'ok' && !data?.latest_build) {
      return null;
    }
    return data as AppVersionCheckResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAppUpdatePolicy(): Promise<AppUpdateStatus> {
  if (!shouldRunCheck()) {
    return { status: 'allowed' };
  }

  const installedBuild = parseInt(DeviceInfo.getBuildNumber(), 10);
  if (!Number.isFinite(installedBuild) || installedBuild <= 0) {
    return { status: 'allowed' };
  }

  const info = await fetchVersionInfo();

  if (!info) {
    return APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR
      ? { status: 'allowed' }
      : { status: 'hard_block', downloadUrl: APP_DOWNLOAD_FALLBACK_URL };
  }

  const latestBuild =
    typeof info.latest_build === 'number' ? info.latest_build : 0;
  const minRequired =
    typeof info.min_required_build === 'number' ? info.min_required_build : 0;
  const downloadUrl = info.download_url?.trim() || APP_DOWNLOAD_FALLBACK_URL;

  if (installedBuild >= latestBuild) {
    return { status: 'allowed' };
  }

  if (minRequired > 0 && installedBuild < minRequired) {
    return { status: 'hard_block', downloadUrl };
  }

  const graceEndsAt = info.grace_period_ends_at
    ? new Date(info.grace_period_ends_at)
    : new Date(0);
  const now = new Date();

  if (now > graceEndsAt) {
    return { status: 'hard_block', downloadUrl };
  }

  return {
    status: 'soft_update',
    latestVersion: info.latest_version || '',
    downloadUrl,
    releaseNotes: info.release_notes || '',
    gracePeriodEndsAt: graceEndsAt,
  };
}
