import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES} from '../../constants';
import Toast from 'react-native-toast-message';
import PrintService, {PrinterType} from '../../services/PrintService';
import BluetoothPrinterService, {
  BluetoothDevice,
} from '../../services/BluetoothPrinterService';

const PrinterConfig: React.FC = () => {
  const [printerType, setPrinterType] = useState<PrinterType>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>(
    [],
  );
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [manualDeviceName, setManualDeviceName] = useState('');
  const [manualDeviceAddress, setManualDeviceAddress] = useState('');

  const printService = PrintService.getInstance();
  const bluetoothService = BluetoothPrinterService.getInstance();

  useEffect(() => {
    loadPrinterSettings();
    checkBluetoothConnection();
  }, []);

  // Refresh connection status when printer type changes to bluetooth
  useEffect(() => {
    if (printerType === 'bluetooth') {
      checkBluetoothConnection();
    }
  }, [printerType]);

  const loadPrinterSettings = async () => {
    try {
      const savedType = printService.getPrinterType();
      setPrinterType(savedType);
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  };

  const checkBluetoothConnection = () => {
    const device = bluetoothService.getConnectedDevice();
    const isConnected = bluetoothService.isPrinterConnected();
    console.log('Bluetooth connection status:', { device, isConnected });
    setConnectedDevice(device);
  };

  const handlePrinterTypeChange = async (type: PrinterType) => {
    try {
      setIsLoading(true);
      await printService.setPrinterType(type);
      setPrinterType(type);
      
      Toast.show({
        type: 'success',
        text1: 'Printer Type Updated',
        text2: `Printer type set to ${type}`,
      });
    } catch (error) {
      console.error('Failed to set printer type:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update printer type',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scanForPrinters = async () => {
    if (Platform.OS !== 'android') {
      Toast.show({
        type: 'info',
        text1: 'Not Supported',
        text2: 'Bluetooth printing is only available on Android',
      });
      return;
    }

    try {
      setIsScanning(true);
      setBluetoothDevices([]);

      const devices = await bluetoothService.scanForPrinters();
      setBluetoothDevices(devices);

      if (devices.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'No Printers Found',
          text2: 'Make sure your printer is powered on and paired in Bluetooth Settings',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Scan Complete',
          text2: `Found ${devices.length} device(s)`,
        });
      }
    } catch (error: any) {
      console.error('Failed to scan for printers:', error);
      Toast.show({
        type: 'error',
        text1: 'Scan Failed',
        text2: error?.message || 'Failed to scan for Bluetooth printers',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const connectToPrinter = async (device: BluetoothDevice) => {
    try {
      setIsConnecting(true);

      // Disconnect current device if any
      if (connectedDevice) {
        await bluetoothService.disconnect();
      }

      const success = await bluetoothService.connectToPrinter(device);

      if (success) {
        setConnectedDevice(device);
        await printService.setPrinterType('bluetooth');
        setPrinterType('bluetooth');
      }
    } catch (error: any) {
      console.error('Failed to connect to printer:', error);
      Toast.show({
        type: 'error',
        text1: 'Connection Failed',
        text2: error?.message || 'Failed to connect to printer',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectPrinter = async () => {
    try {
      await bluetoothService.disconnect();
      setConnectedDevice(null);
      Toast.show({
        type: 'success',
        text1: 'Disconnected',
        text2: 'Printer disconnected successfully',
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const testPrinter = async () => {
    try {
      setIsTesting(true);

      // Check if Bluetooth printer is selected and connected
      if (printerType === 'bluetooth') {
        if (!connectedDevice) {
          Alert.alert(
            'Printer Not Connected',
            'Please connect to a Bluetooth printer first before testing.',
            [{text: 'OK'}],
          );
          return;
        }

        // Test using Bluetooth service directly
        const success = await bluetoothService.testPrinter();
        if (!success) {
          throw new Error('Bluetooth printer test failed');
        }
      } else {
        // Test using print service (for Sunmi or auto-detect)
        const success = await printService.testPrinter();
        if (!success) {
          throw new Error('Printer test failed');
        }
      }
    } catch (error: any) {
      console.error('Printer test failed:', error);
      Alert.alert(
        'Printer Test Failed',
        error?.message ||
          'Failed to test printer. Please check your printer connection.',
        [{text: 'OK'}],
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Printer Configuration</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Printer Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Printer Type</Text>
          <Text style={styles.sectionSubtitle}>
            Select the type of printer you want to use
          </Text>

          <View style={styles.optionContainer}>
            <TouchableOpacity
              style={[
                styles.option,
                printerType === 'auto' && styles.optionSelected,
              ]}
              onPress={() => handlePrinterTypeChange('auto')}
              disabled={isLoading}>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    printerType === 'auto' && styles.optionTextSelected,
                  ]}>
                  Auto Detect
                </Text>
                <Text style={styles.optionDescription}>
                  Automatically detect available printer (Sunmi or Bluetooth)
                </Text>
              </View>
              {printerType === 'auto' && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.option,
                printerType === 'sunmi' && styles.optionSelected,
              ]}
              onPress={() => handlePrinterTypeChange('sunmi')}
              disabled={isLoading}>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    printerType === 'sunmi' && styles.optionTextSelected,
                  ]}>
                  Sunmi Printer
                </Text>
                <Text style={styles.optionDescription}>
                  Use built-in Sunmi printer (Sunmi devices only)
                </Text>
              </View>
              {printerType === 'sunmi' && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.option,
                printerType === 'bluetooth' && styles.optionSelected,
              ]}
              onPress={() => handlePrinterTypeChange('bluetooth')}
              disabled={isLoading}>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    printerType === 'bluetooth' && styles.optionTextSelected,
                  ]}>
                  Bluetooth Printer
                </Text>
                <Text style={styles.optionDescription}>
                  Use Bluetooth thermal printer (PT-210, etc.)
                </Text>
              </View>
              {printerType === 'bluetooth' && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bluetooth Printer Section */}
        {printerType === 'bluetooth' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bluetooth Printer</Text>
            <Text style={styles.sectionSubtitle}>
              Connect to a Bluetooth thermal printer like PT-210
            </Text>

            {/* Connected Device Info */}
            {connectedDevice && (
              <View style={styles.connectedDeviceContainer}>
                <View style={styles.connectedDeviceInfo}>
                  <Text style={styles.connectedDeviceLabel}>Connected:</Text>
                  <Text style={styles.connectedDeviceName}>
                    {connectedDevice.name}
                  </Text>
                  <Text style={styles.connectedDeviceAddress}>
                    {connectedDevice.address}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={disconnectPrinter}>
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Scan Button */}
            <TouchableOpacity
              style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
              onPress={scanForPrinters}
              disabled={isScanning}>
              {isScanning ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.scanButtonText}>Scan for Printers</Text>
              )}
            </TouchableOpacity>

            {/* Device List */}
            {bluetoothDevices.length > 0 && (
              <View style={styles.deviceList}>
                <Text style={styles.deviceListTitle}>Available Printers</Text>
                {bluetoothDevices.map((device, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.deviceItem,
                      connectedDevice?.address === device.address &&
                        styles.deviceItemConnected,
                    ]}
                    onPress={() => connectToPrinter(device)}
                    disabled={isConnecting}>
                    <View style={styles.deviceItemContent}>
                      <Text style={styles.deviceItemName}>{device.name}</Text>
                      <Text style={styles.deviceItemAddress}>
                        {device.address}
                      </Text>
                    </View>
                    {isConnecting ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={styles.deviceItemArrow}>›</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Setup Instructions:</Text>
              <Text style={styles.instructionsText}>
                1. Turn on your Bluetooth printer (PT-210, etc.)
              </Text>
              <Text style={styles.instructionsText}>
                2. Make sure the printer is in pairing mode
              </Text>
              <Text style={styles.instructionsText}>
                3. Tap "Scan for Printers" to find available devices
              </Text>
              <Text style={styles.instructionsText}>
                4. Select your printer from the list to connect
              </Text>
              <Text style={styles.instructionsText}>
                5. Use "Test Printer" to verify the connection
              </Text>
              <Text style={styles.instructionsText}>
                Note: For best results, pair your printer in Android Bluetooth Settings first
              </Text>
            </View>
          </View>
        )}

        {/* Test Printer Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.testButton, isTesting && styles.testButtonDisabled]}
            onPress={testPrinter}
            disabled={isTesting}>
            {isTesting ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.testButtonText}>Test Printer</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.testButtonHelp}>
            Print a test receipt to verify your printer is working correctly
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.black,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  section: {
    marginBottom: SIZES.padding * 2,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base,
  },
  sectionSubtitle: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: SIZES.radius,
  },
  optionContainer: {
    gap: SIZES.base,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.radius,
    borderRadius: SIZES.radius,
    borderWidth: 2,
    borderColor: COLORS.lightGray2,
    backgroundColor: COLORS.white,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPrimary,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base / 2,
  },
  optionTextSelected: {
    color: COLORS.primary,
  },
  optionDescription: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SIZES.base,
  },
  checkmarkText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectedDeviceContainer: {
    padding: SIZES.radius,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightPrimary,
    marginBottom: SIZES.radius,
  },
  connectedDeviceInfo: {
    marginBottom: SIZES.base,
  },
  connectedDeviceLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: SIZES.base / 2,
  },
  connectedDeviceName: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SIZES.base / 2,
  },
  connectedDeviceAddress: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  disconnectButton: {
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.base,
    backgroundColor: COLORS.error,
    alignSelf: 'flex-start',
  },
  disconnectButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.radius,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  deviceList: {
    marginTop: SIZES.radius,
  },
  deviceListTitle: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.radius,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
    marginBottom: SIZES.base,
  },
  deviceItemConnected: {
    backgroundColor: COLORS.lightPrimary,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  deviceItemContent: {
    flex: 1,
  },
  deviceItemName: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base / 2,
  },
  deviceItemAddress: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  deviceItemArrow: {
    ...FONTS.h2,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
  instructionsContainer: {
    marginTop: SIZES.radius,
    padding: SIZES.radius,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
  },
  instructionsTitle: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base,
  },
  instructionsText: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: SIZES.base / 2,
  },
  testButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.base,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  testButtonHelp: {
    ...FONTS.body5,
    color: COLORS.gray,
    textAlign: 'center',
  },
  manualEntryContainer: {
    marginTop: SIZES.radius,
    padding: SIZES.radius,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
    marginBottom: SIZES.radius,
  },
  manualEntryTitle: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base / 2,
  },
  manualEntrySubtitle: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: SIZES.radius,
  },
  manualEntryInput: {
    ...FONTS.body3,
    backgroundColor: COLORS.white,
    padding: SIZES.radius,
    borderRadius: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    marginBottom: SIZES.base,
    color: COLORS.black,
  },
  manualEntryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryButtonDisabled: {
    opacity: 0.6,
  },
  manualEntryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default PrinterConfig;

