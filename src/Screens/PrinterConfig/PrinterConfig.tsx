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
  Image,
  StatusBar,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {safeGoBack} from '../../hooks/NavigationService';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import Toast from 'react-native-toast-message';
import {QuickIconPressable} from '../../Components';
import PrintService, {PrinterType} from '../../services/PrintService';
import BluetoothPrinterService, {
  BluetoothDevice,
} from '../../services/BluetoothPrinterService';
import UsbPrinterService, {UsbDevice} from '../../services/UsbPrinterService';

const PrinterConfig: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
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
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [connectedUsbDevice, setConnectedUsbDevice] = useState<UsbDevice | null>(
    null,
  );
  const [isUsbScanning, setIsUsbScanning] = useState(false);
  const [isUsbConnecting, setIsUsbConnecting] = useState(false);

  const printService = PrintService.getInstance();
  const bluetoothService = BluetoothPrinterService.getInstance();
  const usbService = UsbPrinterService.getInstance();

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  useEffect(() => {
    loadPrinterSettings();
    checkBluetoothConnection();
  }, []);

  useEffect(() => {
    if (printerType === 'bluetooth') {
      checkBluetoothConnection();
    }
  }, [printerType]);

  const loadPrinterSettings = async () => {
    try {
      const savedType = await printService.syncPrinterTypeFromStorage();
      setPrinterType(savedType);
      if (Platform.OS === 'android') {
        await bluetoothService.ensureConnectedFromStorage();
        if (savedType === 'auto' && !bluetoothService.isPrinterConnected()) {
          await bluetoothService.tryAutoConnectPosBuiltin();
        }
        checkBluetoothConnection();
        if (savedType === 'usb') {
          const reconnected = await usbService.reconnectFromStorage();
          if (reconnected) {
            setConnectedUsbDevice(usbService.getConnectedDevice());
          }
        }
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  };

  const checkBluetoothConnection = () => {
    const device = bluetoothService.getConnectedDevice();
    const isConnected = bluetoothService.isPrinterConnected();
    console.log('Bluetooth connection status:', {device, isConnected});
    setConnectedDevice(device);
  };

  const promptEnableBluetooth = (): Promise<boolean> =>
    new Promise(resolve => {
      Alert.alert(
        'Bluetooth is turned off',
        'Turn on Bluetooth to use a Bluetooth thermal printer. You can enable it now or in Android settings.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable Bluetooth',
            onPress: () => {
              void (async () => {
                const enabled = await bluetoothService.requestEnableBluetooth();
                if (!enabled) {
                  Toast.show({
                    type: 'info',
                    text1: 'Bluetooth still off',
                    text2:
                      'Enable Bluetooth in your device settings, then try again.',
                  });
                }
                resolve(enabled);
              })();
            },
          },
        ],
        {cancelable: true, onDismiss: () => resolve(false)},
      );
    });

  const ensureBluetoothReady = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    if (await bluetoothService.isBluetoothEnabled()) {
      return true;
    }
    return promptEnableBluetooth();
  };

  const handlePrinterTypeChange = async (type: PrinterType) => {
    if (type === 'bluetooth' && Platform.OS === 'android') {
      const ready = await ensureBluetoothReady();
      if (!ready) {
        return;
      }
    }

    try {
      setIsLoading(true);
      await printService.setPrinterType(type);
      setPrinterType(type);

      Toast.show({
        type: 'success',
        text1: 'Printer type updated',
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
        text1: 'Not supported',
        text2: 'Bluetooth printing is only available on Android',
      });
      return;
    }

    const ready = await ensureBluetoothReady();
    if (!ready) {
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
          text1: 'No printers found',
          text2:
            'Make sure your printer is powered on and paired in Bluetooth settings',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Scan complete',
          text2: `Found ${devices.length} device(s)`,
        });
      }
    } catch (error: any) {
      console.error('Failed to scan for printers:', error);
      Toast.show({
        type: 'error',
        text1: 'Scan failed',
        text2: error?.message || 'Failed to scan for Bluetooth printers',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const connectToPrinter = async (device: BluetoothDevice) => {
    const ready = await ensureBluetoothReady();
    if (!ready) {
      return;
    }

    try {
      setIsConnecting(true);

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
        text1: 'Connection failed',
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

  const scanForUsbPrinters = async () => {
    if (Platform.OS !== 'android') {
      Toast.show({
        type: 'info',
        text1: 'Not supported',
        text2: 'USB printing is only available on Android',
      });
      return;
    }
    try {
      setIsUsbScanning(true);
      setUsbDevices([]);
      const devices = await usbService.getDeviceList();
      setUsbDevices(devices);
      if (devices.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'No USB printers found',
          text2:
            'Power on the Xprinter, plug in USB, then scan again. Use a data USB cable, not charge-only.',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'USB devices found',
          text2: `Found ${devices.length} device(s). Select the Xprinter.`,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Scan failed',
        text2: error?.message || 'Failed to scan for USB printers',
      });
    } finally {
      setIsUsbScanning(false);
    }
  };

  const connectToUsbPrinter = async (device: UsbDevice) => {
    try {
      setIsUsbConnecting(true);
      if (connectedUsbDevice) {
        await usbService.disconnect();
      }
      const success = await usbService.connect(device);
      if (success) {
        setConnectedUsbDevice(device);
        await printService.setPrinterType('usb');
        setPrinterType('usb');
        Toast.show({
          type: 'success',
          text1: 'USB printer connected',
          text2: device.device_name,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Connection failed',
          text2:
            'Could not connect to USB printer. Grant USB permission when prompted.',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Connection failed',
        text2: error?.message || 'Failed to connect to USB printer',
      });
    } finally {
      setIsUsbConnecting(false);
    }
  };

  const disconnectUsbPrinter = async () => {
    try {
      await usbService.disconnect();
      setConnectedUsbDevice(null);
      Toast.show({type: 'success', text1: 'USB printer disconnected'});
    } catch {}
  };

  const ensurePrinterReadyForTest = async (): Promise<boolean> => {
    if (printerType === 'usb' && !usbService.isConnected()) {
      Alert.alert(
        'Printer not connected',
        'Please connect to a USB printer first before testing.',
        [{text: 'OK'}],
      );
      return false;
    }

    if (printerType === 'bluetooth') {
      const ready = await ensureBluetoothReady();
      if (!ready) {
        return false;
      }
      if (!bluetoothService.isPrinterConnected()) {
        await bluetoothService.ensureConnectedFromStorage();
      }
      if (!bluetoothService.isPrinterConnected()) {
        Alert.alert(
          'Printer not connected',
          'Please connect to a Bluetooth printer first before testing.',
          [{text: 'OK'}],
        );
        return false;
      }
      checkBluetoothConnection();
    }

    return true;
  };

  const runPrinterTest = async (mode: 'short' | 'sale') => {
    try {
      setIsTesting(true);
      const ready = await ensurePrinterReadyForTest();
      if (!ready) {
        return;
      }

      const success =
        mode === 'short'
          ? await printService.testShortPrinter()
          : await printService.testSaleReceipt();
      if (!success) {
        throw new Error(
          mode === 'short'
            ? 'Quick test print failed'
            : 'Sales test receipt print failed',
        );
      }
    } catch (error: any) {
      console.error('Printer test failed:', error);
      Alert.alert(
        'Printer test failed',
        error?.message ||
          'Failed to test printer. Please check your printer connection.',
        [{text: 'OK'}],
      );
    } finally {
      setIsTesting(false);
    }
  };

  const showTestPrintOptions = () => {
    Alert.alert(
      'Test print',
      'Choose a test type:',
      [
        {
          text: 'Quick test',
          onPress: () => runPrinterTest('short'),
        },
        {
          text: 'Sales receipt test',
          onPress: () => runPrinterTest('sale'),
        },
        {text: 'Cancel', style: 'cancel'},
      ],
      {cancelable: true},
    );
  };

  const showHelpInfo = () => {
    Alert.alert(
      'Printer setup',
      '1. Choose Auto detect, Bluetooth, or USB.\n2. Bluetooth: pair your printer in Android Bluetooth settings, then tap "Scan for printers".\n3. USB (Xprinter XP-58IIT): plug the printer USB-B cable into the POS, turn the printer on, tap "Scan for USB printers", select it, and tap Allow when Android asks.\n4. Tap Quick test or Sales receipt to print.',
      [{text: 'OK'}],
    );
  };

  const renderTypeOption = (
    type: PrinterType,
    title: string,
    description: string,
  ) => {
    const selected = printerType === type;
    return (
      <TouchableOpacity
        style={[
          styles.option,
          {
            borderColor: selected ? COLORS.primary2 : colors.border,
            backgroundColor: selected
              ? COLORS.transparentPrimary
              : colors.card,
          },
        ]}
        onPress={() => handlePrinterTypeChange(type)}
        disabled={isLoading}
        activeOpacity={0.65}>
        <View style={styles.optionContent}>
          <Text
            style={[
              styles.optionText,
              {color: selected ? COLORS.primary2 : colors.textPrimary},
            ]}>
            {title}
          </Text>
          <Text style={[styles.optionDescription, {color: colors.textSecondary}]}>
            {description}
          </Text>
        </View>
        {selected ? (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeOuter, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.root, {backgroundColor: colors.background}]}>
        <View
          style={[
            styles.topHeader,
            {
              paddingTop: headerPaddingTop,
              borderBottomColor: colors.border,
            },
          ]}>
          <QuickIconPressable
            style={[
              styles.headerRoundButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            onPress={() => safeGoBack(navigation, 'Home')}
            accessibilityLabel="Go back">
            <Image
              source={icons.back as any}
              style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text
            style={[styles.topTitle, {color: colors.textPrimary}]}
            numberOfLines={1}
            ellipsizeMode="tail">
            Printer configuration
          </Text>
          <TouchableOpacity
            style={[
              styles.headerHelpButton,
              {backgroundColor: COLORS.transparentPrimary},
            ]}
            onPress={showHelpInfo}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel="Printer setup help">
            <Image
              source={icons.help as any}
              style={[styles.headerHelpIcon, {tintColor: COLORS.primary3}]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionTitle, {color: COLORS.primary3}]}>
            Printer type
          </Text>
          <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
            Select the type of printer you want to use
          </Text>

          <View style={[styles.card, {backgroundColor: colors.card}]}>
            <View style={styles.optionStack}>
              {renderTypeOption(
                'auto',
                'Auto detect',
                'Sunmi when available; otherwise Bluetooth (including built-in POS printers paired in Android)',
              )}
              {renderTypeOption(
                'sunmi',
                'Sunmi printer',
                'Built-in Sunmi printer (Sunmi devices only)',
              )}
              {renderTypeOption(
                'bluetooth',
                'Bluetooth printer',
                'Bluetooth thermal printer (e.g. PT-210)',
              )}
              {renderTypeOption(
                'usb',
                'USB printer',
                'USB thermal printer (Xprinter XP-58IIT and other 58mm ESC/POS)',
              )}
            </View>
          </View>

          {printerType === 'bluetooth' ? (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.sectionTitleSpaced,
                  {color: COLORS.primary3},
                ]}>
                Bluetooth printer
              </Text>
              <Text
                style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
                Connect to a Bluetooth thermal printer
              </Text>

              {connectedDevice ? (
                <View
                  style={[
                    styles.connectedCard,
                    {
                      backgroundColor: COLORS.transparentPrimary,
                      borderColor: COLORS.transparentPrimary2,
                    },
                  ]}>
                  <View style={styles.connectedDeviceInfo}>
                    <Text
                      style={[styles.connectedDeviceLabel, {color: colors.textSecondary}]}>
                      Connected
                    </Text>
                    <Text
                      style={[styles.connectedDeviceName, {color: colors.textPrimary}]}>
                      {connectedDevice.name}
                    </Text>
                    <Text
                      style={[
                        styles.connectedDeviceAddress,
                        {color: colors.textTertiary},
                      ]}>
                      {connectedDevice.address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={disconnectPrinter}
                    activeOpacity={0.85}>
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  isScanning && styles.primaryButtonDisabled,
                ]}
                onPress={scanForPrinters}
                disabled={isScanning}
                activeOpacity={0.85}>
                {isScanning ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Scan for printers</Text>
                )}
              </TouchableOpacity>

              {bluetoothDevices.length > 0 ? (
                <View style={styles.deviceList}>
                  <Text style={[styles.deviceListTitle, {color: colors.textPrimary}]}>
                    Available printers
                  </Text>
                  {bluetoothDevices.map((device, index) => (
                    <TouchableOpacity
                      key={`${device.address}-${index}`}
                      style={[
                        styles.deviceItem,
                        {
                          backgroundColor: colors.screenMuted,
                          borderColor:
                            connectedDevice?.address === device.address
                              ? COLORS.primary2
                              : colors.border,
                        },
                        connectedDevice?.address === device.address &&
                          styles.deviceItemConnected,
                      ]}
                      onPress={() => connectToPrinter(device)}
                      disabled={isConnecting}
                      activeOpacity={0.65}>
                      <View style={styles.deviceItemContent}>
                        <Text
                          style={[styles.deviceItemName, {color: colors.textPrimary}]}>
                          {device.name}
                        </Text>
                        <Text
                          style={[
                            styles.deviceItemAddress,
                            {color: colors.textSecondary},
                          ]}>
                          {device.address}
                        </Text>
                      </View>
                      {isConnecting ? (
                        <ActivityIndicator size="small" color={COLORS.primary2} />
                      ) : (
                        <Text style={[styles.deviceItemArrow, {color: COLORS.primary2}]}>
                          ›
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View
                style={[
                  styles.infoCard,
                  {
                    borderColor: COLORS.transparentPrimary2,
                    backgroundColor: COLORS.transparentPrimary,
                  },
                ]}>
                <Text style={[styles.infoCardTitle, {color: COLORS.primary3}]}>
                  Setup tips
                </Text>
                <Text style={[styles.infoCardBody, {color: colors.textSecondary}]}>
                  Many handheld POS units expose the internal 58mm printer as a paired
                  Bluetooth device: pair it in Android Bluetooth settings, then scan
                  and select it here (or use Auto detect). Use Test printer when
                  connected.
                </Text>
              </View>
            </>
          ) : null}

          {printerType === 'usb' ? (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.sectionTitleSpaced,
                  {color: COLORS.primary3},
                ]}>
                USB thermal printer
              </Text>
              <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
                Connect the Xprinter XP-58IIT (or another 58mm USB ESC/POS printer) with the USB-B cable
              </Text>

              {connectedUsbDevice ? (
                <View
                  style={[
                    styles.connectedCard,
                    {
                      backgroundColor: COLORS.transparentPrimary,
                      borderColor: COLORS.transparentPrimary2,
                    },
                  ]}>
                  <View style={styles.connectedDeviceInfo}>
                    <Text
                      style={[styles.connectedDeviceLabel, {color: colors.textSecondary}]}>
                      Connected
                    </Text>
                    <Text
                      style={[styles.connectedDeviceName, {color: colors.textPrimary}]}>
                      {connectedUsbDevice.device_name}
                    </Text>
                    <Text
                      style={[
                        styles.connectedDeviceAddress,
                        {color: colors.textTertiary},
                      ]}>
                      Vendor: {connectedUsbDevice.vendor_id} · Product:{' '}
                      {connectedUsbDevice.product_id}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={disconnectUsbPrinter}
                    activeOpacity={0.85}>
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  isUsbScanning && styles.primaryButtonDisabled,
                ]}
                onPress={scanForUsbPrinters}
                disabled={isUsbScanning}
                activeOpacity={0.85}>
                {isUsbScanning ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Scan for USB printers</Text>
                )}
              </TouchableOpacity>

              {usbDevices.length > 0 ? (
                <View style={styles.deviceList}>
                  <Text style={[styles.deviceListTitle, {color: colors.textPrimary}]}>
                    Available USB printers
                  </Text>
                  {usbDevices.map((device, index) => (
                    <TouchableOpacity
                      key={`${device.vendor_id}-${device.product_id}-${index}`}
                      style={[
                        styles.deviceItem,
                        {
                          backgroundColor: colors.screenMuted,
                          borderColor:
                            connectedUsbDevice?.vendor_id === device.vendor_id &&
                            connectedUsbDevice?.product_id === device.product_id
                              ? COLORS.primary2
                              : colors.border,
                        },
                        connectedUsbDevice?.vendor_id === device.vendor_id &&
                          connectedUsbDevice?.product_id === device.product_id &&
                          styles.deviceItemConnected,
                      ]}
                      onPress={() => connectToUsbPrinter(device)}
                      disabled={isUsbConnecting}
                      activeOpacity={0.65}>
                      <View style={styles.deviceItemContent}>
                        <Text
                          style={[styles.deviceItemName, {color: colors.textPrimary}]}>
                          {device.device_name}
                        </Text>
                        <Text
                          style={[
                            styles.deviceItemAddress,
                            {color: colors.textSecondary},
                          ]}>
                          Vendor: {device.vendor_id} · Product: {device.product_id}
                        </Text>
                      </View>
                      {isUsbConnecting ? (
                        <ActivityIndicator size="small" color={COLORS.primary2} />
                      ) : (
                        <Text style={[styles.deviceItemArrow, {color: COLORS.primary2}]}>
                          ›
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View
                style={[
                  styles.infoCard,
                  {
                    borderColor: COLORS.transparentPrimary2,
                    backgroundColor: COLORS.transparentPrimary,
                  },
                ]}>
                <Text style={[styles.infoCardTitle, {color: COLORS.primary3}]}>
                  Setup tips
                </Text>
                <Text style={[styles.infoCardBody, {color: colors.textSecondary}]}>
                  Power on the Xprinter, connect USB-B to the POS USB port, then tap
                  "Scan for USB printers". Select the printer (often labeled Xprinter). When
                  Android asks for USB permission, tap Allow and choose Always if shown.
                  Then tap Quick test — a short slip should print.
                </Text>
              </View>
            </>
          ) : null}

          <View style={styles.testButtonRow}>
            <TouchableOpacity
              style={[
                styles.secondaryTestButton,
                {borderColor: colors.border},
                styles.testButtonHalf,
                isTesting && styles.primaryButtonDisabled,
              ]}
              onPress={() => runPrinterTest('short')}
              disabled={isTesting}
              activeOpacity={0.85}>
              {isTesting ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Text style={[styles.secondaryTestButtonText, {color: colors.text}]}>
                  Quick test
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.testButtonHalf,
                isTesting && styles.primaryButtonDisabled,
              ]}
              onPress={() => runPrinterTest('sale')}
              disabled={isTesting}
              activeOpacity={0.85}>
              {isTesting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Sales receipt</Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.testMenuLink}
            onPress={showTestPrintOptions}
            disabled={isTesting}
            activeOpacity={0.7}>
            <Text style={[styles.testButtonHelp, {color: COLORS.primary}]}>
              Or choose test type…
            </Text>
          </TouchableOpacity>
          <Text style={[styles.testButtonHelp, {color: colors.textSecondary}]}>
            Quick test: short slip. Sales receipt: full sample sale with your
            template.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeOuter: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRoundIcon: {
    width: 20,
    height: 20,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerHelpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerHelpIcon: {
    width: 22,
    height: 22,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionTitleSpaced: {
    marginTop: 8,
  },
  sectionSubtitle: {
    ...FONTS.body4,
    marginBottom: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  optionStack: {
    padding: SIZES.base,
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.radius,
    borderRadius: 14,
    borderWidth: 1,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    ...FONTS.body5,
    lineHeight: 18,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SIZES.base,
  },
  checkmarkText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  connectedCard: {
    padding: SIZES.radius,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: SIZES.radius,
  },
  connectedDeviceInfo: {
    marginBottom: SIZES.base,
  },
  connectedDeviceLabel: {
    ...FONTS.body5,
    marginBottom: 4,
    fontWeight: '600',
  },
  connectedDeviceName: {
    ...FONTS.body3,
    fontWeight: '700',
    marginBottom: 4,
  },
  connectedDeviceAddress: {
    ...FONTS.body5,
  },
  disconnectButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: COLORS.error,
    alignSelf: 'flex-start',
  },
  disconnectButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: COLORS.primary2,
    paddingVertical: 16,
    paddingHorizontal: SIZES.padding,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.base,
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
  testButtonSpaced: {
    marginTop: SIZES.base,
  },
  deviceList: {
    marginTop: SIZES.base,
    marginBottom: SIZES.radius,
  },
  deviceListTitle: {
    ...FONTS.body4,
    fontWeight: '700',
    marginBottom: 10,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.radius,
    borderRadius: 14,
    marginBottom: SIZES.base,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deviceItemConnected: {
    borderWidth: 2,
  },
  deviceItemContent: {
    flex: 1,
  },
  deviceItemName: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceItemAddress: {
    ...FONTS.body5,
  },
  deviceItemArrow: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: SIZES.base,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: SIZES.base,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoCardBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  testButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SIZES.padding,
  },
  testButtonHalf: {
    flex: 1,
    marginTop: 0,
  },
  secondaryTestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  secondaryTestButtonText: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  testMenuLink: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  testButtonHelp: {
    ...FONTS.body5,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PrinterConfig;
