type QrModules = {
  size: number;
  get: (row: number, col: number) => number | boolean;
};

/** Hermes on the POS has no TextEncoder. qrcode calls it while building the matrix. */
function installTextEncoder(): void {
  const root = (
    typeof globalThis !== "undefined" ? globalThis : global
  ) as typeof globalThis & { TextEncoder?: new () => { encode: (input: string) => Uint8Array } };
  if (typeof root.TextEncoder === "function") return;
  root.TextEncoder = class TextEncoder {
    encode(input: string): Uint8Array {
      const text = String(input);
      const bytes: number[] = [];
      for (let i = 0; i < text.length; i++) {
        let code = text.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
          const next = text.charCodeAt(i + 1);
          if (next >= 0xdc00 && next <= 0xdfff) {
            code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
            i += 1;
          }
        }
        if (code < 0x80) {
          bytes.push(code);
        } else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code < 0x10000) {
          bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        } else {
          bytes.push(
            0xf0 | (code >> 18),
            0x80 | ((code >> 12) & 0x3f),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f),
          );
        }
      }
      return Uint8Array.from(bytes);
    }
  };
}

installTextEncoder();

const QRCode = require("qrcode") as {
  create: (
    data: string,
    options?: { errorCorrectionLevel?: string },
  ) => { modules: QrModules };
};

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  );
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(type, (char) => char.charCodeAt(0));
  const crcInput = concat([typeBytes, data]);
  return concat([
    u32(data.length),
    typeBytes,
    data,
    u32(crc32(crcInput)),
  ]);
}

/** zlib wrapper around raw bytes using uncompressed stored blocks. */
function zlibStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  let offset = 0;
  while (offset < data.length || data.length === 0) {
    const len = Math.min(65535, data.length - offset);
    const last = offset + len >= data.length;
    const nlen = len ^ 0xffff;
    parts.push(
      Uint8Array.of(
        last ? 1 : 0,
        len & 255,
        (len >> 8) & 255,
        nlen & 255,
        (nlen >> 8) & 255,
      ),
      data.subarray(offset, offset + len),
    );
    offset += len;
    if (last) break;
  }
  const sum = adler32(data);
  parts.push(u32(sum));
  return concat(parts);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[triple & 63] : "=";
  }
  return out;
}

type QrMatrix = { modules: QrModules };

function qrMatrix(payload: string): QrMatrix | null {
  const text = String(payload || "").trim();
  if (!text) return null;
  return QRCode.create(text, { errorCorrectionLevel: "M" });
}

function moduleDark(qr: QrMatrix, row: number, col: number): boolean {
  const size = qr.modules.size;
  return row >= 0 && col >= 0 && row < size && col < size && Boolean(qr.modules.get(row, col));
}

/**
 * ESC * 24-dot picture. The PT-200 prints GS v 0 as a block of random letters,
 * and this is the image command that portable 58mm printers actually draw.
 */
export function appendEfrisQrRaster(bytes: number[], payload: string): void {
  const qr = qrMatrix(payload);
  if (!qr) return;
  const modules = qr.modules.size;
  const margin = 4;
  const paperDots = 384;
  let scale = 4;
  let dim = (modules + margin * 2) * scale;
  while (dim > 256 && scale > 2) {
    scale -= 1;
    dim = (modules + margin * 2) * scale;
  }
  const width = Math.min(paperDots, dim + 48);
  const xOffset = Math.floor((width - dim) / 2);

  // Leave multibyte character mode or ESC * is ignored after the receipt text.
  bytes.push(0x1c, 0x2e);
  bytes.push(0x1b, 0x61, 0x01);
  bytes.push(0x1b, 0x33, 24);
  for (let y0 = 0; y0 < dim; y0 += 24) {
    bytes.push(0x1b, 0x2a, 33, width & 0xff, (width >> 8) & 0xff);
    for (let x = 0; x < width; x++) {
      const srcX = x - xOffset;
      for (let slice = 0; slice < 3; slice++) {
        let value = 0;
        for (let bit = 0; bit < 8; bit++) {
          const srcY = y0 + slice * 8 + bit;
          if (srcX < 0 || srcX >= dim || srcY >= dim) continue;
          const moduleRow = Math.floor(srcY / scale) - margin;
          const moduleCol = Math.floor(srcX / scale) - margin;
          if (moduleDark(qr, moduleRow, moduleCol)) {
            value |= 1 << (7 - bit);
          }
        }
        bytes.push(value);
      }
    }
    bytes.push(0x0a);
  }
  bytes.push(0x1b, 0x32);
}

/** Base64 of the GS v 0 QR raster, for the USB raw print path. */
export function efrisQrRasterBase64(payload: string): string {
  const bytes: number[] = [];
  appendEfrisQrRaster(bytes, payload);
  if (!bytes.length) return "";
  return bytesToBase64(Uint8Array.from(bytes));
}

/** Black-and-white PNG of an EFRIS QR payload. Empty string when there is no payload. */
export function encodeEfrisQrPngBase64(payload: string): string {
  const qr = qrMatrix(payload);
  if (!qr) return "";
  const modules = qr.modules.size;
  const margin = 4;
  const scale = 5;
  const dim = (modules + margin * 2) * scale;
  // 24-bit RGB. Grayscale PNGs decoded as a flat bitmap on the OCOM,
  // and the printer then burned a blank square.
  const raw = new Uint8Array(dim * (1 + dim * 3));
  let offset = 0;
  for (let y = 0; y < dim; y++) {
    raw[offset++] = 0;
    const row = Math.floor(y / scale) - margin;
    for (let x = 0; x < dim; x++) {
      const col = Math.floor(x / scale) - margin;
      const value = moduleDark(qr, row, col) ? 0 : 255;
      raw[offset++] = value;
      raw[offset++] = value;
      raw[offset++] = value;
    }
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(dim), 0);
  ihdr.set(u32(dim), 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = concat([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibStore(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
  return bytesToBase64(png);
}
