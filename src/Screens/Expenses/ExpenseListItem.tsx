import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';
import {COLORS, FONTS, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {formatCurrencyCompact} from '../../utils/currency';
import {Expense} from '../../@types/expense';
import {formatDateOnlyDisplay} from '../../utils/localDate';
import ChooseActionSheet, {
  type ChooseActionItem,
} from '../../Components/ChooseActionSheet';

interface ExpenseListItemProps {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
  onView?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onPost?: (expense: Expense) => void;
  onReverse?: (expense: Expense) => void;
}

const formatDate = (dateString: string) => formatDateOnlyDisplay(dateString);

const ExpenseListItem: React.FC<ExpenseListItemProps> = ({
  expense,
  onEdit,
  onView,
  onDelete,
  onPost,
  onReverse,
}) => {
  const {colors} = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const isOpen = expense.status === 'Open';
  const isPosted = expense.status === 'Posted';
  const isReversed = expense.status === 'Reversed';
  const openRecord = onView || onEdit;
  const title =
    expense.expense_type_name?.trim() ||
    expense.description?.trim() ||
    expense.document_no ||
    'Expense';

  const initials =
    title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'EX';

  const secondaryLine = [
    expense.document_no,
    expense.payment_method_name,
    expense.posting_date ? formatDate(expense.posting_date) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const amountText = formatCurrencyCompact(expense.amount);
  const canOpenActions = !!(onEdit || onView || onPost || onDelete || onReverse);

  const actionItems = useMemo(() => {
    const items: ChooseActionItem[] = [];
    if (onEdit && isOpen) {
      items.push({
        key: 'edit',
        label: 'Edit expense',
        onPress: () => onEdit(expense),
      });
    }
    if (onView && (isPosted || isReversed)) {
      items.push({
        key: 'view',
        label: isReversed ? 'View reversed expense' : 'View posted expense',
        onPress: () => onView(expense),
      });
    }
    if (onPost && isOpen) {
      items.push({
        key: 'post',
        label: 'Post expense',
        onPress: () => onPost(expense),
      });
    }
    if (onReverse && isPosted) {
      items.push({
        key: 'reverse',
        label: 'Reverse entries',
        onPress: () => onReverse(expense),
      });
    }
    if (onDelete && isOpen) {
      items.push({
        key: 'remove',
        label: 'Delete',
        destructive: true,
        onPress: () => onDelete(expense),
      });
    }
    return items;
  }, [expense, isOpen, isPosted, isReversed, onDelete, onEdit, onPost, onReverse, onView]);

  const closeActions = () => setActionsVisible(false);

  const handlePress = () => {
    if (isOpen && onEdit) {
      onEdit(expense);
      return;
    }
    if ((isPosted || isReversed) && openRecord) {
      openRecord(expense);
    }
  };

  const canTap = (isOpen && !!onEdit) || ((isPosted || isReversed) && !!openRecord);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={canTap ? 0.8 : 1}
        style={[styles.container, {borderBottomColor: colors.border}]}
        onPress={canTap ? handlePress : undefined}>
        <View style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.content}>
          <Text
            style={[styles.title, {color: colors.textPrimary}]}
            numberOfLines={1}>
            {title}
          </Text>
          <Text
            style={[styles.secondaryText, {color: colors.textSecondary}]}
            numberOfLines={1}>
            {secondaryLine}
          </Text>
          <Text
            style={[
              styles.metaText,
              isOpen ? styles.metaTextOpen : {color: colors.textSecondary},
              isReversed ? styles.metaTextReversed : null,
            ]}>
            {amountText} · {expense.status}
          </Text>
        </View>

        {canOpenActions && (
          <TouchableOpacity
            onPress={() => setActionsVisible(true)}
            style={[styles.actionButton, {backgroundColor: colors.backButtonBg}]}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel="Choose an action">
            <Image
              source={icons.menu}
              style={[styles.actionIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ChooseActionSheet
        visible={actionsVisible}
        title={title}
        actions={actionItems}
        onClose={closeActions}
      />
    </View>
  );
};

export default ExpenseListItem;

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
  title: {
    ...FONTS.body2,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  secondaryText: {
    ...FONTS.body4,
    fontSize: 13,
  },
  metaText: {
    ...FONTS.body4,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  metaTextOpen: {
    color: COLORS.primary2,
  },
  metaTextReversed: {
    color: COLORS.error,
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
