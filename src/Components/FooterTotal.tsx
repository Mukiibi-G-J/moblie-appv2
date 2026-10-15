import React from 'react';
import {formatCurrencyCompact, getLocalCurrencyCode} from '../utils/currency';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONTS, COLORS, ICON_BUTTON_QUICK_PRESS} from '../constants';
import {useTheme} from '../context/ThemeContext';

interface FooterTotalProps {
  subTotal: number;
  totalQuantity: number;
  total: number;
  isLoading: boolean;
  onPress: () => void;
  printReceipt: boolean;
  setPrintReceipt: (value: boolean) => void;
  /** When true, checkout stays disabled even if the cart has items (e.g. no sales permission). */
  checkoutBlocked?: boolean;
  /**
   * When true (Make Sale tab), skip extra safe-area bottom padding —
   * the tab bar already clears the home indicator.
   */
  embeddedInTabBar?: boolean;
}

const FooterTotal: React.FC<FooterTotalProps> = ({
  subTotal: _subTotal,
  totalQuantity,
  total,
  isLoading,
  onPress,
  printReceipt: _printReceipt,
  setPrintReceipt: _setPrintReceipt,
  checkoutBlocked = false,
  embeddedInTabBar = false,
}) => {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const disabled = isLoading || totalQuantity === 0 || checkoutBlocked;
  const bottomPad = embeddedInTabBar
    ? 10
    : Math.max(insets.bottom, 12);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
          paddingBottom: bottomPad,
        },
      ]}>
      <Pressable
        {...ICON_BUTTON_QUICK_PRESS}
        accessibilityRole="button"
        accessibilityLabel={`Charge ${getLocalCurrencyCode()} ${
          total?.toLocaleString() || '0'
        }`}
        disabled={disabled}
        android_ripple={
          Platform.OS === 'android' && !disabled
            ? {color: 'rgba(255,255,255,0.22)', foreground: true}
            : undefined
        }
        style={({pressed}) => [
          styles.checkoutButton,
          disabled && styles.disabledButton,
          !disabled && pressed && styles.checkoutButtonPressed,
        ]}
        onPress={onPress}>
        {isLoading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <Text style={styles.checkoutButtonText}>
              Charge {formatCurrencyCompact(total || 0)}
            </Text>
            <Text style={styles.checkoutButtonSubtext}>
              {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary2,
    minHeight: 64,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  checkoutButtonPressed: {
    opacity: 0.88,
    transform: [{scale: 0.992}],
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
