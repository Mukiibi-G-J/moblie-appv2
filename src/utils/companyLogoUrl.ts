import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import {createAxiosInstance} from '../axios/axios';

const PLACEHOLDER_LOGO = 'company_logos/default.png';
const logoCache = new Map<string, string>();

/** Max logo width on 58mm thermal receipts (~1/3 of printable width). */
export const RECEIPT_LOGO_WIDTH_PX = 128;

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

/** Skip Django default placeholder (same rule as backend PDF receipts). */
export function isPlaceholderCompanyLogo(
  logo: string | null | undefined,
): boolean {
  if (!logo?.trim()) {
    return true;
  }
  const u = logo.trim();
  if (u.includes(PLACEHOLDER_LOGO)) {
    return true;
  }
  return false;
}

/**
 * Resolve logo URL and download to cache for native printers (Sunmi, Bluetooth).
 * USB can use the URL directly via RNUSBPrinter.printImageData.
 */
export async function prepareCompanyLogoForPrint(
  logo: string | null | undefined,
): Promise<{url: string; localPath: string} | null> {
  if (isPlaceholderCompanyLogo(logo)) {
    return null;
  }

  const url = await resolveCompanyLogoUri(logo);
  if (!url) {
    return null;
  }

  const cached = logoCache.get(url);
  if (cached && (await RNFS.exists(cached))) {
    return {url, localPath: cached};
  }

  const filename = `company_logo_${Date.now()}.png`;
  const localPath = `${RNFS.CachesDirectoryPath}/${filename}`;

  const result = await RNFS.downloadFile({fromUrl: url, toFile: localPath})
    .promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Logo download failed (${result.statusCode})`);
  }

  const stat = await RNFS.stat(localPath);
  if (stat.size === 0) {
    await RNFS.unlink(localPath).catch(() => undefined);
    throw new Error('Downloaded logo file is empty');
  }

  logoCache.set(url, localPath);
  return {url, localPath};
}
