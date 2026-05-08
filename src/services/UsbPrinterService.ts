import AsyncStorage from '@react-native-async-storage/async-storage';
import {USBPrinter} from 'react-native-thermal-receipt-printer';
import type {PrintReceiptData} from './PrintService';

export interface UsbDevice {
  device_name: string;
  vendor_id: number;
  product_id: number;
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
  return {
    device_name: raw.device_name,
    vendor_id: Number(raw.vendor_id),
    product_id: Number(raw.product_id),
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
      return list.map(d => normalizeUsbDevice(d));
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
    return `UGX ${Number(amount).toLocaleString('en-US', {maximumFractionDigits: 0})}`;
  }

  private printCompactReceiptUsb(data: PrintReceiptData): string {
    const companyName = data.companyInfo?.name || 'ZENTRO APP';
    const receiptId = data.receiptId || `R${Date.now()}`;
    const saleDateRaw = data.saleDate || new Date().toISOString();
    let text = '';
    text += `<CB>SALES RECEIPT</CB>\n`;
    text += `<C><B>${companyName}</B></C>\n`;
    if (data.companyInfo?.address) {
      text += `<C>${data.companyInfo.address}</C>\n`;
    }
    if (data.companyInfo?.phone) {
      text += `<C>Tel: ${data.companyInfo.phone}</C>\n`;
    }
    if (data.companyInfo?.tin) {
      text += `<C>TIN: ${data.companyInfo.tin}</C>\n`;
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

  async printReceipt(data: PrintReceiptData): Promise<boolean> {
    try {
      if (!this.connectedDevice) {
        return false;
      }

      if (data.compactReceipt) {
        const text = this.printCompactReceiptUsb(data);
        USBPrinter.printText(text);
        return true;
      }

      const companyName = data.companyInfo?.name || 'ZENTRO APP';
      const receiptId = data.receiptId || `R${Date.now()}`;
      const date = data.saleDate
        ? String(data.saleDate).split('T')[0]
        : new Date().toISOString().split('T')[0];

      let text = '';
      text += `<CB>${companyName.toUpperCase()}</CB>\n`;
      if (data.companyInfo?.address) {
        text += `<C>${data.companyInfo.address}</C>\n`;
      }
      if (data.companyInfo?.tin) {
        text += `<C>TIN: ${data.companyInfo.tin}</C>\n`;
      }
      text += `<C>${LINE}</C>\n`;
      text += `<C>Receipt #: ${receiptId}</C>\n`;
      text += `<C>Date: ${date}</C>\n`;
      text += `<C>Cashier: ${data.username}</C>\n`;
      if (data.customerName) {
        text += `<C>Customer: ${data.customerName}</C>\n`;
      }
      text += `<C>${LINE}</C>\n`;
      text += '<B>ITEMS</B>\n';
      text += `${LINE}\n`;

      for (const item of data.cartItems) {
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        const name =
          item.item_name.length > 20
            ? item.item_name.substring(0, 19) + '\u2026'
            : item.item_name;
        text += `${name}\n`;
        text += `${padLine(`  ${item.quantity} x ${this.fmt(item.unit_price)}`, this.fmt(lineTotal))}\n`;
      }

      text += `${LINE}\n`;
      const subtotal = data.subtotal ?? data.total;
      text += `${padLine('Subtotal:', this.fmt(subtotal))}\n`;
      if (data.tax && data.tax > 0) {
        text += `${padLine('Tax:', this.fmt(data.tax))}\n`;
      }
      if (data.discount && data.discount > 0) {
        text += `${padLine('Discount:', `-${this.fmt(data.discount)}`)}\n`;
      }
      text += `<B>${padLine('TOTAL:', this.fmt(data.total))}</B>\n`;
      if (data.paymentMethod) {
        text += `${padLine('Payment:', data.paymentMethod)}\n`;
      }
      if (data.change && data.change > 0) {
        text += `${padLine('Change:', this.fmt(data.change))}\n`;
      }
      text += `${LINE}\n`;
      text += '<C>Thank you for your purchase!</C>\n';
      text += '<C>www.zentroapp.app</C>\n';
      text += '<C>Powered by Zentroapp</C>\n';
      text += '\n\n\n\n';

      USBPrinter.printText(text);
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
      let text = '';
      text += '<CB>KITCHEN ORDER</CB>\n';
      text += `<C>${LINE}</C>\n`;
      text += `<C>Order: ${data.order_no}</C>\n`;
      text += `<C>${data.table_label}</C>\n`;
      text += `<C>${data.order_type_display}</C>\n`;
      if (data.waiter_name) {
        text += `<C>Server: ${data.waiter_name}</C>\n`;
      }
      text += `<C>${data.printed_at}</C>\n`;
      text += `<C>${LINE}</C>\n`;
      for (const item of data.items) {
        text += `<B>${item.quantity}x ${item.item_name}</B>\n`;
        if (item.special_instructions) {
          text += `  ** ${item.special_instructions}\n`;
        }
        if (item.fire_state_display) {
          text += `  [${item.fire_state_display}]\n`;
        }
      }
      text += `${LINE}\n`;
      text += '<C>*** KITCHEN COPY ***</C>\n';
      text += '\n\n\n\n';
      USBPrinter.printText(text);
      return true;
    } catch (error) {
      console.error('USB KOT print failed:', error);
      return false;
    }
  }

  async testPrint(): Promise<boolean> {
    return this.printReceipt({
      cartItems: [{item_name: 'Test Item', quantity: 1, unit_price: 1000}],
      total: 1000,
      username: 'Test',
      receiptId: 'TEST-001',
      saleDate: new Date().toISOString(),
    });
  }
}

export default UsbPrinterService;
