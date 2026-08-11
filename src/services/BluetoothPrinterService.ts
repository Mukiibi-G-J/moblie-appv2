import {Platform, PermissionsAndroid, EmitterSubscription} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BluetoothStateManager,
  ThermalPrinter,
} from '@finan-me/react-native-thermal-printer';
import Toast from 'react-native-toast-message';
import {
  prepareCompanyLogoForPrint,
  fitReceiptLogoSize,
} from '../utils/companyLogoUrl';
import type {ItemLabelPrintData, PrintReceiptData} from './PrintService';
import type {KotData} from './UsbPrinterService';
import {compileDocumentToEscPosBytes} from '../shared/receipt/compileToEscPos';
import {
  buildKotReceiptDocument,
  buildSaleReceiptDocument,
} from './receiptPrintOrchestrator';
import type {ReceiptDocument} from '../shared/receipt/types';

const BT_PRINTER_STORAGE_KEY = 'zentro_bluetooth_printer_v1';
const RECEIPT_WIDTH_CHARS = 32; // 58mm, matches USB pad width

function padReceiptLine(
  left: string,
  right: string,
  cols: number = RECEIPT_WIDTH_CHARS,
): string {
  const gap = cols - left.length - right.length;
  return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
}

/**
 * @finan-me/react-native-thermal-printer expects numeric ESC/POS sizes (1–8),
 * not README strings like 'double' / 'double_width'.
 */
function normalizeEscposStyle(style?: Record<string, unknown>) {
  if (!style) {
    return style;
  }
  const next = {...style};
  const size = next.size;
  if (typeof size === 'string') {
    if (size === 'double' || size === 'double_width') {
      next.size = 2;
    } else {
      delete next.size;
    }
  }
  return next;
}

function normalizeEscposDocument(document: any[]): any[] {
  return document.map(node => {
    if (node?.type === 'text' && node.style) {
      return {...node, style: normalizeEscposStyle(node.style)};
    }
    return node;
  });
}

function extractThermalPrintError(
  result: {results?: Map<string, {error?: unknown}>},
  fallback = 'Print failed',
): string {
  const firstResult = result.results
    ? Array.from(result.results.values())[0]
    : null;
  const err = firstResult?.error;
  if (!err) {
    return fallback;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'object' && err !== null) {
    const e = err as {code?: string; message?: string; suggestion?: string};
    const parts = [e.code, e.message, e.suggestion].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' — ');
    }
  }
  return fallback;
}

/** Encode ASCII/Latin text for ESC/POS without relying on compileDocument. */
function encodeEscPosText(text: string): number[] {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(text));
  }
  return Array.from(text).map(char => char.charCodeAt(0) & 0xff);
}

function sanitizeEscPosByteArray(bytes: number[] | Uint8Array): number[] {
  return Array.from(bytes, byte => byte & 0xff);
}

type EscPosTextStyle = {
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  double?: boolean;
};

function appendEscPosInit(bytes: number[]): void {
  bytes.push(0x1b, 0x40);
}

function appendEscPosText(
  bytes: number[],
  text: string,
  style: EscPosTextStyle = {},
): void {
  if (style.align === 'center') {
    bytes.push(0x1b, 0x61, 1);
  } else if (style.align === 'right') {
    bytes.push(0x1b, 0x61, 2);
  } else {
    bytes.push(0x1b, 0x61, 0);
  }
  if (style.double) {
    bytes.push(0x1d, 0x21, 0x11);
  }
  if (style.bold) {
    bytes.push(0x1b, 0x45, 1);
  }
  bytes.push(...encodeEscPosText(String(text)), 0x0a);
  if (style.bold) {
    bytes.push(0x1b, 0x45, 0);
  }
  if (style.double) {
    bytes.push(0x1d, 0x21, 0x00);
  }
  bytes.push(0x1b, 0x61, 0);
}

function appendEscPosRule(bytes: number[]): void {
  appendEscPosText(bytes, '-'.repeat(RECEIPT_WIDTH_CHARS));
}

function appendEscPosFeed(bytes: number[], lines: number): void {
  bytes.push(0x1b, 0x64, Math.max(0, Math.min(255, lines)) & 0xff);
}

function appendEscPosCut(bytes: number[]): void {
  bytes.push(0x1d, 0x56, 0x01);
}

function finalizeEscPosDocument(bytes: number[]): number[] {
  appendEscPosFeed(bytes, 3);
  appendEscPosCut(bytes);
  return sanitizeEscPosByteArray(bytes);
}

/** Heuristic score for names of built-in / POS Bluetooth thermal printers (non-Sunmi handhelds). */
function scoreBuiltinPrinterName(name: string): number {
  const n = name.trim();
  if (!n) {
    return 0;
  }
  let score = 0;
  const hints = [
    /inner\s*printer/i,
    /aocom/i,
    /pos[\s-]?m\d{4}/i,
    /m1106/i,
    /posmicro/i,
    /inner.*print|print.*inner/i,
    /btp[\s-]?\d+/i,
    /builtin|built[-\s]?in/i,
    /内置|内建/,
    /handheld/i,
    /\bpda\b/i,
    /pos.*print|print.*pos|pos[_\s-]*printer/i,
    /thermal/i,
    /receipt/i,
    /58\s*mm|58mm|80\s*mm|80mm/i,
    /^printer$/i,
    /\bbt\b.*print|print.*\bbt\b/i,
    /bluetooth\s*printer/i,
    /woyou|jiuiv|sunmi/i,
    /esc\s*pos|escpos/i,
    /label\s*printer/i,
    /\bspp\b/i,
  ];
  for (const re of hints) {
    if (re.test(n)) {
      score += 2;
    }
  }
  if (/printer|print|thermal|pos|receipt|label/.test(n)) {
    score += 1;
  }
  if (
    /headphone|airpods|buds|galaxy\s*bud|watch|keyboard|mouse|speaker|car\s*audio/i.test(
      n,
    )
  ) {
    score -= 8;
  }
  return score;
}

export interface BluetoothDevice {
  address: string;
  name: string;
}

class BluetoothPrinterService {
  private static instance: BluetoothPrinterService;
  private isConnected: boolean = false;
  private connectedDevice: BluetoothDevice | null = null;
  private isInitialized: boolean = false;
  private printerAddress: string | null = null; // Format: "bt:MAC_ADDRESS"

  private constructor() {}

  public static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  /** Printable ASCII only; max length for narrow thermal labels. */
  public static resolveLabelBarcodeValue(
    barCodeNo?: string | null,
    itemNo?: string | null,
  ): string | null {
    const candidates = [barCodeNo, itemNo]
      .map(s => (s == null ? '' : String(s).trim()))
      .filter(Boolean);
    for (const raw of candidates) {
      if (raw.length < 1 || raw.length > 48) {
        continue;
      }
      if (!/^[\x20-\x7E]+$/.test(raw)) {
        continue;
      }
      return raw;
    }
    return null;
  }

  public static formatLabelItemName(name: string): string {
    const n = (name || 'Item').trim();
    if (n.length <= 28) {
      return n;
    }
    return `${n.slice(0, 25)}...`;
  }

  /**
   * Whether the device Bluetooth radio is on.
   */
  public async isBluetoothEnabled(): Promise<boolean> {
    try {
      const state = await BluetoothStateManager.getState();
      return state === 'PoweredOn';
    } catch (error) {
      console.warn('Failed to read Bluetooth state:', error);
      return false;
    }
  }

  /**
   * Show the system dialog to turn Bluetooth on (Android only).
   * On iOS, apps cannot enable Bluetooth — prompt the user instead.
   * @returns true when Bluetooth is on after the request.
   */
  public async requestEnableBluetooth(): Promise<boolean> {
    try {
      if (await this.isBluetoothEnabled()) {
        return true;
      }
      if (Platform.OS !== 'android') {
        Toast.show({
          type: 'info',
          text1: 'Turn on Bluetooth',
          text2: 'Open Control Center or Settings and enable Bluetooth, then try again.',
        });
        return false;
      }
      await BluetoothStateManager.enable();
      return await this.isBluetoothEnabled();
    } catch (error) {
      console.warn('Bluetooth enable request failed:', error);
      return false;
    }
  }

  /**
   * Request Bluetooth permissions (Android runtime).
   * On iOS, permission is requested when CoreBluetooth starts (Info.plist required).
   */
  private async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const apiLevel = Platform.Version;

      if (apiLevel >= 31) {
        // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        const hasBluetoothScan =
          granted['android.permission.BLUETOOTH_SCAN'] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const hasBluetoothConnect =
          granted['android.permission.BLUETOOTH_CONNECT'] ===
          PermissionsAndroid.RESULTS.GRANTED;

        console.log('Bluetooth permissions:', {
          BLUETOOTH_SCAN: hasBluetoothScan,
          BLUETOOTH_CONNECT: hasBluetoothConnect,
        });

        return hasBluetoothScan && hasBluetoothConnect;
      } else {
        // Android 11 and below - need location for Bluetooth scanning
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        const hasLocation = granted === PermissionsAndroid.RESULTS.GRANTED;

        console.log('Location permissions granted:', hasLocation);

        return hasLocation;
      }
    } catch (error) {
      console.error('Error requesting Bluetooth permissions:', error);
      return false;
    }
  }

  /** Format printer address for the native thermal-printer module. */
  private formatNativePrinterAddress(address: string): string {
    const raw = address.replace(/^(bt|ble):/i, '');
    if (Platform.OS === 'ios') {
      // iOS discovery returns BLE UUIDs — classic `bt:` is MFi-only.
      return `ble:${raw}`;
    }
    return `bt:${raw}`;
  }

  /**
   * Scan for available Bluetooth printers
   */
  public async scanForPrinters(): Promise<BluetoothDevice[]> {
    try {
      console.log('Starting Bluetooth scan...');

      if (!(await this.isBluetoothEnabled())) {
        Toast.show({
          type: 'error',
          text1: 'Bluetooth is off',
          text2:
            Platform.OS === 'ios'
              ? 'Turn on Bluetooth in Control Center or Settings, then scan again.'
              : 'Turn on Bluetooth in Printer configuration to scan for printers.',
        });
        return [];
      }

      // Request permissions first
      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Bluetooth permissions are required to scan for printers.',
        });
        return [];
      }

      // Use event-based discovery with timeout
      const devices: BluetoothDevice[] = [];
      const discoveredDevices = new Map<string, BluetoothDevice>();
      let discoveryComplete = false;
      let discoveryError: string | null = null;

      // Set up event listeners
      const subscriptions: EmitterSubscription[] = [];

      // Listen for paired devices
      const pairedSubscription = ThermalPrinter.addDiscoveryEventListener(
        'EVENT_DEVICE_ALREADY_PAIRED',
        (data: any) => {
          console.log('Paired device found:', data);
          try {
            if (data.devices) {
              const deviceList =
                typeof data.devices === 'string'
                  ? JSON.parse(data.devices)
                  : Array.isArray(data.devices)
                  ? data.devices
                  : [data.devices];

              deviceList.forEach((device: any) => {
                if (device && device.address) {
                  const deviceObj: BluetoothDevice = {
                    name: device.name || 'Unknown Device',
                    address: device.address || '',
                  };
                  discoveredDevices.set(device.address, deviceObj);
                }
              });
            }
          } catch (e) {
            console.error('Error parsing paired devices:', e);
          }
        },
      );
      subscriptions.push(pairedSubscription);

      // Listen for found devices
      const foundSubscription = ThermalPrinter.addDiscoveryEventListener(
        'EVENT_DEVICE_FOUND',
        (data: any) => {
          console.log('Device found:', data);
          try {
            if (data.device) {
              const device =
                typeof data.device === 'string'
                  ? JSON.parse(data.device)
                  : data.device;

              if (device && device.address) {
                const deviceObj: BluetoothDevice = {
                  name: device.name || 'Unknown Device',
                  address: device.address || '',
                };
                discoveredDevices.set(device.address, deviceObj);
              }
            }
          } catch (e) {
            console.error('Error parsing found device:', e);
          }
        },
      );
      subscriptions.push(foundSubscription);

      // Listen for discovery completion
      const doneSubscription = ThermalPrinter.addDiscoveryEventListener(
        'EVENT_DEVICE_DISCOVER_DONE',
        (data: any) => {
          console.log('Discovery done:', data);
          discoveryComplete = true;

          // Also check the data for devices
          try {
            if (data.paired) {
              const pairedList =
                typeof data.paired === 'string'
                  ? JSON.parse(data.paired)
                  : Array.isArray(data.paired)
                  ? data.paired
                  : [];

              pairedList.forEach((device: any) => {
                if (device && device.address) {
                  const deviceObj: BluetoothDevice = {
                    name: device.name || 'Unknown Device',
                    address: device.address || '',
                  };
                  discoveredDevices.set(device.address, deviceObj);
                }
              });
            }

            if (data.found) {
              const foundList =
                typeof data.found === 'string'
                  ? JSON.parse(data.found)
                  : Array.isArray(data.found)
                  ? data.found
                  : [];

              foundList.forEach((device: any) => {
                if (device && device.address) {
                  const deviceObj: BluetoothDevice = {
                    name: device.name || 'Unknown Device',
                    address: device.address || '',
                  };
                  discoveredDevices.set(device.address, deviceObj);
                }
              });
            }
          } catch (e) {
            console.error('Error parsing discovery done data:', e);
          }
        },
      );
      subscriptions.push(doneSubscription);

      // Listen for errors
      const errorSubscription = ThermalPrinter.addDiscoveryEventListener(
        'EVENT_BLUETOOTH_NOT_SUPPORT',
        () => {
          discoveryError = 'Bluetooth not supported';
          discoveryComplete = true;
        },
      );
      subscriptions.push(errorSubscription);

      try {
        // Start scan
        const result = await ThermalPrinter.scanDevices();
        console.log('Scan result:', result);

        // Also check immediate result for devices
        if (result.paired && Array.isArray(result.paired)) {
          result.paired.forEach((device: any) => {
            if (device && device.address) {
              discoveredDevices.set(device.address, {
                name: device.name || 'Unknown Device',
                address: device.address || '',
              });
            }
          });
        }

        if (result.found && Array.isArray(result.found)) {
          result.found.forEach((device: any) => {
            if (device && device.address) {
              discoveredDevices.set(device.address, {
                name: device.name || 'Unknown Device',
                address: device.address || '',
              });
            }
          });
        }

        // Wait for discovery to complete (max 10 seconds)
        const startTime = Date.now();
        const timeout = 10000; // 10 seconds

        while (!discoveryComplete && Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Convert map to array
        devices.push(...Array.from(discoveredDevices.values()));

        // Clean up listeners
        subscriptions.forEach(sub => {
          try {
            ThermalPrinter.removeDiscoveryEventListener(sub);
          } catch (e) {
            console.error('Error removing listener:', e);
          }
        });

        // Handle results
        if (devices.length > 0) {
          Toast.show({
            type: 'success',
            text1: 'Scan Complete',
            text2: `Found ${devices.length} device(s)`,
          });
          return devices;
        }

        // No devices found
        if (discoveryError || (result as any).error) {
          Toast.show({
            type: 'error',
            text1: 'Scan Failed',
            text2:
              discoveryError ||
              (result as any).error ||
              'No Bluetooth devices found. Please pair your printer in Android Bluetooth Settings first.',
          });
        } else {
          Toast.show({
            type: 'info',
            text1: 'No Printers Found',
            text2:
              'Make sure your printer is powered on and paired in Android Bluetooth Settings first.',
          });
        }

        return [];
      } catch (scanError: any) {
        console.error('Scan error:', scanError);

        // Clean up listeners
        subscriptions.forEach(sub => {
          try {
            ThermalPrinter.removeDiscoveryEventListener(sub);
          } catch (e) {
            console.error('Error removing listener:', e);
          }
        });

        // Return any devices we found before the error
        if (devices.length > 0) {
          return devices;
        }

        Toast.show({
          type: 'error',
          text1: 'Scan Failed',
          text2:
            scanError?.message ||
            'Failed to scan for Bluetooth printers. Please pair your printer in Android Bluetooth Settings first.',
        });
        return [];
      }
    } catch (error: any) {
      console.error('Failed to scan for printers:', error);
      Toast.show({
        type: 'error',
        text1: 'Scan Failed',
        text2: error?.message || 'Failed to scan for Bluetooth printers.',
      });
      return [];
    }
  }

  /**
   * Persist paired printer so sales printing works after app restart.
   */
  private async persistPrinterDevice(device: BluetoothDevice): Promise<void> {
    try {
      const address = device.address.replace(/^bt:/i, '');
      await AsyncStorage.setItem(
        BT_PRINTER_STORAGE_KEY,
        JSON.stringify({name: device.name, address}),
      );
    } catch (e) {
      console.warn('Failed to persist Bluetooth printer:', e);
    }
  }

  private async clearPersistedPrinter(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BT_PRINTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Open a session to a Bluetooth ESC/POS printer (used by manual connect, restore, and auto-detect).
   */
  public async establishBluetoothConnection(
    device: BluetoothDevice,
    options?: {showToast?: boolean},
  ): Promise<boolean> {
    const showToast = options?.showToast !== false;

    const hasPermissions = await this.requestBluetoothPermissions();
    if (!hasPermissions) {
      return false;
    }

    if (!(await this.isBluetoothEnabled())) {
      if (showToast) {
        Toast.show({
          type: 'error',
          text1: 'Bluetooth is off',
          text2:
            Platform.OS === 'ios'
              ? 'Turn on Bluetooth in Control Center or Settings, then try again.'
              : 'Turn on Bluetooth and try again.',
        });
      }
      return false;
    }

    const formattedAddress = this.formatNativePrinterAddress(device.address);
    this.printerAddress = formattedAddress;

    try {
      const testResult = await ThermalPrinter.testConnection(formattedAddress);
      if (testResult.success) {
        this.isConnected = true;
        this.connectedDevice = {
          name: device.name,
          address: device.address.replace(/^(bt|ble):/i, ''),
        };
        this.isInitialized = true;
        await this.persistPrinterDevice(this.connectedDevice);
        if (showToast) {
          Toast.show({
            type: 'success',
            text1: 'Printer Connected',
            text2: `Connected to ${device.name}`,
          });
        }
        return true;
      }
      this.isConnected = false;
      this.connectedDevice = null;
      this.printerAddress = null;
      if (showToast) {
        const errorMsg =
          typeof testResult.error === 'string'
            ? testResult.error
            : (testResult.error as {message?: string})?.message ||
              'Connection test failed';
        Toast.show({
          type: 'error',
          text1: 'Connection Failed',
          text2: errorMsg,
        });
      }
      return false;
    } catch (e: any) {
      console.error('Bluetooth connection test failed:', e);
      this.isConnected = false;
      this.connectedDevice = null;
      this.printerAddress = null;
      if (showToast) {
        Toast.show({
          type: 'error',
          text1: 'Connection Failed',
          text2:
            e?.message ||
            'Failed to connect to Bluetooth printer. Please ensure the printer is nearby and powered on.',
        });
      }
      return false;
    }
  }

  /**
   * Reconnect to the last printer used (after app restart).
   */
  public async ensureConnectedFromStorage(): Promise<boolean> {
    if (this.isPrinterConnected()) {
      return true;
    }
    try {
      const raw = await AsyncStorage.getItem(BT_PRINTER_STORAGE_KEY);
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw) as {name?: string; address?: string};
      if (!parsed?.address) {
        return false;
      }
      const device: BluetoothDevice = {
        name: parsed.name || 'Printer',
        address: parsed.address,
      };
      return await this.establishBluetoothConnection(device, {showToast: false});
    } catch {
      return false;
    }
  }

  /**
   * Many non-Sunmi POS units expose the internal 58mm printer as a paired Bluetooth device.
   * When printer type is Auto, try likely candidates from the system paired list.
   */
  public async tryAutoConnectPosBuiltin(): Promise<boolean> {
    if (this.isPrinterConnected()) {
      return true;
    }
    const permitted = await this.requestBluetoothPermissions();
    if (!permitted) {
      return false;
    }
    try {
      const result = await ThermalPrinter.scanDevices();
      const paired = Array.isArray(result.paired) ? result.paired : [];

      const ranked = paired
        .filter(d => d?.address)
        .map(d => ({
          d,
          score: scoreBuiltinPrinterName(d.name || ''),
        }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

      let ordered = ranked.map(x => x.d);
      if (
        ordered.length === 0 &&
        paired.length === 1 &&
        paired[0]?.address &&
        scoreBuiltinPrinterName(paired[0].name || '') > -4
      ) {
        ordered = [paired[0]];
      }

      for (const d of ordered) {
        const device: BluetoothDevice = {
          name: d.name || 'Printer',
          address: d.address.replace(/^(bt|ble):/i, ''),
        };
        const ok = await this.establishBluetoothConnection(device, {
          showToast: false,
        });
        if (ok) {
          console.log(
            'Auto-connected Bluetooth thermal printer:',
            device.name,
            device.address,
          );
          return true;
        }
      }
      return false;
    } catch (e) {
      console.log('tryAutoConnectPosBuiltin:', e);
      return false;
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  public async connectToPrinter(device: BluetoothDevice): Promise<boolean> {
    return this.establishBluetoothConnection(device, {showToast: true});
  }

  /**
   * Disconnect from printer
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.printerAddress) {
        await ThermalPrinter.disconnect(this.printerAddress);
      }
      this.isConnected = false;
      this.connectedDevice = null;
      this.printerAddress = null;
      this.isInitialized = false;
      await this.clearPersistedPrinter();
      console.log('Bluetooth printer disconnected');
    } catch (error) {
      console.error('Failed to disconnect printer:', error);
    }
  }

  /**
   * Check if printer is connected
   */
  public isPrinterConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Drop any pooled native socket before opening a new SPP print session.
   * App "connected" state only reflects an earlier testConnection — not an open socket.
   */
  private async ensureFreshBluetoothSession(): Promise<boolean> {
    if (!this.printerAddress) {
      return false;
    }

    try {
      await ThermalPrinter.disconnect(this.printerAddress);
    } catch {
      /* ignore stale disconnect errors */
    }

    // Give the printer time to release the previous RFCOMM channel (PT210-class devices).
    await new Promise<void>(resolve => setTimeout(resolve, 600));
    return true;
  }

  private buildEscPosTestBytes(): number[] {
    const bytes: number[] = [];
    appendEscPosInit(bytes);
    appendEscPosText(bytes, 'ZENTRO APP - TEST', {
      align: 'center',
      bold: true,
      double: true,
    });
    appendEscPosFeed(bytes, 1);
    appendEscPosRule(bytes);
    appendEscPosText(bytes, 'Printer Test Successful', {
      align: 'center',
      bold: true,
    });
    appendEscPosText(bytes, `Date: ${new Date().toLocaleString()}`, {
      align: 'center',
    });
    appendEscPosText(bytes, `Device: ${this.connectedDevice?.name || 'Printer'}`, {
      align: 'center',
    });
    appendEscPosRule(bytes);
    return finalizeEscPosDocument(bytes);
  }

  /** Raw ESC/POS bytes — same layout as buildCompactReceiptDocument. */
  private buildCompactReceiptRawBytes(data: PrintReceiptData): number[] {
    const bytes: number[] = [];
    const companyName = data.companyInfo?.name || 'ZENTRO APP';
    const receiptId = data.receiptId || 'N/A';
    const saleDateRaw = data.saleDate || new Date().toISOString();

    appendEscPosInit(bytes);
    appendEscPosText(bytes, 'SALES RECEIPT', {align: 'center', bold: true});
    appendEscPosText(bytes, companyName, {align: 'center', bold: true});
    if (data.companyInfo?.address) {
      appendEscPosText(bytes, data.companyInfo.address, {align: 'center'});
    }
    if (data.companyInfo?.phone) {
      appendEscPosText(bytes, `Tel: ${data.companyInfo.phone}`, {align: 'center'});
    }
    if (data.companyInfo?.tin) {
      appendEscPosText(bytes, `TIN: ${data.companyInfo.tin}`, {align: 'center'});
    }
    if (data.companyInfo?.vatNo) {
      appendEscPosText(bytes, `VAT No: ${data.companyInfo.vatNo}`, {
        align: 'center',
      });
    }

    appendEscPosRule(bytes);
    appendEscPosText(bytes, `Invoice: ${receiptId}`, {
      align: 'center',
      bold: true,
    });
    appendEscPosText(bytes, `Date: ${this.formatCompactReceiptDate(saleDateRaw)}`);
    appendEscPosText(bytes, `Cashier: ${data.username}`);
    if (data.customerName) {
      appendEscPosText(bytes, `Customer: ${data.customerName}`);
    }

    appendEscPosText(bytes, padReceiptLine('Qty', 'Amount'), {bold: true});
    appendEscPosRule(bytes);

    for (const item of data.cartItems) {
      const lineTotal =
        item.line_total != null && Number.isFinite(Number(item.line_total))
          ? Number(item.line_total)
          : (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      const rawName = (item.item_name || 'Item').trim();
      const shortName =
        rawName.length > 24 ? `${rawName.slice(0, 21)}...` : rawName;
      appendEscPosText(
        bytes,
        padReceiptLine(`${item.quantity}x ${shortName}`, this.formatPlainAmount(lineTotal)),
      );
    }

    appendEscPosRule(bytes);

    const tax = Number(data.tax) || 0;
    const discount = Number(data.discount) || 0;
    const total = Number(data.total) || 0;
    const change = Number(data.change) || 0;
    const tendered = Number(data.amountReceived);

    if (tax > 0) {
      appendEscPosText(bytes, padReceiptLine('Tax:', this.formatCurrency(tax)));
    }
    if (discount > 0) {
      appendEscPosText(
        bytes,
        padReceiptLine('Discount:', `-${this.formatPlainAmount(discount)}`),
      );
    }
    appendEscPosText(bytes, padReceiptLine('TOTAL:', this.formatPlainAmount(total)), {
      bold: true,
    });
    if (Number.isFinite(tendered) && tendered > 0) {
      appendEscPosText(
        bytes,
        padReceiptLine('Tendered:', this.formatPlainAmount(tendered)),
        {bold: true},
      );
    }
    if (change > 0) {
      appendEscPosText(
        bytes,
        padReceiptLine('Change:', this.formatPlainAmount(change)),
        {bold: true},
      );
    }
    if (data.paymentMethod && data.paymentMethod !== '—') {
      appendEscPosText(bytes, padReceiptLine('Payment:', data.paymentMethod));
    }

    appendEscPosRule(bytes);
    if (data.cartItems.length > 0) {
      appendEscPosText(
        bytes,
        `THANK YOU (${data.cartItems.length} item${
          data.cartItems.length === 1 ? '' : 's'
        })`,
        {align: 'center', bold: true},
      );
    } else {
      appendEscPosText(bytes, 'THANK YOU', {align: 'center', bold: true});
    }
    appendEscPosText(
      bytes,
      `${receiptId} ${this.formatCompactReceiptDate(saleDateRaw)} ${data.username}`,
      {align: 'center'},
    );
    appendEscPosFeed(bytes, 1);
    return finalizeEscPosDocument(bytes);
  }

  /** Raw ESC/POS bytes — same layout as buildReceiptDocument (full receipt). */
  private buildFullReceiptRawBytes(data: PrintReceiptData): number[] {
    const bytes: number[] = [];
    const companyName = data.companyInfo?.name || 'ZENTRO APP';
    const receiptId = data.receiptId || 'N/A';
    const saleDate = data.saleDate || new Date().toLocaleString();

    appendEscPosInit(bytes);
    appendEscPosText(bytes, companyName.toUpperCase(), {
      align: 'center',
      bold: true,
      double: true,
    });
    if (data.companyInfo?.address) {
      appendEscPosText(bytes, data.companyInfo.address, {align: 'center'});
    }
    if (data.companyInfo?.tin) {
      appendEscPosText(bytes, `TIN: ${data.companyInfo.tin}`, {align: 'center'});
    }
    if (data.companyInfo?.vatNo) {
      appendEscPosText(bytes, `VAT No: ${data.companyInfo.vatNo}`, {
        align: 'center',
      });
    }

    appendEscPosRule(bytes);
    appendEscPosText(bytes, 'SALES RECEIPT', {align: 'center', bold: true});
    appendEscPosRule(bytes);
    appendEscPosFeed(bytes, 1);

    appendEscPosText(bytes, `Receipt #: ${receiptId}`);
    appendEscPosText(bytes, `Date: ${saleDate.split('T')[0]}`);
    appendEscPosText(bytes, `Cashier: ${data.username}`);
    if (data.customerName) {
      appendEscPosText(bytes, `Customer: ${data.customerName}`);
    }

    appendEscPosRule(bytes);
    appendEscPosText(bytes, 'ITEMS:', {bold: true});

    for (const item of data.cartItems) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const itemTotal = quantity * unitPrice;
      const itemName =
        item.item_name.length > 30
          ? `${item.item_name.substring(0, 27)}...`
          : item.item_name;
      appendEscPosText(bytes, itemName);
      appendEscPosText(
        bytes,
        `  ${item.quantity} x ${this.formatCurrency(unitPrice)} = ${this.formatCurrency(itemTotal)}`,
      );
    }

    appendEscPosRule(bytes);
    appendEscPosText(bytes, 'TOTALS:', {bold: true});

    const subtotal = Number(data.subtotal ?? data.total) || 0;
    const tax = Number(data.tax) || 0;
    const discount = Number(data.discount) || 0;
    const total = Number(data.total) || 0;
    const change = Number(data.change) || 0;

    appendEscPosText(bytes, `Subtotal: ${this.formatCurrency(subtotal)}`);
    if (tax > 0) {
      appendEscPosText(bytes, `Tax: ${this.formatCurrency(tax)}`);
    }
    if (discount > 0) {
      appendEscPosText(bytes, `Discount: -${this.formatCurrency(discount)}`);
    }

    appendEscPosRule(bytes);
    appendEscPosText(bytes, `TOTAL: ${this.formatCurrency(total)}`, {
      bold: true,
      double: true,
    });
    if (change > 0) {
      appendEscPosText(bytes, `Change: ${this.formatCurrency(change)}`);
    }
    if (data.paymentMethod) {
      appendEscPosText(bytes, `Payment: ${data.paymentMethod}`);
    }

    appendEscPosRule(bytes);
    appendEscPosFeed(bytes, 1);
    appendEscPosText(bytes, 'Thank you for your purchase!', {align: 'center'});
    appendEscPosText(bytes, 'Please come again', {align: 'center'});
    if (data.receiptId) {
      appendEscPosText(bytes, `Receipt ID: ${data.receiptId}`, {align: 'center'});
    }

    appendEscPosRule(bytes);
    appendEscPosText(bytes, 'www.zentroapp.app', {align: 'center'});
    appendEscPosText(bytes, 'Contact: 0750440865 / 0779899789', {align: 'center'});
    appendEscPosText(bytes, 'Powered by Zentroapp', {align: 'center'});

    return finalizeEscPosDocument(bytes);
  }

  private buildReceiptRawBytes(data: PrintReceiptData): number[] {
    return data.compactReceipt
      ? this.buildCompactReceiptRawBytes(data)
      : this.buildFullReceiptRawBytes(data);
  }

  private async printReceiptLogo(logo?: string): Promise<void> {
    if (!logo?.trim() || !this.printerAddress) {
      return;
    }

    const prepared = await prepareCompanyLogoForPrint(logo);
    if (!prepared) {
      return;
    }

    const NativePrinter = (ThermalPrinter as {NativePrinter?: any})
      .NativePrinter;
    if (!NativePrinter?.printImage) {
      throw new Error('Native printer image module unavailable');
    }

    // BT path scales by width only — pick a width that keeps height ≤ max.
    const {width} = fitReceiptLogoSize(prepared.width, prepared.height);

    const result = await NativePrinter.printImage(
      this.printerAddress,
      prepared.localPath,
      {
        align: 'center',
        widthPx: width,
        keepAlive: true,
        timeout: 15000,
      },
      {paperWidthMm: 58},
    );

    if (!result?.success) {
      const err = result?.error;
      const message =
        typeof err === 'string'
          ? err
          : err && typeof err === 'object'
            ? [err.code, err.message, err.suggestion].filter(Boolean).join(' — ')
            : 'Logo print failed';
      throw new Error(message);
    }
  }

  private async printRawEscpos(
    data: number[],
  ): Promise<{success: boolean; error?: string}> {
    const NativePrinter = (ThermalPrinter as {NativePrinter?: any}).NativePrinter;
    if (!NativePrinter?.printRaw || !this.printerAddress) {
      return {success: false, error: 'Native printer module unavailable'};
    }

    const payload = sanitizeEscPosByteArray(data);
    console.log(
      '[BluetoothPrinter] printRawEscpos:',
      payload.length,
      'bytes to',
      this.printerAddress,
    );

    const result = await NativePrinter.printRaw(this.printerAddress, payload, {
      keepAlive: false,
      timeout: 15000,
    });

    console.log('[BluetoothPrinter] printRawEscpos result:', result);

    if (result?.success) {
      return {success: true};
    }

    const err = result?.error;
    if (typeof err === 'string') {
      return {success: false, error: err};
    }
    if (err && typeof err === 'object') {
      const parts = [err.code, err.message, err.suggestion].filter(Boolean);
      if (parts.length > 0) {
        return {success: false, error: parts.join(' — ')};
      }
    }
    return {success: false, error: 'Print failed'};
  }

  /**
   * Get connected device
   */
  public getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }

  /**
   * Web-aligned compact receipt (sales history reprint): less vertical space, no marketing footer.
   */
  private buildCompactReceiptDocument(data: PrintReceiptData): any[] {
    const document: any[] = [];
    const companyName = data.companyInfo?.name || 'ZENTRO APP';
    const receiptId = data.receiptId || 'N/A';
    const saleDateRaw = data.saleDate || new Date().toISOString();

    document.push({
      type: 'text',
      content: 'SALES RECEIPT',
      style: {align: 'center', bold: true},
    });
    document.push({
      type: 'text',
      content: companyName,
      style: {align: 'center', bold: true},
    });
    if (data.companyInfo?.address) {
      document.push({
        type: 'text',
        content: data.companyInfo.address,
        style: {align: 'center'},
      });
    }
    if (data.companyInfo?.phone) {
      document.push({
        type: 'text',
        content: `Tel: ${data.companyInfo.phone}`,
        style: {align: 'center'},
      });
    }
    if (data.companyInfo?.tin) {
      document.push({
        type: 'text',
        content: `TIN: ${data.companyInfo.tin}`,
        style: {align: 'center'},
      });
    }
    if (data.companyInfo?.vatNo) {
      document.push({
        type: 'text',
        content: `VAT No: ${data.companyInfo.vatNo}`,
        style: {align: 'center'},
      });
    }

    document.push({type: 'line'});
    document.push({
      type: 'text',
      content: `Invoice: ${receiptId}`,
      style: {align: 'center', bold: true},
    });
    document.push({
      type: 'text',
      content: `Date: ${this.formatCompactReceiptDate(saleDateRaw)}`,
    });
    document.push({
      type: 'text',
      content: `Cashier: ${data.username}`,
    });
    if (data.customerName) {
      document.push({
        type: 'text',
        content: `Customer: ${data.customerName}`,
      });
    }

    document.push({
      type: 'text',
      content: padReceiptLine('Qty', 'Amount'),
      style: {bold: true},
    });
    document.push({type: 'line'});

    for (const item of data.cartItems) {
      const lineTotal =
        item.line_total != null && Number.isFinite(Number(item.line_total))
          ? Number(item.line_total)
          : (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      const rawName = (item.item_name || 'Item').trim();
      const shortName =
        rawName.length > 24 ? `${rawName.slice(0, 21)}...` : rawName;
      const left = `${item.quantity}x ${shortName}`;
      document.push({
        type: 'text',
        content: padReceiptLine(left, this.formatPlainAmount(lineTotal)),
      });
    }

    document.push({type: 'line'});

    const tax = Number(data.tax) || 0;
    const discount = Number(data.discount) || 0;
    const total = Number(data.total) || 0;
    const change = Number(data.change) || 0;
    const tendered = Number(data.amountReceived);

    if (tax > 0) {
      document.push({
        type: 'text',
        content: padReceiptLine('Tax:', this.formatCurrency(tax)),
      });
    }
    if (discount > 0) {
      document.push({
        type: 'text',
        content: padReceiptLine(
          'Discount:',
          `-${this.formatPlainAmount(discount)}`,
        ),
      });
    }
    document.push({
      type: 'text',
      content: padReceiptLine('TOTAL:', this.formatPlainAmount(total)),
      style: {bold: true},
    });
    if (Number.isFinite(tendered) && tendered > 0) {
      document.push({
        type: 'text',
        content: padReceiptLine(
          'Tendered:',
          this.formatPlainAmount(tendered),
        ),
        style: {bold: true},
      });
    }
    if (change > 0) {
      document.push({
        type: 'text',
        content: padReceiptLine('Change:', this.formatPlainAmount(change)),
        style: {bold: true},
      });
    }
    if (data.paymentMethod && data.paymentMethod !== '—') {
      document.push({
        type: 'text',
        content: padReceiptLine('Payment:', data.paymentMethod),
      });
    }

    document.push({type: 'line'});
    if (data.cartItems.length > 0) {
      document.push({
        type: 'text',
        content: `THANK YOU (${data.cartItems.length} item${
          data.cartItems.length === 1 ? '' : 's'
        })`,
        style: {align: 'center', bold: true},
      });
    } else {
      document.push({
        type: 'text',
        content: 'THANK YOU',
        style: {align: 'center', bold: true},
      });
    }
    document.push({
      type: 'text',
      content: `${receiptId} ${this.formatCompactReceiptDate(saleDateRaw)} ${data.username}`,
      style: {align: 'center'},
    });

    document.push({type: 'feed', lines: 1});
    document.push({type: 'cut'});

    return document;
  }

  private formatPlainAmount(amount: number): string {
    const n = Math.round(Number(amount));
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
  }

  private formatCompactReceiptDate(isoOrDate: string): string {
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

  /**
   * Build receipt document for ThermalPrinter API
   */
  private buildReceiptDocument(data: PrintReceiptData): any[] {
    if (data.compactReceipt) {
      return this.buildCompactReceiptDocument(data);
    }

    const document: any[] = [];

    // Header - Center aligned
    const companyName = data.companyInfo?.name || 'ZENTRO APP';
    document.push({
      type: 'text',
      content: companyName.toUpperCase(),
      style: {align: 'center', bold: true, size: 'double'},
    });

    if (data.companyInfo?.address) {
      document.push({
        type: 'text',
        content: data.companyInfo.address,
        style: {align: 'center'},
      });
    }

    if (data.companyInfo?.tin) {
      document.push({
        type: 'text',
        content: `TIN: ${data.companyInfo.tin}`,
        style: {align: 'center'},
      });
    }

    if (data.companyInfo?.vatNo) {
      document.push({
        type: 'text',
        content: `VAT No: ${data.companyInfo.vatNo}`,
        style: {align: 'center'},
      });
    }

    document.push({type: 'line'});
    document.push({
      type: 'text',
      content: 'SALES RECEIPT',
      style: {align: 'center', bold: true},
    });
    document.push({type: 'line'});
    document.push({type: 'feed', lines: 1});

    // Receipt Info - Left aligned
    const receiptId = data.receiptId || 'N/A';
    const saleDate = data.saleDate || new Date().toLocaleString();
    document.push({
      type: 'text',
      content: `Receipt #: ${receiptId}`,
    });
    document.push({
      type: 'text',
      content: `Date: ${saleDate.split('T')[0]}`,
    });
    document.push({
      type: 'text',
      content: `Cashier: ${data.username}`,
    });

    if (data.customerName) {
      document.push({
        type: 'text',
        content: `Customer: ${data.customerName}`,
      });
    }

    document.push({type: 'line'});

    // Items
    document.push({
      type: 'text',
      content: 'ITEMS:',
      style: {bold: true},
    });

    for (const item of data.cartItems) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const itemTotal = quantity * unitPrice;
      const itemName =
        item.item_name.length > 30
          ? item.item_name.substring(0, 27) + '...'
          : item.item_name;

      document.push({
        type: 'text',
        content: itemName,
      });
      document.push({
        type: 'text',
        content: `  ${item.quantity} x ${this.formatCurrency(
          unitPrice,
        )} = ${this.formatCurrency(itemTotal)}`,
      });
    }

    document.push({type: 'line'});

    // Totals
    document.push({
      type: 'text',
      content: 'TOTALS:',
      style: {bold: true},
    });

    const subtotal = Number(data.subtotal ?? data.total) || 0;
    const tax = Number(data.tax) || 0;
    const discount = Number(data.discount) || 0;
    const total = Number(data.total) || 0;
    const change = Number(data.change) || 0;

    document.push({
      type: 'text',
      content: `Subtotal: ${this.formatCurrency(subtotal)}`,
    });

    if (tax > 0) {
      document.push({
        type: 'text',
        content: `Tax: ${this.formatCurrency(tax)}`,
      });
    }

    if (discount > 0) {
      document.push({
        type: 'text',
        content: `Discount: -${this.formatCurrency(discount)}`,
      });
    }

    document.push({type: 'line'});
    document.push({
      type: 'text',
      content: `TOTAL: ${this.formatCurrency(total)}`,
      style: {bold: true, size: 'double_width'},
    });

    if (change > 0) {
      document.push({
        type: 'text',
        content: `Change: ${this.formatCurrency(change)}`,
      });
    }

    if (data.paymentMethod) {
      document.push({
        type: 'text',
        content: `Payment: ${data.paymentMethod}`,
      });
    }

    document.push({type: 'line'});

    // Footer - Center aligned
    document.push({type: 'feed', lines: 1});
    document.push({
      type: 'text',
      content: 'Thank you for your purchase!',
      style: {align: 'center'},
    });
    document.push({
      type: 'text',
      content: 'Please come again',
      style: {align: 'center'},
    });

    if (data.receiptId) {
      document.push({
        type: 'text',
        content: `Receipt ID: ${data.receiptId}`,
        style: {align: 'center'},
      });
    }

    document.push({type: 'line'});
    document.push({
      type: 'text',
      content: 'www.zentroapp.app',
      style: {align: 'center'},
    });
    document.push({
      type: 'text',
      content: 'Contact: 0750440865 / 0779899789',
      style: {align: 'center'},
    });
    document.push({
      type: 'text',
      content: 'Powered by Zentroapp',
      style: {align: 'center'},
    });

    // Feed paper and cut
    document.push({type: 'feed', lines: 3});
    document.push({type: 'cut'});

    return document;
  }

  private buildItemLabelDocument(data: ItemLabelPrintData): any[] {
    const doc: any[] = [];
    doc.push({
      type: 'text',
      content: 'ITEM LABEL',
      style: {align: 'center', bold: true},
    });
    doc.push({type: 'line'});
    doc.push({
      type: 'text',
      content: BluetoothPrinterService.formatLabelItemName(data.item_name),
      style: {align: 'center', bold: true},
    });
    if (data.no) {
      doc.push({
        type: 'text',
        content: `No: ${data.no}`,
        style: {align: 'center'},
      });
    }
    const barcode = BluetoothPrinterService.resolveLabelBarcodeValue(
      data.bar_code_no,
      data.no,
    );
    if (barcode) {
      doc.push({type: 'feed', lines: 1});
      doc.push({
        type: 'barcode',
        content: barcode,
        format: 'CODE128',
        align: 'center',
        heightPx: 72,
        textPosition: 'below',
      });
    } else {
      const humanLine = [data.bar_code_no, data.no]
        .map(s => (s == null ? '' : String(s).trim()))
        .find(Boolean);
      if (humanLine) {
        doc.push({
          type: 'text',
          content: `Code: ${humanLine}`,
          style: {align: 'center'},
        });
      }
    }
    doc.push({type: 'feed', lines: 2});
    doc.push({type: 'cut'});
    return doc;
  }

  /**
   * Print one label job (optional copies via thermal printer `copies`).
   */
  public async printItemLabel(data: ItemLabelPrintData): Promise<boolean> {
    try {
      if (!this.isConnected || !this.connectedDevice || !this.printerAddress) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Connected',
          text2: 'Please connect to a Bluetooth printer first.',
        });
        return false;
      }

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Bluetooth permissions are required to print.',
        });
        return false;
      }

      const sessionReady = await this.ensureFreshBluetoothSession();
      if (!sessionReady) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Connected',
          text2: 'Could not open a Bluetooth print session. Re-pair the printer and try again.',
        });
        return false;
      }

      const copies = Math.min(
        10,
        Math.max(1, Math.floor(Number(data.copies) || 1)),
      );
      const document = normalizeEscposDocument(this.buildItemLabelDocument(data));
      const job = {
        printers: [
          {
            address: this.printerAddress,
            copies,
            options: {
              paperWidthMm: 58,
              encoding: 'utf8' as const,
              marginMm: 1,
            },
          },
        ],
        documents: [document],
      };

      const result = await ThermalPrinter.printReceipt(job);

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Label printed',
          text2: copies > 1 ? `${copies} copies` : 'Ready',
        });
        return true;
      }

      throw new Error(extractThermalPrintError(result, 'Print failed'));
    } catch (error: any) {
      console.error('Failed to print item label via Bluetooth:', error);
      Toast.show({
        type: 'error',
        text1: 'Print Failed',
        text2:
          error?.message ||
          'Could not print the label. Check the printer connection.',
      });
      return false;
    }
  }

  private async printReceiptDocument(
    document: ReceiptDocument,
    logoUrl?: string | null,
  ): Promise<boolean> {
    const logoSrc =
      logoUrl ||
      document.nodes.find((n) => n.type === "image" && n.src)?.src;
    if (logoSrc) {
      try {
        await this.printReceiptLogo(logoSrc);
      } catch (logoError) {
        console.warn("[BluetoothPrinter] receipt logo skipped:", logoError);
      }
    }
    const rawBytes = compileDocumentToEscPosBytes(document);
    const printResult = await this.printRawEscpos(rawBytes);
    if (!printResult.success) {
      throw new Error(printResult.error || "Print failed");
    }
    return true;
  }

  /**
   * Print receipt using Bluetooth
   */
  public async printReceipt(data: PrintReceiptData): Promise<boolean> {
    try {
      if (!this.isConnected || !this.connectedDevice || !this.printerAddress) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Connected',
          text2: 'Please connect to a Bluetooth printer first.',
        });
        return false;
      }

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Bluetooth permissions are required to print.',
        });
        return false;
      }

      const sessionReady = await this.ensureFreshBluetoothSession();
      if (!sessionReady) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Connected',
          text2: 'Could not open a Bluetooth print session. Re-pair the printer and try again.',
        });
        return false;
      }

      const process = data.compactReceipt
        ? 'sales_history_reprint'
        : 'pos_sale';
      const document = await buildSaleReceiptDocument(
        data,
        process,
        'bluetooth',
      );
      await this.printReceiptDocument(
        document,
        data.companyInfo?.logo,
      );

      Toast.show({
        type: 'success',
        text1: 'Print Successful',
        text2: 'Receipt printed successfully',
      });
      return true;
    } catch (error: any) {
      console.error('Failed to print via Bluetooth:', error);
      Toast.show({
        type: 'error',
        text1: 'Print Failed',
        text2:
          error?.message ||
          'Failed to print receipt. Please check printer connection.',
      });
      return false;
    }
  }

  /**
   * Kitchen order ticket (KOT) — same thermal pipeline as receipt, no success toast
   * (callers may print silently, e.g. on fire).
   */
  public async printKot(data: KotData): Promise<boolean> {
    try {
      if (!this.isConnected || !this.connectedDevice || !this.printerAddress) {
        return false;
      }

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        return false;
      }

      const sessionReady = await this.ensureFreshBluetoothSession();
      if (!sessionReady) {
        return false;
      }

      const document = await buildKotReceiptDocument(data, 'bluetooth');
      return await this.printReceiptDocument(document);
    } catch (error) {
      console.error('Bluetooth KOT print failed:', error);
      return false;
    }
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number | string | undefined | null): string {
    const {formatCurrencyCompact} = require('../utils/currency');
    return formatCurrencyCompact(amount);
  }

  /**
   * Test printer
   */
  public async testPrinter(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.connectedDevice || !this.printerAddress) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Connected',
          text2: 'Please connect to a Bluetooth printer first.',
        });
        return false;
      }

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        Toast.show({
          type: 'error',
          text1: 'Permissions Required',
          text2: 'Bluetooth permissions are required to print.',
        });
        return false;
      }

      console.log('Starting printer test...');

      const sessionReady = await this.ensureFreshBluetoothSession();
      if (!sessionReady) {
        Toast.show({
          type: 'error',
          text1: 'Printer Not Connected',
          text2: 'Could not prepare Bluetooth print session.',
        });
        return false;
      }

      const rawResult = await this.printRawEscpos(this.buildEscPosTestBytes());
      if (rawResult.success) {
        console.log('Printer test completed successfully');

        Toast.show({
          type: 'success',
          text1: 'Test Print',
          text2: 'Test print completed successfully',
        });

        return true;
      }

      throw new Error(rawResult.error || 'Test print failed');
    } catch (error: any) {
      console.error('Printer test failed:', error);

      let errorMessage = 'Failed to print test receipt.';
      if (error?.message) {
        errorMessage = `Print failed: ${error.message}`;
      }

      Toast.show({
        type: 'error',
        text1: 'Print Test Failed',
        text2: errorMessage,
      });

      return false;
    }
  }
}

export default BluetoothPrinterService;
