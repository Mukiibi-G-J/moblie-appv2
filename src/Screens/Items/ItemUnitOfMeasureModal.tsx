import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import UnitOfMeasureFormModal from './UnitOfMeasureFormModal';
import {
  createItemUnitOfMeasure,
  deleteItemUnitOfMeasure,
  deleteUnitOfMeasure,
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

function catalogLabel(unit?: {code?: string; description?: string} | null) {
  if (!unit?.code) {
    return 'Unit';
  }
  const description = unit.description?.trim();
  if (description && description !== unit.code) {
    return `${unit.code} — ${description}`;
  }
  return unit.code;
}

function assignmentLabel(row: ItemUnitOfMeasure) {
  return catalogLabel({
    code: row.unit_of_measure,
    description: row.unit_of_measure_description,
  });
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
  embedded?: boolean;
  onClose: () => void;
  itemNo: string;
  itemName?: string;
  canEdit: boolean;
  onChanged?: (defaultCode?: string) => void;
}

const ItemUnitOfMeasureModal: React.FC<ItemUnitOfMeasureModalProps> = ({
  visible,
  embedded = false,
  onClose,
  itemNo,
  canEdit,
  onChanged,
}) => {
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<ItemUnitOfMeasure[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOfMeasure[]>([]);
  const [pendingDefault, setPendingDefault] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [codePickerOpen, setCodePickerOpen] = useState(false);
  const [pickerCode, setPickerCode] = useState<string | null>(null);
  const [codeSearch, setCodeSearch] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogUnit, setCatalogUnit] = useState<UnitOfMeasure | null>(null);

  const rowsRef = useRef(rows);
  const formRef = useRef(form);
  const recordIdRef = useRef(recordId);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const pendingDirty = useRef(false);
  const lastSavedRef = useRef('');
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  rowsRef.current = rows;
  formRef.current = form;
  recordIdRef.current = recordId;

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = saveQueueRef.current.then(task, task);
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const theme = useMemo(
    () => ({
      root: {backgroundColor: colors.background},
      header: {
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      },
      title: {color: colors.textPrimary},
      closeCircle: {backgroundColor: colors.backButtonBg},
      closeIcon: {tintColor: colors.textPrimary},
      rowTitle: {color: colors.textPrimary},
      rowMeta: {color: colors.textSecondary},
      hint: {color: colors.textSecondary},
      createLabel: {color: colors.textPrimary},
      plus: {tintColor: colors.textPrimary},
      divider: {borderBottomColor: colors.border},
      input: {
        color: colors.textPrimary,
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      searchWrap: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      searchInput: {
        color: colors.textPrimary,
      },
      sectionTitle: {color: colors.textPrimary},
      parentText: {color: colors.textPrimary},
      placeholder: {color: colors.textSecondary},
      saved: {color: colors.textSecondary},
    }),
    [colors],
  );

  const loadData = useCallback(
    async (silent = false) => {
      if (!itemNo) {
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      try {
        const [itemUoms, globalUoms] = await Promise.all([
          fetchItemUnitsOfMeasure(itemNo),
          fetchUnitsOfMeasure(),
        ]);
        setRows(itemUoms);
        setUnitOptions(globalUoms);
        onChangedRef.current?.(
          itemUoms.find(row => row.default)?.unit_of_measure,
        );
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Failed to load units',
          text2: parseApiError(error),
        });
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [itemNo],
  );

  useEffect(() => {
    if (!visible || !itemNo) {
      return;
    }
    setFormOpen(false);
    setCodePickerOpen(false);
    setRecordId(null);
    setForm(EMPTY_FORM);
    pendingDirty.current = false;
    lastSavedRef.current = '';
    void loadData();
  }, [visible, itemNo, loadData]);

  useEffect(() => {
    if (pendingDirty.current) {
      return;
    }
    const current = rows.find(row => row.default);
    setPendingDefault(current?.unit_of_measure ?? null);
  }, [rows]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const markSaved = () => {
    setShowSaved(true);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
  };

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.default !== b.default) {
          return a.default ? -1 : 1;
        }
        return a.unit_of_measure.localeCompare(b.unit_of_measure);
      }),
    [rows],
  );

  const filteredUnits = useMemo(() => {
    const query = codeSearch.trim().toLowerCase();
    const list = [...unitOptions].sort((a, b) => a.code.localeCompare(b.code));
    if (!query) {
      return list;
    }
    return list.filter(
      unit =>
        unit.code.toLowerCase().includes(query) ||
        (unit.description || '').toLowerCase().includes(query),
    );
  }, [unitOptions, codeSearch]);

  const selectedUnitLabel = useMemo(() => {
    if (!form.unit_of_measure) {
      return '';
    }
    const match = unitOptions.find(unit => unit.code === form.unit_of_measure);
    return match ? catalogLabel(match) : form.unit_of_measure;
  }, [form.unit_of_measure, unitOptions]);

  const openCreate = () => {
    setRecordId(null);
    setForm(EMPTY_FORM);
    lastSavedRef.current = '';
    setCodePickerOpen(false);
    setFormOpen(true);
  };

  const openEdit = (row: ItemUnitOfMeasure) => {
    const next: FormState = {
      unit_of_measure: row.unit_of_measure,
      quantity_per_unit: String(row.quantity_per_unit ?? 1),
      default: row.default,
    };
    setRecordId(row.id);
    setForm(next);
    lastSavedRef.current = `${row.unit_of_measure}|${Number(row.quantity_per_unit) || 1}|${row.default}`;
    setCodePickerOpen(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    setCodePickerOpen(false);
    setCodeSearch('');
    setFormOpen(false);
    pendingDirty.current = false;
    void loadData(true);
  };

  const persist = useCallback(
    async (next: FormState, id: number | null): Promise<boolean> => {
      if (!canEdit || !itemNo || !next.unit_of_measure) {
        return true;
      }
      const qty = Number(next.quantity_per_unit);
      if (!Number.isFinite(qty) || qty <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid quantity',
          text2: 'Quantity per unit must be greater than 0.',
        });
        return false;
      }
      if (next.default && qty !== 1) {
        Toast.show({
          type: 'error',
          text1: 'Default unit',
          text2: 'The default unit must have quantity per unit of 1.',
        });
        return false;
      }
      const duplicate = rowsRef.current.find(
        row => row.unit_of_measure === next.unit_of_measure && row.id !== id,
      );
      if (duplicate) {
        Toast.show({
          type: 'error',
          text1: 'Unit already added',
          text2: `${next.unit_of_measure} is already on this item.`,
        });
        return false;
      }

      const snapshot = `${next.unit_of_measure}|${qty}|${next.default}`;
      if (id && lastSavedRef.current === snapshot) {
        return true;
      }

      const payload = {
        item: itemNo,
        unit_of_measure: next.unit_of_measure,
        quantity_per_unit: qty,
        default: next.default,
      };

      setSaving(true);
      try {
        if (id) {
          await updateItemUnitOfMeasure(id, payload);
        } else {
          const response = await createItemUnitOfMeasure(payload);
          const createdId = Number(response?.data?.id) || null;
          let resolvedId = createdId;
          if (!resolvedId) {
            const fresh = await fetchItemUnitsOfMeasure(itemNo);
            resolvedId =
              fresh.find(row => row.unit_of_measure === next.unit_of_measure)?.id ??
              null;
          }
          if (!resolvedId) {
            throw new Error('Could not save unit');
          }
          setRecordId(resolvedId);
          recordIdRef.current = resolvedId;
        }
        lastSavedRef.current = snapshot;
        markSaved();
        pendingDirty.current = false;
        await loadData(true);
        onChanged?.();
        return true;
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Save failed',
          text2: parseApiError(error),
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [canEdit, itemNo, loadData, onChanged],
  );

  const handleSaveUnit = useCallback(async () => {
    Keyboard.dismiss();
    const ok = await enqueue(() =>
      persist(formRef.current, recordIdRef.current),
    );
    if (ok && formRef.current.unit_of_measure) {
      markSaved();
    }
  }, [enqueue, persist]);

  const handleCloseForm = useCallback(async () => {
    Keyboard.dismiss();
    if (!formRef.current.unit_of_measure && !recordIdRef.current) {
      closeForm();
      return;
    }
    const ok = await enqueue(() =>
      persist(formRef.current, recordIdRef.current),
    );
    if (!ok) {
      return;
    }
    closeForm();
  }, [enqueue, persist]);

  const handleDelete = (row: ItemUnitOfMeasure) => {
    if (!canEdit) {
      return;
    }
    Alert.alert('Delete unit', `Remove ${assignmentLabel(row)} from this item?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deleteItemUnitOfMeasure(row.id);
              if (pendingDefault === row.unit_of_measure) {
                pendingDirty.current = false;
              }
              Toast.show({type: 'success', text1: 'Unit deleted'});
              await loadData(true);
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
          })();
        },
      },
    ]);
  };

  const applyDefault = async () => {
    if (!canEdit) {
      onClose();
      return;
    }
    const selected = rows.find(row => row.unit_of_measure === pendingDefault);
    if (!selected || selected.default) {
      onClose();
      return;
    }
    if (Number(selected.quantity_per_unit) !== 1) {
      Toast.show({
        type: 'error',
        text1: 'Default unit',
        text2: 'The default unit must have quantity per unit of 1. Edit it first.',
      });
      return;
    }
    setApplying(true);
    try {
      await updateItemUnitOfMeasure(selected.id, {
        item: itemNo,
        unit_of_measure: selected.unit_of_measure,
        quantity_per_unit: Number(selected.quantity_per_unit) || 1,
        default: true,
      });
      onChanged?.(selected.unit_of_measure);
      onClose();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not set default',
        text2: parseApiError(error),
      });
    } finally {
      setApplying(false);
    }
  };

  const openCodePicker = () => {
    setPickerCode(form.unit_of_measure || null);
    setCodeSearch('');
    setCodePickerOpen(true);
  };

  const applyPickedCode = () => {
    const code = pickerCode;
    setCodePickerOpen(false);
    setCodeSearch('');
    if (!code) {
      return;
    }
    const next = {...formRef.current, unit_of_measure: code};
    setForm(next);
    void enqueue(() => persist(next, recordIdRef.current));
  };

  const refreshCatalog = async (selectCode?: string) => {
    const globalUoms = await fetchUnitsOfMeasure();
    setUnitOptions(globalUoms);
    if (selectCode) {
      setPickerCode(selectCode);
    }
  };

  const handleDeleteCatalogUnit = (unit: UnitOfMeasure) => {
    Alert.alert(
      'Delete unit',
      `Delete "${catalogLabel(unit)}"? Items using it keep their current unit until you choose another.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteUnitOfMeasure(unit.code);
                if (pickerCode === unit.code) {
                  setPickerCode(null);
                }
                Toast.show({type: 'success', text1: 'Unit deleted'});
                await refreshCatalog();
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Could not delete unit',
                  text2: parseApiError(error),
                });
              }
            })();
          },
        },
      ],
    );
  };

  const list = loading ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={COLORS.primary2} />
    </View>
  ) : (
    <FlatList
      style={styles.list}
      data={sortedRows}
      keyExtractor={row => String(row.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.listContent,
        {paddingBottom: Math.max(insets.bottom, 20) + 24},
        sortedRows.length === 0 ? styles.listEmptyGrow : null,
      ]}
      ListHeaderComponent={
        <View>
          {canEdit ? (
            <TouchableOpacity
              style={styles.createRow}
              onPress={openCreate}
              activeOpacity={0.65}>
              <Image
                source={icons.plus as any}
                style={[styles.createPlus, theme.plus]}
                resizeMode="contain"
              />
              <Text style={[styles.createLabel, theme.createLabel]}>Create unit</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.hint, theme.hint]}>
            {canEdit
              ? 'Checked unit is the default. Tap Done to save it.'
              : 'The checked unit is the default.'}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.hint, theme.hint]}>
          {canEdit
            ? 'No units yet. Tap Create unit to add one.'
            : 'No units yet.'}
        </Text>
      }
      renderItem={({item: row}) => {
        const checked = pendingDefault === row.unit_of_measure;
        return (
          <View style={[styles.pickerRow, theme.divider]}>
            <TouchableOpacity
              style={styles.pickerRowMain}
              onPress={() => {
                if (!canEdit) {
                  return;
                }
                pendingDirty.current = true;
                setPendingDefault(row.unit_of_measure);
              }}
              activeOpacity={0.7}
              disabled={!canEdit}>
              <Image
                source={
                  checked ? (icons.check_on as any) : (icons.check_off as any)
                }
                style={styles.check}
                resizeMode="contain"
              />
              <View style={styles.pickerTextCol}>
                <Text
                  style={[styles.pickerTitle, theme.rowTitle]}
                  numberOfLines={1}>
                  {assignmentLabel(row)}
                </Text>
                <Text style={[styles.pickerMeta, theme.rowMeta]}>
                  Qty per unit: {row.quantity_per_unit}
                </Text>
              </View>
            </TouchableOpacity>
            {canEdit ? (
              <TouchableOpacity
                onPress={() => openEdit(row)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                activeOpacity={0.7}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            {canEdit ? (
              <TouchableOpacity
                onPress={() => handleDelete(row)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                activeOpacity={0.7}
                disabled={saving}>
                <Text style={styles.deleteLink}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      }}
    />
  );

  const screen = (
    <View style={[styles.root, theme.root]}>
      <View
        style={[
          styles.header,
          theme.header,
          {paddingTop: Math.max(insets.top, 12)},
        ]}>
        <View style={styles.headerSide}>
          <QuickIconPressable
            onPress={onClose}
            style={[styles.closeCircle, theme.closeCircle]}
            accessibilityLabel="Close units">
            <Image
              source={icons.cross as any}
              style={[styles.closeIcon, theme.closeIcon]}
              resizeMode="contain"
            />
          </QuickIconPressable>
        </View>
        <Text style={[styles.headerTitle, theme.title]}>Units of measure</Text>
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <TouchableOpacity
            style={[styles.donePill, applying && styles.donePillDisabled]}
            onPress={() => void applyDefault()}
            disabled={applying}
            activeOpacity={0.7}>
            {applying ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {list}
    </View>
  );

  return (
    <>
      {embedded ? (
        screen
      ) : (
        <Modal
          visible={visible}
          animationType="slide"
          transparent={false}
          onRequestClose={onClose}>
          {screen}
        </Modal>
      )}

      <Modal
        visible={formOpen && visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (codePickerOpen) {
            setCodePickerOpen(false);
            setCodeSearch('');
            return;
          }
          closeForm();
        }}>
        <KeyboardAvoidingView
          style={[styles.root, theme.root]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {codePickerOpen ? (
            <>
              <View
                style={[
                  styles.header,
                  theme.header,
                  {paddingTop: Math.max(insets.top, 12)},
                ]}>
                <View style={styles.headerSide}>
                  <QuickIconPressable
                    onPress={() => {
                      setCodePickerOpen(false);
                      setCodeSearch('');
                    }}
                    style={[styles.closeCircle, theme.closeCircle]}
                    accessibilityLabel="Close unit codes">
                    <Image
                      source={icons.cross as any}
                      style={[styles.closeIcon, theme.closeIcon]}
                      resizeMode="contain"
                    />
                  </QuickIconPressable>
                </View>
                <Text style={[styles.headerTitle, theme.title]}>Unit code</Text>
                <View style={[styles.headerSide, styles.headerSideEnd]}>
                  <TouchableOpacity
                    style={styles.donePill}
                    onPress={applyPickedCode}
                    activeOpacity={0.7}>
                    <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <FlatList
                style={styles.list}
                data={filteredUnits}
                keyExtractor={unit => unit.code}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.listContent,
                  {paddingBottom: Math.max(insets.bottom, 20) + 24},
                  filteredUnits.length === 0 ? styles.listEmptyGrow : null,
                ]}
                ListHeaderComponent={
                  <View>
                    {canEdit ? (
                      <TouchableOpacity
                        style={styles.createRow}
                        onPress={() => {
                          setCatalogUnit(null);
                          setCatalogOpen(true);
                        }}
                        activeOpacity={0.65}>
                        <Image
                          source={icons.plus as any}
                          style={[styles.createPlus, theme.plus]}
                          resizeMode="contain"
                        />
                        <Text style={[styles.createLabel, theme.createLabel]}>
                          Create unit
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={[styles.searchWrap, theme.searchWrap]}>
                      <TextInput
                        style={[styles.searchInput, theme.searchInput]}
                        value={codeSearch}
                        onChangeText={setCodeSearch}
                        placeholder="Search unit codes"
                        placeholderTextColor={colors.placeholder}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                }
                ListEmptyComponent={
                  <Text style={[styles.hint, theme.hint]}>
                    {unitOptions.length === 0
                      ? 'No units yet. Tap Create unit to add one.'
                      : 'No units match your search.'}
                  </Text>
                }
                renderItem={({item: unit}) => {
                  const checked = pickerCode === unit.code;
                  return (
                    <View style={[styles.pickerRow, theme.divider]}>
                      <TouchableOpacity
                        style={styles.pickerRowMain}
                        onPress={() =>
                          setPickerCode(prev =>
                            prev === unit.code ? null : unit.code,
                          )
                        }
                        activeOpacity={0.7}>
                        <Image
                          source={
                            checked
                              ? (icons.check_on as any)
                              : (icons.check_off as any)
                          }
                          style={styles.check}
                          resizeMode="contain"
                        />
                        <Text
                          style={[styles.pickerTitle, theme.rowTitle]}
                          numberOfLines={1}>
                          {catalogLabel(unit)}
                        </Text>
                      </TouchableOpacity>
                      {canEdit ? (
                        <TouchableOpacity
                          onPress={() => {
                            setCatalogUnit(unit);
                            setCatalogOpen(true);
                          }}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                          activeOpacity={0.7}>
                          <Text style={styles.editLink}>Edit</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canEdit ? (
                        <TouchableOpacity
                          onPress={() => handleDeleteCatalogUnit(unit)}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                          activeOpacity={0.7}>
                          <Text style={styles.deleteLink}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                }}
              />
            </>
          ) : (
            <>
              <View style={[styles.formHeader, {paddingTop: Math.max(insets.top, 12)}]}>
                <QuickIconPressable
                  onPress={() => void handleCloseForm()}
                  style={styles.formClose}
                  accessibilityLabel="Close">
                  <Image
                    source={icons.cross as any}
                    style={[styles.formCloseIcon, theme.closeIcon]}
                    resizeMode="contain"
                  />
                </QuickIconPressable>
                {canEdit ? (
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      showSaved && !saving ? styles.saveButtonSaved : null,
                    ]}
                    onPress={() => void handleSaveUnit()}
                    disabled={saving}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      saving ? 'Saving' : showSaved ? 'Saved' : 'Save'
                    }>
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Saving' : showSaved ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.formHeaderSpacer} />
                )}
              </View>
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled">
                <Text style={[styles.pageTitle, theme.title]}>
                  {recordId ? 'Edit unit' : 'Create unit'}
                </Text>
                <Text style={[styles.hint, theme.hint, styles.formHint]}>
                  Tap Save to keep your changes. Leaving a field also saves.
                </Text>

                <Text style={[styles.sectionTitle, theme.sectionTitle]}>Unit code</Text>
                <TouchableOpacity
                  style={[styles.parentRow, theme.divider]}
                  onPress={openCodePicker}
                  activeOpacity={0.7}
                  disabled={!canEdit}>
                  <Text
                    style={[
                      styles.parentText,
                      selectedUnitLabel ? theme.parentText : theme.placeholder,
                    ]}
                    numberOfLines={1}>
                    {selectedUnitLabel || 'None selected'}
                  </Text>
                  <Text style={styles.parentChevron}>›</Text>
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, theme.sectionTitle, styles.sectionSpaced]}>
                  Quantity per unit
                </Text>
                <TextInput
                  style={[styles.input, theme.input]}
                  value={form.quantity_per_unit}
                  onChangeText={text => {
                    const next = {...formRef.current, quantity_per_unit: text};
                    formRef.current = next;
                    setForm(next);
                  }}
                  onBlur={() => {
                    void enqueue(() =>
                      persist(formRef.current, recordIdRef.current),
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.placeholder}
                  editable={canEdit}
                />
                <Text style={[styles.fieldHelp, theme.hint]}>
                  How many base units are in this unit. A box of 12 uses 12.
                </Text>

                <View style={styles.defaultRow}>
                  <View style={styles.defaultCopy}>
                    <Text style={[styles.sectionTitle, theme.sectionTitle, styles.defaultTitle]}>
                      Default unit
                    </Text>
                    <Text style={[styles.fieldHelp, theme.hint]}>
                      The default unit must have a quantity of 1.
                    </Text>
                  </View>
                  <Switch
                    value={form.default}
                    onValueChange={value => {
                      if (value && Number(form.quantity_per_unit) !== 1) {
                        Toast.show({
                          type: 'error',
                          text1: 'Default unit',
                          text2: 'The default unit must have quantity per unit of 1.',
                        });
                        return;
                      }
                      const next = {...formRef.current, default: value};
                      setForm(next);
                      void enqueue(() => persist(next, recordIdRef.current));
                    }}
                    disabled={!canEdit}
                    trackColor={{false: colors.border, true: COLORS.primary2}}
                    thumbColor={COLORS.white}
                  />
                </View>
              </ScrollView>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <UnitOfMeasureFormModal
        visible={catalogOpen && formOpen && visible}
        onClose={() => {
          setCatalogOpen(false);
          setCatalogUnit(null);
        }}
        unit={catalogUnit}
        onSave={saved => {
          const code = saved?.code;
          void refreshCatalog(code).catch(() => undefined);
        }}
        canCreate={canEdit}
        canEdit={canEdit}
      />
    </>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSideEnd: {
    justifyContent: 'flex-end',
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 18,
    height: 18,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  donePill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    minWidth: 72,
    alignItems: 'center',
  },
  donePillDisabled: {
    opacity: 0.7,
  },
  doneText: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.white,
    fontSize: 15,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 1.25,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 4,
  },
  createPlus: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  createLabel: {
    ...FONTS.body3,
    fontSize: 16,
  },
  hint: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minWidth: 0,
  },
  check: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  pickerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pickerTitle: {
    ...FONTS.body3,
    fontSize: 16,
  },
  pickerMeta: {
    ...FONTS.body4,
    fontSize: 13,
    marginTop: 2,
  },
  editLink: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.primary2,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  deleteLink: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.error,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...FONTS.body4,
    fontSize: 16,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  formClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCloseIcon: {
    width: 20,
    height: 20,
  },
  formHeaderSpacer: {
    width: 88,
  },
  saveButton: {
    minWidth: 72,
    height: 36,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  saveButtonSaved: {
    backgroundColor: COLORS.success,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  savedText: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 88,
    textAlign: 'right',
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 4,
  },
  formHint: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSpaced: {
    marginTop: 26,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  parentText: {
    flex: 1,
    fontSize: 17,
  },
  parentChevron: {
    fontSize: 28,
    lineHeight: 28,
    color: COLORS.primary2,
    marginLeft: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    minHeight: 58,
  },
  fieldHelp: {
    ...FONTS.body5,
    marginTop: 8,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    gap: 12,
  },
  defaultCopy: {
    flex: 1,
  },
  defaultTitle: {
    marginBottom: 0,
  },
});

export default ItemUnitOfMeasureModal;
