import Clipboard from '@react-native-clipboard/clipboard';
import RNFS from 'react-native-fs';
import {Platform, Share} from 'react-native';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function isLikelyPdf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) {
    return false;
  }
  const v = new Uint8Array(buffer.slice(0, 4));
  const sig = String.fromCharCode(v[0]!, v[1]!, v[2]!, v[3]!);
  return sig === '%PDF';
}

/**
 * Writes PDF bytes to app cache and opens the share sheet (iOS) or copies the
 * file path (Android — use Files / a share-capable app; RN Share cannot attach files on Android without extra native modules).
 */
export async function savePdfBufferAndShare(
  arrayBuffer: ArrayBuffer,
  fileBaseName: string,
): Promise<{savedPath: string; sharedOnIos: boolean}> {
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
      'Server did not return a PDF. Ensure POST /api/reports/export-pdf/ is implemented (same as web ReportService).',
    );
  }

  const safe = `${fileBaseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}.pdf`;
  const dest = `${RNFS.CachesDirectoryPath}/${safe}`;
  await RNFS.writeFile(dest, arrayBufferToBase64(arrayBuffer), 'base64');

  if (Platform.OS === 'ios') {
    await Share.share({title: 'Report', url: `file://${dest}`});
    return {savedPath: dest, sharedOnIos: true};
  }

  await Clipboard.setString(dest);
  return {savedPath: dest, sharedOnIos: false};
}
