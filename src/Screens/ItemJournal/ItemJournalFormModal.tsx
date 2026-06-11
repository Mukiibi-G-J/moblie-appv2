import React, {useState, useEffect, useCallback} from 'react';
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
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, icons} from '../../constants';
import {QuickIconPressable} from '../../Components';
import {fetchItems, upsertItemJournal} from '../../services/app.services';
import type {
  ItemJournalAdjustmentType,
  ItemJournalEntryType,
  ItemJournalUpsertPayload,
} from '../../@types/types.dto';
import type {ItemJournalLine} from './ItemJournalListItem';

const ENTRY_OPTIONS: {value: ItemJournalEntryType; label: string}[] = [
  {value: 'PositiveAdjustment', label: 'Increase'},
  {value: 'NegativeAdjustment', label: 'Decrease'},
];

type ItemUomOption = {
  id: number;
  unit_of_measure: string;
  quantity_per_unit: number;
  default: boolean;
};

type ItemSearchHit = {
  no?: string;
  item_name: string;
  unit_cost: number;
  item_units_of_measure: ItemUomOption[];
};

function resolveItemUnitCost(raw: {
  unit_cost?: unknown;
  unit_price?: unknown;
}): number {
  const cost = Number(raw.unit_cost);
  if (Number.isFinite(cost) && cost >= 0) {
    return cost;
  }
  const price = Number(raw.unit_price);
  if (Number.isFinite(price) && price >= 0) {
    return price;
  }
  return 0;
}

function formatUnitCostForInput(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0';
  }
  return String(Math.round(value));
}

function mapRawItemUoms(raw: unknown): ItemUomOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (u): u is Record<string, unknown> =>
        !!u && typeof u === 'object' && typeof (u as {id?: unknown}).id === 'number',
    )
    .map(u => ({
      id: u.id as number,
      unit_of_measure: String(u.unit_of_measure ?? ''),
      quantity_per_unit: Number(u.quantity_per_unit ?? 1),
      default: !!u.default,
    }));
}

function pickDefaultItemUomId(uoms: ItemUomOption[]): number | null {
  if (!uoms.length) {
    return null;
  }
  const def = uoms.find(u => u.default);
  return (def ?? uoms[0]).id;
}

function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

interface ItemJournalFormModalProps {
  visible: boolean;
  onClose: () => void;
  line: ItemJournalLine | null;
  onSave: () => void;
  userId: number;
  canCreate: boolean;
  canEdit: boolean;
  lockedAdjustmentType: ItemJournalAdjustmentType;
  addFormTitle?: string;
  editFormTitle?: string;
}

const ItemJournalFormModal: React.FC<ItemJournalFormModalProps> = ({
  visible,
  onClose,
  line,
  onSave,
  userId,
  canCreate,
  canEdit,
  lockedAdjustmentType,
  addFormTitle = 'Add adjustment',
  editFormTitle = 'Edit adjustment',
}) => {
  const isEditMode = !!line;

  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<ItemSearchHit[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [availableItemUoms, setAvailableItemUoms] = useState<ItemUomOption[]>([]);
  const [selectedItemUomId, setSelectedItemUomId] = useState<number | null>(null);
  const [uomLabelFallback, setUomLabelFallback] = useState('');
  const [entryType, setEntryType] = useState<ItemJournalEntryType>('PositiveAdjustment');
  const [quantityStr, setQuantityStr] = useState('1');
  const [unitCostStr, setUnitCostStr] = useState('0');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(todayISODate());

  const resetForm = useCallback(() => {
    setItemSearch('');
    setItemResults([]);
    setSelectedItemNo('');
    setSelectedItemName('');
    setAvailableItemUoms([]);
    setSelectedItemUomId(null);
    setUomLabelFallback('');
    setEntryType('PositiveAdjustment');
    setQuantityStr('1');
    setUnitCostStr('0');
    setDescription('');
    setDateStr(todayISODate());
  }, []);

  const loadUomsForItemNo = useCallback(
    async (itemNo: string, preferredUomId: number | null) => {
      try {
        const data = await fetchItems(1, itemNo.trim());
        const match = data?.results?.find((x: {no?: string}) => x.no === itemNo);
        const uoms = mapRawItemUoms(match?.item_units_of_measure);
        setAvailableItemUoms(uoms);
        if (preferredUomId != null && uoms.some(u => u.id === preferredUomId)) {
          setSelectedItemUomId(preferredUomId);
        } else {
          setSelectedItemUomId(pickDefaultItemUomId(uoms));
        }
      } catch {
        setAvailableItemUoms([]);
      }
    },
    [],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (line) {
      setSelectedItemNo(line.item);
      setSelectedItemName(line.item_name);
      setEntryType((line.entry_type as ItemJournalEntryType) || 'PositiveAdjustment');
      setQuantityStr(String(line.quantity ?? ''));
      setUnitCostStr(
        line.unit_cost != null && !Number.isNaN(line.unit_cost)
          ? String(line.unit_cost)
          : '0',
      );
      setDescription(line.description || '');
      setDateStr(line.date || todayISODate());
      const preferredUom = line.item_unit_of_measure ?? null;
      setSelectedItemUomId(preferredUom);
      setUomLabelFallback(line.unit_of_measure_code || '');
      setItemSearch('');
      setItemResults([]);
      void loadUomsForItemNo(line.item, preferredUom);
    } else {
      resetForm();
    }
  }, [line, visible, loadUomsForItemNo, resetForm]);

  useEffect(() => {
    if (!visible || isEditMode) {
      return;
    }
    if (itemSearch.trim().length < 2) {
      setItemResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setItemsLoading(true);
        const data = await fetchItems(1, itemSearch.trim());
        if (!cancelled && data?.results) {
          setItemResults(
            data.results.map((it: {
              no?: string;
              item_name: string;
              unit_cost?: unknown;
              unit_price?: unknown;
              item_units_of_measure?: unknown;
            }) => ({
              no: it.no,
              item_name: it.item_name,
              unit_cost: resolveItemUnitCost(it),
              item_units_of_measure: mapRawItemUoms(it.item_units_of_measure),
            })),
          );
        }
      } catch {
        if (!cancelled) {
          setItemResults([]);
        }
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [itemSearch, visible, isEditMode]);

  const handleSave = async () => {
    if (!userId) {
      Toast.show({type: 'error', text1: 'Missing user', text2: 'Please sign in again.'});
      return;
    }

    if (isEditMode && !canEdit) {
      Alert.alert('Permission denied', 'You do not have permission to edit journal lines.');
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert('Permission denied', 'You do not have permission to create lines.');
      return;
    }

    const qty = parseInt(quantityStr.replace(/,/g, ''), 10);
    const unitCost = parseFloat(unitCostStr.replace(/,/g, '')) || 0;
    if (!Number.isFinite(qty) || qty < 0) {
      Toast.show({type: 'error', text1: 'Invalid quantity'});
      return;
    }
    if (!isEditMode && !selectedItemNo.trim()) {
      Toast.show({type: 'error', text1: 'Select an item'});
      return;
    }
    if (
      selectedItemUomId == null ||
      typeof selectedItemUomId !== 'number' ||
      !Number.isFinite(selectedItemUomId)
    ) {
      Toast.show({
        type: 'error',
        text1: 'Unit of measure required',
        text2: 'Pick an item that has at least one unit of measure.',
      });
      return;
    }

    const base: ItemJournalUpsertPayload = {
      item: isEditMode && line ? line.item : selectedItemNo.trim(),
      entry_type: entryType,
      quantity: qty,
      unit_cost: unitCost,
      description: description.trim(),
      date: dateStr.trim() || undefined,
      user: userId,
      item_unit_of_measure: selectedItemUomId,
      adjustment_type: lockedAdjustmentType,
    };

    if (isEditMode && line) {
      base.id = line.id;
    }

    try {
      setSaving(true);
      await upsertItemJournal(base);
      Toast.show({type: 'success', text1: 'Saved'});
      onSave();
    } catch (e: unknown) {
      const ax = e as {response?: {data?: {detail?: unknown}}; message?: string};
      const d = ax?.response?.data;
      const msg =
        typeof d?.detail === 'string'
          ? d.detail
          : d?.detail && typeof d.detail === 'object'
            ? JSON.stringify(d.detail)
            : ax?.message || 'Save failed';
      Toast.show({type: 'error', text1: 'Save failed', text2: msg});
    } finally {
      setSaving(false);
    }
  };

  const previewName = (selectedItemName || 'Select an item').trim();
  const previewInitials =
    previewName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'IT';
  const entryLabel =
    ENTRY_OPTIONS.find(o => o.value === entryType)?.label || entryType;
  const selectedUomLabel =
    availableItemUoms.find(u => u.id === selectedItemUomId)?.unit_of_measure ||
    uomLabelFallback ||
    'Unit of measure';

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
              style={[styles.headerSaveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}>
              {saving ? (
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>
            {isEditMode ? 'Edit adjustment' : 'Add adjustment'}
          </Text>

          <View style={styles.previewSection}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitials}>{previewInitials}</Text>
            </View>
            <View style={styles.previewMeta}>
              <Text style={styles.previewName} numberOfLines={1} ellipsizeMode="tail">
                {previewName}
              </Text>
              <Text style={styles.previewSubtext} numberOfLines={1}>
                {isEditMode && line?.document_no
                  ? `${line.document_no} · ${entryLabel}`
                  : entryLabel}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item</Text>

            {isEditMode ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Item name</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={selectedItemName}
                    editable={false}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Item number</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={selectedItemNo}
                    editable={false}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Find item</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Type at least 2 characters"
                    placeholderTextColor={COLORS.gray2}
                    value={itemSearch}
                    onChangeText={t => {
                      setItemSearch(t);
                      if (!t.trim()) {
                        setSelectedItemNo('');
                        setSelectedItemName('');
                        setAvailableItemUoms([]);
                        setSelectedItemUomId(null);
                        setUomLabelFallback('');
                        setUnitCostStr('0');
                      }
                    }}
                  />
                </View>
                {itemsLoading ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator size="small" color={COLORS.primary2} />
                    <Text style={styles.inlineLoadingText}>Searching items...</Text>
                  </View>
                ) : null}
                {itemResults.length > 0 ? (
                  <View style={styles.pickList}>
                    {itemResults.map(it => (
                      <TouchableOpacity
                        key={it.no || it.item_name}
                        style={styles.pickRow}
                        onPress={() => {
                          setSelectedItemNo(it.no || '');
                          setSelectedItemName(it.item_name);
                          setItemSearch(it.item_name);
                          setItemResults([]);
                          setAvailableItemUoms(it.item_units_of_measure);
                          setSelectedItemUomId(
                            pickDefaultItemUomId(it.item_units_of_measure),
                          );
                          setUomLabelFallback('');
                          setUnitCostStr(formatUnitCostForInput(it.unit_cost));
                        }}
                        activeOpacity={0.8}>
                        <Text style={styles.pickRowTitle}>{it.item_name}</Text>
                        {it.no ? (
                          <Text style={styles.pickRowSub}>{it.no}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            )}

            {(selectedItemNo || isEditMode) && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Unit of measure</Text>
                {availableItemUoms.length > 1 ? (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedItemUomId ?? availableItemUoms[0]?.id}
                      onValueChange={v => setSelectedItemUomId(Number(v))}
                      style={styles.picker}>
                      {availableItemUoms.map(u => (
                        <Picker.Item
                          key={u.id}
                          label={`${u.unit_of_measure || 'UOM'} (×${u.quantity_per_unit})`}
                          value={u.id}
                        />
                      ))}
                    </Picker>
                  </View>
                ) : availableItemUoms.length === 1 ? (
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={availableItemUoms[0].unit_of_measure}
                    editable={false}
                  />
                ) : selectedItemUomId != null ? (
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={selectedUomLabel}
                    editable={false}
                  />
                ) : (
                  <Text style={styles.helperText}>
                    No units loaded for this item. Check item setup in the web app.
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adjustment</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Entry type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={entryType}
                  onValueChange={v => setEntryType(v as ItemJournalEntryType)}
                  style={styles.picker}>
                  {ENTRY_OPTIONS.map(opt => (
                    <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={quantityStr}
                onChangeText={setQuantityStr}
                placeholder="0"
                placeholderTextColor={COLORS.gray2}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.gray2}
              />
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost & notes</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Unit cost</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={unitCostStr}
                onChangeText={setUnitCostStr}
                placeholder="0"
                placeholderTextColor={COLORS.gray2}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional notes"
                placeholderTextColor={COLORS.gray2}
              />
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
  helperText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    lineHeight: 20,
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
  pickList: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  pickRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  pickRowTitle: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 2,
  },
  pickRowSub: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineLoadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ItemJournalFormModal;
