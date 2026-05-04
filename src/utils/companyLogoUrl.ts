import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

/**
 * Build a full image URI for company logo from GET /api/sales/company-info/.
 * Django may return an absolute URL or a root-relative path (/media/...).
 */
export async function resolveCompanyLogoUri(
  logo: string | null | undefined,
): Promise<string | null> {
  if (!logo?.trim()) {
    return null;
  }
  const u = logo.trim();
  if (/^https?:\/\//i.test(u)) {
    return u;
  }
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const inst = createAxiosInstance(tenant);
  const base = inst?.defaults?.baseURL?.replace(/\/$/, '') ?? '';
  if (!base) {
    return null;
  }
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${base}${path}`;
}
