import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules} from 'react-native';
import {USBPrinter} from 'react-native-thermal-receipt-printer';
import {exchange_text} from 'react-native-thermal-receipt-printer/dist/utils/EPToolkit';
import type {PrintReceiptData} from './PrintService';
import {
  compileDocumentToUsbPieces,
  printUsbDocument,
} from '../shared/receipt/compileToUsb';
import {appendEfrisQrRaster, bytesToBase64} from '../shared/receipt/efrisQrPng';
import type {ReceiptDocument} from '../shared/receipt/types';
import {
  buildKotReceiptDocument,
  buildSaleReceiptDocument,
} from './receiptPrintOrchestrator';
import {
  fitReceiptLogoSize,
  logoBoxPixels,
  prepareCompanyLogoForPrint,
} from '../utils/companyLogoUrl';
import {
  buildSampleSaleReceiptData,
  fetchCompanyInfoForReceipt,
  receiptCompanyName,
} from '../utils/companyReceiptInfo';
import {
  isLikelyThermalPrinter,
  scoreBuiltinUsbPrinter,
  XPRINTER_VENDOR_IDS,
} from './builtinUsbPrinter';

export interface UsbDevice {
  device_name: string;
  vendor_id: number;
  product_id: number;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printUsbRaw(bytes: number[]): void {
  const printRawData = (
    NativeModules.RNUSBPrinter as
      | {printRawData?: (payload: string, cb: (error?: string) => void) => void}
      | undefined
  )?.printRawData;
  if (!bytes.length || typeof printRawData !== 'function') return;
  printRawData(bytesToBase64(Uint8Array.from(bytes)), () => undefined);
}

function textToEscPos(text: string): number[] {
  const encoded = exchange_text(text, {encoding: 'UTF8'}) as Uint8Array;
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) bytes.push(encoded[i] & 0xff);
  return bytes;
}

/**
 * The PT-200 drops a picture that shares a buffer with the following text.
 * Each part is its own write, and the next part waits until that write is done.
 */
async function printUsbSaleDocument(document: ReceiptDocument): Promise<void> {
  for (const piece of compileDocumentToUsbPieces(document)) {
    if (piece.kind === 'qr') {
      const bytes: number[] = [];
      try {
        appendEfrisQrRaster(bytes, piece.data);
      } catch (error) {
        console.warn('EFRIS QR image skipped', error);
      }
      if (!bytes.length) continue;
      printUsbRaw(bytes);
      await wait(2200);
      continue;
    }
    if (!piece.text) continue;
    const bytes = textToEscPos(piece.text);
    printUsbRaw(bytes);
    await wait(Math.min(1200, 400 + Math.ceil(bytes.length / 6)));
  }
}

function looksLikeUsbPath(name: string): boolean {
  return name.startsWith('/dev/') || /bus\/usb/i.test(name);
}

function formatUsbDeviceName(device: UsbDevice): string {
  const raw = (device.device_name || '').trim();
  if (raw && !looksLikeUsbPath(raw)) {
    return raw;
  }
  if (XPRINTER_VENDOR_IDS.has(device.vendor_id)) {
    return `Xprinter USB (${device.vendor_id}:${device.product_id})`;
  }
  return raw || `USB device (${device.vendor_id}:${device.product_id})`;
}

const STORAGE_KEY = 'zentro_usb_printer_v1';
const LINE = '--------------------------------'; // 32 chars for 58mm paper
const COLS = 32;

function padLine(left: string, right: string): string {
  const gap = COLS - left.length - right.length;
  return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
}

function plainAmount(n: number): string {
  const r = Math.round(Number(n));
  return Number.isFinite(r) ? r.toLocaleString('en-US') : '0';
}

function compactReceiptDate(isoOrDate: string): string {
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) {
      return String(isoOrDate).split('T')[0] || '';
    }
    return d
      .toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Africa/Kampala',
      })
      .replace(',', '');
  } catch {
    return String(isoOrDate).split('T')[0] || '';
  }
}

function normalizeUsbDevice(raw: {
  device_name: string;
  vendor_id?: string | number;
  product_id?: string | number;
}): UsbDevice {
  const device = {
    device_name: raw.device_name,
    vendor_id: Number(raw.vendor_id),
    product_id: Number(raw.product_id),
  };
  return {
    ...device,
    device_name: formatUsbDeviceName(device),
  };
}

export interface KotItem {
  item_name: string;
  quantity: number;
  special_instructions?: string | null;
  fire_state_display?: string | null;
}

export interface KotData {
  order_no: string;
  table_label: string;
  order_type_display: string;
  waiter_name?: string;
  printed_at: string;
  items: KotItem[];
}

export type BuiltinUsbConnectResult = 'connected' | 'none' | 'denied';

class UsbPrinterService {
  private static instance: UsbPrinterService;
  private connectedDevice: UsbDevice | null = null;
  private initialised = false;
  private lastError: string | null = null;

  private constructor() {}

  static getInstance(): UsbPrinterService {
    if (!UsbPrinterService.instance) {
      UsbPrinterService.instance = new UsbPrinterService();
    }
    return UsbPrinterService.instance;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialised) {
      await USBPrinter.init();
      this.initialised = true;
    }
  }

  async getDeviceList(): Promise<UsbDevice[]> {
    await this.ensureInit();
    try {
      const devices = await USBPrinter.getDeviceList();
      const list = Array.isArray(devices) ? devices : [];
      return list
        .map(d => normalizeUsbDevice(d))
        .sort((a, b) => {
          const aLikely = isLikelyThermalPrinter(a) ? 0 : 1;
          const bLikely = isLikelyThermalPrinter(b) ? 0 : 1;
          return aLikely - bLikely;
        });
    } catch (err: unknown) {
      const msg =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : String(err ?? '');
      if (/no device found/i.test(msg)) {
        return [];
      }
      throw err;
    }
  }

  async connect(device: UsbDevice): Promise<boolean> {
    try {
      await this.ensureInit();
      const vendorId = Number(device.vendor_id);
      const productId = Number(device.product_id);
      if (!Number.isFinite(vendorId) || !Number.isFinite(productId)) {
        console.error('USB connect: invalid vendor_id or product_id');
        this.lastError = 'Invalid USB printer id';
        return false;
      }
      // Native RNUSBPrinter.connectPrinter expects Integer, not string (New Architecture bridge).
      // The native side resolves only after USB permission is granted.
      await (USBPrinter.connectPrinter as (v: number, p: number) => Promise<unknown>)(
        vendorId,
        productId,
      );
      this.connectedDevice = device;
      this.lastError = null;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
      return true;
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : String(error ?? '');
      this.lastError = message || 'USB connect failed';
      console.error('USB connect failed:', error);
      return false;
    }
  }

  /**
   * Auto mode only. Reconnects the last USB printer when it is still plugged in,
   * otherwise the built-in POS58-style printer. Explicit USB selection is unchanged.
   */
  async tryAutoConnectBuiltin(): Promise<BuiltinUsbConnectResult> {
    if (this.isConnected()) {
      return 'connected';
    }
    let devices: UsbDevice[] = [];
    try {
      devices = await this.getDeviceList();
    } catch (error) {
      console.log('Built-in USB printer scan failed:', error);
      return 'none';
    }

    const saved = await this.readSavedDevice();
    if (saved) {
      const stillThere = devices.find(
        device =>
          device.vendor_id === saved.vendor_id &&
          device.product_id === saved.product_id,
      );
      if (stillThere && scoreBuiltinUsbPrinter(stillThere) > 0) {
        return (await this.connect(stillThere)) ? 'connected' : this.deniedOrNone();
      }
    }

    const ranked = devices
      .map(device => ({device, score: scoreBuiltinUsbPrinter(device)}))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) {
      return 'none';
    }
    console.log(
      'Auto-connecting built-in USB printer:',
      ranked[0].device.device_name,
      ranked[0].device.vendor_id,
      ranked[0].device.product_id,
    );
    return (await this.connect(ranked[0].device)) ? 'connected' : this.deniedOrNone();
  }

  private deniedOrNone(): BuiltinUsbConnectResult {
    return /permission/i.test(this.lastError || '') ? 'denied' : 'none';
  }

  private async readSavedDevice(): Promise<UsbDevice | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return normalizeUsbDevice(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await USBPrinter.closeConn();
    } catch {}
    this.connectedDevice = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  async reconnectFromStorage(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return false;
      }
      const device: UsbDevice = JSON.parse(raw);
      const normalized = normalizeUsbDevice(device);
      return await this.connect(normalized);
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): UsbDevice | null {
    return this.connectedDevice;
  }

  private fmt(amount: number): string {
    const {formatCurrencyCompact} = require('../utils/currency');
    return formatCurrencyCompact(amount);
  }

  private printCompactReceiptUsb(data: PrintReceiptData): string {
    const companyName = receiptCompanyName(data.companyInfo);
    const receiptId = data.receiptId || `R${Date.now()}`;
    const saleDateRaw = data.saleDate || new Date().toISOString();
    let text = '';
    text += `<CB>SALES RECEIPT</CB>\n`;
    text += `<C><B>${companyName}</B></C>\n`;
    if (data.companyInfo?.address) {
      text += `<C>${data.companyInfo.address}</C>\n`;
    }
    if (data.companyInfo?.phone) {
      text += `<C>${data.companyInfo.phone}</C>\n`;
    }
    if (data.companyInfo?.vatNo) {
      text += `<C>VAT No: ${data.companyInfo.vatNo}</C>\n`;
    }
    text += `<C>${LINE}</C>\n`;
    text += `<C><B>Invoice: ${receiptId}</B></C>\n`;
    text += `<C>Date: ${compactReceiptDate(saleDateRaw)}</C>\n`;
    text += `<C>Cashier: ${data.username}</C>\n`;
    if (data.customerName) {
      text += `<C>Customer: ${data.customerName}</C>\n`;
    }
    text += `${padLine('Qty', 'Amount')}\n`;
    text += `${LINE}\n`;
    for (const item of data.cartItems) {
      const lineTotal =
        item.line_total != null && Number.isFinite(Number(item.line_total))
          ? Number(item.line_total)
          : (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      const raw = (item.item_name || 'Item').trim();
      const name =
        raw.length > 24 ? raw.slice(0, 21) + '\u2026' : raw;
      const left = `${item.quantity}x ${name}`;
      text += `${padLine(left, plainAmount(lineTotal))}\n`;
    }
    text += `${LINE}\n`;
    const tax = Number(data.tax) || 0;
    const discount = Number(data.discount) || 0;
    if (tax > 0) {
      text += `${padLine('Tax:', this.fmt(tax))}\n`;
    }
    if (discount > 0) {
      text += `${padLine('Discount:', `-${plainAmount(discount)}`)}\n`;
    }
    text += `<B>${padLine('TOTAL:', plainAmount(data.total))}</B>\n`;
    const tendered = Number(data.amountReceived);
    if (Number.isFinite(tendered) && tendered > 0) {
      text += `<B>${padLine('Tendered:', plainAmount(tendered))}</B>\n`;
    }
    if (data.change && data.change > 0) {
      text += `<B>${padLine('Change:', plainAmount(data.change))}</B>\n`;
    }
    if (data.paymentMethod && data.paymentMethod !== '—') {
      text += `${padLine('Payment:', data.paymentMethod)}\n`;
    }
    text += `<C>${LINE}</C>\n`;
    if (data.cartItems.length > 0) {
      text += `<C><B>THANK YOU (${data.cartItems.length} item${
        data.cartItems.length === 1 ? '' : 's'
      })</B></C>\n`;
    } else {
      text += `<C><B>THANK YOU</B></C>\n`;
    }
    text += `<C>${receiptId} ${compactReceiptDate(saleDateRaw)} ${data.username}</C>\n`;
    text += '\n';
    return text;
  }

  private async printReceiptLogo(document: {
    nodes: Array<{type?: string; src?: string; maxWidthMm?: number; maxHeightMm?: number}>;
    paperProfile?: {logoWidthPx?: number};
  }): Promise<void> {
    const src = document.nodes.find(node => node.type === 'image')?.src;
    if (!src) {
      return;
    }
    try {
      const prepared = await prepareCompanyLogoForPrint(src);
      if (!prepared) {
        return;
      }
      const usb = USBPrinter as {
        printImage?: (path: string, opts?: {imageWidth?: number}) => Promise<void>;
        printImageData?: Function;
      };
      const printImage = usb.printImage || usb.printImageData;
      if (typeof printImage !== 'function') {
        console.warn('USB receipt logo skipped: printer has no image API');
        return;
      }
      const path = prepared.localPath.startsWith('file://')
        ? prepared.localPath
        : `file://${prepared.localPath}`;
      const imageNode = document.nodes.find(node => node.type === 'image');
      const logoBox = logoBoxPixels(imageNode);
      const {width} = fitReceiptLogoSize(
        prepared.width,
        prepared.height,
        imageNode?.maxWidthMm
          ? logoBox.maxW
          : document.paperProfile?.logoWidthPx ?? logoBox.maxW,
        logoBox.maxH,
        logoBox.allowUpscale,
      );
      await printImage.call(USBPrinter, path, {
        imageWidth: width,
      });
    } catch (error) {
      console.warn('USB receipt logo skipped:', error);
    }
  }

  async printPreparedDocument(document: ReceiptDocument): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        return false;
      }
      await this.printReceiptLogo(document);
      await printUsbSaleDocument(document);
      return true;
    } catch (error) {
      console.error('USB layout test print failed:', error);
      return false;
    }
  }

  async printReceipt(data: PrintReceiptData): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        return false;
      }

      const process = data.compactReceipt
        ? 'sales_history_reprint'
        : 'pos_sale';
      const document = await buildSaleReceiptDocument(data, process, 'usb');
      await this.printReceiptLogo(document);
      await printUsbSaleDocument(document);
      return true;
    } catch (error) {
      console.error('USB print failed:', error);
      return false;
    }
  }

  async printKot(data: KotData): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        return false;
      }
      const document = await buildKotReceiptDocument(data, 'usb');
      await printUsbDocument(document);
      return true;
    } catch (error) {
      console.error('USB KOT print failed:', error);
      return false;
    }
  }

  async testShortPrint(): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        return false;
      }
      const text =
        `<C><B>ZENTRO APP - TEST</B></C>\n` +
        `<C>USB printer test OK</C>\n` +
        `<C>${new Date().toLocaleString()}</C>\n`;
      await USBPrinter.printText(text, {tailingLine: false, cut: false});
      return true;
    } catch (error) {
      console.error('USB quick test failed:', error);
      return false;
    }
  }

  async testSaleReceipt(): Promise<boolean> {
    const companyInfo = await fetchCompanyInfoForReceipt();
    return this.printReceipt(buildSampleSaleReceiptData(companyInfo));
  }

  /** @deprecated Use testShortPrint or testSaleReceipt */
  async testPrint(): Promise<boolean> {
    return this.testSaleReceipt();
  }
}

export default UsbPrinterService;
