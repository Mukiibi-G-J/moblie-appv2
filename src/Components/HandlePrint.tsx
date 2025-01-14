import PrinterSunmi from 'react-native-printer-sunmi';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

const formatCurrency = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const handlePrint = async (cartItems, total, username) => {
    if (Platform.OS !== 'android') {
        Toast.show({
            type: 'error',
            text1: 'Printing Error',
            text2: 'Printing is only supported on Sunmi devices',
        });
        return;
    }

    try {
        // Initialize printer connection
        const isConnected = await PrinterSunmi.connect();
        if (!isConnected) {
            throw new Error('Printer not connected');
        }

        PrinterSunmi.enableTransMode(true);

        // Store Header
        PrinterSunmi.initLine({ align: 'CENTER' });
        PrinterSunmi.printText('SEMUNA STORES', { textSize: 35, bold: true });
        PrinterSunmi.printDividingLine('EMPTY', 8);
        PrinterSunmi.printText('GENERAL MERCHANDISE', { textSize: 24 });
        PrinterSunmi.printDividingLine('EMPTY', 8);

        // Business Details
        PrinterSunmi.initLine({ align: 'CENTER' });
        PrinterSunmi.addText('Plot 123, Kyengera Trading Center\n');
        PrinterSunmi.addText('Kampala, Uganda\n');
        PrinterSunmi.addText('Tel: 0779899789 / 0750440865\n');
        PrinterSunmi.addText('TIN: 1001219174\n');

        // Receipt Info
        PrinterSunmi.printDividingLine('SOLID', 1);
        PrinterSunmi.printTexts([
            { text: 'Date:', span: 2 },
            { text: new Date().toLocaleString(), span: 2, style: { align: 'RIGHT' } },
        ]);
        PrinterSunmi.printTexts([
            { text: 'Cashier:', span: 2 },
            { text: username, span: 2, style: { align: 'RIGHT' } },
        ]);

        // Items Header
        PrinterSunmi.printDividingLine('SOLID', 1);
        PrinterSunmi.printTexts([
            { text: 'ITEM', span: 2, style: { bold: true } },
            { text: 'QTY', span: 1, style: { align: 'CENTER', bold: true } },
            { text: 'AMOUNT', span: 1, style: { align: 'RIGHT', bold: true } },
        ]);
        PrinterSunmi.printDividingLine('SOLID', 1);

        // Items
        cartItems.forEach((item) => {
            PrinterSunmi.printTexts([
                { text: item.item_name, span: 4 },
            ]);
            PrinterSunmi.printTexts([
                { text: '', span: 1 },
                { text: `${item.quantity} x ${formatCurrency(item.unit_price)}`, span: 2 },
                { text: `${formatCurrency(item.quantity * item.unit_price)}`, span: 1, style: { align: 'RIGHT' } },
            ]);
        });

        // Total
        PrinterSunmi.printDividingLine('SOLID', 1);
        PrinterSunmi.printTexts([
            { text: 'TOTAL', span: 2, style: { bold: true } },
            { text: `UGX ${formatCurrency(total)}`, span: 2, style: { align: 'RIGHT', bold: true } },
        ]);

        // Footer
        PrinterSunmi.printDividingLine('EMPTY', 12);
        PrinterSunmi.initLine({ align: 'CENTER' });
        PrinterSunmi.printText('Thank You For Shopping With Us!', { bold: true });
        PrinterSunmi.printDividingLine('EMPTY', 8);
        PrinterSunmi.addText('Goods once sold are not returnable\n');
        PrinterSunmi.addText('Keep this receipt for any future reference\n');

        // Receipt ID and Barcode
        const receiptId = `SM${Date.now()}`;
        PrinterSunmi.printDividingLine('EMPTY', 8);
        PrinterSunmi.printBarCode(receiptId, { align: 'CENTER' });
        PrinterSunmi.addText(receiptId + '\n');

        // Final spacing and complete transaction
        PrinterSunmi.printDividingLine('EMPTY', 48);
        PrinterSunmi.printTrans();

        // Setup error watching
        const unsubscribe = PrinterSunmi.watchError((payload) => {
            console.log('Printer Error:', payload.method, payload.message);
            Toast.show({
                type: 'error',
                text1: 'Printer Error',
                text2: payload.message,
            });
        });

        // Cleanup
        return () => {
            unsubscribe();
            PrinterSunmi.disconnect();
        };

    } catch (error) {
        console.error('Printing error:', error);
        Toast.show({
            type: 'error',
            text1: 'Printing Error',
            text2: error.message || 'Failed to print receipt',
        });
    }
};