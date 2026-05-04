import {Platform} from 'react-native';
import Toast from 'react-native-toast-message';
import PrinterSunmi from 'react-native-printer-sunmi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BluetoothPrinterService from './BluetoothPrinterService';
import UsbPrinterService from './UsbPrinterService';

// Types for printing
export interface PrintItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  date_sold?: string;
  bar_code_no?: string;
}

export interface CompanyInfo {
  name: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  tin: string;
  /** Not returned by GET /api/sales/company-info/; optional for receipts until backend adds it. */
  vatNo?: string;
}

export interface PrintReceiptData {
  cartItems: PrintItem[];
  total: number;
  username: string;
  receiptId?: string;
  saleDate?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  paymentMethod?: string;
  change?: number;
  customerName?: string;
  companyInfo?: CompanyInfo;
}

/** Single item shelf / barcode label (Bluetooth thermal or Sunmi). */
export interface ItemLabelPrintData {
  item_name: string;
  no?: string | null;
  bar_code_no?: string | null;
  copies?: number;
}

export type PrinterType = 'sunmi' | 'bluetooth' | 'usb' | 'auto';

class PrintService {
  private static instance: PrintService;
  private isConnected: boolean = false;
  private isInitialized: boolean = false;
  private printerType: PrinterType = 'auto';
  private bluetoothService: BluetoothPrinterService;
  private usbService: UsbPrinterService;

  private constructor() {
    this.bluetoothService = BluetoothPrinterService.getInstance();
    this.usbService = UsbPrinterService.getInstance();
  }

  public static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  /**
   * Get saved printer type from storage
   */
  private async getSavedPrinterType(): Promise<PrinterType> {
    try {
      const saved = await AsyncStorage.getItem('printer_type');
      if (
        saved &&
        (saved === 'sunmi' ||
          saved === 'bluetooth' ||
          saved === 'usb' ||
          saved === 'auto')
      ) {
        return saved as PrinterType;
      }
    } catch (error) {
      console.error('Failed to get saved printer type:', error);
    }
    return 'auto';
  }

  /**
   * Save printer type to storage
   */
  public async setPrinterType(type: PrinterType): Promise<void> {
    try {
      this.printerType = type;
      await AsyncStorage.setItem('printer_type', type);
    } catch (error) {
      console.error('Failed to save printer type:', error);
    }
  }

  /**
   * Get current printer type
   */
  public getPrinterType(): PrinterType {
    return this.printerType;
  }

  /**
   * Load saved printer mode into memory (Printer Config screen uses this).
   */
  public async syncPrinterTypeFromStorage(): Promise<PrinterType> {
    const t = await this.getSavedPrinterType();
    this.printerType = t;
    return t;
  }

  /**
   * Resolve logical printer: explicit Sunmi/Bluetooth, or Auto (Sunmi if available).
   */
  private async resolvePrinterType(savedType: PrinterType): Promise<PrinterType> {
    if (
      savedType === 'sunmi' ||
      savedType === 'bluetooth' ||
      savedType === 'usb'
    ) {
      return savedType;
    }
    const sunmiOk = await this.isSunmiDevice();
    return sunmiOk ? 'sunmi' : 'bluetooth';
  }

  /**
   * Restore saved BT printer and, on Auto, try paired built-in POS printers.
   */
  private async ensureBluetoothSession(savedType: PrinterType): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    await this.bluetoothService.ensureConnectedFromStorage();
    if (!this.bluetoothService.isPrinterConnected() && savedType === 'auto') {
      await this.bluetoothService.tryAutoConnectPosBuiltin();
    }
  }

  /**
   * Initialize the printer connection
   */
  public async initializePrinter(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('Printing only supported on Android');
      return false;
    }

    try {
      const savedType = await this.getSavedPrinterType();
      if (savedType === 'usb') {
        if (Platform.OS !== 'android') {
          return false;
        }
        this.printerType = 'usb';
        if (!this.usbService.isConnected()) {
          await this.usbService.reconnectFromStorage();
        }
        const ok = this.usbService.isConnected();
        this.isInitialized = ok;
        this.isConnected = ok;
        return ok;
      }

      const resolved = await this.resolvePrinterType(savedType);
      this.printerType = resolved;

      if (resolved === 'sunmi') {
        const sunmiOk = await this.initializeSunmiPrinter();
        if (sunmiOk) {
          return true;
        }
        if (savedType !== 'auto') {
          return false;
        }
        this.printerType = 'bluetooth';
      }

      await this.ensureBluetoothSession(savedType);
      if (this.bluetoothService.isPrinterConnected()) {
        this.isInitialized = true;
        this.isConnected = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize printer:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Initialize Sunmi printer
   */
  private async initializeSunmiPrinter(): Promise<boolean> {
    try {
      if (this.isInitialized && this.printerType === 'sunmi') {
        return this.isConnected;
      }

      console.log('Initializing Sunmi printer...');
      
      try {
        const isConnected = await PrinterSunmi.connect();
        if (!isConnected) {
          throw new Error('Printer not connected');
        }
        
        PrinterSunmi.enableTransMode(true);
        
        this.isInitialized = true;
        this.isConnected = true;
        this.printerType = 'sunmi';
        
        console.log('Sunmi printer connected and initialized successfully');
        
        return this.isConnected;
      } catch (printerError) {
        if (printerError.message && printerError.message.includes('print service')) {
          console.log('Sunmi printer service not found - this device is not a Sunmi device');
          return false;
        }
        throw printerError;
      }
    } catch (error) {
      console.error('Failed to initialize Sunmi printer:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Check if printer is connected
   * Automatically detects printer type if set to 'auto'
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const savedType = await this.getSavedPrinterType();
      if (savedType === 'usb') {
        this.printerType = 'usb';
        if (Platform.OS !== 'android') {
          this.isConnected = false;
          return false;
        }
        if (!this.usbService.isConnected()) {
          await this.usbService.reconnectFromStorage();
        }
        const ok = this.usbService.isConnected();
        this.isConnected = ok;
        return ok;
      }

      let resolved = await this.resolvePrinterType(savedType);
      this.printerType = resolved;

      if (resolved === 'sunmi') {
        try {
          const isConnected = await PrinterSunmi.connect();
          this.isConnected = !!isConnected;
          if (!this.isConnected && savedType === 'auto') {
            this.printerType = 'bluetooth';
            await this.ensureBluetoothSession(savedType);
            this.isConnected = this.bluetoothService.isPrinterConnected();
          }
          return this.isConnected;
        } catch {
          if (savedType === 'auto') {
            this.printerType = 'bluetooth';
            await this.ensureBluetoothSession(savedType);
            this.isConnected = this.bluetoothService.isPrinterConnected();
            return this.isConnected;
          }
          this.isConnected = false;
          return false;
        }
      }

      this.printerType = 'bluetooth';
      await this.ensureBluetoothSession(savedType);
      this.isConnected = this.bluetoothService.isPrinterConnected();
      return this.isConnected;
    } catch (error) {
      console.error('Failed to check printer connection:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Check if device supports Sunmi printing
   */
  public async isSunmiDevice(): Promise<boolean> {
    try {
      await PrinterSunmi.connect();
      return true;
    } catch (error) {
      if (error.message && error.message.includes('print service')) {
        return false;
      }
      // Other errors might be temporary connection issues
      return false;
    }
  }

  /**
   * Print a receipt
   */
  public async printReceipt(data: PrintReceiptData): Promise<boolean> {
    try {
      const savedType = await this.getSavedPrinterType();

      if (savedType === 'usb') {
        if (Platform.OS !== 'android') {
          Toast.show({
            type: 'info',
            text1: 'Printing',
            text2: 'USB receipt printing is available on Android only.',
          });
          return false;
        }
        return await this.printReceiptUsb(data);
      }

      const resolved = await this.resolvePrinterType(savedType);
      this.printerType = resolved;

      if (resolved === 'sunmi') {
        const sunmiOk = await this.printReceiptSunmi(data);
        if (sunmiOk || savedType !== 'auto') {
          return sunmiOk;
        }
        this.printerType = 'bluetooth';
        await this.ensureBluetoothSession(savedType);
        if (!this.bluetoothService.isPrinterConnected()) {
          return false;
        }
        return await this.printReceiptBluetooth(data);
      }

      await this.ensureBluetoothSession(savedType);
      if (!this.bluetoothService.isPrinterConnected()) {
        return false;
      }
      return await this.printReceiptBluetooth(data);
    } catch (error) {
      console.error('Failed to print receipt:', error);
      return false;
    }
  }

  /**
   * Print receipt using Sunmi printer
   */
  private async printReceiptSunmi(data: PrintReceiptData): Promise<boolean> {
    try {
      const isConnected = await this.initializeSunmiPrinter();
      if (!isConnected) {
        console.log('Sunmi printer not available - skipping receipt printing');
        return false;
      }

      console.log('Starting to print receipt on Sunmi printer...');

      await this.printHeader(data.companyInfo);
      await this.printReceiptInfo(data);
      await this.printItems(data.cartItems);
      await this.printTotals(data);
      await this.printFooter(data.receiptId, data.companyInfo);

      console.log('Committing print job...');
      PrinterSunmi.printTrans();
      console.log('Print job committed successfully');

      console.log('Receipt printed successfully on Sunmi printer');
      return true;
    } catch (error) {
      console.error('Failed to print receipt on Sunmi:', error);
      return false;
    }
  }

  /**
   * Print receipt using Bluetooth printer
   */
  private async printReceiptBluetooth(data: PrintReceiptData): Promise<boolean> {
    try {
      if (!this.bluetoothService.isPrinterConnected()) {
        Toast.show({
          type: 'info',
          text1: 'Bluetooth Printer Not Connected',
          text2: 'Please connect to a Bluetooth printer first.',
        });
        return false;
      }

      console.log('Starting to print receipt on Bluetooth printer...');
      const success = await this.bluetoothService.printReceipt(data);
      return success;
    } catch (error) {
      console.error('Failed to print receipt on Bluetooth:', error);
      return false;
    }
  }

  /**
   * Print item label(s) with barcode when encodable (CODE128); otherwise text-only code line.
   */
  public async printItemLabel(data: ItemLabelPrintData): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        Toast.show({
          type: 'info',
          text1: 'Printing',
          text2: 'Label printing is only supported on Android.',
        });
        return false;
      }

      const savedType = await this.getSavedPrinterType();
      if (savedType === 'usb') {
        Toast.show({
          type: 'info',
          text1: 'Labels',
          text2:
            'Shelf labels need Bluetooth or Sunmi. Switch printer type in Settings.',
        });
        return false;
      }

      const resolved = await this.resolvePrinterType(savedType);
      this.printerType = resolved;

      if (resolved === 'sunmi') {
        const sunmiOk = await this.printItemLabelSunmi(data);
        if (sunmiOk || savedType !== 'auto') {
          return sunmiOk;
        }
        this.printerType = 'bluetooth';
        await this.ensureBluetoothSession(savedType);
        if (!this.bluetoothService.isPrinterConnected()) {
          return false;
        }
        return await this.printItemLabelBluetooth(data);
      }

      await this.ensureBluetoothSession(savedType);
      if (!this.bluetoothService.isPrinterConnected()) {
        Toast.show({
          type: 'info',
          text1: 'Bluetooth Printer Not Connected',
          text2: 'Please connect to a Bluetooth printer in settings.',
        });
        return false;
      }
      return await this.printItemLabelBluetooth(data);
    } catch (error) {
      console.error('Failed to print item label:', error);
      return false;
    }
  }

  private async printItemLabelSunmi(data: ItemLabelPrintData): Promise<boolean> {
    try {
      const isConnected = await this.initializeSunmiPrinter();
      if (!isConnected) {
        return false;
      }

      const copies = Math.min(10, Math.max(1, Math.floor(Number(data.copies) || 1)));
      const displayName = BluetoothPrinterService.formatLabelItemName(data.item_name);
      const barcode = BluetoothPrinterService.resolveLabelBarcodeValue(
        data.bar_code_no,
        data.no,
      );
      const humanCode =
        [data.bar_code_no, data.no].find(s => s != null && String(s).trim()) ?? '';
      const humanLine = String(humanCode).trim();

      for (let i = 0; i < copies; i++) {
        PrinterSunmi.initLine({align: 'CENTER'});
        PrinterSunmi.printText('ITEM LABEL', {textSize: 22, bold: true});
        PrinterSunmi.printDividingLine('EMPTY', 6);
        PrinterSunmi.printText(displayName, {textSize: 20, bold: true});
        if (data.no) {
          PrinterSunmi.printText(`No: ${data.no}`, {textSize: 18});
        }
        if (barcode) {
          PrinterSunmi.printBarCode(barcode, {
            symbology: 'CODE128',
            align: 'CENTER',
            readable: 'POS_TWO',
            barHeight: 120,
          });
        } else if (humanLine) {
          PrinterSunmi.printText(`Code: ${humanLine}`, {textSize: 18});
        }
        PrinterSunmi.addText('\n\n');
        await PrinterSunmi.printTrans();
      }

      Toast.show({
        type: 'success',
        text1: 'Label printed',
        text2: copies > 1 ? `${copies} copies` : undefined,
      });
      return true;
    } catch (error: any) {
      console.error('Failed to print item label on Sunmi:', error);
      Toast.show({
        type: 'error',
        text1: 'Print failed',
        text2:
          typeof error?.message === 'string'
            ? error.message
            : 'Could not print on Sunmi printer.',
      });
      return false;
    }
  }

  private async printItemLabelBluetooth(
    data: ItemLabelPrintData,
  ): Promise<boolean> {
    return this.bluetoothService.printItemLabel(data);
  }

  /**
   * Print receipt header
   */
  private async printHeader(companyInfo?: CompanyInfo): Promise<void> {
    try {
      console.log('Printing header...');
      PrinterSunmi.initLine({ align: 'CENTER' });
      console.log('Header line initialized');
      
      // Print logo if available
      if (companyInfo?.logo) {
        try {
          console.log('Printing company logo...');
          // await this.printLogo(companyInfo.logo);
          console.log('Logo printed successfully');
        } catch (logoError) {
          console.error('Failed to print logo, using fallback:', logoError);
          // Fallback to text logo
          PrinterSunmi.printText('🏪', { textSize: 32, bold: true });
        }
      } else {
        // Default logo placeholder
        PrinterSunmi.printText('🏪', { textSize: 32, bold: true });
      }
      
      // Company name (use dynamic or fallback)
      const companyName = companyInfo?.name || 'ZENTRO APP';
      PrinterSunmi.printText(companyName.toUpperCase(), { textSize: 36, bold: true });
      
      // Company address if available
      if (companyInfo?.address) {
        PrinterSunmi.printText(companyInfo.address, { textSize: 18, bold: true });
      }
      
      // Business identifiers
      if (companyInfo?.tin) {
        PrinterSunmi.printText(`TIN: ${companyInfo.tin}`, { textSize: 16, bold: true });
      }
      
      if (companyInfo?.vatNo) {
        PrinterSunmi.printText(`VAT No: ${companyInfo.vatNo}`, { textSize: 16, bold: true });
      }
      
      PrinterSunmi.printDividingLine('EMPTY', 8);
      console.log('Header dividing line printed');
      PrinterSunmi.printText('SALES RECEIPT', { textSize: 28, bold: true });
      console.log('Sales receipt text printed');
      PrinterSunmi.printDividingLine('EMPTY', 8);
      console.log('Header completed');
    } catch (error) {
      console.error('Error printing header:', error);
      throw error;
    }
  }

  /**
   * Print company logo
   */
  private async printLogo(logoPath: string): Promise<void> {
    try {
      console.log('Printing logo from path:', logoPath);
      
      let localLogoPath = logoPath;
      
      // If it's a remote URL, download it first
      if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
        try {
          console.log('Downloading logo from URL:', logoPath);
          localLogoPath = await this.downloadAndCacheLogo(logoPath);
          console.log('Logo downloaded and cached to:', localLogoPath);
        } catch (downloadError) {
          console.error('Failed to download logo, using fallback:', downloadError);
          // Fallback to emoji
          PrinterSunmi.printText('🏪', { textSize: 32, bold: true });
          return;
        }
      }
      
      // Method 1: Direct bitmap printing (simpler)
      // console.log('Attempting to print logo with path:', localLogoPath);
      // PrinterSunmi.printBitmap(localLogoPath, {
      //   width: 200,
      //   height: 100,
      //   align: 'CENTER',
      // });
      
      // Alternative Method 2: Canvas-based logo printing (more control)
      // PrinterSunmi.initCanvas({ width: 320, height: 120 });
      // PrinterSunmi.renderBitmap(localLogoPath, {
      //   width: 200,
      //   height: 100,
      //   posX: 60, // Center the logo
      //   posY: 10,
      // });
      // PrinterSunmi.printCanvas(1);
      
      console.log('Logo printing completed');
    } catch (error) {
      console.error('Error printing logo:', error);
      throw error;
    }
  }

  /**
   * Download and cache logo from remote URL
   */
  private async downloadAndCacheLogo(logoUrl: string): Promise<string> {
    try {
      console.log('Starting logo download from:', logoUrl);
      
      // For React Native, we'll use a different approach
      // Since FileReader and blob APIs might not work properly on mobile
      
      // Method 1: Try using the URL directly (some printer libraries support this)
      console.log('Attempting to use URL directly for printing');
      return logoUrl;
      
      // Method 2: If the above doesn't work, we'll need to implement
      // a proper image download using react-native-fs or similar
      // For now, this will fall back to the emoji if the URL doesn't work
      
    } catch (error) {
      console.error('Error processing logo URL:', error);
      throw error;
    }
  }

  /**
   * Print QR code
   */
  private async printQRCode(content: string): Promise<void> {
    try {
      console.log('Printing QR code for:', content);
      
      // Method 1: Direct QR code printing (correct method name)
      PrinterSunmi.printQrCode(content, {
        align: 'CENTER',
        dot: 8,
      });
      
      // Alternative Method 2: Canvas-based QR code printing
      // PrinterSunmi.initCanvas({ width: 200, height: 200 });
      // PrinterSunmi.renderQrCode(content, {
      //   dot: 8,
      //   posX: 50,
      //   posY: 50,
      //   width: 100,
      //   height: 100,
      // });
      // PrinterSunmi.printCanvas(1);
      
      console.log('QR code printed successfully');
    } catch (error) {
      console.error('Error printing QR code:', error);
      throw error;
    }
  }

  /**
   * Print receipt information
   */
  private async printReceiptInfo(data: PrintReceiptData): Promise<void> {
    try {
      console.log('Printing receipt info...');
    const receiptId = data.receiptId || this.generateReceiptId();
    const saleDate = data.saleDate || new Date().toLocaleString();
    
      PrinterSunmi.initLine({ align: 'CENTER' });
      console.log('Receipt info line initialized');
      PrinterSunmi.printText(`Receipt #: ${receiptId}`, { textSize: 22, bold: true });
      PrinterSunmi.printText(`Date: ${saleDate.split('T')[0]}`, { textSize: 22, bold: true });
      PrinterSunmi.printText(`Cashier: ${data.username}`, { textSize: 22, bold: true });
      console.log('Receipt info text added');
    
    if (data.customerName) {
        PrinterSunmi.printText(`Customer: ${data.customerName}`, { textSize: 22, bold: true });
      }
      
      PrinterSunmi.printDividingLine('SOLID', 1);
      console.log('Receipt info completed');
    } catch (error) {
      console.error('Error printing receipt info:', error);
      throw error;
    }
  }

  /**
   * Print items list
   */
  private async printItems(items: PrintItem[]): Promise<void> {
    try {
      console.log('Printing items...');
      PrinterSunmi.printText('ITEMS:', { textSize: 24, bold: true });
      console.log('Items header printed');

    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      
      // Item name (truncated if too long)
      const itemName = item.item_name.length > 20 
        ? item.item_name.substring(0, 17) + '...' 
        : item.item_name;
      
        PrinterSunmi.printText(itemName, { textSize: 22, bold: true });
        console.log(`Item name printed: ${itemName}`);
      
      // Item details
        PrinterSunmi.printText(
          `  ${item.quantity} x ${this.formatCurrency(item.unit_price)} = ${this.formatCurrency(itemTotal)}`,
          { textSize: 22, bold: true }
        );
        console.log(`Item details printed for: ${itemName}`);
      
      // // Barcode if available
      // if (item.bar_code_no) {
      //     PrinterSunmi.printText(`  Barcode: ${item.bar_code_no}`, { textSize: 16, bold: true });
      //     console.log(`Barcode printed for: ${itemName}`);
      //   }
      }
      
      PrinterSunmi.printDividingLine('SOLID', 1);
      console.log('Items section completed');
    } catch (error) {
      console.error('Error printing items:', error);
      throw error;
    }
  }

  /**
   * Print totals section
   */
  private async printTotals(data: PrintReceiptData): Promise<void> {
    try {
      console.log('Printing totals...');
    const subtotal = data.subtotal || data.total;
    const tax = data.tax || 0;
    const discount = data.discount || 0;
    const total = data.total;
    const change = data.change || 0;

      PrinterSunmi.printText('TOTALS:', { textSize: 24, bold: true });
      console.log('Totals header printed');

      PrinterSunmi.printTexts([
        { text: 'Subtotal:', span: 2, style: { bold: true, textSize: 20 } },
        { text: this.formatCurrency(subtotal), span: 2, style: { align: 'RIGHT', bold: true, textSize: 20 } }
      ]);
      console.log('Subtotal printed');

    if (tax > 0) {
        PrinterSunmi.printTexts([
          { text: 'Tax:', span: 2, style: { bold: true, textSize: 20 } },
          { text: this.formatCurrency(tax), span: 2, style: { align: 'RIGHT', bold: true, textSize: 20 } }
        ]);
        console.log('Tax printed');
    }

    if (discount > 0) {
        PrinterSunmi.printTexts([
          { text: 'Discount:', span: 2, style: { bold: true, textSize: 20 } },
          { text: `-${this.formatCurrency(discount)}`, span: 2, style: { align: 'RIGHT', bold: true, textSize: 20 } }
        ]);
        console.log('Discount printed');
      }

      PrinterSunmi.printTexts([
        { text: 'TOTAL:', span: 2, style: { bold: true, textSize: 22 } },
        { text: this.formatCurrency(total), span: 2, style: { align: 'RIGHT', bold: true, textSize: 22 } }
      ]);
      console.log('Total printed');

    if (change > 0) {
        PrinterSunmi.printTexts([
          { text: 'Change:', span: 2, style: { bold: true, textSize: 20 } },
          { text: this.formatCurrency(change), span: 2, style: { align: 'RIGHT', bold: true, textSize: 20 } }
        ]);
        console.log('Change printed');
    }

    if (data.paymentMethod) {
        PrinterSunmi.printTexts([
          { text: 'Payment:', span: 2, style: { bold: true, textSize: 20 } },
          { text: data.paymentMethod, span: 2, style: { align: 'RIGHT', bold: true, textSize: 20 } }
        ]);
        console.log('Payment method printed');
      }

      PrinterSunmi.printDividingLine('SOLID', 1);
      console.log('Totals section completed');
    } catch (error) {
      console.error('Error printing totals:', error);
      throw error;
    }
  }

  /**
   * Print receipt footer
   */
  private async printFooter(receiptId?: string, companyInfo?: CompanyInfo): Promise<void> {
    try {
      console.log('Printing footer...');
      PrinterSunmi.initLine({ align: 'CENTER' });
      
      // Thank you message
      PrinterSunmi.printText('Thank you for your purchase!', { textSize: 22, bold: true });
      PrinterSunmi.printText('Please come again', { textSize: 22, bold: true });
      console.log('Footer text printed');
      
      // Receipt ID
    if (receiptId) {
        PrinterSunmi.printText(`Receipt ID: ${receiptId}`, { textSize: 22, bold: true });
        console.log('Receipt ID printed');
      }
      
      // Company contact information
      PrinterSunmi.printDividingLine('SOLID', 1);
      PrinterSunmi.printText('www.zentroapp.app', { textSize: 22, bold: true });
      PrinterSunmi.printText('Contact: 0750440865 / 0779899789', { textSize: 22, bold: true });
      
      // Print QR code for digital receipt
      try {
        await this.printQRCode(`https://${companyInfo?.name}/receipt/${receiptId}`);
        PrinterSunmi.printText('Scan for digital receipt', { textSize: 14, bold: true });
      } catch (qrError) {
        console.error('Failed to print QR code:', qrError);
      }
      
      PrinterSunmi.printText('Powered by Zentroapp', { textSize: 22, bold: true });
      console.log('Company contact info printed');
      
      // Use addText with newlines instead of lineWrap
      PrinterSunmi.addText('\n\n\n\n'); // Feed paper
      console.log('Footer completed with paper feed');
    } catch (error) {
      console.error('Error printing footer:', error);
      throw error;
    }
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number | string | undefined | null): string {
    const numericAmount = Number(amount);
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return `UGX ${safeAmount.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  }

  private async printReceiptUsb(data: PrintReceiptData): Promise<boolean> {
    if (!this.usbService.isConnected()) {
      Toast.show({
        type: 'error',
        text1: 'USB Printer not connected',
        text2: 'Go to Printer Configuration and connect a USB printer.',
      });
      return false;
    }
    return await this.usbService.printReceipt(data);
  }

  /**
   * Generate a unique receipt ID
   */
  public generateReceiptId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `R${timestamp}${random}`;
  }

  /**
   * Test printer functionality
   */
  public async testPrinter(): Promise<boolean> {
    const savedType = await this.getSavedPrinterType();

    if (savedType === 'usb') {
      if (Platform.OS !== 'android') {
        return false;
      }
      if (!this.usbService.isConnected()) {
        Toast.show({
          type: 'error',
          text1: 'USB Printer not connected',
          text2: 'Please connect a USB printer in Printer Configuration.',
        });
        return false;
      }
      return await this.usbService.testPrint();
    }

    try {
      const resolved = await this.resolvePrinterType(savedType);
      this.printerType = resolved;

      if (resolved === 'sunmi') {
        let isConnected = await this.initializeSunmiPrinter();
        if (!isConnected && savedType === 'auto') {
          this.printerType = 'bluetooth';
          await this.ensureBluetoothSession(savedType);
          if (!this.bluetoothService.isPrinterConnected()) {
            return false;
          }
          return await this.bluetoothService.testPrinter();
        }
        if (!isConnected) {
          return false;
        }

        PrinterSunmi.initLine({ align: 'CENTER' });
        PrinterSunmi.printText('ZENTRO APP - TEST', { textSize: 35, bold: true });
        PrinterSunmi.printDividingLine('EMPTY', 8);
        PrinterSunmi.printText('Printer Test Successful', { textSize: 24 });
        PrinterSunmi.printDividingLine('EMPTY', 8);
        PrinterSunmi.printText(`Date: ${new Date().toLocaleString()}`, { textSize: 16 });
        PrinterSunmi.addText('\n\n\n\n');
        PrinterSunmi.printTrans();

        return true;
      }

      await this.ensureBluetoothSession(savedType);
      if (!this.bluetoothService.isPrinterConnected()) {
        return false;
      }
      return await this.bluetoothService.testPrinter();
    } catch (error) {
      console.error('Printer test failed:', error);
      return false;
    }
  }

  /**
   * Get Bluetooth printer service instance
   */
  public getBluetoothService(): BluetoothPrinterService {
    return this.bluetoothService;
  }

  public getUsbService(): UsbPrinterService {
    return this.usbService;
  }

  /**
   * Cleanup printer resources
   */
  public async cleanup(): Promise<void> {
    try {
      this.isInitialized = false;
      this.isConnected = false;
      console.log('Printer cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup printer:', error);
    }
  }
}

export default PrintService;
