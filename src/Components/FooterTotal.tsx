import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {FONTS, SIZES, COLORS} from '../constants';

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
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.checkoutButton,
          (isLoading || totalQuantity === 0) && styles.disabledButton,
        ]}
        onPress={onPress}
        disabled={isLoading || totalQuantity === 0}>
        {isLoading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <Text style={styles.checkoutButtonText}>
              Charge USh{total?.toLocaleString() || '0'}
            </Text>
            <Text style={styles.checkoutButtonSubtext}>
              {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: COLORS.white,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary2,
    minHeight: 64,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutButtonText: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: '700',
  },
  checkoutButtonSubtext: {
    ...FONTS.body5,
    color: COLORS.white,
    marginTop: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default FooterTotal;
