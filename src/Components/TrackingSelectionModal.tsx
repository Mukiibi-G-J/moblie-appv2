import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import ReactNativeModal from 'react-native-modal';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS, FONTS} from '../constants';
import type {TrackingLotOption} from '../utils/salesTracking';

type Props = {
  visible: boolean;
  title: string;
  loading: boolean;
  options: TrackingLotOption[];
  onClose: () => void;
  onSelect: (option: TrackingLotOption) => void;
};

const TrackingSelectionModal: React.FC<Props> = ({
  visible,
  title,
  loading,
  options,
  onClose,
  onSelect,
}) => {
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
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
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
              No available lots for this item. Receive stock with lot tracking
              or check inventory postings.
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
                    {item.expiry_date
                      ? ` · Exp: ${item.expiry_date}`
                      : ''}
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
      </SafeAreaView>
    </ReactNativeModal>
  );
};

const styles = StyleSheet.create({
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
