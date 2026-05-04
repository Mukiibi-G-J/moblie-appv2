import React, {useRef, useState} from 'react';
import {
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Camera, CameraType} from 'react-native-camera-kit';
import {COLORS, FONTS, SIZES} from '../../constants';
import {playBarcodeBeep} from '../../utils/barcodeFeedback';
import {useSearchMode} from '../../context/SearchModeStore';
import {safeGoBack} from '../../hooks/NavigationService';

const BarcodeScannerScreen = ({navigation, route}: {navigation: any; route: any}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const lastScannedRef = useRef<{value: string; at: number} | null>(null);
  const {state} = useSearchMode();

  const onScan = route?.params?.onScan as ((code: string) => void) | undefined;

  React.useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS !== 'android') {
        setHasPermission(false);
        return;
      }

      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Camera permission is required to scan barcodes.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (error) {
        setHasPermission(false);
      }
    };

    requestPermission();
  }, []);

  const handleReadCode = (event: any) => {
    const scannedCode = event?.nativeEvent?.codeStringValue?.trim();
    if (!scannedCode) {
      return;
    }

    const now = Date.now();
    const lastScan = lastScannedRef.current;
    if (lastScan && lastScan.value === scannedCode && now - lastScan.at < 1500) {
      return;
    }
    lastScannedRef.current = {value: scannedCode, at: now};

    if (state.barcodeBeepEnabled) {
      playBarcodeBeep();
    }

    if (onScan) {
      onScan(scannedCode);
    }
    safeGoBack(navigation, 'Home');
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.infoText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Camera permission denied</Text>
        <Text style={styles.infoText}>
          Enable camera permission to scan product barcodes.
        </Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => safeGoBack(navigation, 'Home')}>
          <Text style={styles.actionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topButton} onPress={() => safeGoBack(navigation, 'Home')}>
          <Text style={styles.topButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => setTorchEnabled(previous => !previous)}>
          <Text style={styles.topButtonText}>
            {torchEnabled ? 'Torch Off' : 'Torch On'}
          </Text>
        </TouchableOpacity>
      </View>

      <Camera
        style={styles.camera}
        cameraType={CameraType.Back}
        scanBarcode={true}
        showFrame={true}
        laserColor={COLORS.primary2}
        frameColor={COLORS.white}
        onReadCode={handleReadCode}
        torchMode={torchEnabled ? 'on' : 'off'}
      />

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Align barcode within the frame</Text>
        <Text style={styles.instructionsSubtitle}>
          Scan supports EAN, UPC, Code128, QR and more.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.black,
  },
  topButton: {
    backgroundColor: COLORS.primary2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  topButtonText: {
    color: COLORS.white,
    ...FONTS.h4,
  },
  camera: {
    flex: 1,
  },
  instructionsContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.black,
  },
  instructionsTitle: {
    color: COLORS.white,
    ...FONTS.h3,
    textAlign: 'center',
  },
  instructionsSubtitle: {
    marginTop: SIZES.base,
    color: COLORS.lightGray1,
    ...FONTS.body4,
    textAlign: 'center',
  },
  errorTitle: {
    ...FONTS.h3,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  infoText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: SIZES.padding,
    backgroundColor: COLORS.primary2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  actionButtonText: {
    color: COLORS.white,
    ...FONTS.h4,
  },
});

export default BarcodeScannerScreen;
