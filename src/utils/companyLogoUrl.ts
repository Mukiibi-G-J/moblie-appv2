import AsyncStorage from '@react-native-async-storage/async-storage';
import {Image} from 'react-native';
import RNFS from 'react-native-fs';
import {createAxiosInstance} from '../axios/axios';

const PLACEHOLDER_LOGO = 'company_logos/default.png';
const logoCache = new Map<string, PreparedCompanyLogo>();

/** Max logo width on 58mm thermal receipts (~1/3 of printable width). */
export const RECEIPT_LOGO_WIDTH_PX = 128;
/** Cap height so tall / padded logos do not feed blank paper after the mark. */
export const RECEIPT_LOGO_HEIGHT_PX = 64;

export type PreparedCompanyLogo = {
  url: string;
  localPath: string;
  /** Source pixel size (for contain fit). */
  width: number;
  height: number;
};

/**
 * Fit logo into the receipt box (object-fit: contain), never upscaling.
 * Used so printers that only accept width still end up with a short bitmap.
 */
export function fitReceiptLogoSize(
  srcW: number,
  srcH: number,
  maxW: number = RECEIPT_LOGO_WIDTH_PX,
  maxH: number = RECEIPT_LOGO_HEIGHT_PX,
): {width: number; height: number} {
  if (!srcW || !srcH || srcW < 1 || srcH < 1) {
    return {width: maxW, height: Math.min(maxH, maxW)};
  }
  const scale = Math.min(maxW / srcW, maxH / srcH, 1);
  return {
    width: Math.max(8, Math.round(srcW * scale)),
    height: Math.max(8, Math.round(srcH * scale)),
  };
}

function probeImageSize(
  fileUri: string,
): Promise<{width: number; height: number}> {
  return new Promise(resolve => {
    Image.getSize(
      fileUri,
      (width, height) => {
        resolve({
          width: width > 0 ? width : RECEIPT_LOGO_WIDTH_PX,
          height: height > 0 ? height : RECEIPT_LOGO_HEIGHT_PX,
        });
      },
      () => {
        resolve({
          width: RECEIPT_LOGO_WIDTH_PX,
          height: RECEIPT_LOGO_HEIGHT_PX,
        });
      },
    );
  });
}

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
): Promise<PreparedCompanyLogo | null> {
  if (isPlaceholderCompanyLogo(logo)) {
    return null;
  }

  const url = await resolveCompanyLogoUri(logo);
  if (!url) {
    return null;
  }

  const cached = logoCache.get(url);
  if (cached && (await RNFS.exists(cached.localPath))) {
    return cached;
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

  const fileUri = localPath.startsWith('file://')
    ? localPath
    : `file://${localPath}`;
  const size = await probeImageSize(fileUri);

  const prepared: PreparedCompanyLogo = {
    url,
    localPath,
    width: size.width,
    height: size.height,
  };
  logoCache.set(url, prepared);
  return prepared;
}
