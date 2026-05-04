import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {QuickIconPressable} from '../../Components';
import {COLORS, FONTS, SIZES, ICON_BUTTON_HIT_SLOP} from '../../constants';
import {Loan, BankAccount} from '../../@types/loans';
import {LoanServices} from '../../services/LoanServices';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  loan: Loan | null;
  canCreate: boolean;
  canEdit: boolean;
};

const repaymentAccounts = ['Cash', 'Bank/Mobile Money'];

const LoanFormModal: React.FC<Props> = ({
  visible,
  onClose,
  onSaved,
  loan,
  canCreate,
  canEdit,
}) => {
  const isEdit = !!loan;
  const [loanAmountInput, setLoanAmountInput] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [form, setForm] = useState<Partial<Loan>>({
    lender_name: '',
    loan_amount: undefined,
    disbursement_date: new Date().toISOString().split('T')[0],
    interest_rate: undefined,
    repayment_period: undefined,
    repayment_account: 'Cash',
    bank_account: null,
    purpose: '',
    loan_type: '',
    status: 'Open',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loan) {
      setForm({
        lender_name: loan.lender_name,
        loan_amount: loan.loan_amount,
        disbursement_date: loan.disbursement_date,
        interest_rate: loan.interest_rate,
        repayment_period: loan.repayment_period,
        repayment_account: loan.repayment_account,
        bank_account: loan.bank_account || null,
        purpose: loan.purpose,
        loan_type: loan.loan_type,
        status: loan.status || 'Open',
      });
      setLoanAmountInput(
        loan.loan_amount ? formatWithCommas(loan.loan_amount) : '',
      );
    } else {
      setForm({
        lender_name: '',
        loan_amount: undefined,
        disbursement_date: new Date().toISOString().split('T')[0],
        interest_rate: undefined,
        repayment_period: undefined,
        repayment_account: 'Cash',
        bank_account: null,
        purpose: '',
        loan_type: '',
        status: 'Open',
      });
      setLoanAmountInput('');
    }
    setErrors({});
  }, [loan, visible]);

  useEffect(() => {
    const loadBankAccounts = async () => {
      setBankAccountsLoading(true);
      try {
        const accounts = await LoanServices.getBankAccounts();
        setBankAccounts(accounts || []);
      } catch (error: any) {
        console.error('Error loading bank accounts:', error);
        Toast.show({
          type: 'error',
          text1: 'Bank Accounts',
          text2: 'Failed to load bank accounts',
        });
      } finally {
        setBankAccountsLoading(false);
      }
    };
    if (visible) {
      loadBankAccounts();
    }
  }, [visible]);

  const loanTypes = [
    {label: 'Select loan type', value: ''},
    {label: 'Bank', value: 'Bank'},
    {label: 'Sacco', value: 'Sacco'},
    {label: 'Individual', value: 'Individual'},
  ];

  const formatWithCommas = (value: number | string) => {
    const num = typeof value === 'number' ? value : parseFloat(value || '0');
    if (isNaN(num)) return '';
    return num.toLocaleString();
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.lender_name || !form.lender_name.trim()) {
      newErrors.lender_name = 'Lender is required';
    }
    if (!form.loan_type) {
      newErrors.loan_type = 'Select a loan type';
    }
    if (!form.loan_amount || form.loan_amount <= 0) {
      newErrors.loan_amount = 'Amount must be greater than 0';
    }
    if (!form.repayment_period || form.repayment_period <= 0) {
      newErrors.repayment_period = 'Repayment period must be greater than 0';
    }
    if (
      form.interest_rate === undefined ||
      form.interest_rate === null ||
      form.interest_rate < 0 ||
      form.interest_rate > 100
    ) {
      newErrors.interest_rate = 'Interest rate must be between 0 and 100';
    }
    if (
      form.repayment_account === 'Bank/Mobile Money' &&
      !form.bank_account
    ) {
      newErrors.bank_account = 'Bank account required for Bank/Mobile Money';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (isEdit && !canEdit) {
      Alert.alert('Permission', 'You do not have permission to edit loans.');
      return;
    }
    if (!isEdit && !canCreate) {
      Alert.alert('Permission', 'You do not have permission to create loans.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Loan> = {
        lender_name: form.lender_name?.trim(),
        loan_type: form.loan_type,
        loan_amount: form.loan_amount,
        disbursement_date: form.disbursement_date,
        interest_rate: form.interest_rate,
        repayment_period: form.repayment_period,
        repayment_account: form.repayment_account,
        bank_account: form.bank_account || null,
        purpose: form.purpose?.trim(),
        status: form.status,
      };
      if (isEdit && loan) {
        await LoanServices.updateLoan(loan.id, payload);
        Toast.show({type: 'success', text1: 'Updated', text2: 'Loan updated'});
      } else {
        await LoanServices.createLoan(payload);
        Toast.show({type: 'success', text1: 'Created', text2: 'Loan created'});
      }
      onSaved();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to save loan',
      });
    } finally {
      setSaving(false);
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
            <Text style={styles.title}>{isEdit ? 'Edit Loan' : 'Create Loan'}</Text>
            <QuickIconPressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Close">
              <Text style={styles.closeText}>✕</Text>
            </QuickIconPressable>
          </View>
          <ScrollView style={{maxHeight: '80%'}}>
            {loan?.document_no && (
              <View style={styles.field}>
                <Text style={styles.label}>Document No</Text>
                <TextInput
                  value={loan.document_no}
                  editable={false}
                  style={[styles.input, styles.inputDisabled]}
                />
              </View>
            )}
            {renderInput(
              'Lender *',
              form.lender_name || '',
              text => setForm(prev => ({...prev, lender_name: text})),
            )}
            <View style={styles.field}>
              <Text style={styles.label}>Loan Type *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.loan_type || ''}
                  onValueChange={value =>
                    setForm(prev => ({...prev, loan_type: value || ''}))
                  }
                  dropdownIconColor={COLORS.gray}
                  style={styles.picker}>
                  {loanTypes.map(option => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                    />
                  ))}
                </Picker>
              </View>
              {errors.loan_type && (
                <Text style={styles.error}>{errors.loan_type}</Text>
              )}
            </View>

    <View style={styles.field}>
      <Text style={styles.label}>Loan Amount (UGX) *</Text>
      <TextInput
        value={loanAmountInput}
        onChangeText={text => {
          const numeric = text.replace(/[^0-9]/g, '');
          setLoanAmountInput(formatWithCommas(numeric));
          setForm(prev => ({
            ...prev,
            loan_amount: numeric ? parseFloat(numeric) : undefined,
          }));
        }}
        style={styles.input}
        keyboardType="numeric"
      />
    </View>
    <Text style={styles.helper}>Enter principal in UGX; required.</Text>

    {renderInput(
      'Interest Rate (%)',
      form.interest_rate?.toString() || '',
      text =>
        setForm(prev => ({
          ...prev,
          interest_rate: parseFloat(text) || undefined,
        })),
      'numeric',
    )}
    <Text style={styles.helper}>Interest must be between 0 and 100.</Text>

    {renderInput(
      'Repayment Period (months) *',
      form.repayment_period?.toString() || '',
      text =>
        setForm(prev => ({
          ...prev,
          repayment_period: parseInt(text, 10) || undefined,
        })),
      'numeric',
    )}
    <Text style={styles.helper}>Number of months, greater than 0.</Text>

    {renderInput(
      'Disbursement Date (YYYY-MM-DD)',
      form.disbursement_date || '',
      text => setForm(prev => ({...prev, disbursement_date: text})),
    )}
            <View style={styles.field}>
              <Text style={styles.label}>Repayment Account *</Text>
              <View style={styles.chipRow}>
                {repaymentAccounts.map(acc => (
                  <TouchableOpacity
                    key={acc}
                    style={[
                      styles.chip,
                      form.repayment_account === acc && styles.chipActive,
                    ]}
                    onPress={() =>
                      setForm(prev => ({
                        ...prev,
                        repayment_account: acc,
                        bank_account:
                          acc === 'Cash' ? null : prev.bank_account || null,
                      }))
                    }>
                    <Text
                      style={[
                        styles.chipText,
                        form.repayment_account === acc && styles.chipTextActive,
                      ]}>
                      {acc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.helper}>
                Select Bank/Mobile Money only if a bank account is provided.
              </Text>
              {errors.bank_account && (
                <Text style={styles.error}>{errors.bank_account}</Text>
              )}
            </View>
            {form.repayment_account !== 'Cash' && (
              <View style={styles.field}>
                <Text style={styles.label}>Bank Account</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={(form.bank_account as any) || ''}
                    onValueChange={value =>
                      setForm(prev => ({
                        ...prev,
                        bank_account: value ? value : null,
                      }))
                    }
                    dropdownIconColor={COLORS.gray}
                    style={styles.picker}>
                    <Picker.Item label="Select bank account" value="" />
                    {bankAccounts.map(acc => (
                      <Picker.Item
                        key={acc.no || acc.id || acc.name}
                        label={
                          acc.name
                            ? `${acc.name}${acc.no ? ` (${acc.no})` : ''}`
                            : acc.no || 'Account'
                        }
                        value={acc.no || acc.id || ''}
                      />
                    ))}
                  </Picker>
                </View>
                {bankAccountsLoading && (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                    style={{marginTop: 4}}
                  />
                )}
                <Text style={styles.helper}>Loaded from /api/bank-accounts/.</Text>
              </View>
            )}
            {renderInput(
              'Purpose',
              form.purpose || '',
              text => setForm(prev => ({...prev, purpose: text})),
            )}
            {isEdit && (
              <View style={styles.field}>
                <Text style={styles.label}>Status</Text>
                <TextInput
                  value={form.status || 'Open'}
                  editable={false}
                  style={[styles.input, styles.inputDisabled]}
                />
              </View>
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
              disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}>
              {saving ? (
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
  title: {
    ...FONTS.h2,
    color: COLORS.black,
  },
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
  inputDisabled: {
    backgroundColor: '#EFF2F7',
    color: COLORS.gray,
  },
  row: {
    flexDirection: 'row',
    gap: SIZES.base,
  },
  helper: {
    ...FONTS.body5,
    color: COLORS.gray,
    paddingHorizontal: SIZES.padding,
    marginTop: -4,
    marginBottom: SIZES.base,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {...FONTS.body4, color: COLORS.gray},
  chipTextActive: {color: COLORS.white},
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    backgroundColor: '#F2F5FA',
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: SIZES.base,
    marginTop: SIZES.base / 2,
    marginBottom: SIZES.base,
  },
  picker: {
    width: '100%',
    height: 52,
    color: COLORS.black,
    backgroundColor: 'transparent',
    marginTop: Platform.OS === 'android' ? -8 : 0,
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
  error: {
    ...FONTS.body4,
    color: COLORS.error,
  },
  errorBox: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
    gap: 4,
  },
});

export default LoanFormModal;

