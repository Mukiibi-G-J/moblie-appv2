import {Platform} from 'react-native';

// Set USE_TEST_ENV to true to use test environment
export const USE_TEST_ENV = false;

export const TEST_API_PORT = 8000;

/** Your PC WiFi IPv4 — run `ipconfig` on Windows and pick the WiFi adapter address. */
export const TEST_API_LAN_HOST = '192.168.1.107';

/**
 * How the Android device reaches your local Django server:
 * - 'adb-reverse': `adb reverse tcp:8000 tcp:8000` then app uses 127.0.0.1 (not localhost — avoids IPv6).
 * - 'lan': Same WiFi — set TEST_API_LAN_HOST and run `python manage.py runserver 0.0.0.0:8000`
 */
export const TEST_API_CONNECT_MODE: 'adb-reverse' | 'lan' = 'adb-reverse';

export const TEST_TENANT_SCHEMA = 'primewise';

export function resolveTestApiBaseUrl(): string {
  if (TEST_API_CONNECT_MODE === 'lan') {
    return `http://${TEST_API_LAN_HOST}:${TEST_API_PORT}`;
  }
  if (Platform.OS === 'android') {
    return `http://127.0.0.1:${TEST_API_PORT}`;
  }
  return `http://localhost:${TEST_API_PORT}`;
}

export const TEST_API_BASE_URL = resolveTestApiBaseUrl();

// Production Environment (uses tenant-based subdomains)
export const PROD_BASE_URL = 'https://zentroapp-backend.com';
