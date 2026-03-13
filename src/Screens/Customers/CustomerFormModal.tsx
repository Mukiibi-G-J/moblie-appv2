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
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS, SIZES} from '../../constants';
import {
  Customer,
  PaymentMethod,
  CustomerFormValues,
} from '../../@types/customer';
import {CustomerServices} from '../../services/CustomerServices';
import Toast from 'react-native-toast-message';

interface CustomerFormModalProps {
  visible: boolean;
  onClose: () => void;
  customer: Customer | null; // null for create, Customer for edit
  onSave: () => void;
  paymentMethods: PaymentMethod[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  visible,
  onClose,
  customer,
  onSave,
  paymentMethods,
  canCreate,
  canEdit,
  canDelete,
}) => {
  const isEditMode = !!customer;

  // Form state
  const [formData, setFormData] = useState<CustomerFormValues>({
    name: '',
    contact: '',
    phone_number: '',
    address: '',
    address_2: '',
    city: '',
    credit_limit: '',
    payment_method: null,
    customer_posting_group: null,
    general_business_posting_group: null,
    customer_type: 'GENERAL',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when customer changes
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        contact: customer.contact || '',
        phone_number: customer.phone_number || '',
        address: customer.address || '',
        address_2: customer.address_2 || '',
        city: customer.city || '',
        credit_limit: customer.credit_limit || '',
        payment_method: customer.payment_method || null,
        customer_posting_group: customer.customer_posting_group || null,
        general_business_posting_group:
          customer.general_business_posting_group || null,
        customer_type: customer.customer_type || 'GENERAL',
      });
    } else {
      // Reset form for new customer
      setFormData({
        name: '',
        contact: '',
        phone_number: '',
        address: '',
        address_2: '',
        city: '',
        credit_limit: '',
        payment_method: null,
        customer_posting_group: null,
        general_business_posting_group: null,
        customer_type: 'GENERAL',
      });
    }
    setErrors({});
  }, [customer, visible]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Customer name is required';
    }

    // Phone number validation (optional but if provided, should be valid format)
    if (
      formData.phone_number &&
      !/^\+?[\d\s\-()]+$/.test(formData.phone_number)
    ) {
      newErrors.phone_number =
        'Phone number can only contain numbers, +, -, (), and spaces';
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
        'You do not have permission to edit customers.',
      );
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to create customers.',
      );
      return;
    }

    setLoading(true);
    try {
      const customerData: Partial<Customer> = {
        name: formData.name.trim(),
      };

      // Only include optional fields if they have values
      if (formData.contact && formData.contact.trim()) {
        customerData.contact = formData.contact.trim();
      }
      if (formData.phone_number && formData.phone_number.trim()) {
        customerData.phone_number = formData.phone_number.trim();
      }
      if (formData.address && formData.address.trim()) {
        customerData.address = formData.address.trim();
      }
      if (formData.city && formData.city.trim()) {
        customerData.city = formData.city.trim();
      }
      if (formData.payment_method) {
        customerData.payment_method = formData.payment_method;
      }
      if (formData.customer_posting_group) {
        customerData.customer_posting_group = formData.customer_posting_group;
      }
      if (formData.general_business_posting_group) {
        customerData.general_business_posting_group =
          formData.general_business_posting_group;
      }

      if (isEditMode && customer) {
        await CustomerServices.updateCustomer(customer.id, customerData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Customer updated successfully',
        });
      } else {
        await CustomerServices.createCustomer(customerData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Customer created successfully',
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.name?.[0] ||
        'Failed to save customer';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
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
              {isEditMode ? 'Edit Customer' : 'Create Customer'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              {/* Customer No (Read-only) */}
              {isEditMode && customer?.no && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Customer No</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={customer.no}
                    editable={false}
                  />
                </View>
              )}

              {/* Name */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={formData.name}
                  onChangeText={text => setFormData({...formData, name: text})}
                  placeholder="Enter customer name"
                  placeholderTextColor={COLORS.gray}
                />
                {errors.name && (
                  <Text style={styles.errorText}>{errors.name}</Text>
                )}
              </View>

              {/* Contact */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Contact</Text>
                <TextInput
                  style={styles.input}
                  value={formData.contact}
                  onChangeText={text =>
                    setFormData({...formData, contact: text})
                  }
                  placeholder="Enter contact person name"
                  placeholderTextColor={COLORS.gray}
                />
              </View>

              {/* Phone Number */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.phone_number && styles.inputError,
                  ]}
                  value={formData.phone_number}
                  onChangeText={text =>
                    setFormData({...formData, phone_number: text})
                  }
                  placeholder="+256700000000"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="phone-pad"
                />
                {errors.phone_number && (
                  <Text style={styles.errorText}>{errors.phone_number}</Text>
                )}
              </View>

              {/* Address */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={text =>
                    setFormData({...formData, address: text})
                  }
                  placeholder="Enter street address"
                  placeholderTextColor={COLORS.gray}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* City */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={text => setFormData({...formData, city: text})}
                  placeholder="Enter city name"
                  placeholderTextColor={COLORS.gray}
                />
              </View>

              {/* Payment Method */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Payment Method (Optional)</Text>
                {paymentMethods.length === 0 ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingText}>
                      Loading payment methods...
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={formData.payment_method || 0}
                        onValueChange={value => {
                          if (value === 0) {
                            setFormData({...formData, payment_method: null});
                          } else {
                            setFormData({...formData, payment_method: value});
                          }
                        }}
                        style={styles.picker}>
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
                          paymentMethods.find(
                            m => m.id === formData.payment_method,
                          )?.code ||
                          ''}
                      </Text>
                    )}
                  </>
                )}
              </View>


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
            {((isEditMode && canEdit) || (!isEditMode && canCreate)) && (
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}>
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
    height: 60,
    textAlignVertical: 'top',
    paddingTop: SIZES.base,
  },
  disabledInput: {
    backgroundColor: '#EFF2F7',
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: SIZES.radius,
    backgroundColor: '#F7F9FD',
  },
  picker: {
    width: '100%',
    backgroundColor: '#F7F9FD',
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
  buttonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default CustomerFormModal;

