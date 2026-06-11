import RNFS from 'react-native-fs';
import {
  NativeModules,
  PermissionsAndroid,
  Platform,
  Share,
} from 'react-native';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

type PdfDownloadNative = {
  saveToDownloads: (
    base64: string,
    fileName: string,
  ) => Promise<{path: string; uri?: string}>;
  openPdf?: (uri: string) => Promise<boolean>;
};

const PdfDownload = NativeModules.PdfDownload as PdfDownloadNative | undefined;

export type SavePdfResult = {
  savedPath: string;
  /** Human-readable location shown in success toasts. */
  displayPath: string;
  sharedOnIos: boolean;
  openedViewer: boolean;
};

/** Hermes/RN has no `btoa`; encode bytes for native / RNFS write. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < len ? bytes[i + 1]! : 0;
    const c = i + 2 < len ? bytes[i + 2]! : 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += BASE64_ALPHABET[(triplet >> 18) & 63];
    result += BASE64_ALPHABET[(triplet >> 12) & 63];
    result += i + 1 < len ? BASE64_ALPHABET[(triplet >> 6) & 63] : '=';
    result += i + 2 < len ? BASE64_ALPHABET[triplet & 63] : '=';
  }
  return result;
}

function isLikelyPdf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) {
    return false;
  }
  const v = new Uint8Array(buffer.slice(0, 4));
  const sig = String.fromCharCode(v[0]!, v[1]!, v[2]!, v[3]!);
  return sig === '%PDF';
}

function sanitizePdfBaseName(fileBaseName: string): string {
  const safe = fileBaseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return safe.endsWith('.pdf') ? safe : `${safe}.pdf`;
}

async function ensureLegacyAndroidWritePermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const apiLevel =
    typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  if (Number.isNaN(apiLevel) || apiLevel > 28) {
    return;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Save PDF',
      message: 'Allow Zentro to save reports to your Downloads folder.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    },
  );
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Storage permission is required to save PDFs to Downloads.');
  }
}

async function savePdfOnAndroid(
  arrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<SavePdfResult> {
  if (!PdfDownload?.saveToDownloads) {
    throw new Error(
      'PDF download is not available. Rebuild the Android app and try again.',
    );
  }

  await ensureLegacyAndroidWritePermission();
  const base64 = arrayBufferToBase64(arrayBuffer);
  const result = await PdfDownload.saveToDownloads(base64, fileName);
  const displayPath = result.path || `Downloads/Zentro/${fileName}`;

  let openedViewer = false;
  if (result.uri && PdfDownload.openPdf) {
    try {
      await PdfDownload.openPdf(result.uri);
      openedViewer = true;
    } catch {
      openedViewer = false;
    }
  }

  return {
    savedPath: displayPath,
    displayPath,
    sharedOnIos: false,
    openedViewer,
  };
}

async function savePdfOnIos(
  arrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<SavePdfResult> {
  const dest = `${RNFS.CachesDirectoryPath}/${fileName}`;
  await RNFS.writeFile(dest, arrayBufferToBase64(arrayBuffer), 'base64');
  await Share.share({title: 'Report', url: `file://${dest}`});
  return {
    savedPath: dest,
    displayPath: fileName,
    sharedOnIos: true,
    openedViewer: false,
  };
}

/**
 * Saves a PDF from API bytes. Android → Downloads/Zentro via MediaStore; iOS → share sheet.
 */
export async function savePdfBufferAndShare(
  arrayBuffer: ArrayBuffer,
  fileBaseName: string,
): Promise<SavePdfResult> {
  if (!isLikelyPdf(arrayBuffer)) {
    const head = new TextDecoder('utf-8', {fatal: false}).decode(
      arrayBuffer.slice(0, 4000),
    );
    const trimmed = head.trim();
    if (trimmed.startsWith('{')) {
      try {
        const j = JSON.parse(trimmed) as {
          detail?: unknown;
          error?: unknown;
          message?: unknown;
        };
        const msg = [j.detail, j.error, j.message].find(
          m => typeof m === 'string',
        ) as string | undefined;
        if (msg) {
          throw new Error(msg);
        }
      } catch (e) {
        if (e instanceof Error && e.message && !/^Unexpected token/i.test(e.message)) {
          throw e;
        }
      }
    }
    throw new Error(
      'Server did not return a PDF. Check your connection and try again.',
    );
  }

  const fileName = sanitizePdfBaseName(fileBaseName);
  if (Platform.OS === 'android') {
    return savePdfOnAndroid(arrayBuffer, fileName);
  }
  return savePdfOnIos(arrayBuffer, fileName);
}
