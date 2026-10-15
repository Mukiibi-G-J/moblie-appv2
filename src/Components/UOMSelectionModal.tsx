import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import ReactNativeModal from 'react-native-modal';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  COLORS,
  FONTS,
  ICON_BUTTON_HIT_SLOP,
  ICON_BUTTON_QUICK_PRESS,
} from '../constants';
import {QuickIconPressable} from './QuickIconPressable';
import type {ItemUnitOfMeasure} from '../services/app.services';
import {formatCurrencyCompact} from '../utils/currency';
import {displayPriceForUom} from '../utils/posUom';

type Props = {
  visible: boolean;
  title: string;
  loading: boolean;
  options: ItemUnitOfMeasure[];
  selectedCode?: string | null;
  /** Fallback when a UOM has no resolved price-list price yet. */
  baseUnitPrice: number;
  /** Sell prices from GET /api/sales/resolve-unit-price/ keyed by UOM code. */
  resolvedPrices?: Record<string, number>;
  onClose: () => void;
  onSelect: (uom: ItemUnitOfMeasure) => void;
  /** In-panel overlay so it stacks above the cart item editor. */
  embedded?: boolean;
};

const UOMSelectionModal: React.FC<Props> = ({
  visible,
  title,
  loading,
  options,
  selectedCode,
  baseUnitPrice,
  resolvedPrices,
  onClose,
  onSelect,
  embedded = false,
}) => {
  const sheetBody = (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
        <QuickIconPressable
          onPress={onClose}
          hitSlop={ICON_BUTTON_HIT_SLOP}
          accessibilityLabel="Close">
          <Text style={styles.close}>✕</Text>
        </QuickIconPressable>
      </View>
      <Text style={styles.hint}>
        Choose the unit to sell in. Price updates from the sales price list
        (then item UOM / card price).
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading units…</Text>
        </View>
      ) : options.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No units of measure for this item. Add them on the item card (same as
            web).
          </Text>
        </View>
      ) : (
        <FlatList
          data={options}
          keyExtractor={item =>
            `${item.id}-${item.unit_of_measure}` || String(item.id)
          }
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({item}) => {
            const isSelected =
              String(selectedCode || '') === String(item.unit_of_measure);
            const resolved = resolvedPrices?.[item.unit_of_measure];
            const sellPrice =
              resolved != null && Number.isFinite(resolved)
                ? resolved
                : displayPriceForUom(baseUnitPrice, item);
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => onSelect(item)}
                activeOpacity={0.75}>
                <View style={{flex: 1}}>
                  <Text style={styles.uomLabel}>
                    {item.unit_of_measure}
                    {item.default ? ' · Default' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {item.quantity_per_unit || 1} per unit
                    {item.unit_of_measure_description
                      ? ` · ${item.unit_of_measure_description}`
                      : ''}
                  </Text>
                  <Text style={styles.price}>{formatCurrencyCompact(sellPrice)}</Text>
                </View>
                <Text style={styles.chev}>{isSelected ? '✓' : '›'}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </>
  );

  if (embedded) {
    if (!visible) {
      return null;
    }
    return (
      <View style={styles.embeddedRoot} pointerEvents="box-none">
        <Pressable
          {...ICON_BUTTON_QUICK_PRESS}
          accessibilityRole="button"
          accessibilityLabel="Close unit of measure picker"
          style={styles.embeddedBackdrop}
          onPress={onClose}
        />
        <View style={styles.embeddedSheetOuter} pointerEvents="box-none">
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            {sheetBody}
          </SafeAreaView>
        </View>
      </View>
    );
  }

  return (
    <ReactNativeModal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      useNativeDriver
      statusBarTranslucent>
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        {sheetBody}
      </SafeAreaView>
    </ReactNativeModal>
  );
};

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 820,
    elevation: 820,
    justifyContent: 'flex-end',
  },
  embeddedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  embeddedSheetOuter: {
    maxHeight: '88%',
    width: '100%',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  headerTitle: {
    ...FONTS.h3,
    flex: 1,
    color: COLORS.darkGray,
    fontSize: 16,
    paddingRight: 8,
  },
  close: {
    fontSize: 22,
    color: COLORS.gray,
  },
  hint: {
    ...FONTS.body5,
    color: COLORS.gray,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 12,
  },
  list: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: COLORS.lightGray2,
    borderRadius: 10,
  },
  rowSelected: {
    backgroundColor: COLORS.transparentPrimary2,
    borderWidth: 1,
    borderColor: COLORS.primary2,
  },
  uomLabel: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 4,
    fontSize: 12,
  },
  price: {
    ...FONTS.body4,
    color: COLORS.primary2,
    marginTop: 4,
    fontWeight: '600',
  },
  chev: {
    fontSize: 22,
    color: COLORS.gray,
    marginLeft: 8,
  },
  centered: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  loadingText: {
    marginTop: 8,
    ...FONTS.body5,
    color: COLORS.gray,
  },
  emptyText: {
    ...FONTS.body4,
    color: COLORS.darkGray,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default UOMSelectionModal;
