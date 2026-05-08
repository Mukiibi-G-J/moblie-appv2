import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {FONTS} from '../../constants';
import type {PaymentMethod} from '../../services/app.services';
import {fetchPaymentMethods} from '../../services/app.services';

export type RestaurantCloseCheckoutChrome = {
  surface: string;
  text: string;
  muted: string;
  border: string;
};

type Props = {
  visible: boolean;
  orderNo: string;
  itemCount: number;
  totalAmount: number;
  primaryButtonColor: string;
  chrome: RestaurantCloseCheckoutChrome;
  submitting: boolean;
  onCancel: () => void;
  /** paymentMethodId from sheet selection */
  onConfirm: (
    shouldPrint: boolean,
    paymentMethodId: number,
  ) => void | Promise<void>;
};

export default function RestaurantCloseCheckoutSheet(props: Props) {
  const {
    visible,
    orderNo,
    itemCount,
    totalAmount,
    primaryButtonColor,
    chrome,
    submitting,
    onCancel,
    onConfirm,
  } = props;
  const insets = useSafeAreaInsets();

  const [loadingPm, setLoadingPm] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [pmId, setPmId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingPm(true);
      try {
        const list = await fetchPaymentMethods();
        if (!cancelled) {
          setMethods(Array.isArray(list) ? list : []);
          const firstId = Array.isArray(list) && list[0]?.id != null ? list[0].id : null;
          setPmId(firstId != null ? Number(firstId) : null);
          if (!list?.length) {
            Toast.show({
              type: 'error',
              text1: 'Payment methods',
              text2: 'No payment methods found. Configure them in Zentro first.',
            });
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingPm(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => !submitting && onCancel()}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => !submitting && onCancel()} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: chrome.surface,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          <View style={[styles.header, {borderBottomColor: chrome.border}]}>
            <Text style={[styles.title, {color: chrome.text}]}>Close check & settle</Text>
            {!submitting ? (
              <Pressable onPress={onCancel} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                <Text style={{fontSize: 20, color: chrome.muted}}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={{maxHeight: 440}}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollPad}>
            <View style={[styles.summary, {borderColor: chrome.border}]}>
              <Text style={[styles.summaryNo, {color: chrome.text}]}>{orderNo}</Text>
              <Text style={[styles.summaryMeta, {color: chrome.muted}]}>
                {itemCount} item(s) · UGX billing (posted to Sales)
              </Text>
              <Text style={[styles.summaryTotal, {color: chrome.text}]}>
                Total:{' '}
                {totalAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </Text>
            </View>

            <Text style={[styles.sectionLabel, {color: chrome.text}]}>Payment method</Text>
            {loadingPm ? (
              <View style={{paddingVertical: 16, alignItems: 'center'}}>
                <ActivityIndicator color={primaryButtonColor} />
              </View>
            ) : (
              <View style={styles.pmList}>
                {methods.map(pm => {
                  const sel = pmId === pm.id;
                  return (
                    <Pressable
                      key={pm.id}
                      onPress={() => setPmId(pm.id)}
                      style={[
                        styles.pmChip,
                        {
                          borderColor: sel ? primaryButtonColor : chrome.border,
                          backgroundColor: sel ? `${primaryButtonColor}18` : 'transparent',
                        },
                      ]}>
                      <Text
                        style={[styles.pmChipTxt, {color: sel ? primaryButtonColor : chrome.text}]}
                        numberOfLines={2}>
                        {pm.description || pm.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {submitting ? (
              <View style={{alignItems: 'center', paddingVertical: 20, gap: 8}}>
                <ActivityIndicator color={primaryButtonColor} />
                <Text style={[styles.summaryMeta, {color: chrome.muted}]}>
                  Creating invoice & posting…
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  disabled={pmId == null || loadingPm}
                  onPress={() => void onConfirm(true, pmId!)}
                  style={[
                    styles.primaryBtn,
                    {backgroundColor: primaryButtonColor, opacity: pmId == null ? 0.45 : 1},
                  ]}>
                  <Text style={styles.primaryBtnTxt}>Close & print receipt</Text>
                </Pressable>
                <Pressable
                  disabled={pmId == null || loadingPm}
                  onPress={() => void onConfirm(false, pmId!)}
                  style={[
                    styles.outlineBtn,
                    {
                      borderColor: chrome.border,
                      opacity: pmId == null ? 0.45 : 1,
                    },
                  ]}>
                  <Text style={[styles.outlineBtnTxt, {color: chrome.text}]}>
                    Close without printing
                  </Text>
                </Pressable>
                <Pressable onPress={onCancel} style={{alignItems: 'center', paddingVertical: 8}}>
                  <Text style={[styles.summaryMeta, {color: chrome.muted}]}>Cancel</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  backdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)'},
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {...FONTS.h3, fontWeight: '800'},
  scrollPad: {padding: 18, gap: 12},
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  summaryNo: {...FONTS.body3, fontWeight: '800'},
  summaryMeta: {...FONTS.body5, marginTop: 4},
  summaryTotal: {...FONTS.body3, fontWeight: '800', marginTop: 10},
  sectionLabel: {...FONTS.body4, fontWeight: '700', marginTop: 8},
  pmList: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8},
  pmChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '100%',
  },
  pmChipTxt: {...FONTS.body5, fontWeight: '600'},
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnTxt: {...FONTS.body4, color: '#fff', fontWeight: '800'},
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  outlineBtnTxt: {...FONTS.body4, fontWeight: '700'},
});
