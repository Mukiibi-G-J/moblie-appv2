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
import {Expense} from '../../@types/expense';
import {useTheme} from '../../context/ThemeContext';

interface ExpenseListItemProps {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onPost?: (expense: Expense) => void;
}

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

const ExpenseListItem: React.FC<ExpenseListItemProps> = ({
  expense,
  onEdit,
  onDelete,
  onPost,
}) => {
  const {colors} = useTheme();
  const isOpen = expense.status === 'Open';
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
  const canOpenActions = !!(onEdit || onPost || onDelete);

  const handleOpenActions = () => {
    const options: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [];

    if (onEdit && isOpen) {
      options.push({
        text: 'Edit expense',
        onPress: () => onEdit(expense),
      });
    }

    if (onPost && isOpen) {
      options.push({
        text: 'Post expense',
        onPress: () => onPost(expense),
      });
    }

    if (onDelete && isOpen) {
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(expense),
      });
    }

    options.push({text: 'Cancel', style: 'cancel'});

    if (options.length === 1) {
      Alert.alert(expense.document_no || 'Expense', 'No actions available.', options);
      return;
    }

    Alert.alert(title, 'Choose an action', options);
  };

  return (
    <TouchableOpacity
      activeOpacity={onEdit && isOpen ? 0.8 : 1}
      style={[styles.container, {borderBottomColor: colors.border}]}
      onPress={onEdit && isOpen ? () => onEdit(expense) : undefined}>
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
          ]}>
          {amountText} · {expense.status}
        </Text>
      </View>

      {canOpenActions && (
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
