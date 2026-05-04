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
import {COLORS, FONTS, ICON_BUTTON_HIT_SLOP, ICON_BUTTON_QUICK_PRESS} from '../constants';
import {QuickIconPressable} from './QuickIconPressable';
import type {TrackingLotOption} from '../utils/salesTracking';

type Props = {
  visible: boolean;
  title: string;
  loading: boolean;
  options: TrackingLotOption[];
  onClose: () => void;
  onSelect: (option: TrackingLotOption) => void;
  /**
   * When true, render as an in-panel overlay (same window as parent).
   * Use inside "Current sale" so the sheet stacks above the cart editor on Android.
   */
  embedded?: boolean;
};

const TrackingSelectionModal: React.FC<Props> = ({
  visible,
  title,
  loading,
  options,
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
        Lots with remaining quantity (first expiry first). Same as web POS.
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading lots…</Text>
        </View>
      ) : options.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No available lots for this item. Receive stock with lot tracking or
            check inventory postings.
          </Text>
        </View>
      ) : (
        <FlatList
          data={options}
          keyExtractor={item => item.lot_no}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => onSelect(item)}>
              <View style={{flex: 1}}>
                <Text style={styles.lotLabel}>{item.lot_no}</Text>
                <Text style={styles.meta}>
                  Qty: {item.remaining_quantity}
                  {item.expiry_date ? ` · Exp: ${item.expiry_date}` : ''}
                </Text>
                {item.document_no ? (
                  <Text style={styles.doc}>{item.document_no}</Text>
                ) : null}
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          )}
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
          accessibilityLabel="Close lot picker"
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
    zIndex: 800,
    elevation: 800,
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
  lotLabel: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontSize: 15,
  },
  meta: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 4,
    fontSize: 12,
  },
  doc: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 2,
    fontSize: 11,
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

export default TrackingSelectionModal;
