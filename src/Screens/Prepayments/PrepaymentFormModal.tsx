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
import {COLORS, FONTS, SIZES} from '../../constants';
import {Prepayment, PrepaymentLine} from '../../@types/prepayment';
import {PrepaymentService} from '../../services/PrepaymentService';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  prepayment: Prepayment | null;
  canCreate: boolean;
  canEdit: boolean;
};

const PrepaymentFormModal: React.FC<Props> = ({
  visible,
  onClose,
  onSaved,
  prepayment,
  canCreate,
  canEdit,
}) => {
  const isEdit = !!prepayment;
  const [form, setForm] = useState<Partial<Prepayment>>({
    customer: '',
    payment_method_id: null,
    status: 'Draft',
  });
  const [lines, setLines] = useState<PrepaymentLine[]>([]);
  const [installmentAmount, setInstallmentAmount] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const loadMethods = async () => {
      const methods = await PrepaymentService.getPaymentMethods();
      setPaymentMethods(methods);
    };
    loadMethods();
  }, []);

  useEffect(() => {
    const init = async () => {
      if (prepayment) {
        setLoadingDetail(true);
        try {
          const detail = await PrepaymentService.getPrepayment(prepayment.id);
          setForm({
            customer: detail.customer,
            payment_method_id: detail.payment_method_id || null,
            status: detail.status || 'Draft',
          });
          setLines(
            detail.lines?.map(l => ({
              id: l.id,
              item: l.item,
              unit_of_measure: l.unit_of_measure,
              quantity: l.quantity,
              unit_price: l.unit_price,
              is_deleted: false,
            })) || [],
          );
        } catch (error) {
          console.warn('Failed to load prepayment detail', error);
        } finally {
          setLoadingDetail(false);
        }
      } else {
        setForm({
          customer: '',
          payment_method_id: null,
          status: 'Draft',
        });
        setLines([]);
      }
    };
    init();
  }, [prepayment, visible]);

  const addLine = () => {
    setLines(prev => [
      ...prev,
      {quantity: 1, unit_price: 0, item: '', unit_of_measure: '', is_deleted: false},
    ]);
  };

  const updateLine = (index: number, patch: Partial<PrepaymentLine>) => {
    setLines(prev =>
      prev.map((line, i) => (i === index ? {...line, ...patch} : line)),
    );
  };

  const markDeleteLine = (index: number) => {
    setLines(prev =>
      prev.map((line, i) =>
        i === index ? {...line, is_deleted: true} : line,
      ),
    );
  };

  const validate = () => {
    if (!form.customer) {
      Toast.show({type: 'error', text1: 'Customer is required'});
      return false;
    }
    return true;
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
      if (isEdit && prepayment) {
        await PrepaymentService.updatePrepayment(prepayment.id, form);
        if (lines.length > 0) {
          await PrepaymentService.updateLines(prepayment.id, lines);
        }
        Toast.show({type: 'success', text1: 'Updated', text2: 'Prepayment updated'});
      } else {
        const created = await PrepaymentService.createPrepayment(form);
        if (lines.length > 0) {
          await PrepaymentService.updateLines(created.id, lines);
        }
        Toast.show({type: 'success', text1: 'Created', text2: 'Prepayment created'});
      }
      onSaved();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.detail || 'Failed to save prepayment',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!prepayment) {
      Alert.alert('Save first', 'Save the prepayment before posting.');
      return;
    }
    if (!form.payment_method_id) {
      Alert.alert('Payment Method Required', 'Select a payment method first.');
      return;
    }
    setSaving(true);
    try {
      await PrepaymentService.postPrepayment(prepayment.id, {
        payment_method_id: form.payment_method_id,
      });
      Toast.show({type: 'success', text1: 'Posted', text2: 'Prepayment posted'});
      onSaved();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.detail || 'Failed to post prepayment',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalInvoice = async () => {
    if (!prepayment) {
      Alert.alert('Save first', 'Save the prepayment before final invoicing.');
      return;
    }
    setSaving(true);
    try {
      await PrepaymentService.postFinalInvoice(prepayment.id, {
        payment_method_id: form.payment_method_id || null,
      });
      Toast.show({
        type: 'success',
        text1: 'Final Invoice',
        text2: 'Final invoice posted',
      });
      onSaved();
      onClose();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.detail ||
          'Failed to post final invoice',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInstallment = async () => {
    if (!prepayment) {
      Alert.alert('Save first', 'Save the prepayment before adding installment.');
      return;
    }
    const amount = parseFloat(installmentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid installment amount.');
      return;
    }
    setSaving(true);
    try {
      await PrepaymentService.addInstallment(prepayment.id, {amount});
      Toast.show({
        type: 'success',
        text1: 'Installment',
        text2: 'Installment added',
      });
      setInstallmentAmount('');
      onSaved();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.detail ||
          'Failed to add installment',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEdit ? 'Edit Prepayment' : 'Create Prepayment'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{maxHeight: '75%'}}>
            {prepayment?.document_no && (
              <View style={styles.field}>
                <Text style={styles.label}>Document No</Text>
                <TextInput
                  value={prepayment.document_no}
                  editable={false}
                  style={[styles.input, styles.inputDisabled]}
                />
              </View>
            )}
            <View style={styles.field}>
              <Text style={styles.label}>Customer *</Text>
              <TextInput
                placeholder="Customer id or code"
                placeholderTextColor={COLORS.gray}
                value={(form.customer as any)?.toString() || ''}
                onChangeText={text =>
                  setForm(prev => ({...prev, customer: text}))
                }
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Payment Method</Text>
              <TextInput
                placeholder="Payment method id"
                placeholderTextColor={COLORS.gray}
                value={form.payment_method_id?.toString() || ''}
                onChangeText={text =>
                  setForm(prev => ({
                    ...prev,
                    payment_method_id: text ? parseInt(text, 10) : null,
                  }))
                }
                style={styles.input}
                keyboardType="numeric"
              />
              {paymentMethods.length > 0 && (
                <Text style={styles.helper}>
                  Example method: {paymentMethods[0].description || paymentMethods[0].code}
                </Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              <TextInput
                value={form.status || 'Draft'}
                editable={false}
                style={[styles.input, styles.inputDisabled]}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldHeader}>
              <Text style={styles.sectionTitle}>Lines</Text>
              <TouchableOpacity onPress={addLine} style={styles.addLineBtn}>
                <Text style={styles.addLineText}>+ Add Line</Text>
              </TouchableOpacity>
            </View>
            {loadingDetail ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              lines.map((line, idx) => (
                <View key={idx} style={styles.lineCard}>
                  <Text style={styles.label}>Line {idx + 1}</Text>
                  <TextInput
                    placeholder="Item (code/id)"
                    placeholderTextColor={COLORS.gray}
                    value={line.item?.toString() || ''}
                    onChangeText={text =>
                      updateLine(idx, {item: text})
                    }
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="UOM"
                    placeholderTextColor={COLORS.gray}
                    value={line.unit_of_measure?.toString() || ''}
                    onChangeText={text =>
                      updateLine(idx, {unit_of_measure: text})
                    }
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Quantity"
                    placeholderTextColor={COLORS.gray}
                    value={line.quantity?.toString() || ''}
                    onChangeText={text =>
                      updateLine(idx, {quantity: parseFloat(text) || 0})
                    }
                    style={styles.input}
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="Unit Price"
                    placeholderTextColor={COLORS.gray}
                    value={line.unit_price?.toString() || ''}
                    onChangeText={text =>
                      updateLine(idx, {unit_price: parseFloat(text) || 0})
                    }
                    style={styles.input}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={() => markDeleteLine(idx)}
                    style={styles.deleteLineBtn}>
                    <Text style={styles.deleteLineText}>Delete</Text>
                  </TouchableOpacity>
                  {line.is_deleted && (
                    <Text style={styles.deletedBadge}>Marked for delete</Text>
                  )}
                </View>
              ))
            )}
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.label}>Installment Amount</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={COLORS.gray}
                value={installmentAmount}
                onChangeText={setInstallmentAmount}
                style={styles.input}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleInstallment}
                disabled={saving}>
                <Text style={styles.secondaryButtonText}>Add Installment</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={saving}>
              <Text style={styles.cancelText}>Close</Text>
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
            {isEdit && (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.postButton]}
                  onPress={handlePost}
                  disabled={saving}>
                  <Text style={styles.saveText}>Post</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.postButton]}
                  onPress={handleFinalInvoice}
                  disabled={saving}>
                  <Text style={styles.saveText}>Final Invoice</Text>
                </TouchableOpacity>
              </>
            )}
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
  divider: {
    height: 1,
    backgroundColor: COLORS.lightGray2,
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.base,
  },
  fieldHeader: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {...FONTS.h3, color: COLORS.black},
  addLineBtn: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
  },
  addLineText: {...FONTS.body4, color: COLORS.white, fontWeight: '600'},
  lineCard: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
    padding: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  deleteLineBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteLineText: {...FONTS.body4, color: COLORS.error},
  deletedBadge: {...FONTS.body4, color: COLORS.error, fontStyle: 'italic'},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
    flexWrap: 'wrap',
    gap: 8,
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
  postButton: {backgroundColor: COLORS.success},
  saveText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
  secondaryButton: {
    marginTop: SIZES.base / 2,
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  secondaryButtonText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
});

export default PrepaymentFormModal;



