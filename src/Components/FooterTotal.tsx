import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {FONTS, SIZES, COLORS, icons, images, dummyData} from '../constants';
import TextButton from './TextButton';
import LineDivider from './LineDivider';
import CustomSwitch from './CustomSwitch';

interface FooterTotalProps {
  subTotal: number;
  totalQuantity: number;
  total: number;
  isLoading: boolean;
  onPress: () => void;
  printReceipt: boolean;
  setPrintReceipt: (value: boolean) => void;
}

const FooterTotal: React.FC<FooterTotalProps> = ({
  subTotal,
  totalQuantity,
  total,
  isLoading,
  onPress,
  printReceipt,
  setPrintReceipt,
}) => {
  const handleCheckout = () => {
    Alert.alert(
      'Confirm Sale',
      `Are you sure you want to complete this sale?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete Sale',
          onPress: onPress,
          style: 'default',
        },
      ],
      {cancelable: true},
    );
  };

  return (
    <View style={styles.container}>
      {/* Left side - Totals */}
      <View style={styles.totalsContainer}>
        <Text style={styles.totalQuantity}>{totalQuantity} items</Text>
        <Text style={styles.totalAmount}>
          UGX {total?.toLocaleString() || '0'}
        </Text>
      </View>

      {/* Right side - Actions */}
      <View style={styles.actionsContainer}>
        {/* <TouchableOpacity
          style={[
            styles.actionButton,
            printReceipt
              ? styles.printButtonActive
              : styles.printButtonInactive,
          ]}
          onPress={() => setPrintReceipt(!printReceipt)}>
          <Text
            style={[
              styles.printButtonText,
              printReceipt
                ? styles.printButtonTextActive
                : styles.printButtonTextInactive,
            ]}>
            {printReceipt ? 'Print' : 'No Print'}
          </Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.checkoutButton,
            (isLoading || totalQuantity === 0) && styles.disabledButton,
          ]}
          onPress={handleCheckout}
          disabled={isLoading || totalQuantity === 0}>
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.checkoutButtonText}>Complete Sale</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
    height: 64, // Reduced height
  },
  totalsContainer: {
    flex: 1,
  },
  totalQuantity: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 2,
  },
  totalAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printButtonActive: {
    backgroundColor: COLORS.success,
  },
  printButtonInactive: {
    backgroundColor: COLORS.lightGray2,
  },
  printButtonText: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  printButtonTextActive: {
    color: COLORS.white,
  },
  printButtonTextInactive: {
    color: COLORS.darkGray,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    minWidth: 100,
  },
  checkoutButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default FooterTotal;
