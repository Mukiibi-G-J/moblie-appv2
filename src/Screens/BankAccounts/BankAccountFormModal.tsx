import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
import {QuickIconPressable} from '../../Components';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {BankAccount} from '../../@types/bankAccount';
import {BankAccountServices} from '../../services/BankAccountServices';
import {formatCurrencyCompact} from '../../utils/currency';
import Toast from 'react-native-toast-message';

type BankAccountFormValues = {
  no: string;
  name: string;
  bank_account_no: string;
  bank_branch_no: string;
  bank_account_posting_group: string;
  address: string;
  contact: string;
  min_balance: string;
};

type PostingGroup = {
  code?: string;
  name?: string;
  description?: string;
};

const emptyForm = (): BankAccountFormValues => ({
  no: '',
  name: '',
  bank_account_no: '',
  bank_branch_no: '',
  bank_account_posting_group: '',
  address: '',
  contact: '',
  min_balance: '0',
});

const accountToForm = (account: BankAccount): BankAccountFormValues => ({
  no: account.no || '',
  name: account.name || '',
  bank_account_no: account.bank_account_no || '',
  bank_branch_no: account.bank_branch_no || '',
  bank_account_posting_group: account.bank_account_posting_group || '',
  address: account.address || '',
  contact: account.contact || '',
  min_balance:
    account.min_balance === undefined || account.min_balance === null
      ? '0'
      : String(account.min_balance),
});

const OPTIONAL_FIELDS = new Set<keyof BankAccountFormValues>([
  'bank_account_no',
  'bank_branch_no',
  'bank_account_posting_group',
  'address',
  'contact',
  'min_balance',
]);

const extractApiErrorMessage = (
  error: any,
  field: string,
  fallback: string,
): string => {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data[field]?.[0]) return String(data[field][0]);
  if (data.errors?.[field]?.[0]) return String(data.errors[field][0]);
  if (data.detail) return String(data.detail);
  if (data.error) return String(data.error);
  return fallback;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful auto-save so the list can refresh (does not close). */
  onSave: () => void;
  /** Keeps parent selection in sync after create / update. */
  onRecordChange?: (account: BankAccount) => void;
  bankAccount: BankAccount | null;
  canCreate: boolean;
  canEdit: boolean;
};

const BankAccountFormModal: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  onRecordChange,
  bankAccount,
  canCreate,
  canEdit,
}) => {
  const topInset = useScreenTopInset();

  const [formData, setFormData] = useState<BankAccountFormValues>(emptyForm);
  const [currentRecord, setCurrentRecord] = useState<BankAccount | null>(
    bankAccount,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [postingGroups, setPostingGroups] = useState<PostingGroup[]>([]);
  const [loadingPG, setLoadingPG] = useState(false);

  const formDataRef = useRef(formData);
  const currentRecordRef = useRef(currentRecord);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formDataRef.current = formData;
  currentRecordRef.current = currentRecord;

  const isEditMode = !!currentRecord?.no;
  const canWrite = isEditMode ? canEdit : canCreate;

  const previewName = formData.name.trim() || formData.no.trim() || 'Bank account';
  const previewInitials = useMemo(() => {
    const source = formData.name.trim() || formData.no.trim() || 'BA';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [formData.name, formData.no]);

  useEffect(() => {
    if (!visible) {
      setCurrentRecord(null);
      setFormData(emptyForm());
      setErrors({});
      setShowSaved(false);
      return;
    }
    if (bankAccount?.no) {
      if (currentRecordRef.current?.no !== bankAccount.no) {
        setCurrentRecord(bankAccount);
        setFormData(accountToForm(bankAccount));
      } else {
        setCurrentRecord(bankAccount);
      }
    } else if (!currentRecordRef.current?.no) {
      setCurrentRecord(null);
      setFormData(emptyForm());
    }
    setErrors({});
    setShowSaved(false);
  }, [bankAccount?.no, visible]);

  useEffect(() => {
    if (!visible) {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPG(true);
      try {
        const groups = await BankAccountServices.getPostingGroups();
        if (!cancelled) setPostingGroups(groups || []);
      } catch (error) {
        console.warn('Failed to load posting groups', error);
      } finally {
        if (!cancelled) setLoadingPG(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const parseMinBalance = (raw: string): number => {
    const cleaned = String(raw || '').replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const buildCreatePayload = (
    values: BankAccountFormValues,
  ): Partial<BankAccount> => {
    const payload: Partial<BankAccount> = {
      no: values.no.trim(),
      name: values.name.trim(),
      min_balance: parseMinBalance(values.min_balance),
    };
    if (values.bank_account_no.trim()) {
      payload.bank_account_no = values.bank_account_no.trim();
    }
    if (values.bank_branch_no.trim()) {
      payload.bank_branch_no = values.bank_branch_no.trim();
    }
    if (values.bank_account_posting_group.trim()) {
      payload.bank_account_posting_group =
        values.bank_account_posting_group.trim();
    }
    if (values.address.trim()) {
      payload.address = values.address.trim();
    }
    if (values.contact.trim()) {
      payload.contact = values.contact.trim();
    }
    return payload;
  };

  const normalizeFieldValue = (
    field: keyof BankAccountFormValues,
    rawValue: BankAccountFormValues[keyof BankAccountFormValues],
  ) => {
    if (field === 'min_balance') {
      return parseMinBalance(String(rawValue ?? ''));
    }
    if (typeof rawValue === 'string') {
      return rawValue.trim();
    }
    return rawValue;
  };

  const getComparableRecordValue = (
    record: BankAccount,
    field: keyof BankAccountFormValues,
  ) => {
    if (field === 'min_balance') {
      return Number(record.min_balance ?? 0);
    }
    return String((record as any)[field] ?? '');
  };

  const getFieldError = (
    field: keyof BankAccountFormValues,
    value: unknown,
  ) => {
    if (field === 'no') {
      const no = String(value || '').trim();
      if (!no) return 'Account number is required';
      if (no.length > 20) return 'Account number must be 20 characters or less';
    }
    if (field === 'name') {
      const name = String(value || '').trim();
      if (!name) return 'Name is required';
    }
    if (field === 'min_balance') {
      const cleaned = String(value ?? '').replace(/,/g, '').trim();
      if (cleaned && !Number.isFinite(Number.parseFloat(cleaned))) {
        return 'Enter a valid amount';
      }
    }
    return null;
  };

  const autoSaveField = useCallback(
    async (
      field: keyof BankAccountFormValues,
      rawValue: BankAccountFormValues[keyof BankAccountFormValues],
    ) => {
      if (!visible || !canWrite || savingRef.current) {
        return;
      }

      // Account No is immutable after create.
      if (field === 'no' && currentRecordRef.current?.no) {
        return;
      }

      const normalizedValue = normalizeFieldValue(field, rawValue);
      const record = currentRecordRef.current;
      const values = {...formDataRef.current, [field]: rawValue};

      if (record?.no) {
        const existing = getComparableRecordValue(record, field);
        if (String(existing ?? '') === String(normalizedValue ?? '')) {
          return;
        }
      }

      const fieldError = getFieldError(field, rawValue);
      if (fieldError) {
        setErrors(prev => ({...prev, [field]: fieldError}));
        return;
      }

      if (
        !OPTIONAL_FIELDS.has(field) &&
        (normalizedValue === '' ||
          normalizedValue === null ||
          normalizedValue === undefined)
      ) {
        return;
      }

      const noForCreate =
        field === 'no' ? String(normalizedValue || '') : values.no || '';
      const nameForCreate =
        field === 'name' ? String(normalizedValue || '') : values.name || '';
      if (!record?.no && (!noForCreate.trim() || !nameForCreate.trim())) {
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
        if (!record?.no) {
          const created = await BankAccountServices.createBankAccount(
            buildCreatePayload({
              ...values,
              [field]:
                field === 'min_balance'
                  ? String(normalizedValue)
                  : (rawValue as any),
            }),
          );
          setCurrentRecord(created);
          setFormData(accountToForm(created));
          onRecordChange?.(created);
          onSave();
          flashSaved();
        } else {
          const patch: Partial<BankAccount> = {
            [field]: normalizedValue,
          } as Partial<BankAccount>;
          const updated = await BankAccountServices.updateBankAccount(
            record.no,
            patch,
          );
          setCurrentRecord(updated);
          if (field === 'min_balance') {
            setFormData(prev => ({
              ...prev,
              min_balance: String(updated.min_balance ?? 0),
            }));
          } else if (field !== 'no') {
            setFormData(prev => ({
              ...prev,
              [field]: String((updated as any)[field] ?? prev[field] ?? ''),
            }));
          }
          onRecordChange?.(updated);
          onSave();
          flashSaved();
        }
      } catch (error: any) {
        console.error('Error auto-saving bank account:', error);
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
    [visible, canWrite, onRecordChange, onSave, flashSaved],
  );

  const selectedPostingGroupLabel = useMemo(() => {
    const code = formData.bank_account_posting_group;
    if (!code) return '';
    const match = postingGroups.find(g => g.code === code);
    return match?.name || match?.description || code;
  }, [formData.bank_account_posting_group, postingGroups]);

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

          {canWrite && (isSaving || showSaved) ? (
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
            {isEditMode ? 'Edit bank account' : 'Add bank account'}
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
                {currentRecord?.balance !== undefined &&
                currentRecord?.balance !== null
                  ? `Balance ${formatCurrencyCompact(currentRecord.balance)}`
                  : formData.bank_account_no?.trim() ||
                    formData.no?.trim() ||
                    'Account details'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Account number</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.no && styles.inputError,
                  isEditMode && styles.disabledInput,
                ]}
                value={formData.no}
                onChangeText={text =>
                  setFormData({...formData, no: text.toUpperCase()})
                }
                onBlur={() => autoSaveField('no', formDataRef.current.no)}
                placeholder="e.g. BANK-01"
                placeholderTextColor={COLORS.gray2}
                editable={!isEditMode && canWrite}
                autoCapitalize="characters"
              />
              {errors.no ? (
                <Text style={styles.errorText}>{errors.no}</Text>
              ) : (
                <Text style={styles.helpText}>
                  {isEditMode
                    ? 'Account number cannot be changed after creation.'
                    : 'Short code used as the bank account ID. Required with name to create.'}
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={text => setFormData({...formData, name: text})}
                onBlur={() => autoSaveField('name', formDataRef.current.name)}
                placeholder="e.g. Main Bank UGX"
                placeholderTextColor={COLORS.gray2}
                editable={canWrite}
              />
              {errors.name ? (
                <Text style={styles.errorText}>{errors.name}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Display name on payments, reports, and cash/bank lists.
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Bank account no</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.bank_account_no && styles.inputError,
                ]}
                value={formData.bank_account_no}
                onChangeText={text =>
                  setFormData({...formData, bank_account_no: text})
                }
                onBlur={() =>
                  autoSaveField(
                    'bank_account_no',
                    formDataRef.current.bank_account_no || '',
                  )
                }
                placeholder="Account number at the bank"
                placeholderTextColor={COLORS.gray2}
                editable={canWrite}
                keyboardType="default"
              />
              {errors.bank_account_no ? (
                <Text style={styles.errorText}>{errors.bank_account_no}</Text>
              ) : (
                <Text style={styles.helpText}>
                  The account number assigned by your bank (optional).
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Bank branch no</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.bank_branch_no && styles.inputError,
                ]}
                value={formData.bank_branch_no}
                onChangeText={text =>
                  setFormData({...formData, bank_branch_no: text})
                }
                onBlur={() =>
                  autoSaveField(
                    'bank_branch_no',
                    formDataRef.current.bank_branch_no || '',
                  )
                }
                placeholder="Branch or sort code"
                placeholderTextColor={COLORS.gray2}
                editable={canWrite}
              />
              {errors.bank_branch_no ? (
                <Text style={styles.errorText}>{errors.bank_branch_no}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Branch / sort code if your bank uses one.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Posting</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Posting group</Text>
              {loadingPG ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                  <Text style={styles.loadingText}>Loading posting groups…</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={
                        formData.bank_account_posting_group || ''
                      }
                      onValueChange={value => {
                        const nextValue = String(value || '');
                        setFormData({
                          ...formData,
                          bank_account_posting_group: nextValue,
                        });
                        void autoSaveField(
                          'bank_account_posting_group',
                          nextValue,
                        );
                      }}
                      style={styles.picker}
                      enabled={canWrite}>
                      <Picker.Item label="Select posting group" value="" />
                      {postingGroups.map(group => (
                        <Picker.Item
                          key={group.code || group.name}
                          label={
                            group.name ||
                            group.description ||
                            group.code ||
                            'Group'
                          }
                          value={group.code || ''}
                        />
                      ))}
                    </Picker>
                  </View>
                  {selectedPostingGroupLabel ? (
                    <Text style={styles.selectedValueText}>
                      {selectedPostingGroupLabel}
                    </Text>
                  ) : null}
                </>
              )}
              {errors.bank_account_posting_group ? (
                <Text style={styles.errorText}>
                  {errors.bank_account_posting_group}
                </Text>
              ) : (
                <Text style={styles.helpText}>
                  Links this bank account to G/L posting. Set this for correct
                  accounting when you post payments.
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Minimum balance</Text>
              <TextInput
                style={[styles.input, errors.min_balance && styles.inputError]}
                value={formData.min_balance}
                onChangeText={text =>
                  setFormData({
                    ...formData,
                    min_balance: text.replace(/[^\d.,-]/g, ''),
                  })
                }
                onBlur={() =>
                  autoSaveField(
                    'min_balance',
                    formDataRef.current.min_balance || '0',
                  )
                }
                placeholder="0"
                placeholderTextColor={COLORS.gray2}
                keyboardType="decimal-pad"
                editable={canWrite}
              />
              {errors.min_balance ? (
                <Text style={styles.errorText}>{errors.min_balance}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Soft threshold for monitoring. Does not block posting.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  errors.address && styles.inputError,
                ]}
                value={formData.address}
                onChangeText={text => setFormData({...formData, address: text})}
                onBlur={() =>
                  autoSaveField('address', formDataRef.current.address || '')
                }
                placeholder="Bank branch address"
                placeholderTextColor={COLORS.gray2}
                multiline
                numberOfLines={3}
                editable={canWrite}
              />
              {errors.address ? (
                <Text style={styles.errorText}>{errors.address}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Optional branch address for your records.
                </Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contact</Text>
              <TextInput
                style={[styles.input, errors.contact && styles.inputError]}
                value={formData.contact}
                onChangeText={text => setFormData({...formData, contact: text})}
                onBlur={() =>
                  autoSaveField('contact', formDataRef.current.contact || '')
                }
                placeholder="Phone or contact person"
                placeholderTextColor={COLORS.gray2}
                editable={canWrite}
              />
              {errors.contact ? (
                <Text style={styles.errorText}>{errors.contact}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Optional phone or relationship manager details.
                </Text>
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
  helpText: {
    fontSize: 13,
    color: COLORS.gray2,
    marginTop: 8,
    lineHeight: 18,
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
    gap: 8,
  },
  loadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  picker: {
    width: '100%',
    color: COLORS.black,
  },
});

export default BankAccountFormModal;
