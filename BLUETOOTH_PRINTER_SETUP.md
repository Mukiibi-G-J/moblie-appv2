# Bluetooth Printer Setup Guide

## Package Installation

The Bluetooth printer functionality uses the `@vardrz/react-native-bluetooth-escpos-printer` package.

### Installed Package

```bash
npm install @vardrz/react-native-bluetooth-escpos-printer --legacy-peer-deps
```

**Package**: `@vardrz/react-native-bluetooth-escpos-printer` v0.1.1

This package provides:
- `BluetoothManager` - For device scanning and connection
- `BluetoothEscposPrinter` - For sending ESC/POS print commands

### Option 2: react-native-thermal-receipt-printer

```bash
npm install react-native-thermal-receipt-printer --legacy-peer-deps
```

### Option 3: Manual Native Module Implementation

If the above packages don't work, you may need to:
1. Create a custom native module for Android
2. Use the Android Bluetooth API directly
3. Implement ESC/POS command sending

## Android Setup

After installing the package, you need to configure Android:

### 1. Add Permissions to `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### 2. For Android 12+ (API 31+)

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-feature android:name="android.hardware.bluetooth" android:required="false" />
<uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
```

### 3. Link Native Module

If using React Native < 0.60, you may need to manually link:

```bash
react-native link react-native-bluetooth-escpos-printer
```

For React Native 0.60+, auto-linking should work, but you may need to:

1. Clean and rebuild:
```bash
cd android
./gradlew clean
cd ..
npm run android
```

## Testing

1. Pair your PT-210 printer with your Android device via Bluetooth settings
2. Open Zentro App > Settings > Printer Configuration
3. Select "Bluetooth Printer"
4. Tap "Scan for Printers"
5. Select your printer from the list
6. Tap "Test Printer" to verify connection

## Troubleshooting

### Package Not Found

If `react-native-bluetooth-escpos-printer` doesn't exist, you can:

1. **Use an alternative package**: Try `react-native-thermal-receipt-printer` or similar
2. **Fork and modify**: Create your own package based on existing Bluetooth printer libraries
3. **Use native modules**: Implement Bluetooth communication directly in native Android code

### Common Issues

- **"No module found"**: Make sure you've run `npm install` and rebuilt the app
- **"Permission denied"**: Check AndroidManifest.xml has all required permissions
- **"Cannot connect"**: Ensure printer is paired in Android Bluetooth settings first
- **"Print fails"**: Verify printer supports ESC/POS commands and is in range

## Alternative Implementation

If the npm packages don't work, you can implement Bluetooth printing using:

1. **react-native-bluetooth-serial-next** - For basic Bluetooth communication
2. **react-native-bluetooth-classic** - For Bluetooth Classic connections
3. **Custom native module** - Direct Android Bluetooth API implementation

Then send ESC/POS commands manually through the Bluetooth connection.

