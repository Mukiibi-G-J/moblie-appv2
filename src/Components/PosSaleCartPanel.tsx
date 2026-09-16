import React, {useMemo} from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {CartItem} from '../@types/types.dto';
import {
  COLORS,
  FONTS,
  ICON_BUTTON_HIT_SLOP,
  ICON_BUTTON_QUICK_PRESS,
  icons,
} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {formatCurrencyCompact} from '../utils/currency';
import {QuickIconPressable} from './QuickIconPressable';
import FooterTotal from './FooterTotal';

type PosSaleCartPanelProps = {
  items: CartItem[];
  customerLabel: string;
  customerSubtitle: string;
  onPressCustomer: () => void;
  onPressLine: (item: CartItem) => void;
  onChangeQuantity: (item: CartItem, delta: number) => void;
  onRemoveLine: (item: CartItem) => void;
  onCharge: () => void;
  onClear?: () => void;
  canMutate: boolean;
  canModify: boolean;
  canCharge: boolean;
  isLoading: boolean;
  printReceipt: boolean;
  setPrintReceipt: (value: boolean) => void;
};

export function PosSaleCartPanel({
  items,
  customerLabel,
  customerSubtitle,
  onPressCustomer,
  onPressLine,
  onChangeQuantity,
  onRemoveLine,
  onCharge,
  onClear,
  canMutate,
  canModify,
  canCharge,
  isLoading,
  printReceipt,
  setPrintReceipt,
}: PosSaleCartPanelProps) {
  const {colors, isDark} = useTheme();
  const quantity = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items],
  );
  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0,
      ),
    [items],
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          borderLeftColor: colors.border,
        },
      ]}>
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Current sale ({items.length})
        </Text>
        {onClear && items.length > 0 && canModify ? (
          <QuickIconPressable
            accessibilityLabel="Clear sale"
            hitSlop={ICON_BUTTON_HIT_SLOP}
            onPress={onClear}>
            <Text style={styles.clearText}>Clear</Text>
          </QuickIconPressable>
        ) : null}
      </View>

      <Pressable
        {...ICON_BUTTON_QUICK_PRESS}
        disabled={!canMutate}
        onPress={onPressCustomer}
        style={[
          styles.customerRow,
          {
            backgroundColor: isDark
              ? 'rgba(0, 81, 81, 0.14)'
              : COLORS.transparentPrimary2,
          },
        ]}>
        <View style={[styles.customerIconWrap, {backgroundColor: colors.surface}]}>
          <Image source={icons.profile} style={styles.customerIcon} />
        </View>
        <View style={styles.customerTextWrap}>
          <Text style={styles.customerTitle} numberOfLines={1}>
            {customerLabel}
          </Text>
          <Text
            style={[styles.customerSubtitle, {color: colors.textSecondary}]}
            numberOfLines={1}>
            {customerSubtitle}
          </Text>
        </View>
        <Image source={icons.down_arrow} style={styles.chevron} />
      </Pressable>

      <FlatList
        data={items}
        keyExtractor={item => String(item.system_id)}
        style={styles.list}
        contentContainerStyle={
          items.length === 0 ? styles.emptyContent : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, {color: colors.textSecondary}]}>
              No items in sale
            </Text>
            <Text style={[styles.emptySub, {color: colors.textSecondary}]}>
              Tap products on the left to add them.
            </Text>
          </View>
        }
        renderItem={({item}) => {
          const qty = Number(item.quantity) || 1;
          const lineTotal = qty * (Number(item.unit_price) || 0);
          return (
            <View style={[styles.line, {borderBottomColor: colors.border}]}>
              <Pressable
                {...ICON_BUTTON_QUICK_PRESS}
                onPress={() => onPressLine(item)}
                style={styles.lineMain}>
                <Text
                  style={[styles.lineName, {color: colors.textPrimary}]}
                  numberOfLines={2}>
                  {item.item_name}
                </Text>
                <Text style={[styles.lineMeta, {color: colors.textSecondary}]}>
                  {formatCurrencyCompact(Number(item.unit_price) || 0)}
                  {item.unit_of_measure ? ` · ${item.unit_of_measure}` : ''}
                </Text>
              </Pressable>
              <View style={styles.lineActions}>
                {canModify ? (
                  <View
                    style={[
                      styles.stepper,
                      {borderColor: colors.border, backgroundColor: colors.inputBackground},
                    ]}>
                    <QuickIconPressable
                      accessibilityLabel={`Decrease ${item.item_name}`}
                      hitSlop={ICON_BUTTON_HIT_SLOP}
                      onPress={() => onChangeQuantity(item, -1)}
                      style={styles.stepBtn}>
                      <Text style={styles.stepGlyph}>−</Text>
                    </QuickIconPressable>
                    <Text style={[styles.qty, {color: colors.textPrimary}]}>
                      {qty}
                    </Text>
                    <QuickIconPressable
                      accessibilityLabel={`Increase ${item.item_name}`}
                      hitSlop={ICON_BUTTON_HIT_SLOP}
                      onPress={() => onChangeQuantity(item, 1)}
                      style={styles.stepBtn}>
                      <Text style={styles.stepGlyph}>+</Text>
                    </QuickIconPressable>
                  </View>
                ) : (
                  <Text style={[styles.qty, {color: colors.textPrimary}]}>
                    × {qty}
                  </Text>
                )}
                <Text style={[styles.lineAmount, {color: colors.textPrimary}]}>
                  {formatCurrencyCompact(lineTotal)}
                </Text>
                {canModify ? (
                  <QuickIconPressable
                    accessibilityLabel={`Remove ${item.item_name}`}
                    hitSlop={ICON_BUTTON_HIT_SLOP}
                    onPress={() => onRemoveLine(item)}
                    style={styles.deleteBtn}>
                    <Image
                      source={icons.delete_icon}
                      style={styles.deleteIcon}
                      resizeMode="contain"
                    />
                  </QuickIconPressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.footer, {borderTopColor: colors.border}]}>
        <FooterTotal
          subTotal={total}
          totalQuantity={quantity}
          total={total}
          printReceipt={printReceipt}
          setPrintReceipt={setPrintReceipt}
          onPress={onCharge}
          isLoading={isLoading}
          checkoutBlocked={!canCharge}
          embeddedInTabBar
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 42,
    minWidth: 280,
    maxWidth: 520,
    borderLeftWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    ...FONTS.h4,
    fontWeight: '700',
  },
  clearText: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  customerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary2,
  },
  customerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  customerTitle: {
    ...FONTS.body4,
    fontWeight: '700',
    color: COLORS.primary2,
  },
  customerSubtitle: {
    ...FONTS.body5,
    marginTop: 1,
  },
  chevron: {
    width: 12,
    height: 12,
    tintColor: COLORS.primary2,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...FONTS.body3,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySub: {
    ...FONTS.body5,
    marginTop: 4,
    textAlign: 'center',
  },
  line: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineMain: {
    marginBottom: 8,
  },
  lineName: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  lineMeta: {
    ...FONTS.body5,
    marginTop: 2,
  },
  lineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary2,
    lineHeight: 20,
  },
  qty: {
    ...FONTS.body4,
    fontWeight: '700',
    minWidth: 22,
    textAlign: 'center',
  },
  lineAmount: {
    ...FONTS.body4,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.error,
  },
  footer: {
    borderTopWidth: 1,
  },
});
