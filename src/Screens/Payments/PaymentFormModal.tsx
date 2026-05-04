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
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Picker} from '@react-native-picker/picker';
import {QuickIconPressable} from '../../Components';
import {
  COLORS,
  FONTS,
  SIZES,
  ICON_BUTTON_HIT_SLOP,
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

  const themeStyles = useMemo(
    () => ({
      loadingText: {
        color: colors.textSecondary,
      },
      sectionTitle: {
        color: colors.textPrimary,
      },
      label: {
        color: colors.textPrimary,
      },
      input: {
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      disabledInput: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      pickerWrap: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      picker: {
        backgroundColor: colors.inputBackground,
        color: colors.textPrimary,
      },
    }),
    [colors],
  );

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
        setCustomers(customersRes.results);
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
  const handleAccountChange = async (accountId: number) => {
    setFormData({
      ...formData,
      account_object_id: accountId,
      applies_to_doc_type: '',
      applies_to_content_type_id: null,
      applies_to_object_id: null,
    });

    // Load ledger entries
    if (formData.account_type && accountId) {
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
      return customers.map(customer => ({
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.pageRoot, {backgroundColor: colors.background}]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.page, {backgroundColor: colors.background}]}>
          <View
            style={[
              styles.pageHeader,
              {
                paddingTop: Math.max(
                  insets.top,
                  Platform.OS === 'ios' ? 12 : 16,
                ),
              },
            ]}>
            <QuickIconPressable
              onPress={onClose}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Close">
              <Image
                source={icons.cross}
                style={[
                  styles.headerCloseIcon,
                  {tintColor: colors.textPrimary},
                ]}
                resizeMode="contain"
              />
            </QuickIconPressable>
            {canSave ? (
              <TouchableOpacity
                style={[
                  styles.headerSaveButton,
                  (loading || loadingDropdowns) &&
                    styles.headerSaveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={loading || loadingDropdowns}
                activeOpacity={0.85}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.headerSaveText}>
                    {isEditMode ? 'Save' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSaveSpacer} />
            )}
          </View>

          {loadingDropdowns ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary2} />
              <Text style={[styles.loadingText, themeStyles.loadingText]}>
                Loading form data...
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
              <Text style={[styles.pageTitle, {color: colors.textPrimary}]}>
                {isEditMode ? 'Edit payment' : 'Create payment'}
              </Text>

              {/* Document Information Section */}
              <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>
                Document information
              </Text>

                {/* Document No (Read-only) */}
                {isEditMode && payment?.document_no && (
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, themeStyles.label]}>
                      Document no
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        themeStyles.input,
                        styles.disabledInput,
                        themeStyles.disabledInput,
                      ]}
                      value={payment.document_no}
                      editable={false}
                    />
                  </View>
                )}

                {/* Posting Date */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Posting date *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      themeStyles.input,
                      errors.posting_date && styles.inputError,
                    ]}
                    value={formData.posting_date}
                    onChangeText={text =>
                      setFormData({...formData, posting_date: text})
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.placeholder}
                  />
                  {errors.posting_date && (
                    <Text style={styles.errorText}>{errors.posting_date}</Text>
                  )}
                </View>

                {/* Document Type */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Document type
                  </Text>
                  <View
                    style={[styles.pickerContainer, themeStyles.pickerWrap]}>
                    <Picker
                      selectedValue={formData.document_type}
                      onValueChange={value =>
                        setFormData({...formData, document_type: value})
                      }
                      style={[styles.picker, themeStyles.picker]}
                      itemStyle={{color: colors.textPrimary}}
                      dropdownIconColor={colors.textPrimary}>
                      <Picker.Item label="Payment" value="Payment" />
                      <Picker.Item label="Refund" value="Refund" />
                    </Picker>
                  </View>
                </View>

                {/* Status (Read-only) */}
                {isEditMode && (
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, themeStyles.label]}>Status</Text>
                    <TextInput
                      style={[
                        styles.input,
                        themeStyles.input,
                        styles.disabledInput,
                        themeStyles.disabledInput,
                      ]}
                      value={formData.status}
                      editable={false}
                    />
                  </View>
                )}

                {/* Account Information Section */}
                <Text
                  style={[
                    styles.sectionTitle,
                    styles.sectionTitleMargin,
                    themeStyles.sectionTitle,
                  ]}>
                  Account information
                </Text>

                {/* Description */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Description
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      themeStyles.input,
                      styles.textArea,
                    ]}
                    value={formData.description}
                    onChangeText={text =>
                      setFormData({...formData, description: text})
                    }
                    placeholder="Enter payment description"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Account Type */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Account type *
                  </Text>
                  <View
                    style={[styles.pickerContainer, themeStyles.pickerWrap]}>
                    <Picker
                      selectedValue={formData.account_type || ''}
                      onValueChange={value => {
                        if (value === '') {
                          handleAccountTypeChange('');
                        } else {
                          handleAccountTypeChange(value);
                        }
                      }}
                      style={[styles.picker, themeStyles.picker]}
                      itemStyle={{color: colors.textPrimary}}
                      dropdownIconColor={colors.textPrimary}>
                      <Picker.Item
                        label="-- Select Account Type --"
                        value=""
                      />
                      <Picker.Item label="Customer" value="Customer" />
                      <Picker.Item label="Vendor" value="Vendor" />
                      <Picker.Item label="G/L Account" value="G/L Account" />
                    </Picker>
                  </View>
                  {errors.account_type && (
                    <Text style={styles.errorText}>{errors.account_type}</Text>
                  )}
                </View>

                {/* Account Selection */}
                {formData.account_type && (
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, themeStyles.label]}>
                      {formData.account_type} *
                    </Text>
                    <View
                      style={[styles.pickerContainer, themeStyles.pickerWrap]}>
                      <Picker
                        selectedValue={
                          formData.account_object_id?.toString() || '0'
                        }
                        onValueChange={value => {
                          if (value === '0' || value === 0) {
                            setFormData({
                              ...formData,
                              account_object_id: null,
                            });
                          } else {
                            // For GL accounts, value is a string (account no)
                            // For Customer/Vendor, value is a number (ID)
                            const accountId =
                              formData.account_type === 'G/L Account'
                                ? value
                                : parseInt(value.toString(), 10);
                            handleAccountChange(accountId);
                          }
                        }}
                        style={[styles.picker, themeStyles.picker]}
                        itemStyle={{color: colors.textPrimary}}
                        dropdownIconColor={colors.textPrimary}>
                        <Picker.Item
                          label={`Select ${formData.account_type.toLowerCase()}`}
                          value="0"
                        />
                        {getAvailableAccounts().map(account => (
                          <Picker.Item
                            key={account.id.toString()}
                            label={account.label}
                            value={account.id.toString()}
                          />
                        ))}
                      </Picker>
                    </View>
                    {errors.account_object_id && (
                      <Text style={styles.errorText}>
                        {errors.account_object_id}
                      </Text>
                    )}
                  </View>
                )}

                {/* Payment Information Section */}
                <Text
                  style={[
                    styles.sectionTitle,
                    styles.sectionTitleMargin,
                    themeStyles.sectionTitle,
                  ]}>
                  Payment information
                </Text>

                {/* Payment Method */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Payment method (optional)
                  </Text>
                  <View
                    style={[styles.pickerContainer, themeStyles.pickerWrap]}>
                    <Picker
                      selectedValue={formData.payment_method || 0}
                      onValueChange={value => {
                        if (value === 0) {
                          setFormData({...formData, payment_method: null});
                        } else {
                          handlePaymentMethodChange(value);
                        }
                      }}
                      style={[styles.picker, themeStyles.picker]}
                      itemStyle={{color: colors.textPrimary}}
                      dropdownIconColor={colors.textPrimary}>
                      <Picker.Item label="Select payment method" value={0} />
                      {paymentMethods.map(method => (
                        <Picker.Item
                          key={method.id}
                          label={`${method.code} - ${method.description}`}
                          value={method.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Amount */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Amount (UGX) *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      themeStyles.input,
                      errors.amount && styles.inputError,
                    ]}
                    value={
                      formData.amount === 0 ? '' : formData.amount.toString()
                    }
                    onChangeText={text => {
                      const numValue = text === '' ? 0 : parseInt(text, 10);
                      if (!isNaN(numValue)) {
                        setFormData({...formData, amount: numValue});
                      }
                    }}
                    placeholder="Enter amount"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                  {errors.amount && (
                    <Text style={styles.errorText}>{errors.amount}</Text>
                  )}
                </View>

                {/* Applies To Section */}
                {formData.account_type &&
                  (formData.account_type === 'Customer' ||
                    formData.account_type === 'Vendor') && (
                    <>
                      <Text
                        style={[
                          styles.sectionTitle,
                          styles.sectionTitleMargin,
                          themeStyles.sectionTitle,
                        ]}>
                        Applies to (optional)
                      </Text>

                      <View style={styles.fieldContainer}>
                        <Text style={[styles.label, themeStyles.label]}>
                          Document type
                        </Text>
                        <View
                          style={[
                            styles.pickerContainer,
                            themeStyles.pickerWrap,
                          ]}>
                          <Picker
                            selectedValue={formData.applies_to_doc_type || ''}
                            onValueChange={value =>
                              setFormData({
                                ...formData,
                                applies_to_doc_type: value || '',
                                applies_to_content_type_id: null,
                                applies_to_object_id: null,
                              })
                            }
                            style={[styles.picker, themeStyles.picker]}
                            itemStyle={{color: colors.textPrimary}}
                            dropdownIconColor={colors.textPrimary}>
                            <Picker.Item label="-- Select --" value="" />
                            <Picker.Item label="Invoice" value="Invoice" />
                            <Picker.Item
                              label="Credit Memo"
                              value="Credit Memo"
                            />
                            <Picker.Item label="Payment" value="Payment" />
                          </Picker>
                        </View>
                      </View>

                      {formData.applies_to_doc_type && (
                        <View style={styles.fieldContainer}>
                          <Text style={[styles.label, themeStyles.label]}>
                            Document
                          </Text>
                          <View
                            style={[
                              styles.pickerContainer,
                              themeStyles.pickerWrap,
                            ]}>
                            <Picker
                              selectedValue={formData.applies_to_object_id || 0}
                              onValueChange={value => {
                                if (value === 0) {
                                  setFormData({
                                    ...formData,
                                    applies_to_content_type_id: null,
                                    applies_to_object_id: null,
                                  });
                                } else {
                                  // Set applies_to_content_type_id to match account_content_type_id
                                  // since ledger entries are related to the same account type
                                  setFormData({
                                    ...formData,
                                    applies_to_content_type_id:
                                      formData.account_content_type_id,
                                    applies_to_object_id: value,
                                  });
                                }
                              }}
                              style={[styles.picker, themeStyles.picker]}
                              itemStyle={{color: colors.textPrimary}}
                              dropdownIconColor={colors.textPrimary}>
                              <Picker.Item label="Select document" value={0} />
                              {getAvailableLedgerEntries().map(entry => (
                                <Picker.Item
                                  key={entry.id}
                                  label={entry.label}
                                  value={entry.id}
                                />
                              ))}
                            </Picker>
                          </View>
                          {errors.applies_to_object_id && (
                            <Text style={styles.errorText}>
                              {errors.applies_to_object_id}
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCloseIcon: {
    width: 20,
    height: 20,
  },
  headerSaveButton: {
    minWidth: 108,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerSaveButtonDisabled: {
    opacity: 0.55,
  },
  headerSaveSpacer: {
    minWidth: 108,
    height: 48,
  },
  headerSaveText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
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
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    ...FONTS.h4,
    fontWeight: '600',
    paddingHorizontal: 0,
    paddingTop: SIZES.base * 1.5,
    paddingBottom: SIZES.base,
  },
  sectionTitleMargin: {
    marginTop: SIZES.base,
  },
  fieldContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  label: {
    ...FONTS.body3,
    marginBottom: SIZES.base / 2,
    fontWeight: '600',
  },
  input: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    ...FONTS.body3,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: SIZES.base,
  },
  disabledInput: {},
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    ...FONTS.body5,
    color: COLORS.error,
    marginTop: SIZES.base / 2,
  },
  pickerContainer: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
});

export default PaymentFormModal;

