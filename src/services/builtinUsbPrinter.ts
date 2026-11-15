export type BuiltinUsbDevice = {
  device_name: string;
  vendor_id: number;
  product_id: number;
};

/** Common USB vendor IDs used by Xprinter / generic 58mm ESC/POS printers. */
export const XPRINTER_VENDOR_IDS = new Set([
  1155, // 0x0483 STMicroelectronics
  1046, // 0x0416 Winbond / Aocom POS58
  8137, // 0x1FC9 NXP
  10473, // 0x28E9 GigaDevice
  1659, // 0x067B Prolific
  6790, // 0x1A86 QinHeng CH340
  26728, // 0x6868
  4070, // 0x0FE6
  1317, // 0x0525
  1137, // 0x0471
  5380, // 0x1504
  3540, // 0x0DD4
]);

export function isLikelyThermalPrinter(device: BuiltinUsbDevice): boolean {
  const name = (device.device_name || '').toLowerCase();
  return (
    XPRINTER_VENDOR_IDS.has(device.vendor_id) ||
    name.includes('print') ||
    name.includes('xprinter') ||
    name.includes('pos')
  );
}

/**
 * Built-in printers on Aocom / Rockchip POS tablets show up as USB
 * (for example "POS58 Printer USB", vendor 0x0416). Score only names
 * that look like a receipt printer so hubs and touchscreens are skipped.
 */
export function scoreBuiltinUsbPrinter(device: BuiltinUsbDevice): number {
  const name = (device.device_name || '').toLowerCase();
  const knownVendor = XPRINTER_VENDOR_IDS.has(device.vendor_id);
  const builtinName =
    /pos\s*58|pos58|pos\s*80|pos80|aocom|inner\s*printer|thermal|xprinter|receipt/.test(
      name,
    );
  const printerName =
    name.includes('print') &&
    (name.includes('pos') || name.includes('usb') || knownVendor);
  if (!builtinName && !printerName) {
    return 0;
  }
  let score = 1;
  if (/pos\s*58|pos58|aocom|inner\s*printer/.test(name)) {
    score += 5;
  }
  if (knownVendor) {
    score += 2;
  }
  if (name.includes('print')) {
    score += 2;
  }
  return score;
}
