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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS, SIZES} from '../../constants';
import {
  Vendor,
  PaymentMethod,
  VendorFormValues,
} from '../../@types/vendor';
import {VendorServices} from '../../services/VendorServices';
import Toast from 'react-native-toast-message';

interface VendorFormModalProps {
  visible: boolean;
  onClose: () => void;
  vendor: Vendor | null; // null for create, Vendor for edit
  onSave: () => void;
  paymentMethods: PaymentMethod[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const VendorFormModal: React.FC<VendorFormModalProps> = ({
  visible,
  onClose,
  vendor,
  onSave,
  paymentMethods,
  canCreate,
  canEdit,
  canDelete,
}) => {
  const isEditMode = !!vendor;
  const isGeneralVendor = vendor?.no === 'VENDOR-000001';

  // Form state
  const [formData, setFormData] = useState<VendorFormValues>({
    name: '',
    blocked: false,
    address: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    payment_method: null,
    vendor_posting_group: null,
    business_posting_group: null,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when vendor changes
  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        blocked: vendor.blocked || false,
        address: vendor.address || '',
        city: vendor.city || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        website: vendor.website || '',
        payment_method: vendor.payment_method || null,
        vendor_posting_group: vendor.vendor_posting_group || null,
        business_posting_group: vendor.business_posting_group || null,
      });
    } else {
      // Reset form for new vendor
      setFormData({
        name: '',
        blocked: false,
        address: '',
        city: '',
        phone: '',
        email: '',
        website: '',
        payment_method: null,
        vendor_posting_group: null,
        business_posting_group: null,
      });
    }
    setErrors({});
  }, [vendor, visible]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Vendor name is required';
    }

    // Email validation (optional but if provided, should be valid format)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Enter a valid email address';
      }
    }

    // Website validation (optional but if provided, should be valid URL)
    if (formData.website && formData.website.trim()) {
      try {
        new URL(formData.website.trim());
      } catch {
        newErrors.website = 'Enter a valid URL';
      }
    }

    // Phone validation (optional but if provided, should be valid format)
    if (formData.phone && !/^\+?[\d\s\-()]+$/.test(formData.phone)) {
      newErrors.phone =
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
        'You do not have permission to edit vendors.',
      );
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to create vendors.',
      );
      return;
    }

    // Prevent editing general vendor
    if (isEditMode && isGeneralVendor) {
      Alert.alert(
        'Warning',
        'The general vendor (VENDOR-000001) cannot be edited.',
      );
      return;
    }

    setLoading(true);
    try {
      const vendorData: Partial<Vendor> = {
        name: formData.name.trim(),
        blocked: formData.blocked,
      };

      // Only include optional fields if they have values
      if (formData.address && formData.address.trim()) {
        vendorData.address = formData.address.trim();
      }
      if (formData.city && formData.city.trim()) {
        vendorData.city = formData.city.trim();
      }
      if (formData.phone && formData.phone.trim()) {
        vendorData.phone = formData.phone.trim();
      }
      if (formData.email && formData.email.trim()) {
        vendorData.email = formData.email.trim();
      }
      if (formData.website && formData.website.trim()) {
        vendorData.website = formData.website.trim();
      }
      if (formData.payment_method) {
        vendorData.payment_method = formData.payment_method;
      }
      if (formData.vendor_posting_group) {
        vendorData.vendor_posting_group = formData.vendor_posting_group;
      }
      if (formData.business_posting_group) {
        vendorData.business_posting_group = formData.business_posting_group;
      }

      if (isEditMode && vendor) {
        await VendorServices.updateVendor(vendor.id, vendorData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Vendor updated successfully',
        });
      } else {
        await VendorServices.createVendor(vendorData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Vendor created successfully',
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.name?.[0] ||
        'Failed to save vendor';
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
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditMode ? 'Edit Supplier' : 'Create Supplier'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
              {/* Basic Information Section */}
              <Text style={styles.sectionTitle}>Basic Information</Text>

              {/* Vendor No (Read-only) */}
              {isEditMode && vendor?.no && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Supplier No</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={vendor.no}
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
                  onChangeText={text =>
                    setFormData({...formData, name: text})
                  }
                  placeholder="Enter supplier name"
                  placeholderTextColor={COLORS.gray}
                  editable={!isGeneralVendor}
                />
                {errors.name && (
                  <Text style={styles.errorText}>{errors.name}</Text>
                )}
              </View>

              {/* Blocked */}
              <View style={styles.fieldContainer}>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      formData.blocked && styles.checkboxChecked,
                    ]}
                    onPress={() =>
                      setFormData({...formData, blocked: !formData.blocked})
                    }>
                    {formData.blocked && (
                      <Text style={styles.checkboxText}>✓</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Blocked</Text>
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  value={formData.email}
                  onChangeText={text =>
                    setFormData({...formData, email: text})
                  }
                  placeholder="vendor@example.com"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Phone */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  value={formData.phone}
                  onChangeText={text =>
                    setFormData({...formData, phone: text})
                  }
                  placeholder="+256700000000"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="phone-pad"
                />
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone}</Text>
                )}
              </View>

              {/* Website */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Website</Text>
                <TextInput
                  style={[styles.input, errors.website && styles.inputError]}
                  value={formData.website}
                  onChangeText={text =>
                    setFormData({...formData, website: text})
                  }
                  placeholder="https://vendor.com"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="url"
                  autoCapitalize="none"
                />
                {errors.website && (
                  <Text style={styles.errorText}>{errors.website}</Text>
                )}
              </View>

              {/* Address Information Section */}
              <Text style={[styles.sectionTitle, styles.sectionTitleMargin]}>
                Address Information
              </Text>

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

              {/* Payment Information Section */}
              <Text style={[styles.sectionTitle, styles.sectionTitleMargin]}>
                Payment Information
              </Text>

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
                            setFormData({
                              ...formData,
                              payment_method: null,
                            });
                          } else {
                            setFormData({...formData, payment_method: value});
                          }
                        }}
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
                        {paymentMethods.find(
                          m => m.id === formData.payment_method,
                        )?.description ||
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
            {((isEditMode && canEdit && !isGeneralVendor) ||
              (!isEditMode && canCreate)) && (
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
      </KeyboardAvoidingView>
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
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    paddingHorizontal: SIZES.padding,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
  },
  checkboxText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    ...FONTS.body3,
    color: COLORS.black,
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
  buttonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default VendorFormModal;

