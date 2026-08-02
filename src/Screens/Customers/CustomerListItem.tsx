import React from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {Customer} from '../../@types/customer';
import {formatCurrencyCompact} from '../../utils/currency';

const isProtectedGeneralCustomer = (customer: Customer) => {
  const normalizedName = customer.name?.trim().toLowerCase();
  return normalizedName === 'general' || normalizedName === 'general customer';
};

interface CustomerListItemProps {
  customer: Customer;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onBalancePress?: (customer: Customer) => void;
}

const CustomerListItem: React.FC<CustomerListItemProps> = ({
  customer,
  onEdit,
  onDelete,
  onBalancePress,
}) => {
  const isGeneralCustomer = isProtectedGeneralCustomer(customer);
  const initials =
    customer.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CU';
  const numericBalance = parseFloat(customer.balance || '0') || 0;
  const hasBalance = Math.abs(numericBalance) > 0;
  const formattedBalance = formatCurrencyCompact(numericBalance);

  const secondaryLine =
    customer.phone_number ||
    customer.contact ||
    customer.no ||
    customer.city ||
    'No phone number';

  const handleOpenActions = () => {
    const options: Array<{text: string; style?: 'cancel' | 'destructive'; onPress?: () => void}> = [];

    if (onEdit && !isGeneralCustomer) {
      options.push({
        text: 'Edit customer',
        onPress: () => onEdit(customer),
      });
    }

    if (onDelete && !isGeneralCustomer) {
      options.push({
        text: 'Delete customer',
        style: 'destructive',
        onPress: () => onDelete(customer),
      });
    }

    options.push({text: 'Cancel', style: 'cancel'});

    if (options.length === 1) {
      Alert.alert(
        customer.name || 'Customer',
        'The General Customer cannot be edited or deleted.',
        options,
      );
      return;
    }

    Alert.alert(customer.name || 'Customer', 'Choose an action', options);
  };

  return (
    <TouchableOpacity
      activeOpacity={onEdit && !isGeneralCustomer ? 0.8 : 1}
      style={styles.container}
      onPress={onEdit && !isGeneralCustomer ? () => onEdit(customer) : undefined}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.customerName} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={styles.secondaryText} numberOfLines={1}>
          {secondaryLine}
        </Text>
        <TouchableOpacity
          disabled={!hasBalance || !onBalancePress}
          onPress={() => onBalancePress?.(customer)}
          activeOpacity={hasBalance ? 0.7 : 1}
          style={styles.balanceLinkWrap}>
          <Text
            style={[
              styles.balanceText,
              hasBalance ? styles.balanceTextInteractive : styles.balanceTextMuted,
            ]}>
            Balance: {formattedBalance}
          </Text>
        </TouchableOpacity>
      </View>

      {(onEdit || onDelete) && (
        <TouchableOpacity
          onPress={handleOpenActions}
          style={styles.actionButton}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Image source={icons.menu} style={styles.actionIcon} resizeMode="contain" />
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
    borderBottomColor: COLORS.lightGray1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.transparentPrimary,
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
  customerName: {
    ...FONTS.body2,
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  secondaryText: {
    ...FONTS.body4,
    color: COLORS.gray2,
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
  balanceTextMuted: {
    color: COLORS.gray2,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary3,
  },
});

export default CustomerListItem;





