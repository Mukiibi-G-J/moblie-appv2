import {Platform} from 'react-native';

// Set USE_TEST_ENV to true to use test environment
export const USE_TEST_ENV = false;

/**
 * Test-only master switch for simulated offline (requires USE_TEST_ENV = true).
 * When false: no API blocking, Settings toggle hidden, production-safe default.
 * When true: blocks axios calls; optional Settings toggle can turn it off without rebuild.
 */
export const SIMULATE_OFFLINE_POS = false;

export const TEST_API_PORT = 8003;

/** Your PC WiFi IPv4 — run `ipconfig` on Windows and pick the WiFi adapter address. */
export const TEST_API_LAN_HOST = '172.20.10.5';

/**
 * How the Android device reaches your local Django server:
 * - 'adb-reverse': USB `adb reverse tcp:8003 tcp:8003` then app uses 127.0.0.1.
 *   Wireless ADB reverse often fails (Failed to connect to /127.0.0.1:8003).
 * - 'lan': Same WiFi — set TEST_API_LAN_HOST and run `python manage.py runserver 0.0.0.0:8003`
 */
export const TEST_API_CONNECT_MODE: 'adb-reverse' | 'lan' = 'lan';

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
