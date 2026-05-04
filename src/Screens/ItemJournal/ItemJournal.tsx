import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Image,
  RefreshControl,
  Platform,
  InteractionManager,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {useNavigation} from '@react-navigation/native';
import {safeGoBack} from '../../hooks/NavigationService';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Clipboard from '@react-native-clipboard/clipboard';
import {QuickIconPressable} from '../../Components';
import {
  fetchItemJournal,
  fetchItems,
  upsertItemJournal,
  postItemJournalLines,
} from '../../services/app.services';
import {
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/Store';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import type {ItemJournalEntryType, ItemJournalUpsertPayload} from '../../@types/types.dto';
import ItemJournalListItem, {type ItemJournalLine} from './ItemJournalListItem';

const PAGE_NAME = PAGE_NAMES.ITEM_JOURNAL;

const ENTRY_OPTIONS: {value: ItemJournalEntryType; label: string}[] = [
  {value: 'PositiveAdjustment', label: 'Positive adjustment'},
  {value: 'NegativeAdjustment', label: 'Negative adjustment'},
  {value: 'Purchase', label: 'Purchase'},
  {value: 'Sales', label: 'Sales'},
  {value: 'DirectCost', label: 'Direct cost'},
];

type StatusFilter = 'open' | 'all' | 'posted';

type ItemUomOption = {
  id: number;
  unit_of_measure: string;
  quantity_per_unit: number;
  default: boolean;
};

type ItemSearchHit = {
  no?: string;
  item_name: string;
  item_units_of_measure: ItemUomOption[];
};

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

function normalizeLine(raw: Record<string, unknown>): ItemJournalLine | null {
  const id = raw.id;
  if (typeof id !== 'number') {
    return null;
  }
  const item = raw.item;
  const itemStr =
    typeof item === 'string' ? item : typeof item === 'number' ? String(item) : '';

  const rawUom = raw.item_unit_of_measure;
  let item_unit_of_measure: number | null = null;
  if (typeof rawUom === 'number' && Number.isFinite(rawUom)) {
    item_unit_of_measure = rawUom;
  } else if (
    rawUom &&
    typeof rawUom === 'object' &&
    typeof (rawUom as {id?: unknown}).id === 'number'
  ) {
    item_unit_of_measure = (rawUom as {id: number}).id;
  }

  let unit_of_measure_code = '';
  const detail = raw.unit_of_measure_detail;
  if (detail && typeof detail === 'object') {
    const code = (detail as {unit_of_measure?: unknown}).unit_of_measure;
    if (code != null) {
      unit_of_measure_code = String(code);
    }
  }

  return {
    id,
    system_id: String(raw.system_id ?? ''),
    item: itemStr,
    item_name: String(raw.item_name ?? ''),
    entry_type: String(raw.entry_type ?? ''),
    document_no: String(raw.document_no ?? ''),
    description: String(raw.description ?? ''),
    quantity: Number(raw.quantity ?? 0),
    unit_cost:
      raw.unit_cost === null || raw.unit_cost === undefined
        ? null
        : Number(raw.unit_cost),
    date: String(raw.date ?? ''),
    status: String(raw.status ?? ''),
    item_unit_of_measure,
    unit_of_measure_code,
  };
}

function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Normalize Axios errors, interceptor-rejected `detail`, and post payloads for UI. */
function formatItemJournalPostFailure(e: unknown): string {
  if (typeof e === 'string') {
    return e;
  }

  const ax = e as {
    response?: {data?: Record<string, unknown>};
    message?: string;
  };

  let data = ax?.response?.data;
  if (
    !data &&
    e &&
    typeof e === 'object' &&
    !('response' in (e as object)) &&
    ('invalid_journals' in (e as object) || 'error' in (e as object))
  ) {
    data = e as Record<string, unknown>;
  }

  if (data && typeof data === 'object') {
    const parts: string[] = [];

    if (typeof data.error === 'string' && data.error.trim()) {
      parts.push(data.error.trim());
    }

    const invalid = data.invalid_journals;
    if (Array.isArray(invalid) && invalid.length > 0) {
      const first = invalid[0] as {
        document_no?: string;
        errors?: unknown[];
      };
      if (first?.document_no) {
        parts.push(`Document: ${first.document_no}`);
      }
      const errs = first?.errors;
      if (Array.isArray(errs) && errs.length > 0) {
        errs.forEach(err => {
          if (typeof err === 'string' && err.trim()) {
            parts.push(err.trim());
          } else if (err != null) {
            try {
              parts.push(JSON.stringify(err));
            } catch {
              parts.push(String(err));
            }
          }
        });
      } else if (!parts.length) {
        parts.push('Validation failed; no detailed messages were returned.');
      }
    }

    if (parts.length > 0) {
      return parts.join('\n');
    }

    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail.trim();
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map(String).join('\n');
    }
    if (data.detail != null && typeof data.detail === 'object') {
      try {
        return JSON.stringify(data.detail);
      } catch {
        return 'Post failed.';
      }
    }
  }

  const msg = ax?.message;
  return typeof msg === 'string' && msg.trim()
    ? msg.trim()
    : 'Post failed. Please try again.';
}

function showPostErrorAlert(message: string) {
  InteractionManager.runAfterInteractions(() => {
    Alert.alert(
      'Could not post',
      message,
      [
        {
          text: 'Copy error',
          onPress: () => {
            try {
              Clipboard.setString(message);
              Toast.show({type: 'success', text1: 'Error copied to clipboard'});
            } catch {
              Toast.show({type: 'error', text1: 'Could not copy'});
            }
          },
        },
        {text: 'OK', style: 'cancel'},
      ],
      {cancelable: true},
    );
  });
}

const ItemJournalScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {auth} = useAuth();
  const {canRead, canCreate, canEdit} = usePermissions();

  const userId = useMemo(() => {
    const n = parseInt(auth.user_id || '', 10);
    return Number.isFinite(n) ? n : 0;
  }, [auth.user_id]);

  if (!canRead(PAGE_NAME)) {
    return (
      <SafeAreaView
        style={[styles.flex, {backgroundColor: colors.background}]}
        edges={['left', 'right', 'bottom']}>
        <View style={styles.deniedWrap}>
          <Text style={[styles.deniedTitle, {color: colors.textPrimary}]}>
            Access denied
          </Text>
          <Text style={[styles.deniedBody, {color: colors.textSecondary}]}>
            You do not have permission to view item journal.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const [journals, setJournals] = useState<ItemJournalLine[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingLine, setEditingLine] = useState<ItemJournalLine | null>(null);
  const [saving, setSaving] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<ItemSearchHit[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [availableItemUoms, setAvailableItemUoms] = useState<ItemUomOption[]>([]);
  const [selectedItemUomId, setSelectedItemUomId] = useState<number | null>(null);
  const [uomLabelFallback, setUomLabelFallback] = useState('');

  const [entryType, setEntryType] = useState<ItemJournalEntryType>(
    'PositiveAdjustment',
  );
  const [quantityStr, setQuantityStr] = useState('1');
  const [unitCostStr, setUnitCostStr] = useState('0');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(todayISODate());

  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 450);
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery]);

  const statusParam = useMemo(() => {
    if (statusFilter === 'open') {
      return 'Open';
    }
    if (statusFilter === 'posted') {
      return 'Posted';
    }
    return undefined;
  }, [statusFilter]);

  const loadJournals = useCallback(
    async (pageOverride?: number) => {
      const p = pageOverride ?? page;
      try {
        setLoading(true);
        const extra = statusParam ? {status: statusParam} : undefined;
        const response = await fetchItemJournal(p, debouncedSearch, extra);
        const rawList = response.results || [];
        const parsed = rawList
          .map(r => normalizeLine(r as Record<string, unknown>))
          .filter(Boolean) as ItemJournalLine[];

        if (p === 1) {
          setJournals(parsed);
        } else {
          setJournals(prev => [...prev, ...parsed]);
        }
        setHasMore(!!response.next);
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        const invalidPage =
          detail === 'Invalid page.' || e?.response?.data?.error === 'Invalid page.';
        if (invalidPage && p > 1) {
          setPage(1);
          setHasMore(false);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Failed to load journal',
            text2: typeof detail === 'string' ? detail : 'Please try again.',
          });
          if (p === 1) {
            setJournals([]);
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch, statusParam],
  );

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    if (page === 1) {
      loadJournals(1);
    } else {
      setPage(1);
    }
  }, [page, loadJournals]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(p => p + 1);
    }
  };

  const resetForm = () => {
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
    setEditingLine(null);
  };

  const loadUomsForItemNo = useCallback(
    async (itemNo: string, preferredUomId: number | null) => {
      try {
        const data = await fetchItems(1, itemNo.trim());
        const match = data?.results?.find((x: any) => x.no === itemNo);
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

  const openCreate = () => {
    if (!canCreate(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to create lines.');
      return;
    }
    resetForm();
    setFormMode('create');
    setFormVisible(true);
  };

  const openEdit = (line: ItemJournalLine) => {
    if (!canEdit(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to edit journal lines.');
      return;
    }
    if (line.status !== 'Open') {
      Alert.alert('Cannot edit', 'Only Open lines can be edited.');
      return;
    }
    resetForm();
    setFormMode('edit');
    setEditingLine(line);
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
    void loadUomsForItemNo(line.item, preferredUom);
    setFormVisible(true);
  };

  useEffect(() => {
    if (!formVisible || formMode !== 'create') {
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
            data.results.map((it: any) => ({
              no: it.no,
              item_name: it.item_name,
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
  }, [itemSearch, formVisible, formMode]);

  const submitForm = async () => {
    if (!userId) {
      Toast.show({type: 'error', text1: 'Missing user', text2: 'Please sign in again.'});
      return;
    }
    const qty = parseInt(quantityStr.replace(/,/g, ''), 10);
    const unitCost = parseFloat(unitCostStr.replace(/,/g, '')) || 0;
    if (!Number.isFinite(qty) || qty < 0) {
      Toast.show({type: 'error', text1: 'Invalid quantity'});
      return;
    }
    if (formMode === 'create' && !selectedItemNo.trim()) {
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
      item: formMode === 'edit' && editingLine ? editingLine.item : selectedItemNo.trim(),
      entry_type: entryType,
      quantity: qty,
      unit_cost: unitCost,
      description: description.trim(),
      date: dateStr.trim() || undefined,
      user: userId,
      item_unit_of_measure: selectedItemUomId,
    };

    if (formMode === 'edit' && editingLine) {
      base.id = editingLine.id;
    }

    try {
      setSaving(true);
      await upsertItemJournal(base);
      Toast.show({type: 'success', text1: 'Saved'});
      setFormVisible(false);
      resetForm();
      setPage(1);
      loadJournals(1);
    } catch (e: any) {
      const d = e?.response?.data;
      const msg =
        typeof d?.detail === 'string'
          ? d.detail
          : d?.detail && typeof d.detail === 'object'
            ? JSON.stringify(d.detail)
            : e?.message || 'Save failed';
      Toast.show({type: 'error', text1: 'Save failed', text2: msg});
    } finally {
      setSaving(false);
    }
  };

  const confirmPost = (line: ItemJournalLine) => {
    if (!canEdit(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to post.');
      return;
    }
    if (line.status !== 'Open') {
      return;
    }
    Alert.alert(
      'Post journal line',
      `Post ${line.document_no} to inventory? This cannot be undone from the app.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Post',
          onPress: async () => {
            try {
              await postItemJournalLines([line.id]);
              Toast.show({type: 'success', text1: 'Posted'});
              setPage(1);
              loadJournals(1);
            } catch (e: unknown) {
              showPostErrorAlert(formatItemJournalPostFailure(e));
            }
          },
        },
      ],
    );
  };

  const renderStatusChip = (id: StatusFilter, label: string) => (
    <TouchableOpacity
      key={id}
      style={[
        styles.chip,
        {borderColor: colors.border},
        statusFilter === id && {backgroundColor: colors.screenMuted},
      ]}
      onPress={() => {
        setStatusFilter(id);
        setPage(1);
      }}>
      <Text
        style={[
          styles.chipText,
          {color: statusFilter === id ? colors.textPrimary : colors.textSecondary},
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const canOpenLine = canEdit(PAGE_NAME);

  return (
    <SafeAreaView
      style={[styles.flex, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={{paddingTop: Math.max(insets.top, 8)}}>
        <View style={styles.headerRow}>
          <QuickIconPressable
            style={[styles.headerBtn, {backgroundColor: colors.backButtonBg}]}
            onPress={() => safeGoBack(navigation, 'Home')}
            hitSlop={ICON_BUTTON_HIT_SLOP}
            accessibilityLabel="Go back">
            <Image
              source={icons.back as any}
              style={[styles.headerIcon, {tintColor: colors.textPrimary}]}
            />
          </QuickIconPressable>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            Stock adjustments
          </Text>
          {canCreate(PAGE_NAME) ? (
            <TouchableOpacity
              style={[styles.headerBtn, {backgroundColor: colors.backButtonBg}]}
              onPress={openCreate}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="New adjustment">
              <Image
                source={icons.plus as any}
                style={[styles.headerIcon, {tintColor: colors.textPrimary}]}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>

        <View style={styles.chipRow}>
          {renderStatusChip('open', 'Open')}
          {renderStatusChip('all', 'All')}
          {renderStatusChip('posted', 'Posted')}
        </View>

        <View style={[styles.searchPill, {backgroundColor: colors.inputBackground, borderColor: colors.border}]}>
          <Image
            source={icons.search as any}
            style={[styles.searchIcon, {tintColor: colors.iconMuted}]}
          />
          <TextInput
            style={[styles.searchInput, {color: colors.textPrimary}]}
            placeholder="Search by document, item, description"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading && page === 1 && journals.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.textSecondary} />
        </View>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={item => item.system_id || String(item.id)}
          renderItem={({item}) => (
            <ItemJournalListItem
              line={item}
              colors={colors}
              onPress={() => openEdit(item)}
              onPost={() => confirmPost(item)}
              canOpenLine={canOpenLine}
              canPost={canEdit(PAGE_NAME)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loading && page > 1 ? (
              <ActivityIndicator style={{marginVertical: 16}} color={colors.textSecondary} />
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <Text style={[styles.empty, {color: colors.textSecondary}]}>
                No journal lines match your filters.
              </Text>
            ) : null
          }
        />
      )}

      <Modal visible={formVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor: colors.surface}]}>
            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              {formMode === 'create' ? 'New line' : 'Edit line'}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {formMode === 'create' ? (
                <>
                  <Text style={[styles.label, {color: colors.textSecondary}]}>
                    Find item
                  </Text>
                  <TextInput
                    style={[
                      styles.field,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.inputBackground,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Type at least 2 characters"
                    placeholderTextColor={colors.placeholder}
                    value={itemSearch}
                    onChangeText={t => {
                      setItemSearch(t);
                      if (!t.trim()) {
                        setSelectedItemNo('');
                        setSelectedItemName('');
                        setAvailableItemUoms([]);
                        setSelectedItemUomId(null);
                        setUomLabelFallback('');
                      }
                    }}
                  />
                  {itemsLoading ? (
                    <ActivityIndicator color={colors.textSecondary} />
                  ) : null}
                  {itemResults.length > 0 ? (
                    <View style={[styles.pickList, {borderColor: colors.border}]}>
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
                            setSelectedItemUomId(pickDefaultItemUomId(it.item_units_of_measure));
                            setUomLabelFallback('');
                          }}>
                          <Text style={{color: colors.textPrimary}}>{it.item_name}</Text>
                          {it.no ? (
                            <Text style={{color: colors.textSecondary, fontSize: 12}}>
                              {it.no}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  {selectedItemNo ? (
                    <Text style={[styles.selectedHint, {color: colors.textSecondary}]}>
                      Selected: {selectedItemName} ({selectedItemNo})
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[styles.label, {color: colors.textSecondary}]}>Item</Text>
                  <Text style={[styles.staticText, {color: colors.textPrimary}]}>
                    {selectedItemName}
                  </Text>
                  <Text style={[styles.staticSub, {color: colors.textSecondary}]}>
                    {selectedItemNo}
                  </Text>
                </>
              )}

              {selectedItemNo || formMode === 'edit' ? (
                <>
                  <Text style={[styles.label, {color: colors.textSecondary}]}>
                    Unit of measure
                  </Text>
                  {availableItemUoms.length > 1 ? (
                    <View
                      style={[
                        styles.pickerWrap,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.inputBackground,
                        },
                      ]}>
                      <Picker
                        selectedValue={selectedItemUomId ?? availableItemUoms[0]?.id}
                        onValueChange={v => setSelectedItemUomId(Number(v))}
                        dropdownIconColor={colors.textPrimary}
                        style={Platform.OS === 'ios' ? styles.pickerIOS : undefined}>
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
                    <Text style={[styles.staticText, {color: colors.textPrimary}]}>
                      {availableItemUoms[0].unit_of_measure}
                    </Text>
                  ) : selectedItemUomId != null ? (
                    <Text style={[styles.staticText, {color: colors.textPrimary}]}>
                      {uomLabelFallback || `UOM #${selectedItemUomId}`}
                    </Text>
                  ) : (
                    <Text style={[styles.staticSub, {color: colors.textSecondary}]}>
                      No units loaded for this item. Check item setup in the web app.
                    </Text>
                  )}
                </>
              ) : null}

              <Text style={[styles.label, {color: colors.textSecondary}]}>Entry type</Text>
              <View
                style={[
                  styles.pickerWrap,
                  {borderColor: colors.border, backgroundColor: colors.inputBackground},
                ]}>
                <Picker
                  selectedValue={entryType}
                  onValueChange={v => setEntryType(v as ItemJournalEntryType)}
                  dropdownIconColor={colors.textPrimary}
                  style={Platform.OS === 'ios' ? styles.pickerIOS : undefined}>
                  {ENTRY_OPTIONS.map(opt => (
                    <Picker.Item
                      key={opt.value}
                      label={opt.label}
                      value={opt.value}
                    />
                  ))}
                </Picker>
              </View>

              <Text style={[styles.label, {color: colors.textSecondary}]}>Quantity</Text>
              <TextInput
                style={[
                  styles.field,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                  },
                ]}
                keyboardType="number-pad"
                value={quantityStr}
                onChangeText={setQuantityStr}
              />

              <Text style={[styles.label, {color: colors.textSecondary}]}>Unit cost</Text>
              <TextInput
                style={[
                  styles.field,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                  },
                ]}
                keyboardType="decimal-pad"
                value={unitCostStr}
                onChangeText={setUnitCostStr}
              />

              <Text style={[styles.label, {color: colors.textSecondary}]}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[
                  styles.field,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                  },
                ]}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="2026-04-01"
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.label, {color: colors.textSecondary}]}>Description</Text>
              <TextInput
                style={[
                  styles.field,
                  styles.multiline,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                  },
                ]}
                multiline
                value={description}
                onChangeText={setDescription}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost, {borderColor: colors.border}]}
                onPress={() => {
                  setFormVisible(false);
                  resetForm();
                }}
                disabled={saving}>
                <Text style={{color: colors.textPrimary}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, {backgroundColor: colors.borderStrong}]}
                onPress={submitForm}
                disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={[styles.btnPrimaryText, {color: colors.background}]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ItemJournalScreen;

const styles = StyleSheet.create({
  flex: {flex: 1},
  deniedWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  deniedTitle: {
    ...FONTS.h2,
    textAlign: 'center',
    marginBottom: 8,
  },
  deniedBody: {
    ...FONTS.body3,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {width: 22, height: 22, resizeMode: 'contain'},
  headerTitle: {
    ...FONTS.h2,
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.padding,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    ...FONTS.body4,
    fontWeight: '600',
    fontSize: 13,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZES.padding,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {width: 18, height: 18, marginRight: 8, resizeMode: 'contain'},
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    ...FONTS.body3,
    paddingHorizontal: SIZES.padding,
  },
  centered: {flex: 1, justifyContent: 'center'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    padding: SIZES.padding,
    paddingBottom: 24,
  },
  modalTitle: {
    ...FONTS.h2,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    ...FONTS.body4,
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '600',
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...FONTS.body3,
  },
  multiline: {minHeight: 72, textAlignVertical: 'top'},
  staticText: {...FONTS.body3, fontWeight: '600'},
  staticSub: {...FONTS.body4, marginBottom: 4},
  pickList: {
    maxHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginBottom: 8,
  },
  pickRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000018',
  },
  selectedHint: {...FONTS.body4, marginBottom: 8},
  pickerWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pickerIOS: {height: 160},
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  btnPrimaryText: {...FONTS.h3, fontWeight: '700'},
});
