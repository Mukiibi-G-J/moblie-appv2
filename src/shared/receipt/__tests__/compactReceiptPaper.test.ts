import {buildReceiptDocument} from '../buildDocument';
import {encodeEfrisQrPngBase64} from '../efrisQrPng';
import {compileDocumentToEscPosBytes} from '../compileToEscPos';
import {compileDocumentToUsbText} from '../compileToUsb';
import {getFallbackTemplate} from '../fallbackTemplates';
import type {ReceiptBranding, SaleReceiptPayload} from '../types';

jest.mock('react-native-thermal-receipt-printer', () => ({
  USBPrinter: {printText: jest.fn()},
}));

const branding: ReceiptBranding = {
  name: 'demo',
  address: 'Ntinda',
  phone: '+256779899789',
  tin: '1234567890',
  logo: 'https://example.com/padded-logo.png',
};

function swimmingSale(overrides: Partial<SaleReceiptPayload> = {}): SaleReceiptPayload {
  return {
    receiptType: 'sale',
    invoiceNo: 'SIN-000035',
    documentDate: '2026-08-25T16:09:16.000Z',
    sellerName: 'sales',
    lines: [
      {
        item_name: 'Swimming Session',
        quantity: 2,
        unit_price: 25000,
        line_total: 50000,
      },
    ],
    totalAmount: 50000,
    amountReceived: 50000,
    changeAmount: 0,
    paymentMethod: 'Cash',
    ...overrides,
  };
}

describe('compact thermal receipts save paper', () => {
  it('drops the Qty header, exact-cash tendered line, and extra footer rule', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, branding);
    const text = doc.nodes
      .map(n => [n.text, n.left, n.right].filter(Boolean).join(' '))
      .join('\n');

    expect(text).toContain('2x Swimming Session');
    expect(doc.nodes.some(n => n.type === 'row' && n.left === 'Qty')).toBe(
      false,
    );
    expect(text).not.toContain('Tendered:');
    expect(text).toContain('TOTAL');
    expect(text).toContain('Receipt');
    expect(text).toContain('Till');
    expect(text).toContain('Cash');
    expect(text).toContain('Change');
    expect(text).toContain('Thank you for your purchase!');
    expect(text).not.toContain('TIN:');
    expect(text).not.toContain('Invoice: SIN-000035');
    expect(text).toContain('SIN-000035');
    expect(doc.nodes.filter(n => n.type === 'image')).toHaveLength(1);
    expect(doc.nodes.find(n => n.text === 'demo')?.style?.forceBold).toBeFalsy();
  });

  it('prints the saved layout labels at normal size', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, branding);
    expect(doc.nodes.find(n => n.left === 'TOTAL')?.style?.forceBold).toBeFalsy();
    expect(
      doc.nodes.find(n => n.text === 'Thank you for your purchase!')?.style
        ?.forceBold,
    ).toBeFalsy();
    const usb = compileDocumentToUsbText(doc);
    expect(usb).not.toContain('<B>');
    expect(usb).toContain('<C>demo</C>');
    expect(usb).toContain('TOTAL');
    expect(usb).toContain('Thank you for your purchase!');
    expect(usb).toContain('UGX 50,000');
  });

  it('prints the company display name instead of the legal name', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, {
      ...branding,
      name: 'THE ADRACE EXECUTIVE Copy',
      displayName: 'THE ADRACE EXECUTIVE',
    });
    const names = doc.nodes.map(n => n.text).filter(Boolean);
    expect(names).toContain('THE ADRACE EXECUTIVE');
    expect(names).not.toContain('THE ADRACE EXECUTIVE Copy');
  });

  it('keeps a long company name on one normal-size line', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, {
      ...branding,
      name: 'THE ADRACE EXECUTIVE Copy',
    });
    expect(
      doc.nodes.find(n => n.text === 'THE ADRACE EXECUTIVE Copy')?.style?.forceBold,
    ).toBeFalsy();
    const usb = compileDocumentToUsbText(doc);
    expect(usb).toContain('<C>THE ADRACE EXECUTIVE Copy</C>');
    expect(usb.split('\n').filter(line => line.includes('ADRACE')).length).toBe(
      1,
    );
  });

  it('still prints tendered when the customer overpays', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(
      swimmingSale({amountReceived: 60000, changeAmount: 10000}),
      template,
      branding,
    );
    const text = doc.nodes
      .map(n => [n.text, n.left, n.right].filter(Boolean).join(' '))
      .join('\n');
    expect(text).toContain('Cash');
    expect(text).toContain('Change');
    expect(text).toContain('UGX 10,000');
  });

  it('does not add a trailing cut feed on USB tear-bar printers', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, branding);
    const usb = compileDocumentToUsbText(doc);
    expect(usb.endsWith('\n\n')).toBe(true);
    expect(usb.endsWith('\n\n\n\n\n')).toBe(false);
    expect(usb).not.toContain('<B>');
    expect(usb).not.toContain('<C>--------------------------------</C>');

    const escpos = compileDocumentToEscPosBytes(doc);
    const hasCut = escpos.some(
      (b, i) => b === 0x1d && escpos[i + 1] === 0x56 && escpos[i + 2] === 0x00,
    );
    expect(hasCut).toBe(false);
  });

  it('prints the EFRIS QR, FDN, and verification code', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(
      swimmingSale({
        efrisFdn: '1234567890',
        efrisVerificationCode: 'ABCD',
        efrisQrCode: 'https://ura.example/1234567890',
      }),
      template,
      branding,
    );
    const text = doc.nodes
      .map(n => [n.text, n.left, n.right].filter(Boolean).join(' '))
      .join('\n');
    expect(text).toContain('FDN: 1234567890');
    expect(text).toContain('Verification: ABCD');
    const qrAt = doc.nodes.findIndex(n => n.type === 'qr');
    const thanksAt = doc.nodes.findIndex(n =>
      (n.text || '').startsWith('Thank you'),
    );
    expect(qrAt).toBeGreaterThan(-1);
    expect(thanksAt).toBeGreaterThan(qrAt);
    const escpos = compileDocumentToEscPosBytes(doc);
    const rasterAt = escpos.findIndex(
      (byte, index) =>
        byte === 0x1b &&
        escpos[index + 1] === 0x2a &&
        escpos[index + 2] === 33,
    );
    expect(rasterAt).toBeGreaterThan(-1);
    expect(
      escpos.some(
        (byte, index) =>
          byte === 0x1d &&
          escpos[index + 1] === 0x76 &&
          escpos[index + 2] === 0x30,
      ),
    ).toBe(false);
    const printable = String.fromCharCode(
      ...escpos.filter(b => b >= 32 && b < 127),
    );
    expect(printable).toContain('FDN: 1234567890');
    expect(printable).not.toContain('ura.example');
    const usb = compileDocumentToUsbText(doc);
    expect(usb).toContain('FDN: 1234567890');
    expect(usb).toContain('Verification: ABCD');
    expect(usb).not.toContain('ura.example');
    const png = Buffer.from(
      encodeEfrisQrPngBase64('https://ura.example/1234567890'),
      'base64',
    );
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });
});
