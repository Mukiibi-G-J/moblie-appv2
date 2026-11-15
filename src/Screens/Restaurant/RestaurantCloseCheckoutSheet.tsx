import React, {useEffect, useState} from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  formatDateOnlyDisplay,
  formatDateYmdLocal,
  todayYmdLocal,
} from '../../utils/localDate';
import {useUserSetupQuery} from '../../hooks/useSalesQuery';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {FONTS} from '../../constants';
import type {PaymentMethod} from '../../services/app.services';
import {fetchPaymentMethods} from '../../services/app.services';
import {
  pickDefaultCashPaymentMethod,
  paymentMethodRequiresTransactionId,
  TRANSACTION_ID_MAX_LENGTH,
  TRANSACTION_ID_REQUIRED_MESSAGE,
} from '../../utils/paymentMethodDefaults';

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
    transactionId?: string,
    documentDate?: string,
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
  const [transactionId, setTransactionId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const {data: userSetup} = useUserSetupQuery(visible);
  const canPostPreviousDates = userSetup?.canPostPreviousDates !== false;

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
          const cash = pickDefaultCashPaymentMethod(
            Array.isArray(list) ? list : [],
          );
          setPmId(cash?.id != null ? Number(cash.id) : null);
          setTransactionId('');
          setSaleDate(new Date());
          setShowDatePicker(false);
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

  const selected = methods.find(m => m.id === pmId);
  const requiresTransactionId = paymentMethodRequiresTransactionId(selected);
  const payBlocked =
    pmId == null ||
    loadingPm ||
    (requiresTransactionId && !transactionId.trim());

  const confirm = (shouldPrint: boolean) => {
    if (pmId == null) {
      return;
    }
    if (requiresTransactionId && !transactionId.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Transaction ID',
        text2: TRANSACTION_ID_REQUIRED_MESSAGE,
      });
      return;
    }
    const postedDate = formatDateYmdLocal(saleDate);
    const documentDate =
      !canPostPreviousDates && postedDate < todayYmdLocal()
        ? todayYmdLocal()
        : postedDate;
    void onConfirm(
      shouldPrint,
      pmId,
      requiresTransactionId ? transactionId.trim() : undefined,
      documentDate,
    );
  };

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
                {itemCount} item(s) · {getLocalCurrencyCode()} billing (posted to Sales)
              </Text>
              <Text style={[styles.summaryTotal, {color: chrome.text}]}>
                Total:{' '}
                {totalAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </Text>
            </View>

            <Text style={[styles.sectionLabel, {color: chrome.text}]}>Sale date</Text>
            <Pressable
              disabled={submitting || !canPostPreviousDates}
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateRow,
                {borderColor: chrome.border, opacity: canPostPreviousDates ? 1 : 0.6},
              ]}>
              <Text style={[styles.pmChipTxt, {color: chrome.text}]}>
                {formatDateOnlyDisplay(formatDateYmdLocal(saleDate))}
              </Text>
            </Pressable>
            {!canPostPreviousDates ? (
              <Text style={[styles.summaryMeta, {color: chrome.muted}]}>
                You cannot post sales for previous dates
              </Text>
            ) : null}
            {showDatePicker ? (
              <DateTimePicker
                value={saleDate}
                mode="date"
                display="default"
                onChange={(_event, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (!selected) {
                    return;
                  }
                  if (
                    !canPostPreviousDates &&
                    formatDateYmdLocal(selected) < todayYmdLocal()
                  ) {
                    return;
                  }
                  setSaleDate(selected);
                }}
              />
            ) : null}

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
                      onPress={() => {
                        setPmId(pm.id);
                        if (!paymentMethodRequiresTransactionId(pm)) {
                          setTransactionId('');
                        }
                      }}
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

            {requiresTransactionId ? (
              <View>
                <Text style={[styles.sectionLabel, {color: chrome.text}]}>
                  Transaction ID *
                </Text>
                <TextInput
                  value={transactionId}
                  onChangeText={setTransactionId}
                  placeholder="Enter provider transaction ID"
                  placeholderTextColor={chrome.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={TRANSACTION_ID_MAX_LENGTH}
                  style={{
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: chrome.border,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: chrome.text,
                    fontSize: 15,
                  }}
                />
              </View>
            ) : null}

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
                  disabled={payBlocked}
                  onPress={() => confirm(true)}
                  style={[
                    styles.primaryBtn,
                    {backgroundColor: primaryButtonColor, opacity: payBlocked ? 0.45 : 1},
                  ]}>
                  <Text style={styles.primaryBtnTxt}>Close & print receipt</Text>
                </Pressable>
                <Pressable
                  disabled={payBlocked}
                  onPress={() => confirm(false)}
                  style={[
                    styles.outlineBtn,
                    {
                      borderColor: chrome.border,
                      opacity: payBlocked ? 0.45 : 1,
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
  dateRow: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
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
