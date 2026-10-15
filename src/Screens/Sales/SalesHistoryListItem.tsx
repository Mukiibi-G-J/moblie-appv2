import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import {COLORS, FONTS, icons} from '../../constants';
import {formatCurrencyCompact} from '../../utils/currency';
import {useTheme} from '../../context/ThemeContext';
import ChooseActionSheet, {
  type ChooseActionItem,
} from '../../Components/ChooseActionSheet';

export type SalesHistoryListItemData = {
  id?: number;
  invoice_no?: string;
  customer_name?: string;
  document_date?: string;
  /** API may return number or numeric string */
  total_amount?: number | string;
  payment_method_name?: string;
  /** List API: Paid / Not Paid Yet / Fully Paid when method name is absent */
  payment_status?: string;
  status?: 'Draft' | 'Open' | 'Posted' | 'Cancelled' | string;
  reversed?: boolean;
  reversed_by_user?: string | null;
  reversed_date?: string | null;
};

export function salesHistoryPaymentLabel(item: {
  payment_method_name?: string;
  payment_status?: string;
}): string {
  const method = item.payment_method_name?.trim();
  if (method) {
    return method;
  }
  const status = item.payment_status?.trim();
  if (status && status !== 'Not Paid Yet') {
    return status;
  }
  return '—';
}

type Props = {
  item: SalesHistoryListItemData;
  onPress: () => void;
  /** Shown for posted invoices only when provided (e.g. reprint receipt). */
  onPrintPress?: () => void;
  /** Shown for Open/Draft invoices when provided. */
  onPostPress?: () => void;
  /** Load into Make Sale cart (edit lot/qty/lines). */
  onEditInPosPress?: () => void;
  posting?: boolean;
};

const formatDate = (dateString?: string) => {
  if (!dateString) {
    return null;
  }
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const SalesHistoryListItem: React.FC<Props> = ({
  item,
  onPress,
  onPrintPress,
  onPostPress,
  onEditInPosPress,
  posting = false,
}) => {
  const {colors} = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const statusLower = String(item.status || '').toLowerCase();
  const isOpenish =
    (statusLower === 'open' || statusLower === 'draft') && !item.reversed;
  const title = item.customer_name?.trim() || 'Walk-in customer';

  const initials =
    title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SL';

  const invoiceLabel = item.invoice_no ? `#${item.invoice_no}` : null;
  const paymentLabel = salesHistoryPaymentLabel(item);
  const secondaryLine = [
    invoiceLabel,
    paymentLabel !== '—' ? paymentLabel : null,
    formatDate(item.document_date),
  ]
    .filter(Boolean)
    .join(' · ');

  const amountText = formatCurrencyCompact(
    Number.isFinite(Number(item.total_amount)) ? Number(item.total_amount) : 0,
  );
  const statusLabel = item.reversed
    ? 'Reversed'
    : item.status?.trim() || '—';

  const canEditInPos = !!onEditInPosPress && isOpenish;
  const canPost = !!onPostPress && isOpenish;
  const canPrint =
    !!onPrintPress && statusLower === 'posted' && !item.reversed;
  const canOpenActions = canEditInPos || canPost || canPrint;

  const actionItems = useMemo(() => {
    const items: ChooseActionItem[] = [
      {
        key: 'view',
        label: 'View details',
        onPress,
      },
    ];
    if (canEditInPos && onEditInPosPress) {
      items.push({
        key: 'edit',
        label: 'Edit in POS',
        onPress: onEditInPosPress,
      });
    }
    if (canPost && onPostPress) {
      items.push({
        key: 'post',
        label: 'Post sale',
        onPress: onPostPress,
      });
    }
    if (canPrint && onPrintPress) {
      items.push({
        key: 'print',
        label: 'Print receipt',
        onPress: onPrintPress,
      });
    }
    return items;
  }, [canEditInPos, canPost, canPrint, onEditInPosPress, onPostPress, onPrintPress, onPress]);

  return (
    <View>
      <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.container, {borderBottomColor: colors.border}]}
      onPress={onPress}>
      <View style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {color: colors.textPrimary},
            item.reversed && styles.reversedText,
          ]}
          numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[
            styles.secondaryText,
            {color: colors.textSecondary},
            item.reversed && styles.reversedText,
          ]}
          numberOfLines={1}>
          {secondaryLine}
        </Text>
        <Text
          style={[
            styles.metaText,
            isOpenish
              ? styles.metaTextOpen
              : item.reversed
                ? styles.reversedText
                : {color: colors.textSecondary},
          ]}>
          {amountText} · {statusLabel}
        </Text>
      </View>

      {canOpenActions ? (
        <TouchableOpacity
          onPress={() => {
            if (!posting) {
              setActionsVisible(true);
            }
          }}
          disabled={posting}
          style={[styles.actionButton, {backgroundColor: colors.backButtonBg}]}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="button"
          accessibilityLabel="Choose an action">
          {posting ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <Image
              source={icons.menu}
              style={[styles.actionIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      ) : null}
      </TouchableOpacity>

      <ChooseActionSheet
        visible={actionsVisible}
        title={title}
        actions={actionItems}
        onClose={() => setActionsVisible(false)}
      />
    </View>
  );
};

export default SalesHistoryListItem;

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
  reversedText: {
    color: '#B42318',
    textDecorationLine: 'line-through',
    opacity: 0.85,
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
