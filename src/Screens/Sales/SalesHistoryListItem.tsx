import React, {useMemo} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import SalesInvoiceStatusBadge from './SalesInvoiceStatusBadge';

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

const SalesHistoryListItem: React.FC<Props> = ({
  item,
  onPress,
  onPrintPress,
  onPostPress,
  onEditInPosPress,
  posting = false,
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
      title: {color: colors.textPrimary},
      subtitle: {color: colors.textSecondary},
      amount: {color: colors.textPrimary},
      metaRow: {borderTopColor: colors.border},
      metaDivider: {backgroundColor: colors.border},
      detailLabel: {color: colors.textSecondary},
      detailValue: {color: colors.textPrimary},
    }),
    [colors],
  );

  const formatAmount = (raw: unknown) => {
    const n = Number(raw);
    const amount = Number.isFinite(n) ? n : 0;
    return formatCurrencyCompact(amount);
  };

  const statusLower = String(item.status || '').toLowerCase();
  const isPosted =
    statusLower === 'posted' && !item.reversed && onPrintPress;
  const canPost =
    (statusLower === 'open' || statusLower === 'draft') &&
    !item.reversed &&
    onPostPress;
  const canEditInPos =
    (statusLower === 'open' || statusLower === 'draft') &&
    !item.reversed &&
    onEditInPosPress;

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return '—';
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

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.container, t.container]}
      onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={styles.leftCol}>
          <View style={[styles.iconWrap, t.iconWrap]}>
            <Image
              source={icons.cart as ImageSourcePropType}
              style={[styles.leadingIcon, t.leadingIcon]}
            />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, t.title, item.reversed && styles.reversedText]} numberOfLines={1}>
              {item.customer_name?.trim() || 'Walk-in customer'}
            </Text>
            <Text style={[styles.subtitle, t.subtitle, item.reversed && styles.reversedText]} numberOfLines={1}>
              Invoice #{item.invoice_no || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.rightCol}>
          <View style={styles.badgeRow}>
            {item.reversed ? (
              <SalesInvoiceStatusBadge status="Reversed" />
            ) : item.status ? (
              <SalesInvoiceStatusBadge status={item.status} />
            ) : null}
          </View>
          <View style={styles.amountRow}>
            {canEditInPos ? (
              <TouchableOpacity
                style={[styles.editPosHit, t.iconWrap]}
                onPress={onEditInPosPress}
                disabled={posting}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel="Edit in POS">
                <Image
                  source={icons.cart as ImageSourcePropType}
                  style={[styles.printIcon, {tintColor: COLORS.primary}]}
                />
              </TouchableOpacity>
            ) : null}
            {canPost ? (
              <TouchableOpacity
                style={[styles.postHit, {backgroundColor: COLORS.primary}]}
                onPress={onPostPress}
                disabled={posting}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel="Post sale">
                {posting ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.postHitText}>Post</Text>
                )}
              </TouchableOpacity>
            ) : null}
            {isPosted ? (
              <TouchableOpacity
                style={[styles.printHit, t.iconWrap]}
                onPress={onPrintPress}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel="Print receipt">
                <Image
                  source={icons.printer as ImageSourcePropType}
                  style={[styles.printIcon, t.leadingIcon]}
                />
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.amount, t.amount, item.reversed && styles.reversedText]}>
              {formatAmount(item.total_amount)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.metaRow, t.metaRow]}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, t.detailLabel]}>Date</Text>
          <Text style={[styles.detailValue, t.detailValue]}>
            {formatDate(item.document_date)}
          </Text>
        </View>
        <View style={[styles.metaDivider, t.metaDivider]} />
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, t.detailLabel]}>Payment</Text>
          <Text
            style={[styles.detailValue, t.detailValue]}
            numberOfLines={1}>
            {salesHistoryPaymentLabel(item)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base,
  },
  leadingIcon: {
    width: 20,
    height: 20,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: SIZES.base,
  },
  title: {
    ...FONTS.body3,
    fontWeight: '700',
    fontSize: 16,
  },
  subtitle: {
    ...FONTS.body4,
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  printHit: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  printIcon: {
    width: 18,
    height: 18,
  },
  postHit: {
    minWidth: 52,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  postHitText: {
    ...FONTS.body5,
    color: COLORS.white,
    fontWeight: '700',
  },
  editPosHit: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  amount: {
    ...FONTS.body3,
    fontWeight: '700',
  },
  reversedText: {
    color: '#B42318',
    textDecorationLine: 'line-through',
    opacity: 0.85,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.base,
    paddingTop: SIZES.base,
    borderTopWidth: 1,
  },
  detailItem: {
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: SIZES.base,
  },
  detailLabel: {
    ...FONTS.body5,
  },
  detailValue: {
    ...FONTS.body4,
    marginTop: 2,
    fontWeight: '600',
  },
});

export default SalesHistoryListItem;
