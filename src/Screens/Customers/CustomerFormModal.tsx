import React, {useState, useEffect, useRef, useCallback} from 'react';
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
  FlatList,
  PermissionsAndroid,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
import {
  Customer,
  PaymentMethod,
  CustomerFormValues,
} from '../../@types/customer';
import {QuickIconPressable} from '../../Components';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {CustomerServices} from '../../services/CustomerServices';
import Toast from 'react-native-toast-message';
import Contacts from 'react-native-contacts';

type DeviceContact = {
  recordID: string;
  displayName: string;
  phoneNumber: string;
};

const emptyCustomerForm = (): CustomerFormValues => ({
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
  customer_type: 'Individual',
});

const customerToForm = (customer: Customer): CustomerFormValues => ({
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
  customer_type: customer.customer_type || 'Individual',
});

const isProtectedGeneralCustomer = (customer?: Customer | null) => {
  const normalizedName = customer?.name?.trim().toLowerCase();
  return normalizedName === 'general' || normalizedName === 'general customer';
};

const OPTIONAL_CUSTOMER_FIELDS = new Set<keyof CustomerFormValues>([
  'contact',
  'phone_number',
  'address',
  'address_2',
  'city',
  'credit_limit',
  'payment_method',
  'customer_posting_group',
  'general_business_posting_group',
  'customer_type',
]);

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
    // Backend sometimes stringifies DRF error dicts, e.g.
    // {'customer_type': [ErrorDetail(string='"GENERAL" is not a valid choice.', code='invalid_choice')]}
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

interface CustomerFormModalProps {
  visible: boolean;
  onClose: () => void;
  customer: Customer | null; // null for create, Customer for edit
  /** Called after a successful auto-save so the list can refresh (does not close). */
  onSave: () => void;
  /** Keeps parent selection in sync after create / update. */
  onRecordChange?: (customer: Customer) => void;
  paymentMethods: PaymentMethod[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete?: boolean;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  visible,
  onClose,
  customer,
  onSave,
  onRecordChange,
  paymentMethods,
  canCreate,
  canEdit,
}) => {
  const topInset = useScreenTopInset();

  const [formData, setFormData] = useState<CustomerFormValues>(emptyCustomerForm);
  const [currentRecord, setCurrentRecord] = useState<Customer | null>(customer);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);

  const formDataRef = useRef(formData);
  const currentRecordRef = useRef(currentRecord);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formDataRef.current = formData;
  currentRecordRef.current = currentRecord;

  const isEditMode = !!currentRecord?.id;
  const isGeneralCustomer = isProtectedGeneralCustomer(currentRecord || customer);
  const canWrite = isEditMode ? canEdit : canCreate;

  useEffect(() => {
    if (!visible) {
      setCurrentRecord(null);
      setFormData(emptyCustomerForm());
      setErrors({});
      setShowSaved(false);
      return;
    }
    if (customer?.id) {
      if (currentRecordRef.current?.id !== customer.id) {
        setCurrentRecord(customer);
        setFormData(customerToForm(customer));
      } else {
        setCurrentRecord(customer);
      }
    } else if (!currentRecordRef.current?.id) {
      setCurrentRecord(null);
      setFormData(emptyCustomerForm());
    }
    setErrors({});
    setShowSaved(false);
  }, [customer?.id, visible]);

  useEffect(() => {
    if (!visible) {
      setContactsModalVisible(false);
      setContactSearchQuery('');
      setDeviceContacts([]);
      setLoadingContacts(false);
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
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

  const buildCreatePayload = (
    values: CustomerFormValues,
  ): Partial<Customer> => {
    const payload: Partial<Customer> = {
      name: values.name.trim(),
    };
    if (values.contact?.trim()) {
      payload.contact = values.contact.trim();
    }
    if (values.phone_number?.trim()) {
      payload.phone_number = values.phone_number.trim();
    }
    if (values.address?.trim()) {
      payload.address = values.address.trim();
    }
    if (values.address_2?.trim()) {
      payload.address_2 = values.address_2.trim();
    }
    if (values.city?.trim()) {
      payload.city = values.city.trim();
    }
    if (values.payment_method) {
      payload.payment_method = values.payment_method;
    }
    if (values.customer_posting_group) {
      payload.customer_posting_group = values.customer_posting_group;
    }
    if (values.general_business_posting_group) {
      payload.general_business_posting_group =
        values.general_business_posting_group;
    }
    if (values.customer_type) {
      payload.customer_type = values.customer_type;
    }
    return payload;
  };

  const getFieldError = (field: keyof CustomerFormValues, value: unknown) => {
    if (field === 'name' && (!value || !String(value).trim())) {
      return 'Customer name is required';
    }
    if (
      field === 'phone_number' &&
      value &&
      !/^\+?[\d\s\-()]+$/.test(String(value))
    ) {
      return 'Phone number can only contain numbers, +, -, (), and spaces';
    }
    return null;
  };

  const autoSaveField = useCallback(
    async (
      field: keyof CustomerFormValues,
      rawValue: CustomerFormValues[keyof CustomerFormValues],
    ) => {
      if (!visible || isGeneralCustomer || !canWrite || savingRef.current) {
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
        !OPTIONAL_CUSTOMER_FIELDS.has(field) &&
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
          const created = await CustomerServices.createCustomer(
            buildCreatePayload({...values, [field]: value as any}),
          );
          setCurrentRecord(created);
          setFormData(customerToForm(created));
          onRecordChange?.(created);
          onSave();
          flashSaved();
        } else {
          const updated = await CustomerServices.updateCustomer(record.id, {
            [field]: value,
          } as Partial<Customer>);
          setCurrentRecord(updated);
          onRecordChange?.(updated);
          onSave();
          flashSaved();
        }
      } catch (error: any) {
        console.error('Error auto-saving customer:', error);
        const errorMessage = extractApiErrorMessage(
          error,
          field,
          `Failed to save ${field.replace(/_/g, ' ')}`,
        );
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
    [visible, isGeneralCustomer, canWrite, onRecordChange, onSave, flashSaved],
  );

  const normalizePhoneNumber = (value: string) =>
    value.replace(/[^\d+]/g, '').trim();

  const requestContactsPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts permission',
          message:
            'Allow Zentro to read your contacts so you can quickly add customers.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const permission = await Contacts.requestPermission();
    return permission === 'authorized';
  };

  const handleOpenContactsPicker = async () => {
    try {
      setLoadingContacts(true);
      const hasPermission = await requestContactsPermission();

      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission needed',
          text2: 'Enable contacts permission to pick a customer from your contacts.',
        });
        return;
      }

      const contacts = await Contacts.getAll();
      const mappedContacts = contacts
        .map(contact => {
          const displayName =
            contact.displayName ||
            [contact.givenName, contact.familyName].filter(Boolean).join(' ').trim();
          const phoneNumber =
            contact.phoneNumbers?.find(item => item.number?.trim())?.number || '';

          return {
            recordID: contact.recordID,
            displayName,
            phoneNumber: normalizePhoneNumber(phoneNumber),
          };
        })
        .filter(contact => contact.displayName)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      setDeviceContacts(mappedContacts);
      setContactsModalVisible(true);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to load contacts',
        text2: 'Please try again.',
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const handlePickContact = async (contact: DeviceContact) => {
    const nextValues: CustomerFormValues = {
      ...formDataRef.current,
      name: contact.displayName || formDataRef.current.name,
      phone_number: contact.phoneNumber || formDataRef.current.phone_number,
      contact: formDataRef.current.contact || contact.displayName,
    };
    setFormData(nextValues);
    formDataRef.current = nextValues;
    setContactsModalVisible(false);
    setContactSearchQuery('');

    if (currentRecordRef.current?.id) {
      await autoSaveField('name', nextValues.name);
      await autoSaveField('phone_number', nextValues.phone_number || '');
      if (nextValues.contact) {
        await autoSaveField('contact', nextValues.contact);
      }
    } else {
      await autoSaveField('name', nextValues.name);
    }
  };

  const previewName = (formData.name || 'My Customer').trim();
  const previewInitials =
    previewName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'MC';
  const filteredContacts = deviceContacts.filter(contact => {
    if (!contactSearchQuery.trim()) return true;
    const query = contactSearchQuery.toLowerCase();
    return (
      contact.displayName.toLowerCase().includes(query) ||
      contact.phoneNumber.toLowerCase().includes(query)
    );
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={styles.pageRoot}>
        <View style={[styles.pageHeader, {paddingTop: topInset}]}>
          <QuickIconPressable
            onPress={onClose}
            style={styles.headerIconButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityLabel="Close">
            <Image
              source={icons.cross}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </QuickIconPressable>

          {canWrite && !isGeneralCustomer && (isSaving || showSaved) ? (
            <View
              style={styles.headerSaveButton}
              accessibilityRole="text"
              accessibilityLabel={isSaving ? 'Saving' : 'Saved'}>
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
          <Text style={styles.pageTitle}>
            {isEditMode ? 'Edit customer' : 'Add customer'}
          </Text>
          <Text style={styles.autoSaveHint}>
            Changes save automatically when you leave a field
          </Text>

          <View style={styles.previewSection}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitials}>{previewInitials}</Text>
            </View>
            <View style={styles.previewMeta}>
              <Text
                style={styles.previewName}
                numberOfLines={1}
                ellipsizeMode="tail">
                {previewName}
              </Text>
              <Text style={styles.previewSubtext}>
                {formData.phone_number?.trim() || 'Phone number'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.importContactsButton}
            onPress={handleOpenContactsPicker}
            activeOpacity={0.85}
            disabled={loadingContacts || isGeneralCustomer || !canWrite}>
            {loadingContacts ? (
              <ActivityIndicator size="small" color={COLORS.primary2} />
            ) : (
              <>
                <Image
                  source={icons.profile}
                  style={styles.importContactsIcon}
                  resizeMode="contain"
                />
                <Text style={styles.importContactsText}>Pick from contacts</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>

            {isEditMode && currentRecord?.no ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Customer number</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={currentRecord.no}
                  editable={false}
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Customer name</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={text => setFormData({...formData, name: text})}
                onBlur={() => autoSaveField('name', formDataRef.current.name)}
                placeholder="Customer name"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralCustomer && canWrite}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contact person</Text>
              <TextInput
                style={styles.input}
                value={formData.contact}
                onChangeText={text => setFormData({...formData, contact: text})}
                onBlur={() =>
                  autoSaveField('contact', formDataRef.current.contact || '')
                }
                placeholder="Contact person"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralCustomer && canWrite}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={[styles.input, errors.phone_number && styles.inputError]}
                value={formData.phone_number}
                onChangeText={text =>
                  setFormData({...formData, phone_number: text})
                }
                onBlur={() =>
                  autoSaveField(
                    'phone_number',
                    formDataRef.current.phone_number || '',
                  )
                }
                placeholder="+256700000000"
                placeholderTextColor={COLORS.gray2}
                keyboardType="phone-pad"
                editable={!isGeneralCustomer && canWrite}
              />
              {errors.phone_number ? (
                <Text style={styles.errorText}>{errors.phone_number}</Text>
              ) : null}
            </View>
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
                onBlur={() =>
                  autoSaveField('address', formDataRef.current.address || '')
                }
                placeholder="Street address"
                placeholderTextColor={COLORS.gray2}
                multiline
                numberOfLines={3}
                editable={!isGeneralCustomer && canWrite}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={text => setFormData({...formData, city: text})}
                onBlur={() =>
                  autoSaveField('city', formDataRef.current.city || '')
                }
                placeholder="City"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralCustomer && canWrite}
              />
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Payment method</Text>
              {paymentMethods.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                  <Text style={styles.loadingText}>Loading payment methods...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.payment_method || 0}
                      onValueChange={value => {
                        const nextValue = value === 0 ? null : value;
                        setFormData({...formData, payment_method: nextValue});
                        void autoSaveField('payment_method', nextValue);
                      }}
                      style={styles.picker}
                      enabled={!isGeneralCustomer && canWrite}>
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

        <Modal
          visible={contactsModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setContactsModalVisible(false)}>
          <View style={styles.contactsScreen}>
            <View style={styles.contactsTopBar}>
              <QuickIconPressable
                onPress={() => setContactsModalVisible(false)}
                style={styles.contactsBackButton}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityLabel="Go back">
                <Image
                  source={icons.back}
                  style={styles.contactsBackIcon}
                  resizeMode="contain"
                />
              </QuickIconPressable>
              <Text style={styles.contactsModalTitle}>Choose a Contact</Text>
              <View style={styles.contactsHeaderSpacer} />
            </View>

            <View style={styles.contactsSearchWrap}>
              <Image
                source={icons.search}
                style={styles.contactsSearchIcon}
                resizeMode="contain"
              />
              <TextInput
                style={styles.contactsSearchInput}
                placeholder=""
                placeholderTextColor={COLORS.gray2}
                value={contactSearchQuery}
                onChangeText={setContactSearchQuery}
                autoFocus={true}
              />
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={item => item.recordID}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => handlePickContact(item)}
                  activeOpacity={0.8}>
                  <Text style={styles.contactName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.contactPhone} numberOfLines={1}>
                    {item.phoneNumber || 'No phone number'}
                  </Text>
                </TouchableOpacity>
              )}
                ItemSeparatorComponent={() => <View style={styles.contactSeparator} />}
              ListEmptyComponent={
                <View style={styles.contactsEmptyState}>
                  <Text style={styles.contactsEmptyTitle}>No contacts found</Text>
                  <Text style={styles.contactsEmptyText}>
                    Try another name or make sure your contacts have synced to this device.
                  </Text>
                </View>
              }
              contentContainerStyle={styles.contactsListContent}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </Modal>
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
  headerSpacer: {
    width: 88,
  },
  autoSaveHint: {
    ...FONTS.body5,
    color: COLORS.gray2,
    marginBottom: 12,
  },
  headerSaveButton: {
    minWidth: 88,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  headerSaveText: {
    color: COLORS.gray2,
    fontSize: 15,
    fontWeight: '600',
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
    marginBottom: 4,
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
  importContactsButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  importContactsIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary2,
  },
  importContactsText: {
    color: COLORS.primary3,
    fontSize: 15,
    fontWeight: '600',
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
  selectedValueText: {
    ...FONTS.body4,
    color: COLORS.primary2,
    marginTop: 8,
  },
  loadingContainer: {
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
  buttonDisabled: {
    opacity: 0.6,
  },
  contactsScreen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contactsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  contactsBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactsBackIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.black,
  },
  contactsModalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.black,
    marginLeft: 8,
  },
  contactsHeaderSpacer: {
    width: 40,
    height: 40,
  },
  contactsSearchWrap: {
    marginHorizontal: 0,
    marginVertical: 0,
    height: 70,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  contactsSearchIcon: {
    width: 28,
    height: 28,
    tintColor: COLORS.black,
    marginRight: 14,
  },
  contactsSearchInput: {
    flex: 1,
    fontSize: 18,
    color: COLORS.black,
    paddingVertical: 0,
  },
  contactsListContent: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  contactRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
  },
  contactSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 20,
  },
  contactName: {
    fontSize: 18,
    color: COLORS.black,
    fontWeight: '500',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: COLORS.gray2,
  },
  contactsEmptyState: {
    paddingHorizontal: 28,
    paddingVertical: 48,
    alignItems: 'center',
  },
  contactsEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 8,
  },
  contactsEmptyText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CustomerFormModal;

