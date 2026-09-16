import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
  Platform,
  Switch,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, icons} from '../../constants';
import {QuickIconPressable, SearchableSelectModal} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {
  createItemUnitOfMeasure,
  createUnitOfMeasure,
  deleteItemUnitOfMeasure,
  fetchItemUnitsOfMeasure,
  fetchUnitsOfMeasure,
  ItemUnitOfMeasure,
  UnitOfMeasure,
  updateItemUnitOfMeasure,
} from '../../services/app.services';

function parseApiError(error: unknown): string {
  const err = error as {
    response?: {data?: {detail?: string; error?: string; [key: string]: unknown}};
    message?: string;
  };
  const data = err?.response?.data;
  if (typeof data?.detail === 'string') {
    return data.detail;
  }
  if (typeof data?.error === 'string') {
    return data.error;
  }
  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    const val = data[firstKey];
    if (Array.isArray(val) && val[0]) {
      return String(val[0]);
    }
    if (typeof val === 'string') {
      return val;
    }
  }
  return err?.message || 'Something went wrong';
}

type FormState = {
  unit_of_measure: string;
  quantity_per_unit: string;
  default: boolean;
};

const EMPTY_FORM: FormState = {
  unit_of_measure: '',
  quantity_per_unit: '1',
  default: false,
};

interface ItemUnitOfMeasureModalProps {
  visible: boolean;
  onClose: () => void;
  itemNo: string;
  itemName?: string;
  canEdit: boolean;
  onChanged?: () => void;
}

const ItemUnitOfMeasureModal: React.FC<ItemUnitOfMeasureModalProps> = ({
  visible,
  onClose,
  itemNo,
  itemName,
  canEdit,
  onChanged,
}) => {
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ItemUnitOfMeasure[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOfMeasure[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showNewCodeForm, setShowNewCodeForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creatingCode, setCreatingCode] = useState(false);
  const [unitCodePickerVisible, setUnitCodePickerVisible] = useState(false);

  const unitCodeSelectOptions = useMemo(
    () =>
      unitOptions.map(u => ({
        id: u.code,
        label: u.code,
        subtitle: u.description || undefined,
      })),
    [unitOptions],
  );

  const selectedUnitLabel = useMemo(() => {
    if (!form.unit_of_measure) {
      return '';
    }
    const match = unitOptions.find(u => u.code === form.unit_of_measure);
    if (!match) {
      return form.unit_of_measure;
    }
    return match.description
      ? `${match.code} — ${match.description}`
      : match.code;
  }, [form.unit_of_measure, unitOptions]);

  const theme = useMemo(
    () => ({
      root: {backgroundColor: colors.background},
      headerTitle: {color: colors.textPrimary},
      subtitle: {color: colors.textSecondary},
      card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      label: {color: colors.textSecondary},
      input: {
        color: colors.textPrimary,
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      rowTitle: {color: colors.textPrimary},
      rowMeta: {color: colors.textSecondary},
      badge: {backgroundColor: colors.screenMuted},
      badgeText: {color: colors.textSecondary},
      empty: {color: colors.textSecondary},
      selectRow: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      selectRowText: {color: colors.textPrimary},
      selectRowPlaceholder: {color: colors.textSecondary},
      selectRowChevron: {color: colors.textSecondary},
    }),
    [colors],
  );

  const loadData = useCallback(async () => {
    if (!itemNo) {
      return;
    }
    setLoading(true);
    try {
      const [itemUoms, globalUoms] = await Promise.all([
        fetchItemUnitsOfMeasure(itemNo),
        fetchUnitsOfMeasure(),
      ]);
      setRows(itemUoms);
      setUnitOptions(globalUoms);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load units',
        text2: parseApiError(error),
      });
    } finally {
      setLoading(false);
    }
  }, [itemNo]);

  useEffect(() => {
    if (visible && itemNo) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setShowNewCodeForm(false);
      setNewCode('');
      setNewDescription('');
      setUnitCodePickerVisible(false);
      loadData();
    }
  }, [visible, itemNo, loadData]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleEdit = (row: ItemUnitOfMeasure) => {
    setEditingId(row.id);
    setForm({
      unit_of_measure: row.unit_of_measure,
      quantity_per_unit: String(row.quantity_per_unit ?? 1),
      default: row.default,
    });
  };

  const handleSave = async () => {
    if (!canEdit || !itemNo) {
      return;
    }
    if (!form.unit_of_measure) {
      Toast.show({type: 'error', text1: 'Select a unit of measure'});
      return;
    }
    const qty = Number(form.quantity_per_unit);
    if (!Number.isFinite(qty) || qty <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid quantity',
        text2: 'Quantity per unit must be greater than 0.',
      });
      return;
    }
    if (form.default && qty !== 1) {
      Toast.show({
        type: 'error',
        text1: 'Default unit',
        text2: 'The default unit must have quantity per unit of 1.',
      });
      return;
    }

    const payload = {
      item: itemNo,
      unit_of_measure: form.unit_of_measure,
      quantity_per_unit: qty,
      default: form.default,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateItemUnitOfMeasure(editingId, payload);
        Toast.show({type: 'success', text1: 'Unit updated'});
      } else {
        await createItemUnitOfMeasure(payload);
        Toast.show({type: 'success', text1: 'Unit added'});
      }
      resetForm();
      await loadData();
      onChanged?.();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: parseApiError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: ItemUnitOfMeasure) => {
    if (!canEdit) {
      return;
    }
    Alert.alert(
      'Delete unit',
      `Remove ${row.unit_of_measure} from this item?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteItemUnitOfMeasure(row.id);
              Toast.show({type: 'success', text1: 'Unit deleted'});
              if (editingId === row.id) {
                resetForm();
              }
              await loadData();
              onChanged?.();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Delete failed',
                text2: parseApiError(error),
              });
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleCreateCode = async () => {
    const code = newCode.trim().toUpperCase();
    const description = newDescription.trim() || code;
    if (!code) {
      Toast.show({type: 'error', text1: 'Enter a unit code'});
      return;
    }
    setCreatingCode(true);
    try {
      await createUnitOfMeasure({code, description});
      Toast.show({type: 'success', text1: 'Unit code created'});
      setShowNewCodeForm(false);
      setNewCode('');
      setNewDescription('');
      const globalUoms = await fetchUnitsOfMeasure();
      setUnitOptions(globalUoms);
      setForm(prev => ({...prev, unit_of_measure: code}));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not create code',
        text2: parseApiError(error),
      });
    } finally {
      setCreatingCode(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={[styles.root, theme.root, {paddingTop: insets.top}]}>
        <View style={styles.header}>
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
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, theme.headerTitle]} numberOfLines={1}>
              Units of measure
            </Text>
            {itemName ? (
              <Text style={[styles.headerSubtitle, theme.subtitle]} numberOfLines={1}>
                {itemName}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {rows.length === 0 ? (
              <Text style={[styles.emptyText, theme.empty]}>
                No units yet. Add one below (e.g. PCS with quantity 1 as default).
              </Text>
            ) : (
              rows.map(row => (
                <View key={row.id} style={[styles.rowCard, theme.card]}>
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, theme.rowTitle]}>
                      {row.unit_of_measure}
                      {row.unit_of_measure_description
                        ? ` — ${row.unit_of_measure_description}`
                        : ''}
                    </Text>
                    <Text style={[styles.rowMeta, theme.rowMeta]}>
                      Qty per unit: {row.quantity_per_unit}
                    </Text>
                  </View>
                  {row.default ? (
                    <View style={[styles.defaultBadge, theme.badge]}>
                      <Text style={[styles.defaultBadgeText, theme.badgeText]}>Default</Text>
                    </View>
                  ) : null}
                  {canEdit ? (
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        onPress={() => handleEdit(row)}
                        style={styles.rowActionBtn}
                        activeOpacity={0.7}>
                        <Text style={styles.rowActionEdit}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(row)}
                        style={styles.rowActionBtn}
                        activeOpacity={0.7}
                        disabled={saving}>
                        <Text style={styles.rowActionDelete}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))
            )}

            {canEdit ? (
              <View style={[styles.formCard, theme.card]}>
                <Text style={[styles.formHeading, theme.rowTitle]}>
                  {editingId ? 'Edit unit' : 'Add unit'}
                </Text>

                <Text style={[styles.fieldLabel, theme.label]}>Unit code</Text>
                <TouchableOpacity
                  style={[styles.selectRow, theme.selectRow]}
                  onPress={() => setUnitCodePickerVisible(true)}
                  activeOpacity={0.7}
                  disabled={saving || unitOptions.length === 0}>
                  <Text
                    style={[
                      styles.selectRowText,
                      theme.selectRowText,
                      !selectedUnitLabel && [
                        styles.selectRowPlaceholder,
                        theme.selectRowPlaceholder,
                      ],
                    ]}
                    numberOfLines={1}>
                    {selectedUnitLabel ||
                      (unitOptions.length === 0
                        ? 'No units — create a code below'
                        : 'Search and select unit code…')}
                  </Text>
                  <Image
                    source={icons.down_arrow}
                    style={[styles.selectRowChevron, theme.selectRowChevron]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowNewCodeForm(v => !v)}
                  activeOpacity={0.7}
                  style={styles.newCodeToggle}>
                  <Text style={styles.newCodeToggleText}>
                    {showNewCodeForm ? 'Hide new code form' : '+ Create new unit code'}
                  </Text>
                </TouchableOpacity>

                {showNewCodeForm ? (
                  <View style={styles.newCodeBlock}>
                    <Text style={[styles.fieldLabel, theme.label]}>Code</Text>
                    <TextInput
                      style={[styles.input, theme.input]}
                      value={newCode}
                      onChangeText={setNewCode}
                      placeholder="e.g. BOX"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="characters"
                    />
                    <Text style={[styles.fieldLabel, theme.label]}>Description</Text>
                    <TextInput
                      style={[styles.input, theme.input]}
                      value={newDescription}
                      onChangeText={setNewDescription}
                      placeholder="Optional description"
                      placeholderTextColor={colors.placeholder}
                    />
                    <TouchableOpacity
                      style={styles.createCodeBtn}
                      onPress={handleCreateCode}
                      disabled={creatingCode}
                      activeOpacity={0.8}>
                      {creatingCode ? (
                        <ActivityIndicator color={COLORS.white} size="small" />
                      ) : (
                        <Text style={styles.createCodeBtnText}>Create code</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                <Text style={[styles.fieldLabel, theme.label]}>Quantity per unit</Text>
                <TextInput
                  style={[styles.input, theme.input]}
                  value={form.quantity_per_unit}
                  onChangeText={text =>
                    setForm(prev => ({...prev, quantity_per_unit: text}))
                  }
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.placeholder}
                />

                <View style={styles.defaultRow}>
                  <Text style={[styles.defaultLabel, theme.rowTitle]}>Default unit</Text>
                  <Switch
                    value={form.default}
                    onValueChange={val =>
                      setForm(prev => ({...prev, default: val}))
                    }
                    trackColor={{false: colors.border, true: COLORS.primary2}}
                    thumbColor={COLORS.white}
                  />
                </View>

                <View style={styles.formActions}>
                  {editingId ? (
                    <TouchableOpacity
                      onPress={resetForm}
                      style={styles.cancelBtn}
                      activeOpacity={0.7}
                      disabled={saving}>
                      <Text style={styles.cancelBtnText}>Cancel edit</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={handleSave}
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    activeOpacity={0.8}
                    disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {editingId ? 'Update' : 'Add unit'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      <SearchableSelectModal
        visible={unitCodePickerVisible}
        title="Select unit code"
        options={unitCodeSelectOptions}
        selectedId={form.unit_of_measure || null}
        searchPlaceholder="Search unit codes…"
        onClose={() => setUnitCodePickerVisible(false)}
        onSelect={id => {
          if (typeof id === 'string' && id) {
            setForm(prev => ({...prev, unit_of_measure: id}));
          }
          setUnitCodePickerVisible(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.black,
  },
  headerSubtitle: {
    ...FONTS.body4,
    marginTop: 2,
  },
  headerSpacer: {
    width: 48,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  emptyText: {
    ...FONTS.body4,
    marginBottom: 16,
    lineHeight: 20,
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  rowMeta: {
    ...FONTS.body4,
    marginTop: 4,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  defaultBadgeText: {
    ...FONTS.body5,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 16,
  },
  rowActionBtn: {
    paddingVertical: 4,
  },
  rowActionEdit: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  rowActionDelete: {
    ...FONTS.body4,
    color: COLORS.red,
    fontWeight: '600',
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  formHeading: {
    ...FONTS.h4,
    marginBottom: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    ...FONTS.body5,
    marginBottom: 6,
    marginTop: 8,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48,
  },
  selectRowText: {
    flex: 1,
    ...FONTS.body4,
    paddingRight: 8,
  },
  selectRowPlaceholder: {
    ...FONTS.body4,
  },
  selectRowChevron: {
    width: 14,
    height: 14,
    transform: [{rotate: '-90deg'}],
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    ...FONTS.body4,
  },
  newCodeToggle: {
    marginTop: 10,
  },
  newCodeToggleText: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  newCodeBlock: {
    marginTop: 4,
  },
  createCodeBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createCodeBtnText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  defaultLabel: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: COLORS.primary2,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default ItemUnitOfMeasureModal;
