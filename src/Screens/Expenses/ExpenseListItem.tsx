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
import {Expense} from '../../@types/expense';
import ExpenseStatusBadge from './ExpenseStatusBadge';

interface ExpenseListItemProps {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onPost?: (expense: Expense) => void;
}

const statusAccentMap: Record<string, {background: string; border: string}> = {
  Posted: {background: '#eaf7ef', border: '#bce3c7'},
  Open: {background: '#fdf8ed', border: '#f5d5a5'},
  Reversed: {background: '#fcebea', border: '#f5b1ab'},
};

const ExpenseListItem: React.FC<ExpenseListItemProps> = ({
  expense,
  onEdit,
  onDelete,
  onPost,
}) => {
  const formatAmount = (amount: number) => {
    return `UGX ${(amount || 0)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const accent = statusAccentMap[expense.status] || {
    background: COLORS.white,
    border: 'rgba(0, 0, 0, 0.08)',
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.container,
        {backgroundColor: accent.background, borderColor: accent.border},
      ]}
      onPress={() => {
        if (expense.status === 'Open' && onEdit) {
          onEdit(expense);
        }
      }}>
      <View style={styles.headerRow}>
        <View style={styles.documentRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={icons.navigator as ImageSourcePropType}
              style={styles.icon}
            />
          </View>
          <View>
            <Text style={styles.documentNo}>{expense.document_no}</Text>
            <Text style={styles.typeText}>
              {expense.expense_type_name || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.amountWrapper}>
          <ExpenseStatusBadge status={expense.status} />
          <Text style={styles.amount}>{formatAmount(expense.amount)}</Text>
        </View>
      </View>

      {expense.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {expense.description}
        </Text>
      ) : null}

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {formatDate(expense.posting_date)}
          </Text>
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Payment</Text>
          <Text style={styles.detailValue}>
            {expense.payment_method_name || '—'}
          </Text>
        </View>
      </View>

      {expense.status === 'Open' && (onEdit || onDelete || onPost) && (
        <View style={styles.actionsRow}>
          {onPost && (
            <TouchableOpacity
              style={[styles.actionChip, styles.postChip]}
              onPress={() => onPost(expense)}>
              <Text style={styles.actionChipText}>Post</Text>
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity
              style={[styles.actionChip, styles.editChip]}
              onPress={() => onEdit(expense)}>
              <Text style={styles.actionChipText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionChip, styles.deleteChip]}
              onPress={() => onDelete(expense)}>
              <Text style={styles.actionChipText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.base / 2,
    borderRadius: SIZES.radius * 1.2,
    padding: SIZES.radius,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F0F4FF',
    borderWidth: 1,
    borderColor: '#D3DBFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base,
  },
  icon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary,
  },
  documentNo: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
  },
  typeText: {
    ...FONTS.body4,
    color: COLORS.black,
    opacity: 0.7,
  },
  amountWrapper: {
    alignItems: 'flex-end',
  },
  amount: {
    ...FONTS.h3,
    color: COLORS.primary,
    marginTop: 4,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.black,
    marginTop: SIZES.base,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.base,
    paddingTop: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  detailItem: {
    flex: 1,
  },
  detailDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: SIZES.base,
  },
  detailLabel: {
    ...FONTS.body4,
    color: COLORS.black,
    opacity: 0.6,
  },
  detailValue: {
    ...FONTS.body3,
    color: COLORS.black,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SIZES.base,
  },
  actionChip: {
    paddingHorizontal: SIZES.radius * 1.2,
    paddingVertical: SIZES.base / 1.5,
    borderRadius: 999,
  },
  postChip: {
    backgroundColor: COLORS.success,
  },
  editChip: {
    backgroundColor: COLORS.primary,
  },
  deleteChip: {
    backgroundColor: COLORS.error,
  },
  actionChipText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default ExpenseListItem;
