import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
import {useTheme} from '../../context/ThemeContext';
import {
  Vendor,
  PaymentMethod,
  VendorFormValues,
} from '../../@types/vendor';
import {QuickIconPressable} from '../../Components';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {VendorServices} from '../../services/VendorServices';
import Toast from 'react-native-toast-message';

const emptyVendorForm = (): VendorFormValues => ({
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

const vendorToForm = (vendor: Vendor): VendorFormValues => ({
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

const OPTIONAL_VENDOR_FIELDS = new Set<keyof VendorFormValues>([
  'blocked',
  'address',
  'city',
  'phone',
  'email',
  'website',
  'payment_method',
  'vendor_posting_group',
  'business_posting_group',
]);

interface VendorFormModalProps {
  visible: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  /** Called after a successful auto-save so the list can refresh (does not close). */
  onSave: () => void;
  /** Keeps parent selection in sync after create / update. */
  onRecordChange?: (vendor: Vendor) => void;
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
  onRecordChange,
  paymentMethods,
  canCreate,
  canEdit,
}) => {
  const {colors, isDark} = useTheme();
  const topInset = useScreenTopInset();

  const themed = useMemo(
    () => ({
      pageRoot: {backgroundColor: colors.background},
      pageTitle: {color: colors.textPrimary},
      autoSaveHint: {color: colors.textSecondary},
      previewSection: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      previewName: {color: colors.textPrimary},
      previewSubtext: {color: colors.textSecondary},
      sectionTitle: {color: colors.textPrimary},
      sectionDivider: {backgroundColor: colors.border},
      label: {color: colors.textSecondary},
      input: {
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      disabledInput: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      blockedRow: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      blockedTitle: {color: colors.textPrimary},
      blockedSubtext: {color: colors.textSecondary},
      pickerContainer: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      picker: {
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      loadingText: {color: colors.textSecondary},
      headerIconButton: {backgroundColor: colors.backButtonBg},
      headerIcon: {tintColor: colors.textPrimary},
    }),
    [colors],
  );

  const [formData, setFormData] = useState<VendorFormValues>(emptyVendorForm);
  const [currentRecord, setCurrentRecord] = useState<Vendor | null>(vendor);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formDataRef = useRef(formData);
  const currentRecordRef = useRef(currentRecord);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formDataRef.current = formData;
  currentRecordRef.current = currentRecord;

  const isEditMode = !!currentRecord?.id;
  const isGeneralVendor = isProtectedGeneralVendor(currentRecord || vendor);
  const canWrite = isEditMode ? canEdit : canCreate;

  useEffect(() => {
    if (!visible) {
      setCurrentRecord(null);
      setFormData(emptyVendorForm());
      setErrors({});
      setShowSaved(false);
      return;
    }
    if (vendor?.id) {
      if (currentRecordRef.current?.id !== vendor.id) {
        setCurrentRecord(vendor);
        setFormData(vendorToForm(vendor));
      } else {
        setCurrentRecord(vendor);
      }
    } else if (!currentRecordRef.current?.id) {
      setCurrentRecord(null);
      setFormData(emptyVendorForm());
    }
    setErrors({});
    setShowSaved(false);
  }, [vendor?.id, visible]);

  useEffect(() => {
    if (!visible && savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, [visible]);

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

  const buildCreatePayload = (values: VendorFormValues): Partial<Vendor> => {
    const payload: Partial<Vendor> = {
      name: values.name.trim(),
      blocked: !!values.blocked,
    };
    if (values.address?.trim()) {
      payload.address = values.address.trim();
    }
    if (values.city?.trim()) {
      payload.city = values.city.trim();
    }
    if (values.phone?.trim()) {
      payload.phone = values.phone.trim();
    }
    if (values.email?.trim()) {
      payload.email = values.email.trim();
    }
    if (values.website?.trim()) {
      payload.website = values.website.trim();
    }
    if (values.payment_method) {
      payload.payment_method = values.payment_method;
    }
    if (values.vendor_posting_group) {
      payload.vendor_posting_group = values.vendor_posting_group;
    }
    if (values.business_posting_group) {
      payload.business_posting_group = values.business_posting_group;
    }
    return payload;
  };

  const getFieldError = (field: keyof VendorFormValues, value: unknown) => {
    if (field === 'name' && (!value || !String(value).trim())) {
      return 'Supplier name is required';
    }
    if (field === 'email' && value && String(value).trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value).trim())) {
        return 'Enter a valid email address';
      }
    }
    if (field === 'website' && value && String(value).trim()) {
      try {
        new URL(String(value).trim());
      } catch {
        return 'Enter a valid URL';
      }
    }
    if (field === 'phone' && value && !/^\+?[\d\s\-()]+$/.test(String(value))) {
      return 'Phone number can only contain numbers, +, -, (), and spaces';
    }
    return null;
  };

  const autoSaveField = useCallback(
    async (
      field: keyof VendorFormValues,
      rawValue: VendorFormValues[keyof VendorFormValues],
    ) => {
      if (!visible || isGeneralVendor || !canWrite || savingRef.current) {
        return;
      }

      const value =
        typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      const record = currentRecordRef.current;
      const values = {...formDataRef.current, [field]: rawValue};

      if (record?.id) {
        const existing = (record as any)[field];
        if (String(existing ?? '') === String(value ?? '')) {
          return;
        }
      }

      const fieldError = getFieldError(field, value);
      if (fieldError) {
        setErrors(prev => ({...prev, [field]: fieldError}));
        return;
      }

      if (
        field !== 'blocked' &&
        !OPTIONAL_VENDOR_FIELDS.has(field) &&
        (value === '' || value === null || value === undefined)
      ) {
        return;
      }

      const nameForCreate =
        field === 'name' ? String(value || '') : values.name || '';
      if (!record?.id && !nameForCreate.trim()) {
        return;
      }

      setErrors(prev => {
        const next = {...prev};
        delete next[field];
        return next;
      });

      savingRef.current = true;
      setIsSaving(true);
      try {
        if (!record?.id) {
          const created = await VendorServices.createVendor(
            buildCreatePayload({...values, [field]: value as any}),
          );
          setCurrentRecord(created);
          setFormData(vendorToForm(created));
          onRecordChange?.(created);
          onSave();
          flashSaved();
        } else {
          const updated = await VendorServices.updateVendor(record.id, {
            [field]: value,
          } as Partial<Vendor>);
          setCurrentRecord(updated);
          onRecordChange?.(updated);
          onSave();
          flashSaved();
        }
      } catch (error: any) {
        console.error('Error auto-saving vendor:', error);
        const errorMessage =
          error?.response?.data?.errors?.[field]?.[0] ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          error?.response?.data?.name?.[0] ||
          `Failed to save ${field.replace(/_/g, ' ')}`;
        setErrors(prev => ({...prev, [field]: errorMessage}));
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
        });
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [visible, isGeneralVendor, canWrite, onRecordChange, onSave, flashSaved],
  );

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
      <View style={[styles.pageRoot, themed.pageRoot]}>
        <View style={[styles.pageHeader, {paddingTop: topInset}]}>
          <QuickIconPressable
            onPress={onClose}
            style={[styles.headerIconButton, themed.headerIconButton]}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityLabel="Close">
            <Image
              source={icons.cross}
              style={[styles.headerIcon, themed.headerIcon]}
              resizeMode="contain"
            />
          </QuickIconPressable>

          {canWrite && !isGeneralVendor && (isSaving || showSaved) ? (
            <View style={styles.headerSaveButton}>
              <Text style={styles.headerSaveText}>
                {isSaving ? 'Saving...' : 'Saved'}
              </Text>
            </View>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.pageTitle, themed.pageTitle]}>
            {isEditMode ? 'Edit supplier' : 'Add supplier'}
          </Text>
          <Text style={[styles.autoSaveHint, themed.autoSaveHint]}>
            Changes save automatically when you leave a field
          </Text>

          <View style={[styles.previewSection, themed.previewSection]}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitials}>{previewInitials}</Text>
            </View>
            <View style={styles.previewMeta}>
              <Text
                style={[styles.previewName, themed.previewName]}
                numberOfLines={1}>
                {previewName}
              </Text>
              <Text style={[styles.previewSubtext, themed.previewSubtext]}>
                {formData.phone?.trim() || formData.email?.trim() || 'Supplier contact'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>Details</Text>

            {isEditMode && currentRecord?.no ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, themed.label]}>Supplier number</Text>
                <TextInput
                  style={[styles.input, themed.input, themed.disabledInput]}
                  value={currentRecord.no}
                  editable={false}
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Supplier name</Text>
              <TextInput
                style={[styles.input, themed.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={text => setFormData({...formData, name: text})}
                onBlur={() => autoSaveField('name', formDataRef.current.name)}
                placeholder="Supplier name"
                placeholderTextColor={colors.placeholder}
                editable={!isGeneralVendor && canWrite}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Phone number</Text>
              <TextInput
                style={[styles.input, themed.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={text => setFormData({...formData, phone: text})}
                onBlur={() =>
                  autoSaveField('phone', formDataRef.current.phone || '')
                }
                placeholder="+256700000000"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
                editable={!isGeneralVendor && canWrite}
              />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Email</Text>
              <TextInput
                style={[styles.input, themed.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={text => setFormData({...formData, email: text})}
                onBlur={() =>
                  autoSaveField('email', formDataRef.current.email || '')
                }
                placeholder="supplier@example.com"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isGeneralVendor && canWrite}
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Website</Text>
              <TextInput
                style={[styles.input, themed.input, errors.website && styles.inputError]}
                value={formData.website}
                onChangeText={text => setFormData({...formData, website: text})}
                onBlur={() =>
                  autoSaveField('website', formDataRef.current.website || '')
                }
                placeholder="https://supplier.com"
                placeholderTextColor={colors.placeholder}
                keyboardType="url"
                autoCapitalize="none"
                editable={!isGeneralVendor && canWrite}
              />
              {errors.website ? (
                <Text style={styles.errorText}>{errors.website}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.blockedRow,
                themed.blockedRow,
                isGeneralVendor && themed.disabledInput,
              ]}
              activeOpacity={0.8}
              disabled={isGeneralVendor || !canWrite}
              onPress={() => {
                const nextBlocked = !formData.blocked;
                setFormData(prev => ({...prev, blocked: nextBlocked}));
                void autoSaveField('blocked', nextBlocked);
              }}>
              <View
                style={[
                  styles.blockedToggle,
                  formData.blocked && styles.blockedToggleActive,
                ]}>
                {formData.blocked ? <Text style={styles.blockedToggleTick}>✓</Text> : null}
              </View>
              <View style={styles.blockedTextWrap}>
                <Text style={[styles.blockedTitle, themed.blockedTitle]}>Blocked</Text>
                <Text style={[styles.blockedSubtext, themed.blockedSubtext]}>
                  Prevent this supplier from being used in future transactions.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.sectionDivider, themed.sectionDivider]} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>Address</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Street address</Text>
              <TextInput
                style={[styles.input, styles.textArea, themed.input]}
                value={formData.address}
                onChangeText={text => setFormData({...formData, address: text})}
                onBlur={() =>
                  autoSaveField('address', formDataRef.current.address || '')
                }
                placeholder="Street address"
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
                editable={!isGeneralVendor && canWrite}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>City</Text>
              <TextInput
                style={[styles.input, themed.input]}
                value={formData.city}
                onChangeText={text => setFormData({...formData, city: text})}
                onBlur={() =>
                  autoSaveField('city', formDataRef.current.city || '')
                }
                placeholder="City"
                placeholderTextColor={colors.placeholder}
                editable={!isGeneralVendor && canWrite}
              />
            </View>
          </View>

          <View style={[styles.sectionDivider, themed.sectionDivider]} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>Payment</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Payment method</Text>
              {paymentMethods.length === 0 ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                  <Text style={[styles.loadingText, themed.loadingText]}>
                    Loading payment methods...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.pickerContainer, themed.pickerContainer]}>
                    <Picker
                      selectedValue={formData.payment_method || 0}
                      onValueChange={value => {
                        const nextValue = value === 0 ? null : value;
                        setFormData({...formData, payment_method: nextValue});
                        void autoSaveField('payment_method', nextValue);
                      }}
                      style={[styles.picker, themed.picker]}
                      dropdownIconColor={colors.textPrimary}
                      itemStyle={isDark ? {color: colors.textPrimary} : undefined}
                      enabled={!isGeneralVendor && canWrite}>
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
                    <Text style={[styles.selectedValueText, {color: COLORS.primary2}]}>
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
  headerIcon: {
    width: 16,
    height: 16,
  },
  headerSpacer: {
    width: 108,
  },
  autoSaveHint: {
    ...FONTS.body5,
    marginBottom: 18,
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
    marginTop: 22,
    marginBottom: 4,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  previewSubtext: {
    ...FONTS.body4,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 6,
    marginBottom: 26,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    ...FONTS.body4,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...FONTS.body3,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  disabledInput: {},
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
    fontWeight: '600',
    marginBottom: 2,
  },
  blockedSubtext: {
    ...FONTS.body4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    ...FONTS.body4,
    marginLeft: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  selectedValueText: {
    ...FONTS.body4,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default VendorFormModal;

