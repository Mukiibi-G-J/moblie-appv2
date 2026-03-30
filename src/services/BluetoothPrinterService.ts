import {Platform, PermissionsAndroid, EmitterSubscription} from 'react-native';
import {ThermalPrinter} from '@finan-me/react-native-thermal-printer';
import Toast from 'react-native-toast-message';
import {PrintReceiptData, PrintItem, CompanyInfo} from './PrintService';

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

  /**
   * Request Bluetooth permissions (Android)
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

  /**
   * Scan for available Bluetooth printers
   */
  public async scanForPrinters(): Promise<BluetoothDevice[]> {
    try {
      if (Platform.OS !== 'android') {
        Toast.show({
          type: 'info',
          text1: 'Not Supported',
          text2: 'Bluetooth printing is only available on Android',
        });
        return [];
      }

      console.log('Starting Bluetooth scan...');

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
   * Connect to a Bluetooth printer
   */
  public async connectToPrinter(device: BluetoothDevice): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        return false;
      }

      console.log('Connecting to printer:', device.name, device.address);

      // Format address: "bt:MAC_ADDRESS" for Bluetooth Classic
      // The address should already be in MAC format (AA:BB:CC:DD:EE:FF)
      let formattedAddress = device.address;
      if (!formattedAddress.startsWith('bt:')) {
        formattedAddress = `bt:${formattedAddress}`;
      }

      this.printerAddress = formattedAddress;

      // Test connection to verify it works
      try {
        const testResult = await ThermalPrinter.testConnection(
          formattedAddress,
        );
        console.log('Connection test result:', testResult);

        if (testResult.success) {
          this.isConnected = true;
          this.connectedDevice = device;
          this.isInitialized = true;

          console.log('Bluetooth printer connected successfully');

          Toast.show({
            type: 'success',
            text1: 'Printer Connected',
            text2: `Connected to ${device.name}`,
          });

          return true;
        } else {
          const errorMsg =
            typeof testResult.error === 'string'
              ? testResult.error
              : testResult.error?.message || 'Connection test failed';
          throw new Error(errorMsg);
        }
      } catch (testError: any) {
        console.error('Connection test failed:', testError);
        throw new Error(testError?.message || 'Failed to connect to printer');
      }
    } catch (error: any) {
      console.error('Failed to connect to printer:', error);
      this.isConnected = false;
      this.connectedDevice = null;
      this.printerAddress = null;

      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2:
          error?.message ||
          'Failed to connect to Bluetooth printer. Please ensure the printer is paired.',
      });

      return false;
    }
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
   * Get connected device
   */
  public getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }

  /**
   * Build receipt document for ThermalPrinter API
   */
  private buildReceiptDocument(data: PrintReceiptData): any[] {
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

      console.log('Starting Bluetooth print...');

      // Build receipt document
      const document = this.buildReceiptDocument(data);

      // Create print job
      const job = {
        printers: [
          {
            address: this.printerAddress,
            options: {
              paperWidthMm: 58, // 58mm paper
              encoding: 'utf8' as const,
              marginMm: 1,
            },
          },
        ],
        documents: [document],
      };

      // Print via Bluetooth
      const result = await ThermalPrinter.printReceipt(job);

      console.log('Print result:', result);

      if (result.success) {
        console.log('Bluetooth print completed successfully');

        Toast.show({
          type: 'success',
          text1: 'Print Successful',
          text2: 'Receipt printed successfully',
        });

        return true;
      } else {
        // result.results is a Map<string, PrinterResult>
        const firstResult = result.results
          ? Array.from(result.results.values())[0]
          : null;
        const errorMsg = firstResult?.error || 'Print failed';
        throw new Error(
          typeof errorMsg === 'string'
            ? errorMsg
            : errorMsg?.message || 'Print failed',
        );
      }
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
   * Format currency
   */
  private formatCurrency(amount: number | string | undefined | null): string {
    const numericAmount = Number(amount);
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return `UGX ${safeAmount.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
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

      // Build test receipt document
      const document: any[] = [
        {
          type: 'text',
          content: 'ZENTRO APP - TEST',
          style: {align: 'center', bold: true, size: 'double'},
        },
        {type: 'feed', lines: 1},
        {type: 'line'},
        {
          type: 'text',
          content: 'Printer Test Successful',
          style: {align: 'center', bold: true},
        },
        {
          type: 'text',
          content: `Date: ${new Date().toLocaleString()}`,
          style: {align: 'center'},
        },
        {
          type: 'text',
          content: `Device: ${this.connectedDevice.name}`,
          style: {align: 'center'},
        },
        {type: 'line'},
        {type: 'feed', lines: 3},
        {type: 'cut'},
      ];

      // Create print job
      const job = {
        printers: [
          {
            address: this.printerAddress!,
            options: {
              paperWidthMm: 58,
              encoding: 'utf8' as const,
              marginMm: 1,
            },
          },
        ],
        documents: [document],
      };

      // Print via Bluetooth
      const result = await ThermalPrinter.printReceipt(job);

      if (result.success) {
        console.log('Printer test completed successfully');

        Toast.show({
          type: 'success',
          text1: 'Test Print',
          text2: 'Test print completed successfully',
        });

        return true;
      } else {
        // result.results is a Map<string, PrinterResult>
        const firstResult = result.results
          ? Array.from(result.results.values())[0]
          : null;
        const errorMsg = firstResult?.error || 'Test print failed';
        throw new Error(
          typeof errorMsg === 'string'
            ? errorMsg
            : errorMsg?.message || 'Test print failed',
        );
      }
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
