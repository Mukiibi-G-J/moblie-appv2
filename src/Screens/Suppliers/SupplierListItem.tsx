import React from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import {COLORS, FONTS, icons} from '../../constants';
import {formatCurrencyCompact} from '../../utils/currency';
import {useTheme} from '../../context/ThemeContext';
import {Vendor} from '../../@types/vendor';

const isProtectedGeneralVendor = (vendor: Vendor) =>
  vendor.no === 'VENDOR-000001';

interface SupplierListItemProps {
  vendor: Vendor;
  onEdit?: (vendor: Vendor) => void;
  onDelete?: (vendor: Vendor) => void;
  onBalancePress?: (vendor: Vendor) => void;
}

const SupplierListItem: React.FC<SupplierListItemProps> = ({
  vendor,
  onEdit,
  onDelete,
  onBalancePress,
}) => {
  const {colors} = useTheme();
  const isGeneralVendor = isProtectedGeneralVendor(vendor);
  const initials =
    vendor.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SU';
  const numericBalance = parseFloat(vendor.balance || '0') || 0;
  const hasBalance = Math.abs(numericBalance) > 0;
  const formattedBalance = formatCurrencyCompact(numericBalance);
  const secondaryLine =
    vendor.phone || vendor.email || vendor.no || vendor.city || 'No contact info';

  const handleOpenActions = () => {
    const options: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [];

    if (onEdit && !isGeneralVendor) {
      options.push({
        text: 'Edit supplier',
        onPress: () => onEdit(vendor),
      });
    }

    if (onDelete && !isGeneralVendor) {
      options.push({
        text: 'Delete supplier',
        style: 'destructive',
        onPress: () => onDelete(vendor),
      });
    }

    options.push({text: 'Cancel', style: 'cancel'});

    if (options.length === 1) {
      Alert.alert(
        vendor.name || 'Supplier',
        'The General Vendor cannot be edited or deleted.',
        options,
      );
      return;
    }

    Alert.alert(vendor.name || 'Supplier', 'Choose an action', options);
  };

  return (
    <TouchableOpacity
      activeOpacity={onEdit && !isGeneralVendor ? 0.8 : 1}
      style={[styles.container, {borderBottomColor: colors.border}]}
      onPress={onEdit && !isGeneralVendor ? () => onEdit(vendor) : undefined}>
      <View style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.vendorName, {color: colors.textPrimary}]}
          numberOfLines={1}>
          {vendor.name}
        </Text>
        <Text
          style={[styles.secondaryText, {color: colors.textSecondary}]}
          numberOfLines={1}>
          {secondaryLine}
        </Text>
        <TouchableOpacity
          disabled={!hasBalance || !onBalancePress}
          onPress={() => onBalancePress?.(vendor)}
          activeOpacity={hasBalance ? 0.7 : 1}
          style={styles.balanceLinkWrap}>
          <Text
            style={[
              styles.balanceText,
              hasBalance
                ? styles.balanceTextInteractive
                : {color: colors.textSecondary},
            ]}>
            Balance: {formattedBalance}
          </Text>
        </TouchableOpacity>
        {vendor.blocked ? (
          <View style={styles.blockedBadge}>
            <Text style={styles.blockedBadgeText}>Blocked</Text>
          </View>
        ) : null}
      </View>

      {(onEdit || onDelete) && (
        <TouchableOpacity
          onPress={handleOpenActions}
          style={[styles.actionButton, {backgroundColor: colors.backButtonBg}]}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Image
            source={icons.menu}
            style={[styles.actionIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: COLORS.primary3,
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  vendorName: {
    ...FONTS.body2,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  secondaryText: {
    ...FONTS.body4,
    fontSize: 13,
  },
  balanceLinkWrap: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  balanceText: {
    ...FONTS.body4,
    fontSize: 13,
  },
  balanceTextInteractive: {
    color: COLORS.primary2,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  blockedBadge: {
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  blockedBadgeText: {
    ...FONTS.body5,
    color: COLORS.error,
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 16,
    height: 16,
  },
});

export default SupplierListItem;
