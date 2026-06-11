import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {QuickIconPressable, SearchableSelectModal} from '../../Components';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {
  PaymentJournal,
  PaymentJournalFormValues,
  PaymentMethod,
  Customer,
  Vendor,
  GLAccount,
  ContentType,
  CustomerLedgerEntry,
  VendorLedgerEntry,
} from '../../@types/paymentJournal';
import {PaymentJournalServices} from '../../services/PaymentJournalServices';
import Toast from 'react-native-toast-message';

const isProtectedGeneralCustomer = (customer?: {name?: string | null} | null) => {
  const normalizedName = customer?.name?.trim().toLowerCase();
  return normalizedName === 'general' || normalizedName === 'general customer';
};

interface PaymentFormModalProps {
  visible: boolean;
  onClose: () => void;
  payment: PaymentJournal | null; // null for create, PaymentJournal for edit
  onSave: () => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  visible,
  onClose,
  payment,
  onSave,
  canCreate,
  canEdit,
  canDelete,
}) => {
  const isEditMode = !!payment;
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const canSave =
    (isEditMode && canEdit) || (!isEditMode && canCreate);

  const payTheme = useMemo(
    () => ({
      pageRoot: {backgroundColor: colors.background},
      safeArea: {backgroundColor: colors.background},
      page: {backgroundColor: colors.background},
      pageHeader: {borderBottomColor: colors.border},
      headerIcon: {tintColor: colors.textPrimary},
      pageTitle: {color: colors.textPrimary},
      sectionTitle: {color: colors.textPrimary},
      fieldLabel: {color: colors.textPrimary},
      input: {
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      inputDisabled: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      disabledText: {color: colors.textSecondary},
      selectRow: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      selectRowText: {color: colors.textPrimary},
      selectRowPlaceholder: {color: colors.textSecondary},
      selectRowChevron: {color: colors.textSecondary},
      inlineLoadingText: {color: colors.textSecondary},
      sectionDivider: {backgroundColor: colors.border},
      infoCard: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      infoCardTitle: {color: colors.textPrimary},
      infoCardBody: {color: colors.textSecondary},
      loadingText: {color: colors.textSecondary},
    }),
    [colors],
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [documentTypePickerVisible, setDocumentTypePickerVisible] =
    useState(false);
  const [accountTypePickerVisible, setAccountTypePickerVisible] =
    useState(false);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [paymentMethodPickerVisible, setPaymentMethodPickerVisible] =
    useState(false);
  const [appliesToDocTypePickerVisible, setAppliesToDocTypePickerVisible] =
    useState(false);
  const [appliesToDocumentPickerVisible, setAppliesToDocumentPickerVisible] =
    useState(false);

  // Form state
  const [formData, setFormData] = useState<PaymentJournalFormValues>({
    posting_date: new Date().toISOString().split('T')[0],
    document_type: 'Payment',
    document_no: '',
    account_type: null,
    account_content_type_id: null,
    account_object_id: null,
    description: '',
    payment_method: null,
    amount: 0,
    bal_account_type: null,
    bal_account_content_type_id: null,
    bal_account_object_id: null,
    status: 'Open',
    application_status: 'Unapplied',
    applies_to_doc_type: '',
    applies_to_content_type_id: null,
    applies_to_object_id: null,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  // Dropdown data
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [customerLedgerEntries, setCustomerLedgerEntries] = useState<
    CustomerLedgerEntry[]
  >([]);
  const [vendorLedgerEntries, setVendorLedgerEntries] = useState<
    VendorLedgerEntry[]
  >([]);

  // Load dropdown data
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        setLoadingDropdowns(true);
        const [
          paymentMethodsRes,
          customersRes,
          vendorsRes,
          glAccountsRes,
          contentTypesRes,
        ] = await Promise.all([
          PaymentJournalServices.getPaymentMethods(),
          PaymentJournalServices.getCustomers(),
          PaymentJournalServices.getVendors(),
          PaymentJournalServices.getGLAccounts(),
          PaymentJournalServices.getContentTypes(),
        ]);

        setPaymentMethods(paymentMethodsRes);
        setCustomers(
          customersRes.results.filter(c => !isProtectedGeneralCustomer(c)),
        );
        setVendors(vendorsRes.results);
        setGLAccounts(glAccountsRes);
        setContentTypes(contentTypesRes);
      } catch (error) {
        console.error('Error loading dropdown data:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load form data',
        });
      } finally {
        setLoadingDropdowns(false);
      }
    };

    if (visible) {
      loadDropdownData();
    }
  }, [visible]);

  // Initialize form when payment changes
  useEffect(() => {
    if (payment) {
      setFormData({
        id: payment.id,
        system_id: payment.system_id,
        posting_date: payment.posting_date || new Date().toISOString().split('T')[0],
        document_type: payment.document_type || 'Payment',
        document_no: payment.document_no || '',
        external_document_no: payment.external_document_no,
        account_type: payment.account_type,
        account_content_type_id: payment.account_content_type_id || null,
        account_object_id: payment.account_object_id || null,
        description: payment.description || '',
        payment_method: payment.payment_method || null,
        amount: payment.amount || 0,
        bal_account_type: payment.bal_account_type,
        bal_account_content_type_id: payment.bal_account_content_type_id || null,
        bal_account_object_id: payment.bal_account_object_id || null,
        status: payment.status || 'Open',
        application_status: payment.application_status || 'Unapplied',
        applies_to_doc_type: payment.applies_to_doc_type || '',
        applies_to_content_type_id: payment.applies_to_content_type_id || null,
        applies_to_object_id: payment.applies_to_object_id || null,
      });

      // Load ledger entries if account is set
      if (payment.account_type && payment.account_object_id) {
        loadLedgerEntries(payment.account_type, payment.account_object_id);
      }
    } else {
      // Reset form for new payment
      setFormData({
        posting_date: new Date().toISOString().split('T')[0],
        document_type: 'Payment',
        document_no: '',
        account_type: null,
        account_content_type_id: null,
        account_object_id: null,
        description: '',
        payment_method: null,
        amount: 0,
        bal_account_type: null,
        bal_account_content_type_id: null,
        bal_account_object_id: null,
        status: 'Open',
        application_status: 'Unapplied',
        applies_to_doc_type: '',
        applies_to_content_type_id: null,
        applies_to_object_id: null,
      });
      setCustomerLedgerEntries([]);
      setVendorLedgerEntries([]);
    }
    setErrors({});
  }, [payment, visible]);

  // Load ledger entries when account changes
  const loadLedgerEntries = async (
    accountType: string,
    accountId: number,
  ) => {
    try {
      if (accountType === 'Customer') {
        const response = await PaymentJournalServices.getCustomerLedgerEntries(
          accountId,
        );
        setCustomerLedgerEntries(response.ledger_entries);
      } else if (accountType === 'Vendor') {
        const response = await PaymentJournalServices.getVendorLedgerEntries(
          accountId,
        );
        setVendorLedgerEntries(response.ledger_entries);
      }
    } catch (error) {
      console.error('Error loading ledger entries:', error);
    }
  };

  // Handle account type change
  const handleAccountTypeChange = (accountType: string) => {
    let accountContentTypeId: number | null = null;

    // Set content type based on account type
    if (accountType === 'Vendor') {
      const vendorContentType = contentTypes.find(ct => ct.model === 'vendor');
      if (vendorContentType) {
        accountContentTypeId = vendorContentType.id;
      }
    } else if (accountType === 'Customer') {
      const customerContentType = contentTypes.find(
        ct => ct.model === 'customer',
      );
      if (customerContentType) {
        accountContentTypeId = customerContentType.id;
      }
    }

    setFormData({
      ...formData,
      account_type: accountType || null,
      account_content_type_id: accountContentTypeId,
      account_object_id: null,
      applies_to_doc_type: '',
      applies_to_content_type_id: null,
      applies_to_object_id: null,
    });
    setCustomerLedgerEntries([]);
    setVendorLedgerEntries([]);
  };

  // Handle account selection change
  const handleAccountChange = async (accountId: number | string) => {
    const resolvedAccountId =
      typeof accountId === 'number'
        ? accountId
        : parseInt(String(accountId), 10) || null;

    setFormData({
      ...formData,
      account_object_id: resolvedAccountId,
      applies_to_doc_type: '',
      applies_to_content_type_id: null,
      applies_to_object_id: null,
    });

    // Load ledger entries
    if (
      formData.account_type &&
      accountId &&
      typeof accountId === 'number'
    ) {
      await loadLedgerEntries(formData.account_type, accountId);
    }
  };

  // Handle payment method change (auto-populate balancing account)
  const handlePaymentMethodChange = (paymentMethodId: number) => {
    const selectedMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
    setFormData({
      ...formData,
      payment_method: paymentMethodId,
      // Backend will auto-populate balancing account from payment method
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.posting_date || !formData.posting_date.trim()) {
      newErrors.posting_date = 'Posting date is required';
    }

    if (!formData.account_type) {
      newErrors.account_type = 'Account type is required';
    }

    if (formData.account_type && !formData.account_object_id) {
      newErrors.account_object_id = 'Account selection is required';
    }

    if (formData.amount === undefined || formData.amount === null || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    // Validate applies to if applies_to_doc_type is set
    if (formData.applies_to_doc_type && !formData.applies_to_object_id) {
      newErrors.applies_to_object_id = 'Applies to document is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // Check permissions
    if (isEditMode && !canEdit) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to edit payments.',
      );
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to create payments.',
      );
      return;
    }

    // Validate payment amount against selected invoice if applies_to is set
    if (formData.applies_to_object_id && formData.account_type && formData.amount) {
      let selectedInvoice: CustomerLedgerEntry | VendorLedgerEntry | undefined;

      if (formData.account_type === 'Vendor' && vendorLedgerEntries.length > 0) {
        selectedInvoice = vendorLedgerEntries.find(
          entry => entry.id === formData.applies_to_object_id,
        );
      } else if (
        formData.account_type === 'Customer' &&
        customerLedgerEntries.length > 0
      ) {
        selectedInvoice = customerLedgerEntries.find(
          entry => entry.id === formData.applies_to_object_id,
        );
      }

      if (selectedInvoice) {
        const remainingAmount = Math.abs(selectedInvoice.remaining_amount);
        if (formData.amount > remainingAmount) {
          Alert.alert(
            'Validation Error',
            `Payment amount (UGX ${formData.amount.toLocaleString()}) cannot exceed the selected invoice remaining amount (UGX ${remainingAmount.toLocaleString()})`,
          );
          return;
        }
      }
    }

    setLoading(true);
    try {
      const paymentData: Partial<PaymentJournalFormValues> = {
        posting_date: formData.posting_date,
        document_type: formData.document_type,
        description: formData.description?.trim() || '',
        account_type: formData.account_type || undefined,
        account_content_type_id: formData.account_content_type_id || undefined,
        account_object_id: formData.account_object_id || undefined,
        payment_method: formData.payment_method || undefined,
        amount: formData.amount,
        bal_account_type: formData.bal_account_type || undefined,
        bal_account_content_type_id:
          formData.bal_account_content_type_id || undefined,
        bal_account_object_id: formData.bal_account_object_id || undefined,
        // Only include applies_to fields if applies_to_doc_type is set
        ...(formData.applies_to_doc_type
          ? {
              applies_to_doc_type: formData.applies_to_doc_type,
              applies_to_content_type_id:
                formData.applies_to_content_type_id || undefined,
              applies_to_object_id: formData.applies_to_object_id || undefined,
            }
          : {}),
      };

      if (isEditMode && payment) {
        await PaymentJournalServices.updatePaymentJournal(payment.id, paymentData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Payment updated successfully',
        });
      } else {
        await PaymentJournalServices.createPaymentJournal(paymentData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Payment created successfully',
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.account_content_type_id?.[0] ||
        error?.response?.data?.account_object_id?.[0] ||
        error?.response?.data?.amount?.[0] ||
        'Failed to save payment';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get available accounts based on account type
  const getAvailableAccounts = () => {
    if (formData.account_type === 'Customer') {
      return customers
        .filter(customer => !isProtectedGeneralCustomer(customer))
        .map(customer => ({
          id: customer.id,
          label: `${customer.no} - ${customer.name}`,
        }));
    } else if (formData.account_type === 'Vendor') {
      return vendors.map(vendor => ({
        id: vendor.id,
        label: `${vendor.no} - ${vendor.name}`,
      }));
    } else if (formData.account_type === 'G/L Account') {
      // For GL accounts, we need to handle differently since they use 'no' as identifier
      // We'll need to set both content type and object ID properly
      return glAccounts.map(account => ({
        id: account.no, // Using 'no' as ID for GL accounts
        label: `${account.no} - ${account.name}`,
      }));
    }
    return [];
  };

  // Get available ledger entries based on account type
  const getAvailableLedgerEntries = () => {
    if (formData.account_type === 'Customer') {
      return customerLedgerEntries.map(entry => ({
        id: entry.id,
        label: `${entry.document_no} - UGX ${Math.abs(entry.remaining_amount).toLocaleString()}`,
      }));
    } else if (formData.account_type === 'Vendor') {
      return vendorLedgerEntries.map(entry => ({
        id: entry.id,
        label: `${entry.document_no} - UGX ${Math.abs(entry.remaining_amount).toLocaleString()}`,
      }));
    }
    return [];
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({
        ...formData,
        posting_date: selectedDate.toISOString().split('T')[0],
      });
    }
  };

  const formatAmountInput = (amount: number) => {
    if (!amount) {
      return '';
    }
    return amount.toLocaleString('en-US', {maximumFractionDigits: 0});
  };

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    const num = numericValue === '' ? 0 : parseInt(numericValue, 10);
    if (!isNaN(num)) {
      setFormData({...formData, amount: num});
    }
  };

  const accountOptions = useMemo(
    () => getAvailableAccounts(),
    [formData.account_type, customers, vendors, glAccounts],
  );

  const ledgerEntryOptions = useMemo(
    () => getAvailableLedgerEntries(),
    [formData.account_type, customerLedgerEntries, vendorLedgerEntries],
  );

  const paymentMethodOptions = useMemo(
    () =>
      paymentMethods.map(method => ({
        id: method.id,
        label: method.description || method.code,
        subtitle: method.code,
      })),
    [paymentMethods],
  );

  const accountTypeOptions = useMemo(
    () => [
      {id: 'Customer', label: 'Customer'},
      {id: 'Vendor', label: 'Vendor'},
      {id: 'G/L Account', label: 'G/L Account'},
    ],
    [],
  );

  const documentTypeOptions = useMemo(
    () => [
      {id: 'Payment', label: 'Payment'},
      {id: 'Refund', label: 'Refund'},
    ],
    [],
  );

  const appliesToDocTypeOptions = useMemo(
    () => [
      {id: 'Invoice', label: 'Invoice'},
      {id: 'Credit Memo', label: 'Credit Memo'},
      {id: 'Payment', label: 'Payment'},
    ],
    [],
  );

  const selectedAccountLabel = useMemo(() => {
    if (!formData.account_object_id || !formData.account_type) {
      return null;
    }
    const match = accountOptions.find(
      opt => String(opt.id) === String(formData.account_object_id),
    );
    if (match?.label) {
      return match.label;
    }
    if (formData.account_type === 'Customer' && payment?.account_name) {
      return payment.account_name;
    }
    return null;
  }, [
    accountOptions,
    formData.account_object_id,
    formData.account_type,
    payment?.account_name,
  ]);

  const selectedPaymentMethodLabel = useMemo(() => {
    if (!formData.payment_method) {
      return null;
    }
    const method = paymentMethods.find(m => m.id === formData.payment_method);
    return method ? `${method.code} - ${method.description}` : null;
  }, [formData.payment_method, paymentMethods]);

  const selectedAppliesToLabel = useMemo(() => {
    if (!formData.applies_to_object_id) {
      return null;
    }
    return (
      ledgerEntryOptions.find(opt => opt.id === formData.applies_to_object_id)
        ?.label ?? null
    );
  }, [formData.applies_to_object_id, ledgerEntryOptions]);

  const previewAmountLabel = `UGX ${(formData.amount || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;

  const previewAccountLabel =
    selectedAccountLabel ||
    (formData.account_type ? `${formData.account_type} account` : 'Payment');

  const renderSelectRow = (
    label: string,
    value: string | null,
    placeholder: string,
    onPress: () => void,
    error?: string,
    spaced?: boolean,
  ) => (
    <>
      <Text
        style={[
          styles.fieldLabel,
          payTheme.fieldLabel,
          spaced && styles.fieldLabelSpaced,
        ]}>
        {label}
      </Text>
      <TouchableOpacity
        style={[styles.selectRow, payTheme.selectRow]}
        onPress={onPress}
        activeOpacity={0.7}>
        <Text
          style={[
            styles.selectRowText,
            payTheme.selectRowText,
            !value && [styles.selectRowPlaceholder, payTheme.selectRowPlaceholder],
          ]}
          numberOfLines={2}>
          {value || placeholder}
        </Text>
        <Text style={[styles.selectRowChevron, payTheme.selectRowChevron]}>›</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.pageRoot, payTheme.pageRoot]}>
        <SafeAreaView
          style={[styles.safeArea, payTheme.safeArea]}
          edges={['top', 'left', 'right']}>
          <View style={[styles.page, payTheme.page]}>
            <View style={[styles.pageHeader, payTheme.pageHeader]}>
              <QuickIconPressable
                onPress={onClose}
                style={styles.headerIconButton}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityLabel="Close">
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={[styles.headerIcon, payTheme.headerIcon]}
                  resizeMode="contain"
                />
              </QuickIconPressable>

              {canSave ? (
                <TouchableOpacity
                  style={[
                    styles.headerSaveButton,
                    (loading || loadingDropdowns) && styles.buttonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={loading || loadingDropdowns}
                  activeOpacity={0.85}>
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.headerSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.headerSaveSpacer} />
              )}
            </View>

            {loadingDropdowns ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary2} />
                <Text style={[styles.loadingText, payTheme.loadingText]}>
                  Loading form data…
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.formContainer}
                contentContainerStyle={[
                  styles.formContent,
                  {paddingBottom: Math.max(insets.bottom, 28) + 16},
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <Text style={[styles.pageTitle, payTheme.pageTitle]}>
                  {isEditMode ? 'Edit payment' : 'Add payment'}
                </Text>

                <View style={styles.previewSection}>
                  <View style={styles.paymentPreviewCard}>
                    <View style={styles.paymentPreviewTop}>
                      <Image
                        source={icons.wallet as ImageSourcePropType}
                        style={styles.paymentPreviewIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.paymentPreviewAccount} numberOfLines={1}>
                        {previewAccountLabel}
                      </Text>
                    </View>
                    <Text style={styles.paymentPreviewAmount} numberOfLines={1}>
                      {previewAmountLabel}
                    </Text>
                    <Text style={styles.paymentPreviewDate} numberOfLines={1}>
                      {formData.posting_date || 'Posting date'} ·{' '}
                      {formData.document_type}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, payTheme.sectionTitle]}>
                    Document
                  </Text>

                  {isEditMode && payment?.document_no ? (
                    <>
                      <Text style={[styles.fieldLabel, payTheme.fieldLabel]}>
                        Document no.
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          payTheme.input,
                          styles.inputDisabled,
                          payTheme.inputDisabled,
                        ]}
                        value={payment.document_no}
                        editable={false}
                      />
                    </>
                  ) : null}

                  {renderSelectRow(
                    'Posting date *',
                    formData.posting_date || null,
                    'Select date',
                    () => setShowDatePicker(true),
                    errors.posting_date,
                  )}
                  {showDatePicker ? (
                    <DateTimePicker
                      value={
                        formData.posting_date
                          ? new Date(formData.posting_date)
                          : new Date()
                      }
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                      maximumDate={new Date()}
                    />
                  ) : null}

                  {renderSelectRow(
                    'Document type',
                    formData.document_type,
                    'Select document type',
                    () => setDocumentTypePickerVisible(true),
                    undefined,
                    true,
                  )}

                  {isEditMode ? (
                    <>
                      <Text
                        style={[
                          styles.fieldLabel,
                          payTheme.fieldLabel,
                          styles.fieldLabelSpaced,
                        ]}>
                        Status
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          payTheme.input,
                          styles.inputDisabled,
                          payTheme.inputDisabled,
                        ]}
                        value={formData.status}
                        editable={false}
                      />
                    </>
                  ) : null}
                </View>

                <View style={[styles.sectionDivider, payTheme.sectionDivider]} />

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, payTheme.sectionTitle]}>
                    Account
                  </Text>

                  <Text style={[styles.fieldLabel, payTheme.fieldLabel]}>
                    Description
                  </Text>
                  <TextInput
                    style={[styles.input, payTheme.input, styles.textArea]}
                    value={formData.description}
                    onChangeText={text =>
                      setFormData({...formData, description: text})
                    }
                    placeholder="What is this payment for?"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={4}
                  />

                  {renderSelectRow(
                    'Account type *',
                    formData.account_type,
                    'Select account type',
                    () => setAccountTypePickerVisible(true),
                    errors.account_type,
                    true,
                  )}

                  {formData.account_type ? (
                    loadingDropdowns ? (
                      <View style={styles.inlineLoadingRow}>
                        <ActivityIndicator size="small" color={COLORS.primary2} />
                        <Text
                          style={[
                            styles.inlineLoadingText,
                            payTheme.inlineLoadingText,
                          ]}>
                          Loading accounts…
                        </Text>
                      </View>
                    ) : (
                      renderSelectRow(
                        `${formData.account_type} *`,
                        selectedAccountLabel,
                        `Search ${formData.account_type.toLowerCase()}`,
                        () => setAccountPickerVisible(true),
                        errors.account_object_id,
                        true,
                      )
                    )
                  ) : null}
                </View>

                <View style={[styles.sectionDivider, payTheme.sectionDivider]} />

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, payTheme.sectionTitle]}>
                    Payment details
                  </Text>

                  {renderSelectRow(
                    'Payment method (optional)',
                    selectedPaymentMethodLabel,
                    'Search payment methods',
                    () => setPaymentMethodPickerVisible(true),
                  )}

                  <Text
                    style={[
                      styles.fieldLabel,
                      payTheme.fieldLabel,
                      styles.fieldLabelSpaced,
                    ]}>
                    Amount (UGX) *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      payTheme.input,
                      errors.amount && styles.inputError,
                    ]}
                    value={formatAmountInput(formData.amount)}
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                  {errors.amount ? (
                    <Text style={styles.errorText}>{errors.amount}</Text>
                  ) : null}
                </View>

                {formData.account_type === 'Customer' ||
                formData.account_type === 'Vendor' ? (
                  <>
                    <View
                      style={[styles.sectionDivider, payTheme.sectionDivider]}
                    />
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, payTheme.sectionTitle]}>
                        Applies to (optional)
                      </Text>

                      {renderSelectRow(
                        'Document type',
                        formData.applies_to_doc_type || null,
                        'Select document type',
                        () => setAppliesToDocTypePickerVisible(true),
                        undefined,
                        false,
                      )}

                      {formData.applies_to_doc_type
                        ? renderSelectRow(
                            'Document',
                            selectedAppliesToLabel,
                            'Search open documents',
                            () => setAppliesToDocumentPickerVisible(true),
                            errors.applies_to_object_id,
                            true,
                          )
                        : null}
                    </View>
                  </>
                ) : null}

                <View style={[styles.sectionDivider, payTheme.sectionDivider]} />

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, payTheme.sectionTitle]}>
                    Posting
                  </Text>
                  <View style={[styles.infoCard, payTheme.infoCard]}>
                    <Text style={[styles.infoCardTitle, payTheme.infoCardTitle]}>
                      Before you post
                    </Text>
                    <Text style={[styles.infoCardBody, payTheme.infoCardBody]}>
                      Save the payment as Open first. Post it from the payment
                      list when you are ready to create ledger entries.
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <SearchableSelectModal
        visible={documentTypePickerVisible}
        title="Document type"
        options={documentTypeOptions}
        selectedId={formData.document_type}
        searchPlaceholder="Search document types…"
        onClose={() => setDocumentTypePickerVisible(false)}
        onSelect={id => {
          if (typeof id === 'string') {
            setFormData({...formData, document_type: id});
          }
          setDocumentTypePickerVisible(false);
        }}
      />

      <SearchableSelectModal
        visible={accountTypePickerVisible}
        title="Account type"
        options={accountTypeOptions}
        selectedId={formData.account_type || null}
        searchPlaceholder="Search account types…"
        onClose={() => setAccountTypePickerVisible(false)}
        onSelect={id => {
          if (typeof id === 'string') {
            handleAccountTypeChange(id);
          }
          setAccountTypePickerVisible(false);
        }}
      />

      <SearchableSelectModal
        visible={accountPickerVisible}
        title={`Select ${formData.account_type || 'account'}`}
        options={accountOptions}
        selectedId={formData.account_object_id ?? null}
        searchPlaceholder={`Search ${formData.account_type?.toLowerCase() || 'accounts'}…`}
        onClose={() => setAccountPickerVisible(false)}
        onSelect={id => {
          if (id == null || id === '') {
            setFormData({...formData, account_object_id: null});
          } else if (formData.account_type === 'G/L Account') {
            void handleAccountChange(String(id));
          } else {
            void handleAccountChange(Number(id));
          }
          setAccountPickerVisible(false);
        }}
      />

      <SearchableSelectModal
        visible={paymentMethodPickerVisible}
        title="Payment method"
        options={paymentMethodOptions}
        selectedId={formData.payment_method}
        searchPlaceholder="Search payment methods…"
        allowClear
        clearLabel="No payment method"
        onClose={() => setPaymentMethodPickerVisible(false)}
        onSelect={id => {
          if (typeof id === 'number') {
            handlePaymentMethodChange(id);
          } else {
            setFormData({...formData, payment_method: null});
          }
          setPaymentMethodPickerVisible(false);
        }}
      />

      <SearchableSelectModal
        visible={appliesToDocTypePickerVisible}
        title="Applies to document type"
        options={appliesToDocTypeOptions}
        selectedId={formData.applies_to_doc_type || null}
        searchPlaceholder="Search document types…"
        allowClear
        clearLabel="None"
        onClose={() => setAppliesToDocTypePickerVisible(false)}
        onSelect={id => {
          setFormData({
            ...formData,
            applies_to_doc_type: typeof id === 'string' ? id : '',
            applies_to_content_type_id: null,
            applies_to_object_id: null,
          });
          setAppliesToDocTypePickerVisible(false);
        }}
      />

      <SearchableSelectModal
        visible={appliesToDocumentPickerVisible}
        title="Applies to document"
        options={ledgerEntryOptions}
        selectedId={formData.applies_to_object_id ?? null}
        searchPlaceholder="Search documents…"
        allowClear
        clearLabel="None"
        onClose={() => setAppliesToDocumentPickerVisible(false)}
        onSelect={id => {
          if (typeof id === 'number') {
            setFormData({
              ...formData,
              applies_to_content_type_id: formData.account_content_type_id,
              applies_to_object_id: id,
            });
          } else {
            setFormData({
              ...formData,
              applies_to_content_type_id: null,
              applies_to_object_id: null,
            });
          }
          setAppliesToDocumentPickerVisible(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  page: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary3,
  },
  headerSaveButton: {
    minWidth: 108,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  headerSaveSpacer: {
    minWidth: 108,
    height: 48,
  },
  headerSaveText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
    minHeight: 200,
  },
  loadingText: {
    ...FONTS.body3,
    marginTop: SIZES.base,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 20,
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  paymentPreviewCard: {
    width: '100%',
    maxWidth: 320,
    minHeight: 132,
    borderRadius: 12,
    backgroundColor: COLORS.primary3,
    paddingHorizontal: 20,
    paddingVertical: 18,
    justifyContent: 'space-between',
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  paymentPreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentPreviewIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.accent2,
  },
  paymentPreviewAccount: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },
  paymentPreviewAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 12,
    letterSpacing: -0.5,
  },
  paymentPreviewDate: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  fieldLabelSpaced: {
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: COLORS.black,
    backgroundColor: COLORS.white,
    minHeight: 56,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  inputDisabled: {
    backgroundColor: COLORS.lightGray2,
    color: COLORS.gray2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    ...FONTS.body5,
    color: COLORS.error,
    marginTop: 8,
    fontSize: 13,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  selectRowText: {
    flex: 1,
    fontSize: 17,
    color: COLORS.black,
  },
  selectRowPlaceholder: {
    color: COLORS.gray2,
  },
  selectRowChevron: {
    fontSize: 22,
    color: COLORS.gray2,
    fontWeight: '300',
    marginLeft: 8,
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  inlineLoadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginLeft: 12,
    fontSize: 15,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.transparentPrimary,
    marginBottom: 26,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.transparentPrimary,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 8,
  },
  infoCardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.gray,
  },
});

export default PaymentFormModal;

