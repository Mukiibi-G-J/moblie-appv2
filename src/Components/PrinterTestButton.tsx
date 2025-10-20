import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {COLORS, FONTS, SIZES} from '../constants';
import Toast from 'react-native-toast-message';
import PrintService from '../services/PrintService';

const PrinterTestButton: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);

  const testPrinter = async () => {
    setIsTesting(true);

    try {
      console.log('🔧 Starting printer test with PrintService...');

      // Get print service instance
      const printService = PrintService.getInstance();
      console.log('✅ PrintService instance obtained');

      // Create test receipt data
      const testReceiptData = {
        cartItems: [
          {
            item_name: 'Test Item 1',
            quantity: 2,
            unit_price: 1000,
            date_sold: new Date().toISOString(),
            bar_code_no: 'TEST001',
          },
          {
            item_name: 'Test Item 2',
            quantity: 1,
            unit_price: 1500,
            date_sold: new Date().toISOString(),
            bar_code_no: 'TEST002',
          },
        ],
        total: 3500,
        username: 'Test User',
        receiptId: 'TEST-' + Date.now(),
        saleDate: new Date().toLocaleString(),
        subtotal: 3500,
        tax: 0,
        discount: 0,
        paymentMethod: 'Cash',
        change: 0,
        customerName: 'Test Customer',
      };

      console.log('📋 Test receipt data prepared:', testReceiptData);

      // Print the test receipt
      console.log('🖨️ Attempting to print test receipt...');
      const success = await printService.printReceipt(testReceiptData);

      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Printer Test Success!',
          text2: 'Test receipt printed successfully',
        });

        console.log('✅ Printer test completed successfully');
      } else {
        throw new Error('Print service returned false');
      }
    } catch (error: any) {
      console.error('❌ Printer test failed:', error);

      Toast.show({
        type: 'error',
        text1: 'Printer Test Failed',
        text2: error?.message || 'Failed to test printer',
      });

      Alert.alert(
        'Printer Test Failed',
        `Error: ${
          error?.message || 'Unknown error'
        }\n\nTroubleshooting:\n1. Check if printer is connected\n2. Make sure printer has paper\n3. Try restarting device\n4. Check app permissions\n5. Verify printer service is enabled`,
        [{text: 'OK'}],
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.testButton, isTesting && styles.testingButton]}
        onPress={testPrinter}
        disabled={isTesting}>
        {isTesting ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : (
          <Text style={styles.testButtonText}>Test Printer</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.helpText}>
        Using PrintService (same as working receipt printing)
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SIZES.padding,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.radius,
    borderRadius: SIZES.radius,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testingButton: {
    opacity: 0.7,
  },
  testButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  helpText: {
    ...FONTS.body5,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.radius,
  },
});

export default PrinterTestButton;
