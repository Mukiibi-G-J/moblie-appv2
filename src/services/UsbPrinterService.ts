import AsyncStorage from '@react-native-async-storage/async-storage';
import {USBPrinter} from 'react-native-thermal-receipt-printer';
import type {PrintReceiptData} from './PrintService';
import {printUsbDocument} from '../shared/receipt/compileToUsb';
import {
  buildKotReceiptDocument,
  buildSaleReceiptDocument,
} from './receiptPrintOrchestrator';
import {prepareCompanyLogoForPrint} from '../utils/companyLogoUrl';
import {
  buildSampleSaleReceiptData,
  fetchCompanyInfoForReceipt,
  receiptCompanyName,
} from '../utils/companyReceiptInfo';

export interface UsbDevice {
  device_name: string;
  vendor_id: number;
  product_id: number;
}

/** Common USB vendor IDs used by Xprinter / generic 58mm ESC/POS printers. */
const XPRINTER_VENDOR_IDS = new Set([
  1155, // 0x0483 STMicroelectronics
  1046, // 0x0416 Winbond
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

function isLikelyThermalPrinter(device: UsbDevice): boolean {
  const name = (device.device_name || '').toLowerCase();
  return (
    XPRINTER_VENDOR_IDS.has(device.vendor_id) ||
    name.includes('print') ||
    name.includes('xprinter') ||
    name.includes('pos')
  );
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

class UsbPrinterService {
  private static instance: UsbPrinterService;
  private connectedDevice: UsbDevice | null = null;
  private initialised = false;

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
        return false;
      }
      // Native RNUSBPrinter.connectPrinter expects Integer, not string (New Architecture bridge).
      await (USBPrinter.connectPrinter as (v: number, p: number) => Promise<unknown>)(
        vendorId,
        productId,
      );
      this.connectedDevice = device;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
      return true;
    } catch (error) {
      console.error('USB connect failed:', error);
      return false;
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
    nodes: Array<{type?: string; src?: string}>;
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
      await printImage.call(USBPrinter, path, {
        imageWidth: document.paperProfile?.logoWidthPx ?? 96,
      });
    } catch (error) {
      console.warn('USB receipt logo skipped:', error);
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
      await printUsbDocument(document);
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
        `<C>Xprinter USB test OK</C>\n` +
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
