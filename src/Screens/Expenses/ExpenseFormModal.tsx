import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {
  Expense,
  ExpenseType,
  PaymentMethod,
  ExpenseFormValues,
} from '../../@types/expense';
import {ExpenseServices} from '../../services/ExpenseServices';
import Toast from 'react-native-toast-message';

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
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditMode ? 'Edit Expense' : 'Create Expense'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              {/* Document No (Read-only) */}
              {isEditMode && expense?.document_no && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Document No</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={expense.document_no}
                    editable={false}
                  />
                </View>
              )}

            {/* Posting Date */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Posting Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                disabled={isPosted}>
                <View style={styles.dateButtonContent}>
                  <Image
                    source={icons.calender as ImageSourcePropType}
                    style={styles.dateIcon}
                  />
                  <Text
                    style={[
                      styles.dateButtonText,
                      isPosted && styles.disabledText,
                    ]}>
                    {formData.posting_date || 'dd----yyyy'}
                  </Text>
                  <Image
                    source={icons.calender as ImageSourcePropType}
                    style={[styles.dateIcon, styles.dateIconTrailing]}
                  />
                </View>
              </TouchableOpacity>
              {errors.posting_date && (
                <Text style={styles.errorText}>{errors.posting_date}</Text>
              )}
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(formData.posting_date)}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            {/* Expense Type */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Expense Type *</Text>
              {expenseTypes.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingText}>
                    Loading expense types...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.expense_type || 0}
                      onValueChange={value => {
                        // Handle the placeholder value (0)
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
                  {formData.expense_type && (
                    <Text style={styles.selectedValueText}>
                      Selected:{' '}
                      {expenseTypes.find(t => t.id === formData.expense_type)
                        ?.name || ''}
                    </Text>
                  )}
                </>
              )}
              {errors.expense_type && (
                <Text style={styles.errorText}>{errors.expense_type}</Text>
              )}
            </View>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={text =>
                  setFormData({...formData, description: text})
                }
                placeholder="Enter expense description"
                placeholderTextColor={COLORS.gray}
                multiline
                numberOfLines={3}
                editable={!isPosted}
              />
            </View>

            {/* Amount */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Amount (UGX) *</Text>
              <TextInput
                style={[styles.input, errors.amount && styles.inputError]}
                value={formatAmount(formData.amount)}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={COLORS.gray}
                keyboardType="numeric"
                editable={!isPosted}
              />
              {errors.amount && (
                <Text style={styles.errorText}>{errors.amount}</Text>
              )}
            </View>

            {/* Payment Method */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                Payment Method {isPosted ? '' : '(Optional)'}
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.payment_method || 0}
                  onValueChange={value => {
                    // Handle the placeholder value (0)
                    if (value === 0) {
                      setFormData({...formData, payment_method: null});
                    } else {
                      setFormData({...formData, payment_method: value});
                    }
                  }}
                  enabled={!isPosted}
                  style={styles.picker}
                  itemStyle={{color: COLORS.black}}>
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
              {formData.payment_method && (
                <Text style={styles.selectedValueText}>
                  Selected:{' '}
                  {paymentMethods.find(m => m.id === formData.payment_method)
                    ?.description ||
                    paymentMethods.find(m => m.id === formData.payment_method)
                      ?.code ||
                    ''}
                </Text>
              )}
            </View>

            {/* Status (Read-only for existing) */}
              {isEditMode && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Status</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={expense?.status || 'Open'}
                    editable={false}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            {canPost && isEditMode && expense?.status === 'Open' && (
              <TouchableOpacity
                style={[styles.button, styles.postButton]}
                onPress={handlePost}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonText}>Post</Text>
                )}
              </TouchableOpacity>
            )}
            {((isEditMode && canEdit) || (!isEditMode && canCreate)) && (
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={loading || isPosted}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonText}>
                    {isEditMode ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.black,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.gray,
  },
  scrollView: {
    maxHeight: '70%',
  },
  formCard: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.base,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingBottom: SIZES.padding,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.black,
    marginBottom: SIZES.base / 2,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: '#F7F9FD',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: SIZES.base,
  },
  disabledInput: {
    backgroundColor: '#EFF2F7',
    color: COLORS.gray,
  },
  disabledText: {
    color: COLORS.gray,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    ...FONTS.body5,
    color: COLORS.error,
    marginTop: SIZES.base / 2,
  },
  selectedValueText: {
    ...FONTS.body4,
    color: COLORS.primary,
    marginTop: SIZES.base / 2,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
  },
  loadingText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginLeft: SIZES.base,
  },
  dateButton: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    justifyContent: 'center',
    backgroundColor: '#F7F9FD',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.gray,
  },
  dateIconTrailing: {
    tintColor: COLORS.primary,
  },
  dateButtonText: {
    ...FONTS.body3,
    color: COLORS.black,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: SIZES.radius,
    backgroundColor: '#F7F9FD',
  },
  picker: {
    width: '100%',
    backgroundColor: '#F7F9FD',
    color: COLORS.black,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SIZES.base / 2,
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray1,
  },
  cancelButtonText: {
    ...FONTS.body3,
    color: COLORS.black,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  postButton: {
    backgroundColor: COLORS.success,
  },
  buttonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default ExpenseFormModal;
