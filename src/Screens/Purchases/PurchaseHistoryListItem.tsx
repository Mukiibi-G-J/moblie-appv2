import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';
import {COLORS, FONTS, icons} from '../../constants';
import {formatCurrencyCompact} from '../../utils/currency';
import {useTheme} from '../../context/ThemeContext';
import ChooseActionSheet, {
  type ChooseActionItem,
} from '../../Components/ChooseActionSheet';

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

const PurchaseHistoryListItem: React.FC<Props> = ({item, onPress}) => {
  const {colors} = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const statusLower = String(item.status || '').toLowerCase();
  const isOpenish = statusLower === 'open' || statusLower === 'draft';
  const title = item.vendor_name?.trim() || 'Vendor';

  const initials =
    title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'PU';

  const invoiceLabel = item.invoice_no ? `#${item.invoice_no}` : null;
  const vendorRef = item.vendor_invoice_no?.trim() || null;
  const secondaryLine = [invoiceLabel, vendorRef, formatDate(item.document_date)]
    .filter(Boolean)
    .join(' · ');

  const amountText = formatCurrencyCompact(
    Number.isFinite(Number(item.total_amount)) ? Number(item.total_amount) : 0,
  );
  const statusLabel = item.status?.trim() || '—';

  const actionItems = useMemo(
    (): ChooseActionItem[] => [
      {
        key: 'open',
        label: isOpenish ? 'Edit purchase' : 'View details',
        onPress,
      },
    ],
    [isOpenish, onPress],
  );

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
            isOpenish ? styles.metaTextOpen : {color: colors.textSecondary},
          ]}>
          {amountText} · {statusLabel}
        </Text>
      </View>

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

export default PurchaseHistoryListItem;

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
