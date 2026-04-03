import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {FONTS, SIZES} from '../../constants';
import type {SemanticColors} from '../../theme/semanticColors';

export type ItemJournalLine = {
  id: number;
  system_id: string;
  item: string;
  item_name: string;
  entry_type: string;
  document_no: string;
  description: string;
  quantity: number;
  unit_cost: number | null;
  date: string;
  status: string;
  /** ItemUnitOfMeasure PK from API */
  item_unit_of_measure?: number | null;
  /** UOM code for display (from unit_of_measure_detail) */
  unit_of_measure_code?: string;
};

const ENTRY_LABELS: Record<string, string> = {
  Purchase: 'Purchase',
  Sales: 'Sales',
  PositiveAdjustment: 'Positive adjustment',
  NegativeAdjustment: 'Negative adjustment',
  DirectCost: 'Direct cost',
};

function entryTypeLabel(entryType: string): string {
  return ENTRY_LABELS[entryType] || entryType.replace(/([A-Z])/g, ' $1').trim();
}

type Props = {
  line: ItemJournalLine;
  colors: SemanticColors;
  onPress: () => void;
  onPost: () => void;
  /** Tap row to edit (parent enforces Open-only). */
  canOpenLine: boolean;
  canPost: boolean;
};

const ItemJournalListItem: React.FC<Props> = ({
  line,
  colors,
  onPress,
  onPost,
  canOpenLine,
  canPost,
}) => {
  const isOpen = line.status === 'Open';
  const cost = line.unit_cost != null ? String(line.unit_cost) : '—';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        !canOpenLine && styles.cardDisabled,
      ]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!canOpenLine}>
        <View style={styles.topRow}>
          <Text style={[styles.docNo, {color: colors.textPrimary}]} numberOfLines={1}>
            {line.document_no}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  line.status === 'Open'
                    ? 'rgba(76, 175, 80, 0.15)'
                    : colors.screenMuted,
              },
            ]}>
            <Text
              style={[
                styles.badgeText,
                {color: line.status === 'Open' ? '#2E7D32' : colors.textSecondary},
              ]}>
              {line.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.itemName, {color: colors.textPrimary}]} numberOfLines={2}>
          {line.item_name}
        </Text>
        <Text style={[styles.meta, {color: colors.textSecondary}]}>
          {entryTypeLabel(line.entry_type)}
          {line.date ? ` · ${line.date}` : ''}
        </Text>
        <View style={styles.qtyRow}>
          <Text style={[styles.qtyLabel, {color: colors.textSecondary}]}>Qty</Text>
          <Text style={[styles.qtyValue, {color: colors.textPrimary}]}>
            {line.quantity}
            {line.unit_of_measure_code ? ` ${line.unit_of_measure_code}` : ''}
          </Text>
          <Text style={[styles.qtyLabel, {color: colors.textSecondary}, styles.costPad]}>
            Cost
          </Text>
          <Text style={[styles.qtyValue, {color: colors.textPrimary}]}>{cost}</Text>
        </View>
      </TouchableOpacity>
      {isOpen && canPost ? (
        <TouchableOpacity
          style={[styles.postBtn, {borderColor: colors.border}]}
          onPress={onPost}
          activeOpacity={0.65}>
          <Text style={[styles.postBtnText, {color: colors.textPrimary}]}>Post</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default ItemJournalListItem;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SIZES.padding,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardDisabled: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  docNo: {
    ...FONTS.h3,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    ...FONTS.body5,
    fontSize: 11,
    fontWeight: '700',
  },
  itemName: {
    ...FONTS.body3,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    ...FONTS.body4,
    fontSize: 13,
    marginBottom: 10,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyLabel: {
    ...FONTS.body4,
    fontSize: 13,
  },
  qtyValue: {
    ...FONTS.body3,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  costPad: {
    marginLeft: 16,
  },
  postBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  postBtnText: {
    ...FONTS.h3,
    fontSize: 14,
    fontWeight: '700',
  },
});
