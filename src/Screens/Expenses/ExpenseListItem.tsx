import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {formatCurrencyCompact} from '../../utils/currency';
import {Expense} from '../../@types/expense';
import ExpenseStatusBadge from './ExpenseStatusBadge';
import {useTheme} from '../../context/ThemeContext';

interface ExpenseListItemProps {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onPost?: (expense: Expense) => void;
}

const ExpenseListItem: React.FC<ExpenseListItemProps> = ({
  expense,
  onEdit,
  onDelete,
  onPost,
}) => {
  const {colors} = useTheme();
  const t = useMemo(
    () => ({
      container: {
        backgroundColor: colors.card,
        borderBottomColor: colors.border,
      },
      iconWrap: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      leadingIcon: {tintColor: colors.iconMuted},
      documentNo: {color: colors.textPrimary},
      typeText: {color: colors.textSecondary},
      amount: {color: colors.textPrimary},
      description: {color: colors.textSecondary},
      metaRow: {borderTopColor: colors.border},
      metaDivider: {backgroundColor: colors.border},
      detailLabel: {color: colors.textSecondary},
      detailValue: {color: colors.textPrimary},
    }),
    [colors],
  );

  const formatAmount = (amount: number) => formatCurrencyCompact(amount);

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

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.container, t.container]}
      onPress={() => {
        if (expense.status === 'Open' && onEdit) {
          onEdit(expense);
        }
      }}>
      <View style={styles.headerRow}>
        <View style={styles.leftCol}>
          <View style={[styles.iconWrap, t.iconWrap]}>
            <Image
              source={icons.coupon as ImageSourcePropType}
              style={[styles.leadingIcon, t.leadingIcon]}
            />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.documentNo, t.documentNo]}>{expense.document_no}</Text>
            <Text style={[styles.typeText, t.typeText]}>
              {expense.expense_type_name || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.rightCol}>
          <ExpenseStatusBadge status={expense.status} />
          <Text style={[styles.amount, t.amount]}>{formatAmount(expense.amount)}</Text>
        </View>
      </View>

      {expense.description ? (
        <Text style={[styles.description, t.description]} numberOfLines={2}>
          {expense.description}
        </Text>
      ) : null}

      <View style={[styles.metaRow, t.metaRow]}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, t.detailLabel]}>Date</Text>
          <Text style={[styles.detailValue, t.detailValue]}>
            {formatDate(expense.posting_date)}
          </Text>
        </View>
        <View style={[styles.metaDivider, t.metaDivider]} />
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, t.detailLabel]}>Payment</Text>
          <Text style={[styles.detailValue, t.detailValue]}>
            {expense.payment_method_name || '—'}
          </Text>
        </View>
      </View>

      {expense.status === 'Open' && (onEdit || onDelete || onPost) && (
        <View style={styles.actionsRow}>
          {onPost && (
            <TouchableOpacity
              style={[styles.actionChip, styles.postChip]}
              activeOpacity={0.75}
              onPress={() => onPost(expense)}>
              <Text style={styles.actionChipText}>Post</Text>
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity
              style={[styles.actionChip, styles.editChip]}
              activeOpacity={0.75}
              onPress={() => onEdit(expense)}>
              <Text style={styles.actionChipText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionChip, styles.deleteChip]}
              activeOpacity={0.75}
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
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base,
  },
  leadingIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: SIZES.base,
  },
  documentNo: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 16,
  },
  typeText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  amount: {
    ...FONTS.body3,
    color: COLORS.black,
    marginTop: 6,
    fontWeight: '700',
  },
  description: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: SIZES.base * 0.9,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.base,
    paddingTop: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  detailItem: {
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: '100%',
    backgroundColor: COLORS.lightGray1,
    marginHorizontal: SIZES.base,
  },
  detailLabel: {
    ...FONTS.body5,
    color: COLORS.gray2,
  },
  detailValue: {
    ...FONTS.body4,
    color: COLORS.black,
    marginTop: 2,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.base,
  },
  actionChip: {
    paddingHorizontal: SIZES.radius * 1.2,
    paddingVertical: SIZES.base / 1.5,
    borderRadius: 999,
    marginRight: 8,
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
