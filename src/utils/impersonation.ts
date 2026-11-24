import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AuthImpersonation} from '../types/auth';

/** Stash debug_admin tokens while the app is viewing another user. */
const ADMIN_ACCESS_KEY = 'impersonation_admin_access';
const ADMIN_REFRESH_KEY = 'impersonation_admin_refresh';
const META_KEY = 'impersonation_meta';

export async function readImpersonationMeta(): Promise<AuthImpersonation | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthImpersonation;
    if (!parsed?.active || !parsed.target) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function stashAdminSession(
  meta: AuthImpersonation,
  access: string | null,
  refresh: string | null,
): Promise<void> {
  const items: [string, string][] = [[META_KEY, JSON.stringify(meta)]];
  if (access) {
    items.push([ADMIN_ACCESS_KEY, access]);
  }
  if (refresh) {
    items.push([ADMIN_REFRESH_KEY, refresh]);
  }
  await AsyncStorage.multiSet(items);
}

/** Restore stashed debug_admin tokens. Returns false when nothing was stashed. */
export async function restoreAdminSession(): Promise<boolean> {
  const access = await AsyncStorage.getItem(ADMIN_ACCESS_KEY);
  const refresh = await AsyncStorage.getItem(ADMIN_REFRESH_KEY);
  if (!access) {
    await clearImpersonationStash();
    return false;
  }
  const items: [string, string][] = [['accessToken', access]];
  if (refresh) {
    items.push(['refreshToken', refresh]);
  }
  await AsyncStorage.multiSet(items);
  if (!refresh) {
    await AsyncStorage.removeItem('refreshToken');
  }
  await clearImpersonationStash();
  return true;
}

export async function clearImpersonationStash(): Promise<void> {
  await AsyncStorage.multiRemove([
    ADMIN_ACCESS_KEY,
    ADMIN_REFRESH_KEY,
    META_KEY,
  ]);
}
