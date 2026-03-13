import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {Customer} from '../../@types/customer';

interface CustomerListItemProps {
  customer: Customer;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}

const CustomerListItem: React.FC<CustomerListItemProps> = ({
  customer,
  onEdit,
  onDelete,
}) => {
  const formatBalance = (balance?: string) => {
    if (!balance) return 'UGX 0';
    const numBalance = parseFloat(balance) || 0;
    return `UGX ${numBalance.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatCreditLimit = (creditLimit?: string) => {
    if (!creditLimit) return 'No limit';
    const numLimit = parseFloat(creditLimit) || 0;
    return `UGX ${numLimit.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.customerRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={icons.profile as ImageSourcePropType}
              style={styles.icon}
            />
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerNo}>{customer.no}</Text>
          </View>
        </View>
        <View style={styles.balanceWrapper}>
          <Text style={styles.balance}>{formatBalance(customer.balance)}</Text>
          {customer.balance && parseFloat(customer.balance) > 0 && (
            <View style={styles.balanceBadge}>
              <Text style={styles.balanceBadgeText}>Outstanding</Text>
            </View>
          )}
        </View>
      </View>

      {(customer.contact || customer.phone_number || customer.city) && (
        <View style={styles.detailsRow}>
          {customer.contact && (
            <>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Contact</Text>
                <Text style={styles.detailValue}>{customer.contact}</Text>
              </View>
              {(customer.phone_number || customer.city) && (
                <View style={styles.detailDivider} />
              )}
            </>
          )}
          {customer.phone_number && (
            <>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{customer.phone_number}</Text>
              </View>
              {customer.city && <View style={styles.detailDivider} />}
            </>
          )}
          {customer.city && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>City</Text>
              <Text style={styles.detailValue}>{customer.city}</Text>
            </View>
          )}
        </View>
      )}

      {customer.credit_limit && (
        <View style={styles.creditLimitRow}>
          <Text style={styles.creditLimitLabel}>Credit Limit:</Text>
          <Text style={styles.creditLimitValue}>
            {formatCreditLimit(customer.credit_limit)}
          </Text>
        </View>
      )}

      {(onEdit || (onDelete && customer.name?.toLowerCase() !== 'general')) && (
        <View style={styles.actionsRow}>
          {onEdit && (
            <TouchableOpacity
              style={[styles.actionChip, styles.editChip]}
              onPress={() => onEdit(customer)}>
              <Text style={styles.actionChipText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && customer.name?.toLowerCase() !== 'general' && (
            <TouchableOpacity
              style={[styles.actionChip, styles.deleteChip]}
              onPress={() => onDelete(customer)}>
              <Text style={styles.actionChipText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    marginHorizontal: SIZES.base * 2,
    marginVertical: SIZES.base * 0.75,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.5,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.base * 0.75,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base * 0.75,
  },
  icon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    ...FONTS.body2,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 2,
    fontSize: 16,
  },
  customerNo: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontSize: 13,
  },
  balanceWrapper: {
    alignItems: 'flex-end',
  },
  balance: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 18,
  },
  balanceBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  balanceBadgeText: {
    ...FONTS.body5,
    color: '#92400E',
    fontSize: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.base * 0.75,
    paddingTop: SIZES.base * 0.75,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    ...FONTS.body5,
    color: COLORS.gray2,
    marginBottom: 2,
    fontSize: 12,
  },
  detailValue: {
    ...FONTS.body4,
    color: COLORS.black,
    fontSize: 13,
  },
  detailDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.lightGray2,
    marginHorizontal: SIZES.base,
  },
  creditLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.base * 0.5,
    paddingTop: SIZES.base * 0.5,
  },
  creditLimitLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginRight: SIZES.base * 0.5,
    fontSize: 12,
  },
  creditLimitValue: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '500',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: SIZES.base * 0.75,
    paddingTop: SIZES.base * 0.75,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    gap: SIZES.base * 0.5,
  },
  actionChip: {
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: SIZES.radius,
    minWidth: 55,
    alignItems: 'center',
  },
  editChip: {
    backgroundColor: COLORS.primary2 + '15',
  },
  deleteChip: {
    backgroundColor: COLORS.error + '15',
  },
  actionChipText: {
    ...FONTS.body4,
    fontWeight: '600',
    fontSize: 13,
  },
});

export default CustomerListItem;





