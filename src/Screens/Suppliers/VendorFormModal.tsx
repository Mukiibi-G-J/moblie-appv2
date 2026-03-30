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
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
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
  vendor: Vendor | null;
  onSave: () => void;
  paymentMethods: PaymentMethod[];
  canCreate: boolean;
  canEdit: boolean;
}

const isProtectedGeneralVendor = (vendor?: Vendor | null) =>
  vendor?.no === 'VENDOR-000001';

const VendorFormModal: React.FC<VendorFormModalProps> = ({
  visible,
  onClose,
  vendor,
  onSave,
  paymentMethods,
  canCreate,
  canEdit,
}) => {
  const isEditMode = !!vendor;
  const isGeneralVendor = isProtectedGeneralVendor(vendor);

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
      newErrors.name = 'Supplier name is required';
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Enter a valid email address';
      }
    }

    if (formData.website && formData.website.trim()) {
      try {
        new URL(formData.website.trim());
      } catch {
        newErrors.website = 'Enter a valid URL';
      }
    }

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

    if (isEditMode && isGeneralVendor) {
      Alert.alert(
        'Protected supplier',
        'The General Vendor cannot be edited.',
      );
      return;
    }

    setLoading(true);
    try {
      const vendorData: Partial<Vendor> = {
        name: formData.name.trim(),
        blocked: formData.blocked,
      };

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
          text2: 'Supplier updated successfully',
        });
      } else {
        await VendorServices.createVendor(vendorData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Supplier created successfully',
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.name?.[0] ||
        'Failed to save supplier';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const previewName = (formData.name || 'My Supplier').trim();
  const previewInitials =
    previewName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SU';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={styles.pageRoot}>
        <View style={styles.pageHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerIconButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Image
              source={icons.cross}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {((isEditMode && canEdit && !isGeneralVendor) ||
            (!isEditMode && canCreate)) && (
            <TouchableOpacity
              style={[styles.headerSaveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.headerSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>
            {isEditMode ? 'Edit supplier' : 'Add supplier'}
          </Text>

          <View style={styles.previewSection}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitials}>{previewInitials}</Text>
            </View>
            <View style={styles.previewMeta}>
              <Text style={styles.previewName} numberOfLines={1}>
                {previewName}
              </Text>
              <Text style={styles.previewSubtext}>
                {formData.phone?.trim() || formData.email?.trim() || 'Supplier contact'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>

            {isEditMode && vendor?.no ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Supplier number</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={vendor.no}
                  editable={false}
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Supplier name</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={text => setFormData({...formData, name: text})}
                placeholder="Supplier name"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralVendor}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={text => setFormData({...formData, phone: text})}
                placeholder="+256700000000"
                placeholderTextColor={COLORS.gray2}
                keyboardType="phone-pad"
                editable={!isGeneralVendor}
              />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={text => setFormData({...formData, email: text})}
                placeholder="supplier@example.com"
                placeholderTextColor={COLORS.gray2}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isGeneralVendor}
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Website</Text>
              <TextInput
                style={[styles.input, errors.website && styles.inputError]}
                value={formData.website}
                onChangeText={text => setFormData({...formData, website: text})}
                placeholder="https://supplier.com"
                placeholderTextColor={COLORS.gray2}
                keyboardType="url"
                autoCapitalize="none"
                editable={!isGeneralVendor}
              />
              {errors.website ? (
                <Text style={styles.errorText}>{errors.website}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.blockedRow, isGeneralVendor && styles.disabledInput]}
              activeOpacity={0.8}
              disabled={isGeneralVendor}
              onPress={() =>
                setFormData(prev => ({...prev, blocked: !prev.blocked}))
              }>
              <View
                style={[
                  styles.blockedToggle,
                  formData.blocked && styles.blockedToggleActive,
                ]}>
                {formData.blocked ? <Text style={styles.blockedToggleTick}>✓</Text> : null}
              </View>
              <View style={styles.blockedTextWrap}>
                <Text style={styles.blockedTitle}>Blocked</Text>
                <Text style={styles.blockedSubtext}>
                  Prevent this supplier from being used in future transactions.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Street address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={text => setFormData({...formData, address: text})}
                placeholder="Street address"
                placeholderTextColor={COLORS.gray2}
                multiline
                numberOfLines={3}
                editable={!isGeneralVendor}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={text => setFormData({...formData, city: text})}
                placeholder="City"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralVendor}
              />
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Payment method</Text>
              {paymentMethods.length === 0 ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                  <Text style={styles.loadingText}>Loading payment methods...</Text>
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
                      style={styles.picker}
                      enabled={!isGeneralVendor}>
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
                  {formData.payment_method ? (
                    <Text style={styles.selectedValueText}>
                      {paymentMethods.find(m => m.id === formData.payment_method)
                        ?.description ||
                        paymentMethods.find(m => m.id === formData.payment_method)?.code ||
                        ''}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 8,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary3,
  },
  headerSaveButton: {
    minWidth: 108,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  headerSaveText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 22,
    marginBottom: 24,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    marginBottom: 28,
  },
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInitials: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
  },
  previewMeta: {
    flex: 1,
    marginLeft: 14,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 4,
  },
  previewSubtext: {
    ...FONTS.body4,
    color: COLORS.secondary2,
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
  sectionDivider: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.transparentPrimary,
    marginTop: 6,
    marginBottom: 26,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    ...FONTS.body4,
    color: COLORS.black,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  disabledInput: {
    backgroundColor: COLORS.lightGray2,
    color: COLORS.gray2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: 8,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.white,
  },
  blockedToggle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  blockedToggleActive: {
    backgroundColor: COLORS.primary2,
  },
  blockedToggleTick: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  blockedTextWrap: {
    flex: 1,
  },
  blockedTitle: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 2,
  },
  blockedSubtext: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginLeft: 8,
  },
  pickerContainer: {
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
  selectedValueText: {
    ...FONTS.body4,
    color: COLORS.primary2,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default VendorFormModal;

