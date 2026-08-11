import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';
import {
  formatCurrencyCompact,
  formatCurrencyLabel,
} from '../../utils/currency';
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
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {QuickIconPressable, SearchableSelectModal} from '../../Components';
import {COLORS, FONTS, icons} from '../../constants';
import {
  Expense,
  ExpenseType,
  PaymentMethod,
  ExpenseFormValues,
} from '../../@types/expense';
import {ExpenseServices} from '../../services/ExpenseServices';
import Toast from 'react-native-toast-message';
import {useTheme} from '../../context/ThemeContext';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {isUnpaidPaymentMethod} from '../../utils/paymentMethodDefaults';

const emptyExpenseForm = (): ExpenseFormValues => ({
  posting_date: new Date().toISOString().split('T')[0],
  expense_type: null,
  description: '',
  amount: '',
  payment_method: null,
  status: 'Open',
});

const expenseToForm = (expense: Expense): ExpenseFormValues => ({
  posting_date: expense.posting_date,
  expense_type: expense.expense_type,
  description: expense.description || '',
  amount: expense.amount != null ? String(expense.amount) : '',
  payment_method: expense.payment_method || null,
  status: expense.status === 'Posted' ? 'Posted' : 'Open',
});

const parseAmount = (value: string) =>
  parseFloat(String(value || '').replace(/,/g, '')) || 0;

const extractApiErrorMessage = (
  error: any,
  field: string,
  fallback: string,
): string => {
  const data = error?.response?.data;
  const fieldErrors = data?.errors?.[field] || data?.[field];
  if (Array.isArray(fieldErrors) && fieldErrors[0]) {
    return String(fieldErrors[0]);
  }
  if (typeof fieldErrors === 'string') {
    return fieldErrors;
  }
  const raw = data?.error ?? data?.detail ?? data?.message;
  if (typeof raw === 'string') {
    const match = raw.match(/string='([^']+)'/);
    if (match?.[1]) {
      return match[1].replace(/^"|"$/g, '');
    }
    if (!raw.includes('ErrorDetail') && !raw.startsWith('{')) {
      return raw;
    }
  }
  return fallback;
};

interface ExpenseFormModalProps {
  visible: boolean;
  onClose: () => void;
  expense: Expense | null;
  /** Called after a successful auto-save so the list can refresh (does not close). */
  onSave: () => void;
  /** Keeps parent selection in sync after create / update. */
  onRecordChange?: (expense: Expense) => void;
  expenseTypes: ExpenseType[];
  paymentMethods: PaymentMethod[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPost: boolean;
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  visible,
  onClose,
  expense,
  onSave,
  onRecordChange,
  expenseTypes,
  paymentMethods,
  canCreate,
  canEdit,
  canDelete: _canDelete,
  canPost,
}) => {
  const {colors} = useTheme();
  const topInset = useScreenTopInset();
  const expTheme = useMemo(
    () => ({
      pageRoot: {backgroundColor: colors.background},
      safeArea: {backgroundColor: colors.background},
      page: {backgroundColor: colors.background},
      pageHeader: {
        borderBottomColor: colors.border,
      },
      headerIcon: {tintColor: colors.textPrimary},
      pageTitle: {color: colors.textPrimary},
      autoSaveHint: {color: colors.textSecondary},
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
      selectRowDisabled: {backgroundColor: colors.screenMuted},
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
    }),
    [colors],
  );

  const [formData, setFormData] = useState<ExpenseFormValues>(emptyExpenseForm);
  const [currentRecord, setCurrentRecord] = useState<Expense | null>(expense);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expenseTypePickerVisible, setExpenseTypePickerVisible] =
    useState(false);
  const [paymentMethodPickerVisible, setPaymentMethodPickerVisible] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formDataRef = useRef(formData);
  const currentRecordRef = useRef(currentRecord);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formDataRef.current = formData;
  currentRecordRef.current = currentRecord;

  const isPersisted = !!currentRecord?.id;
  const isPosted =
    currentRecord?.status === 'Posted' || expense?.status === 'Posted';
  const canWrite = isPersisted ? canEdit : canCreate;

  useEffect(() => {
    if (!visible) {
      setCurrentRecord(null);
      setFormData(emptyExpenseForm());
      setErrors({});
      setShowSaved(false);
      setShowDatePicker(false);
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      return;
    }

    if (expense?.id) {
      if (currentRecordRef.current?.id !== expense.id) {
        setCurrentRecord(expense);
        setFormData(expenseToForm(expense));
      } else {
        setCurrentRecord(expense);
      }
    } else if (!currentRecordRef.current?.id) {
      setCurrentRecord(null);
      setFormData(emptyExpenseForm());
    }
    setErrors({});
    setShowSaved(false);
  }, [expense?.id, visible]);

  const flashSaved = useCallback(() => {
    setShowSaved(true);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => {
      setShowSaved(false);
      savedTimerRef.current = null;
    }, 2000);
  }, []);

  const buildPayload = useCallback(
    (
      values: ExpenseFormValues,
      options?: {forUpdate?: boolean},
    ): Partial<Expense> => {
      const amountValue = parseAmount(values.amount);
      const payload: Partial<Expense> = {
        posting_date: values.posting_date,
        expense_type: values.expense_type!,
        document_type: 'Expense',
        amount: amountValue,
        status: values.status || 'Open',
      };
      if (values.description?.trim()) {
        payload.description = values.description.trim();
      } else if (options?.forUpdate) {
        payload.description = '';
      }
      if (values.payment_method) {
        payload.payment_method = values.payment_method;
      } else if (options?.forUpdate) {
        (payload as any).payment_method = null;
      }
      return payload;
    },
    [],
  );

  const canCreateFromValues = (values: ExpenseFormValues) =>
    !!values.posting_date &&
    !!values.expense_type &&
    parseAmount(values.amount) > 0;

  const autoSaveField = useCallback(
    async (field: keyof ExpenseFormValues, rawValue: any) => {
      if (!visible || isPosted || !canWrite || savingRef.current) {
        return;
      }

      const value =
        typeof rawValue === 'string' && field !== 'amount'
          ? rawValue.trim()
          : rawValue;
      const record = currentRecordRef.current;
      const values = {...formDataRef.current, [field]: rawValue};

      const previous = (formDataRef.current as any)[field];
      if (field === 'amount') {
        if (parseAmount(String(previous ?? '')) === parseAmount(String(value ?? ''))) {
          return;
        }
      } else if (String(previous ?? '') === String(value ?? '')) {
        return;
      }

      if (field === 'amount' && parseAmount(String(value ?? '')) <= 0) {
        setErrors(prev => ({
          ...prev,
          amount: 'Amount must be greater than 0',
        }));
        return;
      }
      if (field === 'expense_type' && !value) {
        setErrors(prev => ({
          ...prev,
          expense_type: 'Expense type is required',
        }));
        return;
      }
      if (field === 'posting_date' && !value) {
        setErrors(prev => ({
          ...prev,
          posting_date: 'Posting date is required',
        }));
        return;
      }

      if (!record?.id && !canCreateFromValues(values)) {
        // Wait until required fields are present before creating.
        return;
      }

      setErrors(prev => {
        const next = {...prev};
        delete next[field as string];
        return next;
      });

      savingRef.current = true;
      setIsSaving(true);
      try {
        if (!record?.id) {
          const created = await ExpenseServices.createExpense(
            buildPayload(values),
          );
          setCurrentRecord(created);
          setFormData(expenseToForm(created));
          onRecordChange?.(created);
          onSave();
          flashSaved();
        } else {
          const updated = await ExpenseServices.updateExpense(
            record.id,
            buildPayload(values, {forUpdate: true}),
          );
          setCurrentRecord(updated);
          setFormData(expenseToForm(updated));
          onRecordChange?.(updated);
          onSave();
          flashSaved();
        }
      } catch (error: any) {
        console.error('Error auto-saving expense:', error);
        const message = extractApiErrorMessage(
          error,
          field as string,
          `Failed to save ${String(field).replace(/_/g, ' ')}`,
        );
        setErrors(prev => ({...prev, [field as string]: message}));
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: message,
        });
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [
      visible,
      isPosted,
      canWrite,
      buildPayload,
      onRecordChange,
      onSave,
      flashSaved,
    ],
  );

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (!selectedDate) {
      return;
    }
    const nextDate = selectedDate.toISOString().split('T')[0];
    setFormData(prev => ({...prev, posting_date: nextDate}));
    void autoSaveField('posting_date', nextDate);
  };

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.]/g, '');
    setFormData(prev => ({...prev, amount: numericValue}));
  };

  const formatAmount = (value: string) => {
    if (!value) {
      return '';
    }
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    return numValue.toLocaleString();
  };

  const expenseTypeName = useMemo(() => {
    if (!formData.expense_type) {
      return null;
    }
    return expenseTypes.find(t => t.id === formData.expense_type)?.name ?? null;
  }, [formData.expense_type, expenseTypes]);

  const expensePaymentMethods = useMemo(
    () => paymentMethods.filter(method => !isUnpaidPaymentMethod(method)),
    [paymentMethods],
  );

  const paymentMethodName = useMemo(() => {
    if (!formData.payment_method) {
      return null;
    }
    const method = expensePaymentMethods.find(
      m => m.id === formData.payment_method,
    );
    return method?.description || method?.code || null;
  }, [formData.payment_method, expensePaymentMethods]);

  const expenseTypeOptions = useMemo(
    () =>
      expenseTypes.map(type => ({
        id: type.id,
        label: type.name,
        subtitle: type.code,
      })),
    [expenseTypes],
  );

  const paymentMethodOptions = useMemo(
    () =>
      expensePaymentMethods.map(method => ({
        id: method.id,
        label: method.description || method.code,
        subtitle: method.code !== method.description ? method.code : undefined,
      })),
    [expensePaymentMethods],
  );

  const previewAmountLabel = useMemo(() => {
    const raw = formData.amount?.replace(/,/g, '') ?? '';
    if (!raw || parseFloat(raw) <= 0) {
      return '—';
    }
    return formatCurrencyCompact(parseFloat(raw) || 0);
  }, [formData.amount]);

  const handlePost = async () => {
    if (!formData.payment_method) {
      Alert.alert(
        'Payment Method Required',
        'Please select a payment method before posting.',
      );
      return;
    }

    if (!isPersisted || !currentRecord) {
      Alert.alert(
        'Save first',
        'Fill expense type and amount so the expense auto-saves, then post.',
      );
      return;
    }

    Alert.alert(
      'Post Expense',
      'Are you sure you want to post this expense? This will create G/L entries.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Post',
          onPress: async () => {
            setPosting(true);
            try {
              const result = await ExpenseServices.postExpense(currentRecord.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: result.message || 'Expense posted successfully',
              });
              const refreshed = await ExpenseServices.getExpense(currentRecord.id);
              setCurrentRecord(refreshed);
              setFormData(expenseToForm(refreshed));
              onRecordChange?.(refreshed);
              onSave();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to post expense',
              });
            } finally {
              setPosting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.pageRoot, expTheme.pageRoot]}>
        <SafeAreaView
          style={[styles.safeArea, expTheme.safeArea]}
          edges={['left', 'right']}>
          <View style={[styles.page, expTheme.page]}>
            <View
              style={[
                styles.pageHeader,
                expTheme.pageHeader,
                {paddingTop: topInset},
              ]}>
              <QuickIconPressable
                onPress={onClose}
                style={styles.headerIconButton}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityLabel="Close">
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={[styles.headerIcon, expTheme.headerIcon]}
                  resizeMode="contain"
                />
              </QuickIconPressable>

              <View style={styles.headerRightActions}>
                {canPost && isPersisted && currentRecord?.status === 'Open' ? (
                  <TouchableOpacity
                    style={[
                      styles.headerPostButton,
                      posting && styles.buttonDisabled,
                    ]}
                    onPress={handlePost}
                    disabled={posting || isSaving}
                    activeOpacity={0.85}>
                    {posting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.headerPostText}>Post</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                {canWrite && !isPosted && (isSaving || showSaved) ? (
                  <View
                    style={styles.headerStatus}
                    accessibilityRole="text"
                    accessibilityLabel={isSaving ? 'Saving' : 'Saved'}>
                    <Text
                      style={[
                        styles.headerStatusText,
                        {color: colors.textSecondary},
                      ]}>
                      {isSaving ? 'Saving...' : 'Saved'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.headerStatusSpacer} />
                )}
              </View>
            </View>

            <ScrollView
              style={styles.formContainer}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <Text style={[styles.pageTitle, expTheme.pageTitle]}>
                {isPersisted ? 'Edit expense' : 'Add expense'}
              </Text>
              {!isPosted ? (
                <Text style={[styles.autoSaveHint, expTheme.autoSaveHint]}>
                  Changes save automatically when you leave a field
                </Text>
              ) : null}

              <View style={styles.previewSection}>
                <View style={styles.expensePreviewCard}>
                  <View style={styles.expensePreviewTop}>
                    <Image
                      source={icons.coupon as ImageSourcePropType}
                      style={styles.expensePreviewCoupon}
                      resizeMode="contain"
                    />
                    <Text style={styles.expensePreviewType} numberOfLines={1}>
                      {expenseTypeName || 'Expense type'}
                    </Text>
                  </View>
                  <Text style={styles.expensePreviewAmount} numberOfLines={1}>
                    {previewAmountLabel}
                  </Text>
                  <Text style={styles.expensePreviewDate} numberOfLines={1}>
                    {formData.posting_date || 'Posting date'}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, expTheme.sectionTitle]}>
                  Details
                </Text>

                {isPersisted && currentRecord?.document_no ? (
                  <>
                    <Text style={[styles.fieldLabel, expTheme.fieldLabel]}>
                      Document no.
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        expTheme.input,
                        styles.inputDisabled,
                        expTheme.inputDisabled,
                      ]}
                      value={currentRecord.document_no}
                      editable={false}
                    />
                  </>
                ) : null}

                <Text style={[styles.fieldLabel, expTheme.fieldLabel]}>
                  Posting date *
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectRow,
                    expTheme.selectRow,
                    isPosted && [
                      styles.selectRowDisabled,
                      expTheme.selectRowDisabled,
                    ],
                  ]}
                  onPress={() => !isPosted && canWrite && setShowDatePicker(true)}
                  activeOpacity={0.7}
                  disabled={isPosted || !canWrite}>
                  <Text
                    style={[
                      styles.selectRowText,
                      expTheme.selectRowText,
                      !formData.posting_date && [
                        styles.selectRowPlaceholder,
                        expTheme.selectRowPlaceholder,
                      ],
                      isPosted && [styles.disabledText, expTheme.disabledText],
                    ]}>
                    {formData.posting_date || 'Select date'}
                  </Text>
                  <Text
                    style={[styles.selectRowChevron, expTheme.selectRowChevron]}>
                    ›
                  </Text>
                </TouchableOpacity>
                {errors.posting_date ? (
                  <Text style={styles.errorText}>{errors.posting_date}</Text>
                ) : null}
                {showDatePicker ? (
                  <DateTimePicker
                    value={new Date(formData.posting_date)}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                  />
                ) : null}

                <Text
                  style={[
                    styles.fieldLabel,
                    expTheme.fieldLabel,
                    styles.fieldLabelSpaced,
                  ]}>
                  Expense type *
                </Text>
                {expenseTypes.length === 0 ? (
                  <View style={styles.inlineLoadingRow}>
                    <ActivityIndicator size="small" color={COLORS.primary2} />
                    <Text
                      style={[
                        styles.inlineLoadingText,
                        expTheme.inlineLoadingText,
                      ]}>
                      Loading expense types…
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.selectRow,
                      expTheme.selectRow,
                      isPosted && [
                        styles.selectRowDisabled,
                        expTheme.selectRowDisabled,
                      ],
                    ]}
                    onPress={() =>
                      !isPosted && canWrite && setExpenseTypePickerVisible(true)
                    }
                    activeOpacity={0.7}
                    disabled={isPosted || !canWrite}>
                    <Text
                      style={[
                        styles.selectRowText,
                        expTheme.selectRowText,
                        !expenseTypeName && [
                          styles.selectRowPlaceholder,
                          expTheme.selectRowPlaceholder,
                        ],
                        isPosted && [styles.disabledText, expTheme.disabledText],
                      ]}>
                      {expenseTypeName || 'Select expense type'}
                    </Text>
                    <Text
                      style={[
                        styles.selectRowChevron,
                        expTheme.selectRowChevron,
                      ]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                )}
                {errors.expense_type ? (
                  <Text style={styles.errorText}>{errors.expense_type}</Text>
                ) : null}

                <Text
                  style={[
                    styles.fieldLabel,
                    expTheme.fieldLabel,
                    styles.fieldLabelSpaced,
                  ]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.input, expTheme.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={text =>
                    setFormData(prev => ({...prev, description: text}))
                  }
                  onBlur={() =>
                    void autoSaveField(
                      'description',
                      formDataRef.current.description || '',
                    )
                  }
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={4}
                  editable={!isPosted && canWrite}
                />

                <Text
                  style={[
                    styles.fieldLabel,
                    expTheme.fieldLabel,
                    styles.fieldLabelSpaced,
                  ]}>
                  {formatCurrencyLabel('Amount')} *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    expTheme.input,
                    errors.amount && styles.inputError,
                  ]}
                  value={formatAmount(formData.amount)}
                  onChangeText={handleAmountChange}
                  onBlur={() =>
                    void autoSaveField(
                      'amount',
                      formDataRef.current.amount || '',
                    )
                  }
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  editable={!isPosted && canWrite}
                />
                {errors.amount ? (
                  <Text style={styles.errorText}>{errors.amount}</Text>
                ) : null}

                <Text
                  style={[
                    styles.fieldLabel,
                    expTheme.fieldLabel,
                    styles.fieldLabelSpaced,
                  ]}>
                  Payment method
                  {isPosted ? '' : ' (optional)'}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectRow,
                    expTheme.selectRow,
                    isPosted && [
                      styles.selectRowDisabled,
                      expTheme.selectRowDisabled,
                    ],
                  ]}
                  onPress={() =>
                    !isPosted && canWrite && setPaymentMethodPickerVisible(true)
                  }
                  activeOpacity={0.7}
                  disabled={isPosted || !canWrite}>
                  <Text
                    style={[
                      styles.selectRowText,
                      expTheme.selectRowText,
                      !paymentMethodName && [
                        styles.selectRowPlaceholder,
                        expTheme.selectRowPlaceholder,
                      ],
                      isPosted && [styles.disabledText, expTheme.disabledText],
                    ]}>
                    {paymentMethodName || 'Select payment method'}
                  </Text>
                  <Text
                    style={[styles.selectRowChevron, expTheme.selectRowChevron]}>
                    ›
                  </Text>
                </TouchableOpacity>
              </View>

              {isPersisted ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, expTheme.sectionTitle]}>
                    Status
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      expTheme.input,
                      styles.inputDisabled,
                      expTheme.inputDisabled,
                    ]}
                    value={currentRecord?.status || 'Open'}
                    editable={false}
                  />
                </View>
              ) : null}

              <View style={[styles.sectionDivider, expTheme.sectionDivider]} />

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, expTheme.sectionTitle]}>
                  Posting
                </Text>
                <View style={[styles.infoCard, expTheme.infoCard]}>
                  <Text style={[styles.infoCardTitle, expTheme.infoCardTitle]}>
                    {isPosted ? 'This expense is posted' : 'Before you post'}
                  </Text>
                  <Text style={[styles.infoCardBody, expTheme.infoCardBody]}>
                    {isPosted
                      ? 'Posted expenses are read-only. Create a reversal from the list if you need to adjust.'
                      : 'Fill expense type and amount to auto-save as Open, then use Post when you are ready to create G/L entries. A payment method is required to post.'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <SearchableSelectModal
        visible={expenseTypePickerVisible}
        title="Select expense type"
        options={expenseTypeOptions}
        selectedId={formData.expense_type}
        searchPlaceholder="Search expense types…"
        onClose={() => setExpenseTypePickerVisible(false)}
        onSelect={id => {
          const nextType = typeof id === 'number' ? id : null;
          setFormData(prev => ({...prev, expense_type: nextType}));
          setExpenseTypePickerVisible(false);
          void autoSaveField('expense_type', nextType);
        }}
      />

      <SearchableSelectModal
        visible={paymentMethodPickerVisible}
        title="Select payment method"
        options={paymentMethodOptions}
        selectedId={formData.payment_method}
        searchPlaceholder="Search payment methods…"
        allowClear
        clearLabel="No payment method"
        onClose={() => setPaymentMethodPickerVisible(false)}
        onSelect={id => {
          const nextMethod = typeof id === 'number' ? id : null;
          setFormData(prev => ({...prev, payment_method: nextMethod}));
          setPaymentMethodPickerVisible(false);
          void autoSaveField('payment_method', nextMethod);
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerPostButton: {
    minWidth: 88,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  headerPostText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    minWidth: 72,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  headerStatusSpacer: {
    width: 72,
  },
  headerStatusText: {
    color: COLORS.gray2,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.55,
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
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  autoSaveHint: {
    ...FONTS.body5,
    color: COLORS.gray2,
    marginBottom: 18,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  expensePreviewCard: {
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
  expensePreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expensePreviewCoupon: {
    width: 22,
    height: 22,
    tintColor: COLORS.accent2,
  },
  expensePreviewType: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },
  expensePreviewAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 12,
    letterSpacing: -0.5,
  },
  expensePreviewDate: {
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
  disabledText: {
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
  selectRowDisabled: {
    backgroundColor: COLORS.lightGray2,
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

export default ExpenseFormModal;
