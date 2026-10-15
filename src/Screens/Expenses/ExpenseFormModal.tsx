import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';
import {
  formatCurrencyLabel,
  getLocalCurrencyCode,
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
import {
  formatDateYmdLocal,
  parseLocalISODate,
  todayYmdLocal,
  toDateOnly,
} from '../../utils/localDate';
import {isUnpaidPaymentMethod, pickDefaultCashPaymentMethod} from '../../utils/paymentMethodDefaults';

const coercePositiveId = (value: unknown): number | null => {
  if (value == null || value === '' || value === false) {
    return null;
  }
  if (typeof value === 'object') {
    const nested = (value as {id?: unknown; pk?: unknown}).id ?? (value as {pk?: unknown}).pk;
    return coercePositiveId(nested);
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const emptyExpenseForm = (): ExpenseFormValues => ({
  posting_date: todayYmdLocal(),
  expense_type: null,
  description: '',
  amount: '',
  payment_method: null,
  status: 'Open',
});

const expenseToForm = (
  expense: Expense,
  fallback?: ExpenseFormValues | null,
  expenseTypes: ExpenseType[] = [],
): ExpenseFormValues => {
  const typeFromRecord = coercePositiveId(expense.expense_type);
  const typeFromName = expense.expense_type_name
    ? expenseTypes.find(
        type =>
          type.name.trim().toLowerCase() ===
          expense.expense_type_name!.trim().toLowerCase(),
      )?.id ?? null
    : null;

  return {
    posting_date: toDateOnly(expense.posting_date) || fallback?.posting_date || todayYmdLocal(),
    expense_type: typeFromRecord ?? typeFromName ?? fallback?.expense_type ?? null,
    description: expense.description || fallback?.description || '',
    amount:
      expense.amount != null && expense.amount !== ('' as any)
        ? trimTrailingDecimalZeros(sanitizeAmountInput(String(expense.amount)))
        : fallback?.amount || '',
    payment_method:
      coercePositiveId(expense.payment_method) ?? fallback?.payment_method ?? null,
    status:
      expense.status === 'Posted' || expense.status === 'Reversed'
        ? expense.status
        : 'Open',
  };
};

const parseAmount = (value: string) =>
  parseFloat(String(value || '').replace(/,/g, '')) || 0;

/** Commas are thousand separators. Keep digits and at most one decimal point. */
const sanitizeAmountInput = (text: string) => {
  const cleaned = String(text || '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) {
    return cleaned;
  }
  return `${cleaned.slice(0, firstDot)}.${cleaned
    .slice(firstDot + 1)
    .replace(/\./g, '')
    .slice(0, 5)}`;
};

/** Drop API padding like .89000 → .89. Keep a trailing dot while typing. */
const trimTrailingDecimalZeros = (value: string) => {
  if (!value.includes('.')) {
    return value;
  }
  if (value.endsWith('.')) {
    return value;
  }
  const [whole, fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
};

/** 1500000 → 1,500,000. If displayDp is set and the value has a point, show that many decimals (display only). */
const formatAmountWithCommas = (value: string, displayDp?: number) => {
  if (!value) {
    return '';
  }
  const raw = displayDp == null ? trimTrailingDecimalZeros(value) : value;
  const hasDecimal = raw.includes('.');
  const [whole, fraction = ''] = raw.split('.');
  if (displayDp != null && hasDecimal) {
    const n = Number(`${whole || '0'}.${fraction}`);
    if (Number.isFinite(n)) {
      const [roundedWhole, roundedFrac = ''] = n.toFixed(displayDp).split('.');
      const grouped = roundedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${grouped}.${roundedFrac}`;
    }
  }
  const grouped = (whole || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return hasDecimal ? `${grouped}.${fraction}` : grouped;
};

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
  /** Called after a successful post so the parent can close and open posted expenses. */
  onPosted?: () => void;
  /** Called after a successful reverse so the parent can close and refresh history. */
  onReversed?: () => void;
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
  onPosted,
  onReversed,
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
  const [reversing, setReversing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [amountFocused, setAmountFocused] = useState(false);

  const formDataRef = useRef(formData);
  const currentRecordRef = useRef(currentRecord);
  const lastSavedRef = useRef<ExpenseFormValues>(emptyExpenseForm());
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amountSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const amountFocusedRef = useRef(false);

  formDataRef.current = formData;
  currentRecordRef.current = currentRecord;

  const isPersisted = !!currentRecord?.id;
  const recordStatus = currentRecord?.status || expense?.status;
  const isPosted = recordStatus === 'Posted';
  const isReversed = recordStatus === 'Reversed';
  const isLocked = isPosted || isReversed;
  const canWrite = isPersisted ? canEdit : canCreate;

  useEffect(() => {
    if (!visible) {
      setCurrentRecord(null);
      const blank = emptyExpenseForm();
      setFormData(blank);
      lastSavedRef.current = blank;
      setErrors({});
      setShowSaved(false);
      setShowDatePicker(false);
      setAmountFocused(false);
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      if (amountSaveTimerRef.current) {
        clearTimeout(amountSaveTimerRef.current);
        amountSaveTimerRef.current = null;
      }
      amountFocusedRef.current = false;
      return;
    }

    if (expense?.id) {
      if (currentRecordRef.current?.id !== expense.id) {
        setCurrentRecord(expense);
        const next = expenseToForm(expense, formDataRef.current, expenseTypes);
        setFormData(next);
        lastSavedRef.current = next;
      } else {
        // List refresh often has expense_type=0 (page-data has name, not FK).
        // Keep the in-form type/payment method instead of overwriting them.
        setCurrentRecord(prev => ({
          ...expense,
          expense_type:
            coercePositiveId(expense.expense_type) ??
            coercePositiveId(prev?.expense_type) ??
            expense.expense_type,
          expense_type_name:
            expense.expense_type_name || prev?.expense_type_name,
          payment_method:
            coercePositiveId(expense.payment_method) ??
            coercePositiveId(prev?.payment_method) ??
            expense.payment_method,
        }));
      }
    } else if (!currentRecordRef.current?.id) {
      setCurrentRecord(null);
      const blank = emptyExpenseForm();
      setFormData(blank);
      lastSavedRef.current = blank;
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
      const payload: Partial<Expense> = {
        posting_date: toDateOnly(values.posting_date),
        document_type: 'Expense',
        amount: sanitizeAmountInput(values.amount) as any,
        status: values.status || 'Open',
      };
      const expenseTypeId = coercePositiveId(values.expense_type);
      if (expenseTypeId) {
        payload.expense_type = expenseTypeId;
      }
      if (values.description?.trim()) {
        payload.description = values.description.trim();
      } else if (options?.forUpdate) {
        payload.description = '';
      }
      const paymentMethodId = coercePositiveId(values.payment_method);
      if (paymentMethodId) {
        payload.payment_method = paymentMethodId;
      }
      return payload;
    },
    [],
  );

  const canCreateFromValues = (values: ExpenseFormValues) =>
    !!values.posting_date &&
    !!coercePositiveId(values.expense_type) &&
    !!coercePositiveId(values.payment_method) &&
    parseAmount(values.amount) > 0;

  const autoSaveField = useCallback(
    async (field: keyof ExpenseFormValues, rawValue: any) => {
      if (!visible || isLocked || !canWrite || savingRef.current) {
        return;
      }

      const value =
        typeof rawValue === 'string' && field !== 'amount'
          ? rawValue.trim()
          : rawValue;
      const record = currentRecordRef.current;
      const values = {...formDataRef.current, [field]: rawValue};
      const previous = lastSavedRef.current[field];
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
      if (field === 'payment_method' && !value) {
        setErrors(prev => ({
          ...prev,
          payment_method: 'Payment method is required to credit the bank or cash account',
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
          const next = expenseToForm(created, values, expenseTypes);
          setCurrentRecord(created);
          setFormData(next);
          lastSavedRef.current = next;
          onRecordChange?.(created);
          onSave();
          flashSaved();
        } else {
          const updated = await ExpenseServices.updateExpense(
            record.id,
            buildPayload(values, {forUpdate: true}),
          );
          const next = expenseToForm(updated, values, expenseTypes);
          setCurrentRecord(updated);
          setFormData(next);
          lastSavedRef.current = next;
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
      isLocked,
      canWrite,
      buildPayload,
      onRecordChange,
      onSave,
      flashSaved,
      expenseTypes,
    ],
  );

  const handleAmountChange = (text: string) => {
    if (!amountFocusedRef.current) {
      return;
    }
    const numericValue = sanitizeAmountInput(text);
    setFormData(prev => ({...prev, amount: numericValue}));
    if (amountSaveTimerRef.current) {
      clearTimeout(amountSaveTimerRef.current);
    }
    amountSaveTimerRef.current = setTimeout(() => {
      amountSaveTimerRef.current = null;
      void autoSaveField('amount', numericValue);
    }, 700);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }
    const nextDate = formatDateYmdLocal(selectedDate);
    setFormData(prev => ({...prev, posting_date: nextDate}));
    void autoSaveField('posting_date', nextDate);
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

  useEffect(() => {
    if (!visible || isLocked || formData.payment_method) {
      return;
    }
    const method = pickDefaultCashPaymentMethod(expensePaymentMethods);
    if (method?.id != null) {
      setFormData(prev =>
        prev.payment_method ? prev : {...prev, payment_method: method.id},
      );
    }
  }, [visible, isLocked, formData.payment_method, expensePaymentMethods]);

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
    const display = formatAmountWithCommas(
      raw,
      raw.includes('.') ? 2 : undefined,
    );
    return `${getLocalCurrencyCode()} ${display}`;
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
      'Post expense',
      'Are you sure you want to post this expense? This will take the amount from the selected payment method.',
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
              onSave();
              if (onPosted) {
                onPosted();
                return;
              }
              const refreshed = await ExpenseServices.getExpense(currentRecord.id);
              setCurrentRecord(refreshed);
              setFormData(expenseToForm(refreshed, formDataRef.current, expenseTypes));
              onRecordChange?.(refreshed);
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.error ||
                  error?.response?.data?.detail ||
                  'Failed to post expense',
              });
            } finally {
              setPosting(false);
            }
          },
        },
      ],
    );
  };

  const handleReverse = async () => {
    if (!isPersisted || !currentRecord || !isPosted) {
      return;
    }

    Alert.alert(
      'Reverse entries',
      'To reverse these entries, correcting entries will be posted.\n\nDo you want to reverse the entries?',
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes',
          onPress: async () => {
            setReversing(true);
            try {
              const result = await ExpenseServices.reverseExpense(
                currentRecord.id,
              );
              Toast.show({
                type: 'success',
                text1: 'Reversed',
                text2:
                  result.message ||
                  'Correcting G/L entries were posted for this expense.',
              });
              onSave();
              if (onReversed) {
                onReversed();
                return;
              }
              const refreshed = await ExpenseServices.getExpense(
                currentRecord.id,
              );
              setCurrentRecord(refreshed);
              setFormData(
                expenseToForm(refreshed, formDataRef.current, expenseTypes),
              );
              onRecordChange?.(refreshed);
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: extractApiErrorMessage(
                  error,
                  'error',
                  'Failed to reverse expense',
                ),
              });
            } finally {
              setReversing(false);
            }
          },
        },
      ],
    );
  };

  const pageTitle = isReversed
    ? 'Reversed expense'
    : isPosted
      ? 'Posted expense'
      : isPersisted
        ? 'Edit expense'
        : 'Add expense';

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
                {canWrite && !isLocked && (isSaving || showSaved) ? (
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
                ) : null}
                {canPost && isPersisted && currentRecord?.status === 'Open' ? (
                  <TouchableOpacity
                    style={[
                      styles.headerPostButton,
                      posting && styles.buttonDisabled,
                    ]}
                    onPress={handlePost}
                    disabled={posting || isSaving}
                    activeOpacity={0.85}
                    accessibilityLabel="Post expense">
                    {posting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.headerPostText}>Post</Text>
                    )}
                  </TouchableOpacity>
                ) : canPost && isPosted ? (
                  <TouchableOpacity
                    style={[
                      styles.headerPostButton,
                      reversing && styles.buttonDisabled,
                    ]}
                    onPress={handleReverse}
                    disabled={reversing}
                    activeOpacity={0.85}
                    accessibilityLabel="Reverse expense entries">
                    {reversing ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.headerPostText}>Reverse</Text>
                    )}
                  </TouchableOpacity>
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
                {pageTitle}
              </Text>
              {!isLocked ? (
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
                    isLocked && [
                      styles.selectRowDisabled,
                      expTheme.selectRowDisabled,
                    ],
                  ]}
                  onPress={() => !isLocked && canWrite && setShowDatePicker(true)}
                  activeOpacity={0.7}
                  disabled={isLocked || !canWrite}>
                  <Text
                    style={[
                      styles.selectRowText,
                      expTheme.selectRowText,
                      !formData.posting_date && [
                        styles.selectRowPlaceholder,
                        expTheme.selectRowPlaceholder,
                      ],
                      isLocked && [styles.disabledText, expTheme.disabledText],
                    ]}>
                    {toDateOnly(formData.posting_date) || 'Select date'}
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
                    value={
                      parseLocalISODate(formData.posting_date) ?? new Date()
                    }
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
                      isLocked && [
                        styles.selectRowDisabled,
                        expTheme.selectRowDisabled,
                      ],
                    ]}
                    onPress={() =>
                      !isLocked && canWrite && setExpenseTypePickerVisible(true)
                    }
                    activeOpacity={0.7}
                    disabled={isLocked || !canWrite}>
                    <Text
                      style={[
                        styles.selectRowText,
                        expTheme.selectRowText,
                        !expenseTypeName && [
                          styles.selectRowPlaceholder,
                          expTheme.selectRowPlaceholder,
                        ],
                        isLocked && [styles.disabledText, expTheme.disabledText],
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
                  editable={!isLocked && canWrite}
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
                  value={formatAmountWithCommas(
                    formData.amount,
                    amountFocused ? undefined : 2,
                  )}
                  onChangeText={handleAmountChange}
                  onFocus={() => {
                    amountFocusedRef.current = true;
                    setAmountFocused(true);
                  }}
                  onBlur={() => {
                    amountFocusedRef.current = false;
                    setAmountFocused(false);
                    if (amountSaveTimerRef.current) {
                      clearTimeout(amountSaveTimerRef.current);
                      amountSaveTimerRef.current = null;
                    }
                    void autoSaveField(
                      'amount',
                      formDataRef.current.amount || '',
                    );
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                  editable={!isLocked && canWrite}
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
                  Payment method *
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectRow,
                    expTheme.selectRow,
                    errors.payment_method && styles.inputError,
                    isLocked && [
                      styles.selectRowDisabled,
                      expTheme.selectRowDisabled,
                    ],
                  ]}
                  onPress={() =>
                    !isLocked && canWrite && setPaymentMethodPickerVisible(true)
                  }
                  activeOpacity={0.7}
                  disabled={isLocked || !canWrite}>
                  <Text
                    style={[
                      styles.selectRowText,
                      expTheme.selectRowText,
                      !paymentMethodName && [
                        styles.selectRowPlaceholder,
                        expTheme.selectRowPlaceholder,
                      ],
                      isLocked && [styles.disabledText, expTheme.disabledText],
                    ]}>
                    {paymentMethodName || 'Select payment method'}
                  </Text>
                  <Text
                    style={[styles.selectRowChevron, expTheme.selectRowChevron]}>
                    ›
                  </Text>
                </TouchableOpacity>
                {errors.payment_method ? (
                  <Text style={styles.errorText}>{errors.payment_method}</Text>
                ) : null}
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
                    {isReversed
                      ? 'This expense is reversed'
                      : isPosted
                        ? 'This expense is posted'
                        : 'Before you post'}
                  </Text>
                  <Text style={[styles.infoCardBody, expTheme.infoCardBody]}>
                    {isReversed
                      ? 'Correcting G/L entries have been posted. This record is read-only.'
                      : isPosted
                        ? 'Posted expenses are read-only. Reverse the entries to post correcting G/L entries, the same way Business Central reverses a G/L register.'
                        : 'Fill expense type, amount, and payment method to auto-save as Open. Payment method is required because posting credits that bank or cash account.'}
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
        onClose={() => setPaymentMethodPickerVisible(false)}
        onSelect={id => {
          if (typeof id !== 'number') {
            return;
          }
          setFormData(prev => ({...prev, payment_method: id}));
          setPaymentMethodPickerVisible(false);
          void autoSaveField('payment_method', id);
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
    justifyContent: 'flex-end',
    gap: 10,
    flex: 1,
    marginLeft: 12,
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
    alignItems: 'flex-end',
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
