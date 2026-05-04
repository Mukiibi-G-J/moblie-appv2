import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import {QuickIconPressable} from '../../Components';
import {COLORS, FONTS, SIZES, ICON_BUTTON_HIT_SLOP} from '../../constants';
import {BankAccount} from '../../@types/bankAccount';
import {BankAccountServices} from '../../services/BankAccountServices';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  bankAccount: BankAccount | null;
  canCreate: boolean;
  canEdit: boolean;
};

const BankAccountFormModal: React.FC<Props> = ({
  visible,
  onClose,
  onSaved,
  bankAccount,
  canCreate,
  canEdit,
}) => {
  const isEdit = !!bankAccount;
  const [form, setForm] = useState<Partial<BankAccount>>({
    no: '',
    name: '',
    bank_account_no: '',
    bank_branch_no: '',
    bank_account_posting_group: '',
    address: '',
    contact: '',
    min_balance: 0,
  });
  const [postingGroups, setPostingGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPG, setLoadingPG] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = () => {
      if (bankAccount) {
        setForm({
          no: bankAccount.no,
          name: bankAccount.name,
          bank_account_no: bankAccount.bank_account_no,
          bank_branch_no: bankAccount.bank_branch_no,
          bank_account_posting_group: bankAccount.bank_account_posting_group,
          address: bankAccount.address,
          contact: bankAccount.contact,
          min_balance: bankAccount.min_balance || 0,
        });
      } else {
        setForm({
          no: '',
          name: '',
          bank_account_no: '',
          bank_branch_no: '',
          bank_account_posting_group: '',
          address: '',
          contact: '',
          min_balance: 0,
        });
      }
      setErrors({});
    };
    init();
  }, [bankAccount, visible]);

  useEffect(() => {
    const loadPG = async () => {
      setLoadingPG(true);
      try {
        const groups = await BankAccountServices.getPostingGroups();
        setPostingGroups(groups || []);
      } catch (error) {
        console.warn('Failed to load posting groups', error);
      } finally {
        setLoadingPG(false);
      }
    };
    if (visible) loadPG();
  }, [visible]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.no) newErrors.no = 'Account number is required';
    if (!form.name) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (isEdit && !canEdit) {
      Alert.alert('Permission', 'You do not have permission to edit.');
      return;
    }
    if (!isEdit && !canCreate) {
      Alert.alert('Permission', 'You do not have permission to create.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit && bankAccount) {
        await BankAccountServices.updateBankAccount(bankAccount.no || '', form);
        Toast.show({type: 'success', text1: 'Updated', text2: 'Bank account updated'});
      } else {
        await BankAccountServices.createBankAccount(form);
        Toast.show({type: 'success', text1: 'Created', text2: 'Bank account created'});
      }
      onSaved();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to save bank account',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    keyboardType: 'default' | 'numeric' = 'default',
    editable = true,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.input, !editable && styles.inputDisabled]}
        placeholderTextColor={COLORS.gray}
        keyboardType={keyboardType}
        editable={editable}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Edit Bank Account' : 'Create Bank Account'}</Text>
            <QuickIconPressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Close">
              <Text style={styles.closeText}>✕</Text>
            </QuickIconPressable>
          </View>
          <ScrollView style={{maxHeight: '80%'}}>
            {renderInput(
              'Account No *',
              form.no || '',
              text => setForm(prev => ({...prev, no: text})),
              'default',
              !isEdit, // prevent changing PK on edit
            )}
            {renderInput(
              'Name *',
              form.name || '',
              text => setForm(prev => ({...prev, name: text})),
            )}
            {renderInput(
              'Bank Account No',
              form.bank_account_no || '',
              text => setForm(prev => ({...prev, bank_account_no: text})),
            )}
            {renderInput(
              'Bank Branch No',
              form.bank_branch_no || '',
              text => setForm(prev => ({...prev, bank_branch_no: text})),
            )}
            <View style={styles.field}>
              <Text style={styles.label}>Posting Group</Text>
              <TextInput
                value={form.bank_account_posting_group || ''}
                onChangeText={text =>
                  setForm(prev => ({...prev, bank_account_posting_group: text}))
                }
                style={styles.input}
                placeholder="Posting group code"
                placeholderTextColor={COLORS.gray}
              />
              {loadingPG && (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{marginTop: 4}}
                />
              )}
              {postingGroups.length > 0 && (
                <Text style={styles.helper}>
                  Example: {postingGroups[0].code || postingGroups[0].name}
                </Text>
              )}
            </View>
            {renderInput(
              'Address',
              form.address || '',
              text => setForm(prev => ({...prev, address: text})),
            )}
            {renderInput(
              'Contact',
              form.contact || '',
              text => setForm(prev => ({...prev, contact: text})),
            )}
            {renderInput(
              'Minimum Balance',
              form.min_balance?.toString() || '',
              text =>
                setForm(prev => ({
                  ...prev,
                  min_balance: text ? parseFloat(text) : 0,
                })),
              'numeric',
            )}

            {Object.keys(errors).length > 0 && (
              <View style={styles.errorBox}>
                {Object.values(errors).map(msg => (
                  <Text key={msg} style={styles.error}>
                    {msg}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.saveText}>{isEdit ? 'Update' : 'Create'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    paddingBottom: SIZES.padding,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  title: {...FONTS.h2, color: COLORS.black},
  closeBtn: {padding: 6},
  closeText: {...FONTS.h2, color: COLORS.gray},
  field: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    height: 48,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: '#F2F5FA',
  },
  inputDisabled: {backgroundColor: '#EFF2F7', color: COLORS.gray},
  helper: {...FONTS.body5, color: COLORS.gray, marginTop: 4},
  error: {...FONTS.body4, color: COLORS.error},
  errorBox: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
    gap: 4,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SIZES.base / 2,
  },
  cancelButton: {backgroundColor: COLORS.lightGray1},
  cancelText: {...FONTS.body3, color: COLORS.black},
  saveButton: {backgroundColor: COLORS.primary},
  saveText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
});

export default BankAccountFormModal;



