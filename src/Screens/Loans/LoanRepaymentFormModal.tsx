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
} from 'react-native';
import {COLORS, FONTS, SIZES} from '../../constants';
import {Loan, LoanRepayment} from '../../@types/loans';
import {LoanServices} from '../../services/LoanServices';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  repayment: LoanRepayment | null;
  canCreate: boolean;
  canEdit: boolean;
  loans: Loan[];
};

const LoanRepaymentFormModal: React.FC<Props> = ({
  visible,
  onClose,
  onSaved,
  repayment,
  canCreate,
  canEdit,
  loans,
}) => {
  const isEdit = !!repayment;
  const [form, setForm] = useState<Partial<LoanRepayment>>({
    loan: null,
    amount_paid: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: null,
    bank_account: null,
    status: 'Open',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (repayment) {
      setForm({
        loan:
          typeof repayment.loan === 'object' ? repayment.loan.id : repayment.loan,
        amount_paid: repayment.amount_paid,
        payment_date: repayment.payment_date,
        payment_method: repayment.payment_method || null,
        bank_account: repayment.bank_account || null,
        status: repayment.status || 'Open',
      });
    } else {
      setForm({
        loan: null,
        amount_paid: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: null,
        bank_account: null,
        status: 'Open',
      });
    }
    setErrors({});
  }, [repayment, visible]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.loan) newErrors.loan = 'Loan is required';
    if (!form.amount_paid || form.amount_paid <= 0) {
      newErrors.amount_paid = 'Amount must be greater than 0';
    }
    if (!form.payment_date) newErrors.payment_date = 'Payment date required';
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
    setSaving(true);
    try {
      const payload: Partial<LoanRepayment> = {
        loan: form.loan || undefined,
        amount_paid: form.amount_paid,
        payment_date: form.payment_date,
        payment_method: form.payment_method || undefined,
        bank_account: form.bank_account || null,
        status: form.status,
      };
      if (isEdit && repayment) {
        await LoanServices.updateRepayment(repayment.id, payload);
        Toast.show({type: 'success', text1: 'Updated', text2: 'Repayment updated'});
      } else {
        await LoanServices.createRepayment(payload);
        Toast.show({type: 'success', text1: 'Created', text2: 'Repayment created'});
      }
      onSaved();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.detail || 'Failed to save repayment',
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
            <Text style={styles.title}>
              {isEdit ? 'Edit Repayment' : 'Create Repayment'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{maxHeight: '80%'}}>
            {repayment?.document_no && (
              <View style={styles.field}>
                <Text style={styles.label}>Document No</Text>
                <TextInput
                  value={repayment.document_no}
                  editable={false}
                  style={[styles.input, styles.inputDisabled]}
                />
              </View>
            )}
            <View style={styles.field}>
              <Text style={styles.label}>Loan *</Text>
              <TextInput
                placeholder="Loan id"
                placeholderTextColor={COLORS.gray}
                value={form.loan ? form.loan.toString() : ''}
                onChangeText={text =>
                  setForm(prev => ({
                    ...prev,
                    loan: text ? parseInt(text, 10) : null,
                  }))
                }
                style={styles.input}
                keyboardType="numeric"
              />
              {loans.length > 0 && (
                <Text style={styles.helper}>
                  Example: {loans[0].id} ({loans[0].document_no || loans[0].lender_name})
                </Text>
              )}
              {errors.loan && <Text style={styles.error}>{errors.loan}</Text>}
            </View>
            {renderInput(
              'Amount Paid (UGX) *',
              form.amount_paid?.toString() || '',
              text =>
                setForm(prev => ({
                  ...prev,
                  amount_paid: parseFloat(text) || 0,
                })),
              'numeric',
            )}
            {renderInput(
              'Payment Date (YYYY-MM-DD) *',
              form.payment_date || '',
              text => setForm(prev => ({...prev, payment_date: text})),
            )}
            {renderInput(
              'Payment Method (id)',
              form.payment_method?.toString() || '',
              text =>
                setForm(prev => ({
                  ...prev,
                  payment_method: text ? parseInt(text, 10) : null,
                })),
              'numeric',
            )}
            {renderInput(
              'Bank Account (id)',
              form.bank_account?.toString() || '',
              text =>
                setForm(prev => ({
                  ...prev,
                  bank_account: text ? parseInt(text, 10) : null,
                })),
              'numeric',
            )}
            {errors.amount_paid && (
              <Text style={[styles.error, {paddingHorizontal: SIZES.padding}]}>
                {errors.amount_paid}
              </Text>
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
  title: {...FONTS.h2, color: COLORS.black},
  closeBtn: {padding: 6},
  closeText: {...FONTS.h2, color: COLORS.gray},
  field: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  label: {...FONTS.body3, color: COLORS.black, marginBottom: 6},
  helper: {...FONTS.body4, color: COLORS.gray, marginTop: 4},
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    height: 44,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: '#F7F9FD',
  },
  inputDisabled: {backgroundColor: '#EFF2F7', color: COLORS.gray},
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
  error: {...FONTS.body4, color: COLORS.error},
});

export default LoanRepaymentFormModal;



