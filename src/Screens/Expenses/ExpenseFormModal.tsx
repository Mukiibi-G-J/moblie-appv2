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
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Picker} from '@react-native-picker/picker';
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

interface ExpenseFormModalProps {
  visible: boolean;
  onClose: () => void;
  expense: Expense | null; // null for create, Expense for edit
  onSave: () => void;
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
  expenseTypes,
  paymentMethods,
  canCreate,
  canEdit,
  canDelete,
  canPost,
}) => {
  const isEditMode = !!expense;
  const isPosted = expense?.status === 'Posted';

  const {colors} = useTheme();
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
      pickerShell: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      picker: {
        backgroundColor: colors.inputBackground,
        color: colors.textPrimary,
      },
      pickerItemStyle: {color: colors.textPrimary},
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

  // Form state
  const [formData, setFormData] = useState<ExpenseFormValues>({
    posting_date: new Date().toISOString().split('T')[0],
    expense_type: null,
    description: '',
    amount: '',
    payment_method: null,
    status: 'Open',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when expense changes
  useEffect(() => {
    if (expense) {
      setFormData({
        posting_date: expense.posting_date,
        expense_type: expense.expense_type,
        description: expense.description || '',
        amount: expense.amount.toString(),
        payment_method: expense.payment_method || null,
        status: expense.status,
      });
    } else {
      // Reset form for new expense
      setFormData({
        posting_date: new Date().toISOString().split('T')[0],
        expense_type: null,
        description: '',
        amount: '',
        payment_method: null,
        status: 'Open',
      });
    }
    setErrors({});
  }, [expense, visible]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.posting_date) {
      newErrors.posting_date = 'Posting date is required';
    }

    if (!formData.expense_type) {
      newErrors.expense_type = 'Expense type is required';
    }

    if (
      !formData.amount ||
      parseFloat(formData.amount.replace(/,/g, '')) <= 0
    ) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({
        ...formData,
        posting_date: selectedDate.toISOString().split('T')[0],
      });
    }
  };

  const handleAmountChange = (text: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = text.replace(/[^0-9.]/g, '');
    setFormData({...formData, amount: numericValue});
  };

  const formatAmount = (value: string) => {
    if (!value) return '';
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    return numValue.toLocaleString();
  };

  const expenseTypeName = useMemo(() => {
    if (!formData.expense_type) {
      return null;
    }
    return expenseTypes.find(t => t.id === formData.expense_type)?.name ?? null;
  }, [formData.expense_type, expenseTypes]);

  const previewAmountLabel = useMemo(() => {
    const raw = formData.amount?.replace(/,/g, '') ?? '';
    if (!raw || parseFloat(raw) <= 0) {
      return 'UGX —';
    }
    const n = parseFloat(raw) || 0;
    return `UGX ${n.toLocaleString('en-US', {maximumFractionDigits: 0})}`;
  }, [formData.amount]);

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // Check permissions
    if (isEditMode && !canEdit) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to edit expenses.',
      );
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to create expenses.',
      );
      return;
    }

    setLoading(true);
    try {
      const amountValue = parseFloat(formData.amount.replace(/,/g, '')) || 0;

      const expenseData: Partial<Expense> = {
        posting_date: formData.posting_date,
        expense_type: formData.expense_type!,
        document_type: 'Expense',
        amount: amountValue,
        status: formData.status || 'Open',
      };

      // Only include optional fields if they have values
      if (formData.description && formData.description.trim()) {
        expenseData.description = formData.description.trim();
      }
      if (formData.payment_method) {
        expenseData.payment_method = formData.payment_method;
      }
      if (isEditMode && expense) {
        await ExpenseServices.updateExpense(expense.id, expenseData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Expense updated successfully',
        });
      } else {
        await ExpenseServices.createExpense(expenseData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Expense created successfully',
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to save expense';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!formData.payment_method) {
      Alert.alert(
        'Payment Method Required',
        'Please select a payment method before posting.',
      );
      return;
    }

    if (!isEditMode || !expense) {
      Alert.alert('Error', 'Cannot post a new expense. Please save it first.');
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
            setLoading(true);
            try {
              const result = await ExpenseServices.postExpense(expense.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: result.message || 'Expense posted successfully',
              });
              onSave();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to post expense',
              });
            } finally {
              setLoading(false);
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
          edges={['top', 'left', 'right']}>
          <View style={[styles.page, expTheme.page]}>
            <View style={[styles.pageHeader, expTheme.pageHeader]}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.headerIconButton}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                activeOpacity={0.7}>
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={[styles.headerIcon, expTheme.headerIcon]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <View style={styles.headerRightActions}>
                {canPost && isEditMode && expense?.status === 'Open' ? (
                  <TouchableOpacity
                    style={[styles.headerPostButton, loading && styles.buttonDisabled]}
                    onPress={handlePost}
                    disabled={loading}
                    activeOpacity={0.85}>
                    <Text style={styles.headerPostText}>Post</Text>
                  </TouchableOpacity>
                ) : null}
                {(isEditMode && canEdit) || (!isEditMode && canCreate) ? (
                  <TouchableOpacity
                    style={[
                      styles.headerSaveButton,
                      (loading || isPosted) && styles.buttonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={loading || isPosted}
                    activeOpacity={0.85}>
                    {loading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.headerSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.formContainer}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <Text style={[styles.pageTitle, expTheme.pageTitle]}>
                {isEditMode ? 'Edit expense' : 'Add expense'}
              </Text>

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
                <Text style={[styles.sectionTitle, expTheme.sectionTitle]}>Details</Text>

                {isEditMode && expense?.document_no ? (
                  <>
                    <Text style={[styles.fieldLabel, expTheme.fieldLabel]}>Document no.</Text>
                    <TextInput
                      style={[
                        styles.input,
                        expTheme.input,
                        styles.inputDisabled,
                        expTheme.inputDisabled,
                      ]}
                      value={expense.document_no}
                      editable={false}
                    />
                  </>
                ) : null}

                <Text style={[styles.fieldLabel, expTheme.fieldLabel]}>Posting date *</Text>
                <TouchableOpacity
                  style={[
                    styles.selectRow,
                    expTheme.selectRow,
                    isPosted && [styles.selectRowDisabled, expTheme.selectRowDisabled],
                  ]}
                  onPress={() => !isPosted && setShowDatePicker(true)}
                  activeOpacity={0.7}
                  disabled={isPosted}>
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
                  <Text style={[styles.selectRowChevron, expTheme.selectRowChevron]}>›</Text>
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
                  style={[styles.fieldLabel, expTheme.fieldLabel, styles.fieldLabelSpaced]}>
                  Expense type *
                </Text>
                {expenseTypes.length === 0 ? (
                  <View style={styles.inlineLoadingRow}>
                    <ActivityIndicator size="small" color={COLORS.primary2} />
                    <Text style={styles.inlineLoadingText}>
                      Loading expense types…
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pickerShell}>
                    <Picker
                      selectedValue={formData.expense_type || 0}
                      onValueChange={value => {
                        if (value === 0) {
                          setFormData({...formData, expense_type: null});
                        } else {
                          setFormData({...formData, expense_type: value});
                        }
                      }}
                      enabled={!isPosted}
                      style={styles.picker}
                      itemStyle={{color: COLORS.black}}>
                      <Picker.Item label="Select expense type" value={0} />
                      {expenseTypes.map(type => (
                        <Picker.Item
                          key={type.id}
                          label={type.name}
                          value={type.id}
                        />
                      ))}
                    </Picker>
                  </View>
                )}
                {errors.expense_type ? (
                  <Text style={styles.errorText}>{errors.expense_type}</Text>
                ) : null}

                <Text
                  style={[styles.fieldLabel, expTheme.fieldLabel, styles.fieldLabelSpaced]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.input, expTheme.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={text =>
                    setFormData({...formData, description: text})
                  }
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={4}
                  editable={!isPosted}
                />

                <Text
                  style={[styles.fieldLabel, expTheme.fieldLabel, styles.fieldLabelSpaced]}>
                  Amount (UGX) *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    expTheme.input,
                    errors.amount && styles.inputError,
                  ]}
                  value={formatAmount(formData.amount)}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  editable={!isPosted}
                />
                {errors.amount ? (
                  <Text style={styles.errorText}>{errors.amount}</Text>
                ) : null}

                <Text
                  style={[styles.fieldLabel, expTheme.fieldLabel, styles.fieldLabelSpaced]}>
                  Payment method
                  {isPosted ? '' : ' (optional)'}
                </Text>
                <View style={[styles.pickerShell, expTheme.pickerShell]}>
                  <Picker
                    selectedValue={formData.payment_method || 0}
                    onValueChange={value => {
                      if (value === 0) {
                        setFormData({...formData, payment_method: null});
                      } else {
                        setFormData({...formData, payment_method: value});
                      }
                    }}
                    enabled={!isPosted}
                    style={[styles.picker, expTheme.picker]}
                    itemStyle={expTheme.pickerItemStyle}>
                    <Picker.Item label="Select payment method" value={0} />
                    {paymentMethods.map(method => (
                      <Picker.Item
                        key={method.id}
                        label={method.description || method.code}
                        value={method.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {isEditMode ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, expTheme.sectionTitle]}>Status</Text>
                  <TextInput
                    style={[
                      styles.input,
                      expTheme.input,
                      styles.inputDisabled,
                      expTheme.inputDisabled,
                    ]}
                    value={expense?.status || 'Open'}
                    editable={false}
                  />
                </View>
              ) : null}

              <View style={[styles.sectionDivider, expTheme.sectionDivider]} />

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, expTheme.sectionTitle]}>Posting</Text>
                <View style={[styles.infoCard, expTheme.infoCard]}>
                  <Text style={[styles.infoCardTitle, expTheme.infoCardTitle]}>
                    {isPosted ? 'This expense is posted' : 'Before you post'}
                  </Text>
                  <Text style={[styles.infoCardBody, expTheme.infoCardBody]}>
                    {isPosted
                      ? 'Posted expenses are read-only. Create a reversal from the list if you need to adjust.'
                      : 'Save as Open first, then use Post when you are ready to create G/L entries. A payment method is required to post.'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
  headerSaveText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
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
    marginBottom: 24,
    letterSpacing: -0.3,
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
  pickerShell: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    backgroundColor: COLORS.white,
    color: COLORS.black,
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
