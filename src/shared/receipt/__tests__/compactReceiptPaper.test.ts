import {buildReceiptDocument} from '../buildDocument';
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
    expect(text).toContain('TOTAL:');
    expect(text).toContain('Cash');
    expect(text).not.toContain('TIN:');
    expect(text).not.toContain('Invoice: SIN-000035');
    expect(text).toContain('SIN-000035');
    expect(doc.nodes.filter(n => n.type === 'image')).toHaveLength(1);
    expect(doc.nodes.find(n => n.text === 'demo')?.style?.forceBold).toBeFalsy();
  });

  it('prints TOTAL, amounts, and THANK YOU at normal size', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, branding);
    expect(doc.nodes.find(n => n.left === 'TOTAL:')?.style?.bold).toBeFalsy();
    expect(doc.nodes.find(n => n.text === 'THANK YOU')?.style?.bold).toBeFalsy();
    const usb = compileDocumentToUsbText(doc);
    expect(usb).not.toContain('<B>');
    expect(usb).toContain('<C>demo</C>');
    expect(usb).toContain('TOTAL:');
    expect(usb).toContain('THANK YOU');
    expect(usb).toContain('50,000');
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
    expect(text).toContain('Tendered:');
    expect(text).toContain('Change:');
  });

  it('does not add a trailing cut feed on USB tear-bar printers', () => {
    const template = getFallbackTemplate('sale', 'compact');
    const doc = buildReceiptDocument(swimmingSale(), template, branding);
    const usb = compileDocumentToUsbText(doc);
    expect(usb.endsWith('\n\n')).toBe(false);
    expect(usb).not.toContain('<B>');
    expect(usb).not.toContain('<C>--------------------------------</C>');

    const escpos = compileDocumentToEscPosBytes(doc);
    const hasCut = escpos.some(
      (b, i) => b === 0x1d && escpos[i + 1] === 0x56 && escpos[i + 2] === 0x00,
    );
    expect(hasCut).toBe(false);
  });
});
