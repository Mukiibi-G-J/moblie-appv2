# Zentro App - Printer Setup Documentation

## ✅ Supported Printers

The Zentro App supports two types of thermal printers:

1. **Sunmi Built-in Printers** - For Sunmi devices (Sunmi Pro, etc.)
2. **Bluetooth Thermal Printers** - For external Bluetooth printers like PT-210, GOOJPRT, etc.

### Packages Used

- **Sunmi Library**: `react-native-printer-sunmi`
  - **Version**: Latest
  - **Installation**: `npm install react-native-printer-sunmi --force`

- **Bluetooth ESC/POS Library**: `react-native-bluetooth-escpos-printer`
  - **Version**: Latest
  - **Installation**: `npm install react-native-bluetooth-escpos-printer`

### Key Implementation Details

#### 1. Import Statement

```typescript
import PrinterSunmi from 'react-native-printer-sunmi';
```

#### 2. Connection Setup

```typescript
// Connect to printer
const isConnected = await PrinterSunmi.connect();
if (!isConnected) {
  throw new Error('Printer not connected');
}

// Enable transaction mode
PrinterSunmi.enableTransMode(true);
```

#### 3. Printing Flow

```typescript
// 1. Buffer all print commands
PrinterSunmi.initLine({align: 'CENTER'});
PrinterSunmi.printText('Text', {textSize: 16, bold: true});
PrinterSunmi.addText('More text\n');
PrinterSunmi.printDividingLine('SOLID', 1);

// 2. CRITICAL: Commit the print job
PrinterSunmi.printTrans(); // This actually sends to printer
```

### Working API Methods

| Method                            | Description                     | Example                                                                             |
| --------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| `connect()`                       | Connect to printer              | `await PrinterSunmi.connect()`                                                      |
| `enableTransMode(true)`           | Enable transaction mode         | `PrinterSunmi.enableTransMode(true)`                                                |
| `initLine({ align })`             | Initialize line alignment       | `PrinterSunmi.initLine({ align: 'CENTER' })`                                        |
| `printText(text, options)`        | Print text with styling         | `PrinterSunmi.printText('Hello', { textSize: 16, bold: true })`                     |
| `addText(text)`                   | Add text to current line        | `PrinterSunmi.addText('More text\n')`                                               |
| `printDividingLine(type, height)` | Print dividing line             | `PrinterSunmi.printDividingLine('SOLID', 1)`                                        |
| `printTexts(array)`               | Print multiple text segments    | `PrinterSunmi.printTexts([{ text: 'Label', span: 2 }, { text: 'Value', span: 2 }])` |
| `printTrans()`                    | **CRITICAL** - Commit print job | `PrinterSunmi.printTrans()`                                                         |

### Alignment Options

- `'LEFT'`
- `'CENTER'`
- `'RIGHT'`

### Dividing Line Types

- `'EMPTY'` - Empty space
- `'SOLID'` - Solid line

### Text Size Options

- Numbers: `12`, `14`, `16`, `24`, `35`, etc.

## 🚨 Critical Points

1. **`printTrans()` is REQUIRED** - Without this, nothing prints
2. **Transaction mode must be enabled** - `enableTransMode(true)`
3. **Connection must be established** - Check `connect()` return value
4. **Commands are buffered** - They don't print until `printTrans()` is called

## 📁 Files Modified

- `src/services/PrintService.ts` - Main printer service (supports both Sunmi and Bluetooth)
- `src/services/BluetoothPrinterService.ts` - Bluetooth printer service
- `src/Screens/PrinterConfig/PrinterConfig.tsx` - Printer configuration screen
- `src/Screens/Settings/Settings.tsx` - Updated to navigate to PrinterConfig
- `App.tsx` - Added PrinterConfig screen to navigation
- `package.json` - Added `react-native-printer-sunmi` and `react-native-bluetooth-escpos-printer`

## 🗑️ Removed Packages

- `@mitsuharu/react-native-sunmi-printer-library` - Caused JNI errors
- `@heasy/react-native-sunmi-printer` - Had compatibility issues
- `react-native-sunmi-v2-printer` - Not needed

---

## 📱 Bluetooth Printer Setup (PT-210, etc.)

### Supported Bluetooth Printers

- **PT-210** (GOOJPRT) - ✅ Tested
- Any ESC/POS compatible Bluetooth thermal printer (58mm paper width)

### Setup Instructions

1. **Pair the Printer with Your Device:**
   - Turn on your Bluetooth printer (PT-210, etc.)
   - On your Android device, go to **Settings > Bluetooth**
   - Search for available devices and select your printer
   - If prompted for a PIN, enter `0000` or `1234` (common defaults)
   - Wait for pairing to complete

2. **Configure in Zentro App:**
   - Open Zentro App
   - Go to **Settings > Printer Configuration**
   - Select **"Bluetooth Printer"** as printer type
   - Tap **"Scan for Printers"** to find available Bluetooth printers
   - Select your printer from the list (e.g., "PT-210")
   - Wait for connection confirmation

3. **Test the Connection:**
   - Tap **"Test Printer"** button in Printer Configuration screen
   - A test receipt should print
   - If successful, you're ready to print receipts!

### Bluetooth Printer Features

- **Automatic Detection**: App automatically detects available Bluetooth printers
- **Device Management**: View connected device and disconnect when needed
- **ESC/POS Commands**: Full support for ESC/POS command set
- **58mm Paper**: Optimized for standard 58mm thermal paper width

### Printer Type Selection

The app supports three printer modes:

1. **Auto Detect** (Recommended)
   - Automatically detects if device has Sunmi printer
   - Falls back to Bluetooth if Sunmi not available
   - Best for devices that may switch between printer types

2. **Sunmi Printer**
   - Forces use of built-in Sunmi printer
   - Only works on Sunmi devices
   - Use if you have a Sunmi device and want to ensure Sunmi printer is used

3. **Bluetooth Printer**
   - Forces use of Bluetooth printer
   - Requires manual connection via Printer Configuration screen
   - Use if you have an external Bluetooth printer like PT-210

## 🧪 Testing

### Testing Sunmi Printer

1. Go to **Settings > Printer Configuration**
2. Select **"Sunmi Printer"** or **"Auto Detect"**
3. Tap **"Test Printer"** button
4. Test receipt should print automatically

### Testing Bluetooth Printer

1. Go to **Settings > Printer Configuration**
2. Select **"Bluetooth Printer"**
3. Ensure printer is paired and connected (see setup instructions above)
4. Tap **"Test Printer"** button
5. Test receipt should print

The test receipt includes:
- Header with "ZENTRO APP"
- Test items with prices
- Totals section
- Footer with thank you message

## 🔧 Troubleshooting

### Sunmi Printer Issues

If Sunmi printing stops working:

1. Check if `printTrans()` is being called
2. Verify printer connection with `connect()`
3. Ensure transaction mode is enabled
4. Check device printer service is running
5. Restart the app if needed

### Bluetooth Printer Issues

If Bluetooth printing doesn't work:

1. **Check Bluetooth Permissions:**
   - Go to Android Settings > Apps > Zentro App > Permissions
   - Ensure Location and Bluetooth permissions are granted
   - For Android 12+, also grant Bluetooth Scan and Connect permissions

2. **Verify Printer Pairing:**
   - Check if printer is paired in Android Bluetooth settings
   - Unpair and re-pair if needed
   - Ensure printer is powered on and in range

3. **Check Printer Connection:**
   - Go to Printer Configuration screen
   - Verify printer shows as "Connected"
   - If not connected, scan and reconnect

4. **Test Printer:**
   - Use "Test Printer" button to verify connection
   - Check printer has paper loaded
   - Ensure printer is not in error state

5. **Common Issues:**
   - **"No printers found"**: Make sure printer is powered on and in pairing mode
   - **"Connection failed"**: Check Bluetooth is enabled, printer is paired, and permissions are granted
   - **"Print failed"**: Verify printer is connected, has paper, and is not in error state

### General Troubleshooting

- **Restart the app** if printer type changes don't take effect
- **Clear app data** if persistent connection issues occur
- **Check printer paper** - ensure thermal paper is loaded correctly
- **Verify printer compatibility** - printer must support ESC/POS commands

## 📋 Printer Configuration Screen

Access the Printer Configuration screen from:
- **Settings > Printer Configuration**

Features:
- Select printer type (Auto/Sunmi/Bluetooth)
- Scan for Bluetooth printers
- Connect/disconnect Bluetooth printers
- Test printer functionality
- View connected device information

---

**Last Updated**: January 2025
**Status**: ✅ Working
**Supported Devices**: 
- Sunmi Pro (Sunmi printer)
- Any Android device (Bluetooth printers like PT-210)
**Tested Printers**: 
- Sunmi built-in printer ✅
- PT-210 (GOOJPRT) Bluetooth printer ✅
