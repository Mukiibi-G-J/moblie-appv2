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
import {CustomerServices} from '../../services/CustomerServices';
import Toast from 'react-native-toast-message';
import Contacts from 'react-native-contacts';

type DeviceContact = {
  recordID: string;
  displayName: string;
  phoneNumber: string;
};

const isProtectedGeneralCustomer = (customer?: Customer | null) => {
  const normalizedName = customer?.name?.trim().toLowerCase();
  return normalizedName === 'general' || normalizedName === 'general customer';
};

interface CustomerFormModalProps {
  visible: boolean;
  onClose: () => void;
  customer: Customer | null; // null for create, Customer for edit
  onSave: () => void;
  paymentMethods: PaymentMethod[];
  canCreate: boolean;
  canEdit: boolean;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  visible,
  onClose,
  customer,
  onSave,
  paymentMethods,
  canCreate,
  canEdit,
}) => {
  const isEditMode = !!customer;
  const isGeneralCustomer = isProtectedGeneralCustomer(customer);

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
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);

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

  useEffect(() => {
    if (!visible) {
      setContactsModalVisible(false);
      setContactSearchQuery('');
      setDeviceContacts([]);
      setLoadingContacts(false);
    }
  }, [visible]);

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

    if (isEditMode && isGeneralCustomer) {
      Alert.alert(
        'Protected customer',
        'The General Customer cannot be edited.',
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

  const handlePickContact = (contact: DeviceContact) => {
    setFormData(prev => ({
      ...prev,
      name: contact.displayName || prev.name,
      phone_number: contact.phoneNumber || prev.phone_number,
      contact: prev.contact || contact.displayName,
    }));
    setContactsModalVisible(false);
    setContactSearchQuery('');
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
        <View style={styles.pageHeader}>
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

          {((isEditMode && canEdit) || (!isEditMode && canCreate)) && (
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
            {isEditMode ? 'Edit customer' : 'Add customer'}
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
            disabled={loadingContacts}>
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

            {isEditMode && customer?.no ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Customer number</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={customer.no}
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
                placeholder="Customer name"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralCustomer}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contact person</Text>
              <TextInput
                style={styles.input}
                value={formData.contact}
                onChangeText={text => setFormData({...formData, contact: text})}
                placeholder="Contact person"
                placeholderTextColor={COLORS.gray2}
                editable={!isGeneralCustomer}
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
                placeholder="+256700000000"
                placeholderTextColor={COLORS.gray2}
                keyboardType="phone-pad"
                editable={!isGeneralCustomer}
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
                placeholder="Street address"
                placeholderTextColor={COLORS.gray2}
                multiline
                numberOfLines={3}
                editable={!isGeneralCustomer}
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
                editable={!isGeneralCustomer}
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
                        if (value === 0) {
                          setFormData({...formData, payment_method: null});
                        } else {
                          setFormData({...formData, payment_method: value});
                        }
                      }}
                      style={styles.picker}
                      enabled={!isGeneralCustomer}>
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

