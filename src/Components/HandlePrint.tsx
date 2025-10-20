import {Platform} from 'react-native';
import Toast from 'react-native-toast-message';
import PrintService, {
  PrintReceiptData,
  PrintItem,
} from '../services/PrintService';
import {CartItem} from '../@types/types.dto';

export const handlePrint = async (
  cartItems: CartItem[],
  total: number,
  username: string,
  receiptId?: string,
  additionalData?: {
    customerName?: string;
    paymentMethod?: string;
    change?: number;
    tax?: number;
    discount?: number;
  },
): Promise<boolean> => {
  if (Platform.OS !== 'android') {
  Toast.show({
    type: 'info',
      text1: 'Printing Not Available',
      text2: 'Printing is only supported on Android devices.',
    });
    return false;
  }

  try {
    console.log('Starting print process...');

    // Map cart items to print items
    const printItems: PrintItem[] = cartItems.map(item => ({
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      date_sold: item.date_sold,
      bar_code_no: item.bar_code_no,
    }));

    // Calculate subtotal
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );

    // Prepare receipt data
    const receiptData: PrintReceiptData = {
      cartItems: printItems,
      total: total,
      username: username,
      receiptId: receiptId || PrintService.getInstance().generateReceiptId(),
      saleDate: new Date().toLocaleString(),
      subtotal: subtotal,
      tax: additionalData?.tax || 0,
      discount: additionalData?.discount || 0,
      paymentMethod: additionalData?.paymentMethod || 'Cash',
      change: additionalData?.change || 0,
      customerName: additionalData?.customerName,
    };

    console.log('Receipt data prepared:', receiptData);

    // Get print service instance and print
    const printService = PrintService.getInstance();
    const success = await printService.printReceipt(receiptData);

    if (success) {
      Toast.show({
        type: 'success',
        text1: 'Receipt Printed',
        text2: 'Receipt has been printed successfully.',
      });
      console.log('Print completed successfully');
      return true;
    } else {
      Toast.show({
        type: 'error',
        text1: 'Printing Failed',
        text2: 'Failed to print receipt. Please check printer connection.',
      });
      console.log('Print failed');
      return false;
    }
  } catch (error: any) {
    console.error('Printing error:', error);
    Toast.show({
      type: 'error',
      text1: 'Printing Error',
      text2: error?.message || 'An unexpected error occurred while printing.',
    });
    return false;
  }
};
