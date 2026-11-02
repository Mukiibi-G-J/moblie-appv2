import {scoreBuiltinUsbPrinter} from '../builtinUsbPrinter';

describe('scoreBuiltinUsbPrinter', () => {
  it('selects an Aocom-style built-in POS58 and ignores the touchscreen', () => {
    const printer = scoreBuiltinUsbPrinter({
      device_name: 'STMicroelectronics POS58 Printer USB',
      vendor_id: 1046,
      product_id: 20497,
    });
    const touch = scoreBuiltinUsbPrinter({
      device_name: 'ILITEK ILITEK-TP',
      vendor_id: 8746,
      product_id: 1,
    });
    expect(printer).toBeGreaterThan(0);
    expect(touch).toBe(0);
  });

  it('still matches a named Xprinter', () => {
    expect(
      scoreBuiltinUsbPrinter({
        device_name: 'Xprinter XP-58',
        vendor_id: 1155,
        product_id: 22304,
      }),
    ).toBeGreaterThan(0);
  });
});
