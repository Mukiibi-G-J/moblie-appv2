import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {QuickIconPressable, SearchableSelectModal} from '../../Components';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {Customer, PaymentMethod, Vendor} from '../../@types/paymentJournal';
import {PaymentJournalServices} from '../../services/PaymentJournalServices';
import {
  formatCurrencyCompact,
  formatCurrencyLabel,
} from '../../utils/currency';
import {
  pickDefaultCashPaymentMethod,
  paymentMethodRequiresTransactionId,
  TRANSACTION_ID_MAX_LENGTH,
  TRANSACTION_ID_REQUIRED_MESSAGE,
} from '../../utils/paymentMethodDefaults';

type PartyKind = 'customer' | 'vendor';

function isGeneralCustomer(customer: Customer | null): boolean {
  if (!customer) {
    return false;
  }
  if (customer.customer_type === 'General') {
    return true;
  }
  const name = customer.name.trim().toLowerCase();
  return (
    name === 'general' ||
    name === 'general customer' ||
    name.includes('walk-in') ||
    name.includes('cash customer')
  );
}

function parseBalance(value: string | number | null | undefined): number {
  if (value == null || value === '') {
    return 0;
  }
  const n =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function customerBalance(customer: Customer | null): number {
  return parseBalance(customer?.balance);
}

/** Vendor payable amount (AP balances may be negative). */
function vendorPayable(vendor: Vendor | null): number {
  return Math.abs(parseBalance(vendor?.balance));
}

function pickDefaultMethod(
  methods: PaymentMethod[],
  party: {payment_method?: number | null} | null,
): PaymentMethod | null {
  if (party?.payment_method && methods.length) {
    const preferred = methods.find(m => m.id === party.payment_method);
    if (preferred) {
      return preferred;
    }
  }
  return pickDefaultCashPaymentMethod(methods);
}

type QuickPaymentModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Prefer QuickPayment page; fall back to Payments insert. */
  canPost: boolean;
};

const QuickPaymentModal: React.FC<QuickPaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
  canPost,
}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();

  const [party, setParty] = useState<PartyKind>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [amountDraft, setAmountDraft] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);

  const theme = useMemo(
    () => ({
      sheet: {backgroundColor: colors.surface},
      headerBorder: {borderBottomColor: colors.border},
      title: {color: colors.textPrimary},
      label: {color: colors.textSecondary},
      field: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      fieldText: {color: colors.textPrimary},
      placeholder: colors.placeholder,
      hint: {color: colors.textSecondary},
      outstanding: {color: colors.textPrimary},
      closeIcon: {tintColor: colors.textPrimary},
      footerBorder: {borderTopColor: colors.border},
      tabIdle: {color: colors.textSecondary},
      tabActive: {backgroundColor: COLORS.primary2, color: '#fff'},
      tabTrack: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
    }),
    [colors],
  );

  const debtorCustomers = useMemo(() => {
    const nonGeneral = customers.filter(c => !isGeneralCustomer(c));
    const withBalance = nonGeneral.filter(c => customerBalance(c) > 0);
    return withBalance.length > 0 ? withBalance : nonGeneral;
  }, [customers]);

  const payableVendors = useMemo(() => {
    const open = vendors.filter(v => !v.blocked);
    const withBalance = open.filter(v => vendorPayable(v) > 0);
    return withBalance.length > 0 ? withBalance : open;
  }, [vendors]);

  const partyOptions = useMemo(() => {
    if (party === 'customer') {
      return debtorCustomers.map(c => {
        const balance = customerBalance(c);
        return {
          id: c.id,
          label: c.name,
          subtitle:
            balance > 0
              ? `${c.no} · ${formatCurrencyCompact(balance)} due`
              : c.no,
        };
      });
    }
    return payableVendors.map(v => {
      const payable = vendorPayable(v);
      return {
        id: v.id,
        label: v.name,
        subtitle:
          payable > 0
            ? `${v.no} · ${formatCurrencyCompact(payable)} payable`
            : v.no,
      };
    });
  }, [party, debtorCustomers, payableVendors]);

  const methodOptions = useMemo(
    () =>
      paymentMethods.map(m => ({
        id: m.id,
        label: m.description || m.code,
        subtitle: m.code,
      })),
    [paymentMethods],
  );

  const applyCustomerDefaults = useCallback(
    (nextCustomers: Customer[], nextMethods: PaymentMethod[]) => {
      const nonGeneral = nextCustomers.filter(c => !isGeneralCustomer(c));
      const withBalance = nonGeneral.filter(c => customerBalance(c) > 0);
      const debtors = withBalance.length > 0 ? withBalance : nonGeneral;
      const first =
        debtors.find(c => customerBalance(c) > 0) ?? debtors[0] ?? null;
      setSelectedCustomer(first);
      setSelectedMethod(pickDefaultMethod(nextMethods, first));
      const bal = customerBalance(first);
      setAmountDraft(bal > 0 ? String(Math.round(bal)) : '');
    },
    [],
  );

  const applyVendorDefaults = useCallback(
    (nextVendors: Vendor[], nextMethods: PaymentMethod[]) => {
      const open = nextVendors.filter(v => !v.blocked);
      const withBalance = open.filter(v => vendorPayable(v) > 0);
      const list = withBalance.length > 0 ? withBalance : open;
      const first =
        list.find(v => vendorPayable(v) > 0) ?? list[0] ?? null;
      setSelectedVendor(first);
      setSelectedMethod(pickDefaultMethod(nextMethods, first));
      const payable = vendorPayable(first);
      setAmountDraft(payable > 0 ? String(Math.round(payable)) : '');
    },
    [],
  );

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [customersRes, vendorsRes, methods] = await Promise.all([
        PaymentJournalServices.getCustomers(),
        PaymentJournalServices.getVendors(),
        PaymentJournalServices.getPaymentMethods(),
      ]);
      const nextCustomers = customersRes.results || [];
      const nextVendors = vendorsRes.results || [];
      const nextMethods = methods || [];
      setCustomers(nextCustomers);
      setVendors(nextVendors);
      setPaymentMethods(nextMethods);
      applyCustomerDefaults(nextCustomers, nextMethods);
    } catch (error) {
      console.error('Error loading quick payment data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load payment data',
      });
    } finally {
      setLoadingData(false);
    }
  }, [applyCustomerDefaults]);

  useEffect(() => {
    if (!visible) {
      setPartyPickerOpen(false);
      setMethodPickerOpen(false);
      setSubmitting(false);
      setParty('customer');
      setTransactionId('');
      return;
    }
    void loadData();
  }, [visible, loadData]);

  useEffect(() => {
    if (!visible || loadingData) {
      return;
    }
    if (party === 'vendor') {
      applyVendorDefaults(vendors, paymentMethods);
    } else {
      applyCustomerDefaults(customers, paymentMethods);
    }
    // Re-apply defaults only when switching Customer / Vendor tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party]);

  const outstanding =
    party === 'customer'
      ? customerBalance(selectedCustomer)
      : vendorPayable(selectedVendor);
  const amountPaid = Number.parseFloat(amountDraft.replace(/,/g, '')) || 0;
  const requiresTransactionId =
    party === 'customer' &&
    paymentMethodRequiresTransactionId(selectedMethod);

  const handlePartyKindChange = (next: PartyKind) => {
    if (next === party) {
      return;
    }
    setParty(next);
    setPartyPickerOpen(false);
    setTransactionId('');
  };

  const handlePartySelect = (id: number | string | null) => {
    setPartyPickerOpen(false);
    if (id == null) {
      return;
    }
    const numericId = Number(id);
    if (party === 'customer') {
      const customer =
        debtorCustomers.find(c => c.id === numericId) ??
        customers.find(c => c.id === numericId) ??
        null;
      if (!customer) {
        return;
      }
      setSelectedCustomer(customer);
      setSelectedMethod(pickDefaultMethod(paymentMethods, customer));
      const bal = customerBalance(customer);
      if (bal > 0) {
        setAmountDraft(String(Math.round(bal)));
      }
      return;
    }
    const vendor =
      payableVendors.find(v => v.id === numericId) ??
      vendors.find(v => v.id === numericId) ??
      null;
    if (!vendor) {
      return;
    }
    setSelectedVendor(vendor);
    setSelectedMethod(pickDefaultMethod(paymentMethods, vendor));
    const payable = vendorPayable(vendor);
    if (payable > 0) {
      setAmountDraft(String(Math.round(payable)));
    }
  };

  const handleMethodSelect = (id: number | string | null) => {
    setMethodPickerOpen(false);
    if (id == null) {
      return;
    }
    const method = paymentMethods.find(m => m.id === Number(id)) ?? null;
    setSelectedMethod(method);
    if (!paymentMethodRequiresTransactionId(method)) {
      setTransactionId('');
    }
  };

  const handlePost = async () => {
    if (!canPost) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'You cannot record payments',
      });
      return;
    }
    if (!selectedMethod) {
      Toast.show({type: 'error', text1: 'Select a payment method'});
      return;
    }
    if (!(amountPaid > 0)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid amount',
        text2: 'Enter an amount greater than zero',
      });
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

    if (party === 'customer') {
      if (!selectedCustomer) {
        Toast.show({type: 'error', text1: 'Select a customer'});
        return;
      }
      if (isGeneralCustomer(selectedCustomer)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid customer',
          text2: 'General customer cannot receive invoice payments',
        });
        return;
      }
    } else if (!selectedVendor) {
      Toast.show({type: 'error', text1: 'Select a vendor'});
      return;
    }

    setSubmitting(true);
    try {
      if (party === 'customer' && selectedCustomer) {
        const result = await PaymentJournalServices.quickCustomerPayment({
          customer_id: selectedCustomer.id,
          amount: amountPaid,
          payment_method_id: selectedMethod.id,
          transaction_id: requiresTransactionId
            ? transactionId.trim()
            : undefined,
        });
        const applied = result.applied_document_no
          ? ` — applied to ${result.applied_document_no}`
          : '';
        Toast.show({
          type: 'success',
          text1: 'Payment posted',
          text2: `${result.document_no || 'Payment'}${applied}`,
        });
      } else if (selectedVendor) {
        const result = await PaymentJournalServices.quickVendorPayment({
          vendor_id: selectedVendor.id,
          amount: amountPaid,
          payment_method_id: selectedMethod.id,
        });
        const applied = result.applied_document_no
          ? ` — applied to ${result.applied_document_no}`
          : '';
        Toast.show({
          type: 'success',
          text1: 'Vendor payment posted',
          text2: `${result.document_no || 'Payment'}${applied}`,
        });
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to post payment',
        text2: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPartyLabel =
    party === 'customer'
      ? selectedCustomer
        ? `${selectedCustomer.name} (${selectedCustomer.no})`
        : 'Select customer'
      : selectedVendor
        ? `${selectedVendor.name} (${selectedVendor.no})`
        : 'Select vendor';

  const balanceLabel = party === 'customer' ? 'Outstanding' : 'Payable';
  const amountLabel =
    party === 'customer' ? 'Amount paid' : 'Amount to pay';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            theme.sheet,
            {paddingBottom: Math.max(insets.bottom, 16)},
          ]}>
          <View style={[styles.header, theme.headerBorder]}>
            <Text style={[styles.title, theme.title]}>Quick payment</Text>
            <QuickIconPressable
              onPress={onClose}
              accessibilityLabel="Close"
              style={styles.closeButton}>
              <Image
                source={icons.cross}
                style={[styles.closeIcon, theme.closeIcon]}
                resizeMode="contain"
              />
            </QuickIconPressable>
          </View>

          {loadingData ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary2} />
              <Text style={[styles.loadingText, theme.hint]}>Loading…</Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}>
              <View style={[styles.tabTrack, theme.tabTrack]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    party === 'customer' && theme.tabActive,
                  ]}
                  onPress={() => handlePartyKindChange('customer')}
                  activeOpacity={0.85}>
                  <Text
                    style={[
                      styles.tabText,
                      party === 'customer'
                        ? {color: '#fff'}
                        : theme.tabIdle,
                    ]}>
                    Customer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    party === 'vendor' && theme.tabActive,
                  ]}
                  onPress={() => handlePartyKindChange('vendor')}
                  activeOpacity={0.85}>
                  <Text
                    style={[
                      styles.tabText,
                      party === 'vendor' ? {color: '#fff'} : theme.tabIdle,
                    ]}>
                    Vendor
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.helper, theme.hint]}>
                {party === 'customer'
                  ? 'Record a customer payment against their oldest open invoice.'
                  : 'Pay a vendor against their oldest open invoice.'}
              </Text>

              <Text style={[styles.label, theme.label]}>
                {party === 'customer' ? 'Customer' : 'Vendor'}
              </Text>
              <TouchableOpacity
                style={[styles.field, theme.field]}
                onPress={() => setPartyPickerOpen(true)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.fieldText,
                    theme.fieldText,
                    !(party === 'customer'
                      ? selectedCustomer
                      : selectedVendor) && {color: theme.placeholder},
                  ]}
                  numberOfLines={1}>
                  {selectedPartyLabel}
                </Text>
                <Image
                  source={icons.down_arrow}
                  style={[styles.chevron, {tintColor: colors.iconMuted}]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              {(party === 'customer' ? selectedCustomer : selectedVendor) ? (
                <Text style={[styles.hint, theme.hint]}>
                  {balanceLabel}:{' '}
                  <Text style={[styles.outstanding, theme.outstanding]}>
                    {formatCurrencyCompact(outstanding)}
                  </Text>
                </Text>
              ) : null}

              <Text style={[styles.label, theme.label]}>
                {formatCurrencyLabel(amountLabel)}
              </Text>
              <TextInput
                style={[
                  styles.field,
                  styles.amountInput,
                  theme.field,
                  theme.fieldText,
                ]}
                value={amountDraft}
                onChangeText={setAmountDraft}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.placeholder}
              />

              <Text style={[styles.label, theme.label]}>Payment method</Text>
              <TouchableOpacity
                style={[styles.field, theme.field]}
                onPress={() => setMethodPickerOpen(true)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.fieldText,
                    theme.fieldText,
                    !selectedMethod && {color: theme.placeholder},
                  ]}
                  numberOfLines={1}>
                  {selectedMethod
                    ? selectedMethod.description || selectedMethod.code
                    : 'Select method'}
                </Text>
                <Image
                  source={icons.down_arrow}
                  style={[styles.chevron, {tintColor: colors.iconMuted}]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              {requiresTransactionId ? (
                <>
                  <Text style={[styles.label, theme.label]}>
                    Transaction ID *
                  </Text>
                  <TextInput
                    style={[
                      styles.field,
                      styles.amountInput,
                      theme.field,
                      theme.fieldText,
                    ]}
                    value={transactionId}
                    onChangeText={setTransactionId}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={TRANSACTION_ID_MAX_LENGTH}
                    placeholder="Enter provider transaction ID"
                    placeholderTextColor={theme.placeholder}
                  />
                </>
              ) : null}
            </ScrollView>
          )}

          <View style={[styles.footer, theme.footerBorder]}>
            <TouchableOpacity
              style={[
                styles.postButton,
                (submitting ||
                  loadingData ||
                  !canPost ||
                  (requiresTransactionId && !transactionId.trim())) &&
                  styles.postButtonDisabled,
              ]}
              onPress={() => void handlePost()}
              disabled={
                submitting ||
                loadingData ||
                !canPost ||
                (requiresTransactionId && !transactionId.trim())
              }
              activeOpacity={0.85}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.postButtonText}>
                  {party === 'customer' ? 'Post payment' : 'Pay vendor'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <SearchableSelectModal
        visible={partyPickerOpen}
        title={party === 'customer' ? 'Select customer' : 'Select vendor'}
        options={partyOptions}
        selectedId={
          party === 'customer' ? selectedCustomer?.id : selectedVendor?.id
        }
        onSelect={handlePartySelect}
        onClose={() => setPartyPickerOpen(false)}
        searchPlaceholder={
          party === 'customer' ? 'Search debtor…' : 'Search vendor…'
        }
      />
      <SearchableSelectModal
        visible={methodPickerOpen}
        title="Payment method"
        options={methodOptions}
        selectedId={selectedMethod?.id}
        onSelect={handleMethodSelect}
        onClose={() => setMethodPickerOpen(false)}
        searchPlaceholder="Search method…"
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 18,
    height: 18,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...FONTS.body4,
  },
  body: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...FONTS.body4,
    fontWeight: '700',
  },
  helper: {
    ...FONTS.body5,
    marginBottom: 4,
    lineHeight: 18,
  },
  label: {
    ...FONTS.body5,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  field: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInput: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  fieldText: {
    ...FONTS.body4,
    flex: 1,
    marginRight: 8,
  },
  chevron: {
    width: 14,
    height: 14,
  },
  hint: {
    ...FONTS.body5,
    marginTop: 6,
  },
  outstanding: {
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  postButton: {
    backgroundColor: COLORS.primary2,
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#fff',
    ...FONTS.h4,
    fontWeight: '700',
  },
});

export default QuickPaymentModal;
