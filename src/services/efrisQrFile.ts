import RNFS from "react-native-fs";
import { encodeEfrisQrPngBase64 } from "../shared/receipt/efrisQrPng";

/** Write the EFRIS QR to a cache PNG the thermal image path can print. */
export async function writeEfrisQrPng(payload: string): Promise<string | null> {
  const base64 = encodeEfrisQrPngBase64(payload);
  if (!base64) return null;
  const path = `${RNFS.CachesDirectoryPath}/efris-qr-${Date.now()}.png`;
  await RNFS.writeFile(path, base64, "base64");
  return path;
}
