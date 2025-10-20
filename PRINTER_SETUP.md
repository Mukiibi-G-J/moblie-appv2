# Zentro App - Sunmi Printer Setup Documentation

## ✅ Working Configuration

### Package Used

- **Library**: `react-native-printer-sunmi`
- **Version**: Latest
- **Installation**: `npm install react-native-printer-sunmi --force`

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

- `src/services/PrintService.ts` - Main printer service
- `src/Components/PrinterTestButton.tsx` - Test component
- `package.json` - Added `react-native-printer-sunmi`

## 🗑️ Removed Packages

- `@mitsuharu/react-native-sunmi-printer-library` - Caused JNI errors
- `@heasy/react-native-sunmi-printer` - Had compatibility issues
- `react-native-sunmi-v2-printer` - Not needed

## 🧪 Testing

Use the "Test Printer" button in the app to verify functionality. The test prints:

- Header with "ZENTRO APP"
- Test items with prices
- Totals section
- Footer with thank you message

## 🔧 Troubleshooting

If printing stops working:

1. Check if `printTrans()` is being called
2. Verify printer connection with `connect()`
3. Ensure transaction mode is enabled
4. Check device printer service is running
5. Restart the app if needed

---

**Last Updated**: August 23, 2025
**Status**: ✅ Working
**Device**: Sunmi Pro
