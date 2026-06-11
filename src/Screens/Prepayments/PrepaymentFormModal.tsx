import React, {useEffect, useMemo, useState} from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Picker} from '@react-native-picker/picker';
import {QuickIconPressable} from '../../Components';
import {
  COLORS,
  FONTS,
  SIZES,
  ICON_BUTTON_HIT_SLOP,
  icons,
} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
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

const formatCommaInput = (text: string): string => {
  const cleanedText = text.replace(/[^0-9.]/g, '');
  if (!cleanedText) {
    return '';
  }
  const numericValue = parseFloat(cleanedText.replace(/,/g, ''));
  if (!Number.isFinite(numericValue)) {
    return cleanedText;
  }
  return numericValue.toLocaleString('en-US', {maximumFractionDigits: 0});
};

const parseAmount = (text: string): number => {
  const trimmed = text.trim().replace(/,/g, '');
  if (!trimmed) {
    return 0;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
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
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const canSave = (isEdit && canEdit) || (!isEdit && canCreate);

  const themeStyles = useMemo(
    () => ({
      label: {color: colors.textPrimary},
      input: {
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      disabledInput: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      sectionTitle: {color: colors.textPrimary},
      lineCard: {
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      pickerWrap: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      picker: {
        backgroundColor: colors.inputBackground,
        color: colors.textPrimary,
      },
      helper: {color: colors.textSecondary},
    }),
    [colors],
  );

  const [form, setForm] = useState<Partial<Prepayment>>({
    customer: '',
    payment_method_id: null,
    status: 'Draft',
  });
  const [lines, setLines] = useState<PrepaymentLine[]>([]);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const loadMethods = async () => {
      const methods = await PrepaymentService.getPaymentMethods();
      setPaymentMethods(methods);
    };
    loadMethods();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
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
        setInstallmentAmount('');
      }
    };
    init();
  }, [prepayment, visible]);

  const visibleLines = lines.filter(line => !line.is_deleted);

  const addLine = () => {
    setLines(prev => [
      ...prev,
      {
        quantity: 1,
        unit_price: 0,
        item: '',
        unit_of_measure: '',
        is_deleted: false,
      },
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
    if (!validate()) {
      return;
    }
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
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to save prepayment',
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
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to post prepayment',
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
    const amount = parseAmount(installmentAmount);
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.pageRoot, {backgroundColor: colors.background}]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.page, {backgroundColor: colors.background}]}>
          <View
            style={[
              styles.pageHeader,
              {
                paddingTop: Math.max(
                  insets.top,
                  Platform.OS === 'ios' ? 12 : 16,
                ),
              },
            ]}>
            <QuickIconPressable
              onPress={onClose}
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Close">
              <Image
                source={icons.cross}
                style={[
                  styles.headerCloseIcon,
                  {tintColor: colors.textPrimary},
                ]}
                resizeMode="contain"
              />
            </QuickIconPressable>
            {canSave ? (
              <TouchableOpacity
                style={[
                  styles.headerSaveButton,
                  (saving || loadingDetail) && styles.headerSaveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || loadingDetail}
                activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.headerSaveText}>
                    {isEdit ? 'Save' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSaveSpacer} />
            )}
          </View>

          {loadingDetail ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary2} />
              <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
                Loading prepayment...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.formContainer}
              contentContainerStyle={[
                styles.formContent,
                {paddingBottom: Math.max(insets.bottom, 28) + 16},
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text style={[styles.pageTitle, {color: colors.textPrimary}]}>
                {isEdit ? 'Edit prepayment' : 'Create prepayment'}
              </Text>

              <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>
                Document information
              </Text>

              {prepayment?.document_no ? (
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, themeStyles.label]}>
                    Document no
                  </Text>
                  <TextInput
                    value={prepayment.document_no}
                    editable={false}
                    style={[
                      styles.input,
                      themeStyles.input,
                      themeStyles.disabledInput,
                    ]}
                  />
                </View>
              ) : null}

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, themeStyles.label]}>
                  Customer *
                </Text>
                <TextInput
                  placeholder="Customer id or code"
                  placeholderTextColor={colors.placeholder}
                  value={(form.customer as any)?.toString() || ''}
                  onChangeText={text =>
                    setForm(prev => ({...prev, customer: text}))
                  }
                  style={[styles.input, themeStyles.input]}
                  editable={form.status !== 'Posted'}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, themeStyles.label]}>
                  Payment method
                </Text>
                {paymentMethods.length > 0 ? (
                  <View style={[styles.pickerContainer, themeStyles.pickerWrap]}>
                    <Picker
                      selectedValue={form.payment_method_id || 0}
                      onValueChange={value =>
                        setForm(prev => ({
                          ...prev,
                          payment_method_id: value === 0 ? null : Number(value),
                        }))
                      }
                      style={[styles.picker, themeStyles.picker]}
                      itemStyle={{color: colors.textPrimary}}
                      dropdownIconColor={colors.textPrimary}
                      enabled={form.status !== 'Posted'}>
                      <Picker.Item label="Select payment method" value={0} />
                      {paymentMethods.map(method => (
                        <Picker.Item
                          key={method.id}
                          label={
                            method.description ||
                            method.code ||
                            `Method ${method.id}`
                          }
                          value={method.id}
                        />
                      ))}
                    </Picker>
                  </View>
                ) : (
                  <TextInput
                    placeholder="Payment method id"
                    placeholderTextColor={colors.placeholder}
                    value={form.payment_method_id?.toString() || ''}
                    onChangeText={text =>
                      setForm(prev => ({
                        ...prev,
                        payment_method_id: text ? parseInt(text, 10) : null,
                      }))
                    }
                    style={[styles.input, themeStyles.input]}
                    keyboardType="numeric"
                    editable={form.status !== 'Posted'}
                  />
                )}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, themeStyles.label]}>Status</Text>
                <TextInput
                  value={form.status || 'Draft'}
                  editable={false}
                  style={[
                    styles.input,
                    themeStyles.input,
                    themeStyles.disabledInput,
                  ]}
                />
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, themeStyles.sectionTitle]}>
                  Lines
                </Text>
                {form.status !== 'Posted' ? (
                  <TouchableOpacity
                    onPress={addLine}
                    style={styles.addLineButton}
                    activeOpacity={0.85}>
                    <Text style={styles.addLineText}>+ Add line</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {visibleLines.length === 0 ? (
                <Text style={[styles.helper, themeStyles.helper]}>
                  No lines yet. Tap Add line to include items.
                </Text>
              ) : (
                lines.map((line, idx) => {
                  if (line.is_deleted) {
                    return null;
                  }
                  return (
                    <View
                      key={line.id ?? `line-${idx}`}
                      style={[styles.lineCard, themeStyles.lineCard]}>
                      <View style={styles.lineCardHeader}>
                        <Text style={[styles.lineCardTitle, themeStyles.label]}>
                          Line {idx + 1}
                        </Text>
                        {form.status !== 'Posted' ? (
                          <TouchableOpacity
                            onPress={() => markDeleteLine(idx)}
                            hitSlop={ICON_BUTTON_HIT_SLOP}
                            accessibilityLabel="Delete line">
                            <Image
                              source={icons.delete_icon}
                              style={styles.lineDeleteIcon}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <TextInput
                        placeholder="Item (code/id)"
                        placeholderTextColor={colors.placeholder}
                        value={line.item?.toString() || ''}
                        onChangeText={text => updateLine(idx, {item: text})}
                        style={[styles.input, themeStyles.input]}
                        editable={form.status !== 'Posted'}
                      />
                      <TextInput
                        placeholder="Unit of measure"
                        placeholderTextColor={colors.placeholder}
                        value={line.unit_of_measure?.toString() || ''}
                        onChangeText={text =>
                          updateLine(idx, {unit_of_measure: text})
                        }
                        style={[styles.input, themeStyles.input]}
                        editable={form.status !== 'Posted'}
                      />
                      <View style={styles.lineFieldRow}>
                        <View style={styles.lineFieldHalf}>
                          <Text style={[styles.lineFieldLabel, themeStyles.helper]}>
                            Quantity
                          </Text>
                          <TextInput
                            placeholder="1"
                            placeholderTextColor={colors.placeholder}
                            value={
                              line.quantity > 0
                                ? line.quantity.toLocaleString('en-US')
                                : ''
                            }
                            onChangeText={text =>
                              updateLine(idx, {
                                quantity: parseAmount(text) || 0,
                              })
                            }
                            style={[styles.input, themeStyles.input]}
                            keyboardType="decimal-pad"
                            editable={form.status !== 'Posted'}
                          />
                        </View>
                        <View style={styles.lineFieldHalf}>
                          <Text style={[styles.lineFieldLabel, themeStyles.helper]}>
                            Unit price
                          </Text>
                          <TextInput
                            placeholder="Enter price"
                            placeholderTextColor={colors.placeholder}
                            value={
                              line.unit_price > 0
                                ? line.unit_price.toLocaleString('en-US')
                                : ''
                            }
                            onChangeText={text =>
                              updateLine(idx, {
                                unit_price: parseAmount(text),
                              })
                            }
                            style={[styles.input, themeStyles.input]}
                            keyboardType="decimal-pad"
                            editable={form.status !== 'Posted'}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })
              )}

              {isEdit && form.status !== 'Posted' ? (
                <>
                  <Text
                    style={[
                      styles.sectionTitle,
                      styles.sectionTitleMargin,
                      themeStyles.sectionTitle,
                    ]}>
                    Actions
                  </Text>
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, themeStyles.label]}>
                      Installment amount
                    </Text>
                    <TextInput
                      placeholder="Enter amount"
                      placeholderTextColor={colors.placeholder}
                      value={installmentAmount}
                      onChangeText={text =>
                        setInstallmentAmount(formatCommaInput(text))
                      }
                      style={[styles.input, themeStyles.input]}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={handleInstallment}
                      disabled={saving}
                      activeOpacity={0.85}>
                      <Text style={styles.secondaryButtonText}>
                        Add installment
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.postButton]}
                      onPress={handlePost}
                      disabled={saving}
                      activeOpacity={0.85}>
                      <Text style={styles.actionButtonText}>Post</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.finalButton]}
                      onPress={handleFinalInvoice}
                      disabled={saving}
                      activeOpacity={0.85}>
                      <Text style={styles.actionButtonText}>Final invoice</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageRoot: {flex: 1},
  page: {flex: 1},
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
  headerCloseIcon: {width: 20, height: 20},
  headerSaveButton: {
    minWidth: 108,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerSaveButtonDisabled: {opacity: 0.55},
  headerSaveSpacer: {minWidth: 108, height: 48},
  headerSaveText: {color: COLORS.white, fontSize: 17, fontWeight: '700'},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
    minHeight: 200,
  },
  loadingText: {...FONTS.body3, marginTop: SIZES.base},
  formContainer: {flex: 1},
  formContent: {paddingHorizontal: 20},
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    ...FONTS.h4,
    fontWeight: '600',
    paddingTop: SIZES.base,
    paddingBottom: SIZES.base,
  },
  sectionTitleMargin: {marginTop: SIZES.base},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SIZES.base,
  },
  fieldContainer: {
    paddingVertical: SIZES.base,
  },
  label: {...FONTS.body3, marginBottom: SIZES.base / 2, fontWeight: '600'},
  helper: {...FONTS.body4, marginBottom: SIZES.base},
  input: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    ...FONTS.body3,
    marginBottom: SIZES.base / 2,
  },
  pickerContainer: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    marginBottom: SIZES.base / 2,
  },
  picker: {width: '100%'},
  addLineButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
  },
  addLineText: {...FONTS.body4, color: COLORS.white, fontWeight: '600'},
  lineCard: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    marginBottom: SIZES.base,
  },
  lineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2,
  },
  lineCardTitle: {...FONTS.body3, fontWeight: '600'},
  lineDeleteIcon: {width: 20, height: 20, tintColor: COLORS.error},
  lineFieldRow: {flexDirection: 'row', gap: 10},
  lineFieldHalf: {flex: 1},
  lineFieldLabel: {...FONTS.body4, marginBottom: 4},
  secondaryButton: {
    marginTop: SIZES.base,
    backgroundColor: COLORS.primary2,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  secondaryButtonText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: SIZES.base,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButton: {backgroundColor: COLORS.success},
  finalButton: {backgroundColor: COLORS.primary},
  actionButtonText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
});

export default PrepaymentFormModal;
