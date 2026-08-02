import React, {useMemo} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import SalesInvoiceStatusBadge from '../Sales/SalesInvoiceStatusBadge';

export type PurchaseHistoryListItemData = {
  id?: number;
  invoice_no?: string;
  vendor_name?: string;
  document_date?: string;
  total_amount?: number | string;
  status?: 'Draft' | 'Open' | 'Posted' | 'Cancelled' | string;
  vendor_invoice_no?: string;
};

type Props = {
  item: PurchaseHistoryListItemData;
  onPress: () => void;
};

const PurchaseHistoryListItem: React.FC<Props> = ({item, onPress}) => {
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
              source={icons.company as ImageSourcePropType}
              style={[styles.leadingIcon, t.leadingIcon]}
            />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, t.title]} numberOfLines={1}>
              {item.vendor_name?.trim() || 'Vendor'}
            </Text>
            <Text style={[styles.subtitle, t.subtitle]} numberOfLines={1}>
              Invoice #{item.invoice_no || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.rightCol}>
          {item.status ? (
            <SalesInvoiceStatusBadge status={item.status} />
          ) : null}
          <Text style={[styles.amount, t.amount, styles.amountBelowBadge]}>
            {formatAmount(item.total_amount)}
          </Text>
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
          <Text style={[styles.detailLabel, t.detailLabel]}>Vendor ref.</Text>
          <Text
            style={[styles.detailValue, t.detailValue]}
            numberOfLines={1}>
            {item.vendor_invoice_no?.trim() || '—'}
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
  amountBelowBadge: {
    marginTop: 6,
  },
  amount: {
    ...FONTS.body3,
    fontWeight: '700',
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

export default PurchaseHistoryListItem;
