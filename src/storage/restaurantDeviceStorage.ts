import AsyncStorage from '@react-native-async-storage/async-storage';

/** Restaurant PIN prefs (web: zentro_restaurant_device_v1). Uses AsyncStorage to avoid extra native deps. */
const PREFS_KEY = 'zentro_restaurant_device_v1';
/** Stable device id until prefs cleared (survives app restarts before enroll completes). */
const STANDALONE_DEVICE_ID_KEY = 'zentro_restaurant_device_id_v1';

export const RESTAURANT_PIN_SETUP_PENDING_KEY = 'restaurant.pin_setup_pending';

/** After password login: show PIN setup on auth stack when branch picker is not deferred. */
export const RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY =
  'restaurant.show_pin_setup_immediate';

/** Cleared on full logout. Parity with web sessionStorage `zentro_restaurant_pin_prompt_dismissed`. */
export const RESTAURANT_PIN_PROMPT_DISMISSED_KEY =
  'restaurant.pin_prompt_dismissed';

/** Cleared on full logout. Parity with web `zentro_restaurant_pin_configured_session`. */
export const RESTAURANT_PIN_CONFIGURED_SESSION_KEY =
  'restaurant.pin_configured_session';

export type RestaurantDevicePrefs = {
  isRestaurantDevice: boolean;
  deviceId: string;
  /** Tenant schema slug (matches JWT schema_name). */
  schemaName: string;
  companyDisplayName?: string;
  enrolledStaffName?: string;
};

/** RFC4122-style v4 (non-cryptographic; sufficient for device binding id). */
function randomUuidV4(): string {
  const b = new Uint8Array(16);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    try {
      globalThis.crypto.getRandomValues(b);
    } catch {
      for (let i = 0; i < 16; i++) {
        b[i] = Math.floor(Math.random() * 256);
      }
    }
  } else {
    for (let i = 0; i < 16; i++) {
      b[i] = Math.floor(Math.random() * 256);
    }
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function safeParse(raw: string | null): RestaurantDevicePrefs | null {
  if (!raw) {
    return null;
  }
  try {
    const v = JSON.parse(raw) as RestaurantDevicePrefs;
    if (
      v &&
      typeof v.deviceId === 'string' &&
      typeof v.schemaName === 'string' &&
      v.isRestaurantDevice === true
    ) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function getRestaurantDevicePrefs(): Promise<RestaurantDevicePrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return safeParse(raw);
  } catch {
    return null;
  }
}

export async function setRestaurantDevicePrefs(
  prefs: RestaurantDevicePrefs,
): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function clearRestaurantDevicePrefs(): Promise<void> {
  await AsyncStorage.multiRemove([PREFS_KEY, STANDALONE_DEVICE_ID_KEY]);
}

/**
 * Stable device id (max 64 chars). Persisted before enroll so PIN login stays consistent.
 */
export async function ensureRestaurantPinDeviceForCompany(options: {
  schemaName: string;
  companyDisplayName?: string;
}): Promise<RestaurantDevicePrefs> {
  const schemaSlug = (options.schemaName || '').trim().toLowerCase();
  const existing = await getRestaurantDevicePrefs();
  if (
    existing?.isRestaurantDevice &&
    existing.schemaName.toLowerCase() === schemaSlug
  ) {
    if (options.companyDisplayName && !existing.companyDisplayName) {
      const updated = {
        ...existing,
        companyDisplayName: options.companyDisplayName,
      };
      await setRestaurantDevicePrefs(updated);
      return updated;
    }
    return existing;
  }
  const prefs: RestaurantDevicePrefs = {
    isRestaurantDevice: true,
    deviceId: await getOrCreateRestaurantDeviceId(),
    schemaName: schemaSlug,
    companyDisplayName: options.companyDisplayName || existing?.companyDisplayName,
    enrolledStaffName:
      existing?.schemaName?.toLowerCase() === schemaSlug
        ? existing.enrolledStaffName
        : undefined,
  };
  await setRestaurantDevicePrefs(prefs);
  return prefs;
}

export async function getOrCreateRestaurantDeviceId(): Promise<string> {
  const prefs = await getRestaurantDevicePrefs();
  if (prefs?.deviceId && prefs.deviceId.length <= 64) {
    return prefs.deviceId;
  }
  try {
    const existing = await AsyncStorage.getItem(STANDALONE_DEVICE_ID_KEY);
    if (existing && existing.trim() && existing.length <= 64) {
      return existing.trim();
    }
  } catch {
    /* ignore */
  }
  const deviceId = randomUuidV4();
  await AsyncStorage.setItem(STANDALONE_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function setPinSetupPending(pending: boolean): Promise<void> {
  await AsyncStorage.setItem(
    RESTAURANT_PIN_SETUP_PENDING_KEY,
    pending ? '1' : '0',
  );
}

export async function getPinSetupPending(): Promise<boolean> {
  const v = await AsyncStorage.getItem(RESTAURANT_PIN_SETUP_PENDING_KEY);
  return v === '1';
}

export async function setRestaurantPinPromptDismissed(
  dismissed: boolean,
): Promise<void> {
  if (dismissed) {
    await AsyncStorage.setItem(RESTAURANT_PIN_PROMPT_DISMISSED_KEY, '1');
  } else {
    await AsyncStorage.removeItem(RESTAURANT_PIN_PROMPT_DISMISSED_KEY);
  }
}

export async function getRestaurantPinPromptDismissed(): Promise<boolean> {
  const v = await AsyncStorage.getItem(RESTAURANT_PIN_PROMPT_DISMISSED_KEY);
  return v === '1';
}

export async function setRestaurantPinConfiguredThisSession(
  configured: boolean,
): Promise<void> {
  if (configured) {
    await AsyncStorage.setItem(RESTAURANT_PIN_CONFIGURED_SESSION_KEY, '1');
  } else {
    await AsyncStorage.removeItem(RESTAURANT_PIN_CONFIGURED_SESSION_KEY);
  }
}

export async function getRestaurantPinConfiguredThisSession(): Promise<boolean> {
  const v = await AsyncStorage.getItem(RESTAURANT_PIN_CONFIGURED_SESSION_KEY);
  return v === '1';
}

/** Clear route-prompt session flags (call on logout). */
export async function clearRestaurantPinRouteSessionFlags(): Promise<void> {
  await AsyncStorage.multiRemove([
    RESTAURANT_PIN_PROMPT_DISMISSED_KEY,
    RESTAURANT_PIN_CONFIGURED_SESSION_KEY,
  ]);
}
