import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  FlatList,
  Keyboard,
} from 'react-native';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import {COLORS, FONTS, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {QuickIconPressable, SearchableSelectModal} from '../../Components';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '../../context/Store';
import {fetchItemCardDetail, fetchItemJournalDetail, fetchItemUnitsOfMeasure, postItemJournalLines, upsertItemJournal} from '../../services/app.services';
import {
  listItems,
} from '../../services/itemCatalogService';
import type {
  ItemJournalAdjustmentType,
  ItemJournalEntryType,
  ItemJournalUpsertPayload,
} from '../../@types/types.dto';
import type {ItemJournalLine} from './ItemJournalListItem';
import {normalizeLine} from './itemJournalUtils';
import {parseSaleQuantity} from '../../utils/saleQuantity';

const ENTRY_OPTIONS: {value: ItemJournalEntryType; label: string}[] = [
  {value: 'PositiveAdjustment', label: 'Increase'},
  {value: 'NegativeAdjustment', label: 'Decrease'},
];

const STOCK_INCREASE_REASONS = [
  {id: '101', label: 'Imported'},
  {id: '102', label: 'Bought locally'},
  {id: '103', label: 'Manufactured'},
  {id: '104', label: 'Opening stock'},
];

const STOCK_DECREASE_REASONS = [
  {id: '101', label: 'Expired'},
  {id: '102', label: 'Damaged'},
  {id: '103', label: 'Personal use'},
  {id: '104', label: 'Other'},
  {id: '105', label: 'Used as raw material'},
];

function efrisReasonCode(value: string | undefined): string {
  return String(value ?? '').split('|')[0].trim();
}

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
  bar_code_no?: string;
  inventory?: number;
  type?: string;
  item_images?: {url?: string}[];
  item_units_of_measure: ItemUomOption[];
};

function isStockItem(type?: string): boolean {
  const t = String(type || 'Inventory');
  return t !== 'Service' && t !== 'Non-Inventory';
}

function resolveItemUnitCost(raw: {
  unit_cost?: unknown;
}): number {
  const cost = Number(raw.unit_cost);
  if (Number.isFinite(cost) && cost >= 0) {
    return cost;
  }
  return 0;
}

function formatUnitCostForInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatUnitCostCommaInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) {
    return '';
  }
  const parts = cleaned.split('.');
  const intRaw = parts[0] ?? '';
  const hasDot = parts.length > 1;
  const decRaw = hasDot ? parts.slice(1).join('').slice(0, 2) : '';
  const intNum = intRaw === '' ? 0 : parseInt(intRaw, 10);
  if (!Number.isFinite(intNum)) {
    return '';
  }
  const grouped = intNum.toLocaleString('en-US');
  if (hasDot) {
    return `${grouped}.${decRaw}`;
  }
  return grouped;
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

function itemInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'IT'
  );
}

function formatISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODateLocal(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return new Date();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function todayISODate(): string {
  return formatISODateLocal(new Date());
}

function mapCatalogHit(it: Record<string, unknown>): ItemSearchHit {
  return {
    no: typeof it.no === 'string' ? it.no : it.no != null ? String(it.no) : undefined,
    item_name: String(it.item_name ?? ''),
    unit_cost: resolveItemUnitCost(it),
    bar_code_no: it.bar_code_no != null ? String(it.bar_code_no) : undefined,
    inventory: Number(it.inventory ?? 0),
    type: it.type != null ? String(it.type) : undefined,
    item_images: Array.isArray(it.item_images)
      ? (it.item_images as {url?: string}[])
      : [],
    item_units_of_measure: mapRawItemUoms(it.item_units_of_measure),
  };
}

type PersistLineResult = 'saved' | 'skipped' | 'failed';

interface ItemJournalFormModalProps {
  visible: boolean;
  onClose: () => void;
  line: ItemJournalLine | null;
  onSaved: (saved?: ItemJournalLine) => void;
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
  onSaved,
  userId,
  canCreate,
  canEdit,
  lockedAdjustmentType,
  addFormTitle = 'Add adjustment',
  editFormTitle = 'Edit adjustment',
}) => {
  const {colors} = useTheme();
  const {auth} = useAuth();
  const efrisEnabled = (auth?.enabled_modules || []).includes('efris');
  const topInset = useScreenTopInset();
  const bottomInset = useSafeAreaInsets().bottom;

  const themed = useMemo(
    () => ({
      pageRoot: {backgroundColor: colors.background},
      pageTitle: {color: colors.textPrimary},
      previewSection: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      previewName: {color: colors.textPrimary},
      previewSubtext: {color: colors.textSecondary},
      sectionTitle: {color: colors.textPrimary},
      sectionDivider: {backgroundColor: colors.border},
      label: {color: colors.textSecondary},
      input: {
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      disabledInput: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      helperText: {color: colors.textSecondary},
      pickerContainer: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      picker: {
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      selectRow: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      selectRowDisabled: {backgroundColor: colors.screenMuted},
      selectRowText: {color: colors.textPrimary},
      selectRowPlaceholder: {color: colors.textSecondary},
      selectRowChevron: {color: colors.textSecondary},
      pickList: {borderColor: colors.border},
      pickRow: {borderBottomColor: colors.border},
      pickRowTitle: {color: colors.textPrimary},
      pickRowSub: {color: colors.textSecondary},
      inlineLoadingText: {color: colors.textSecondary},
      headerIconButton: {backgroundColor: colors.backButtonBg},
      headerIcon: {tintColor: colors.textPrimary},
      savePillText: {color: colors.textSecondary},
      autoSaveHint: {color: colors.textSecondary},
      searchIcon: {tintColor: colors.iconMuted},
      searchBackIcon: {tintColor: colors.textPrimary},
      searchWrap: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
      },
      searchResultName: {color: colors.textPrimary},
      searchResultSub: {color: colors.textSecondary},
      searchResultRow: {borderBottomColor: colors.border},
      stateText: {color: colors.textSecondary},
    }),
    [colors],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [persistedId, setPersistedId] = useState<number | null>(null);
  const [documentNo, setDocumentNo] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<ItemSearchHit[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isSearchPanelVisible, setIsSearchPanelVisible] = useState(false);
  const [selectedItemNo, setSelectedItemNo] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [availableItemUoms, setAvailableItemUoms] = useState<ItemUomOption[]>([]);
  const [selectedItemUomId, setSelectedItemUomId] = useState<number | null>(null);
  const [uomLabelFallback, setUomLabelFallback] = useState('');
  const [entryType, setEntryType] = useState<ItemJournalEntryType>('PositiveAdjustment');
  const [efrisStockInType, setEfrisStockInType] = useState('');
  const [efrisAdjustType, setEfrisAdjustType] = useState('');
  const [efrisReasonPickerVisible, setEfrisReasonPickerVisible] = useState(false);
  const [quantityStr, setQuantityStr] = useState('1');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(todayISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uomPickerVisible, setUomPickerVisible] = useState(false);
  const [entryTypePickerVisible, setEntryTypePickerVisible] = useState(false);

  const savingRef = useRef(false);
  const persistInFlightRef = useRef<Promise<PersistLineResult> | null>(null);
  const closeInFlightRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  const persistedIdRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  const hydrateRequestIdRef = useRef(0);
  const pendingUnitCostRef = useRef<number | null>(null);
  const formRef = useRef({
    selectedItemNo: '',
    selectedItemUomId: null as number | null,
    entryType: 'PositiveAdjustment' as ItemJournalEntryType,
    efrisStockInType: '',
    efrisAdjustType: '',
    quantityStr: '1',
    unitCostStr: '',
    description: '',
    dateStr: todayISODate(),
  });

  persistedIdRef.current = persistedId;
  // While close is flushing the focused field, a render must not put the
  // previous state back over the text the user just typed.
  if (!closeInFlightRef.current) {
    formRef.current = {
      selectedItemNo,
      selectedItemUomId,
      entryType,
      efrisStockInType,
      efrisAdjustType,
      quantityStr,
      unitCostStr,
      description,
      dateStr,
    };
  }

  const isPersisted = persistedId != null;
  const canWrite = isPersisted ? canEdit : canCreate;

  const resetForm = useCallback(() => {
    setPersistedId(null);
    persistedIdRef.current = null;
    lastSavedRef.current = '';
    pendingUnitCostRef.current = null;
    setDocumentNo('');
    setItemSearch('');
    setItemResults([]);
    setIsSearchPanelVisible(false);
    setSearchPage(1);
    setHasNextPage(false);
    setSelectedItemNo('');
    setSelectedItemName('');
    setAvailableItemUoms([]);
    setSelectedItemUomId(null);
    setUomLabelFallback('');
    setEntryType('PositiveAdjustment');
    setEfrisStockInType(lockedAdjustmentType === 'opening_balance' ? '104' : '');
    setEfrisAdjustType('');
    setEfrisReasonPickerVisible(false);
    setQuantityStr('1');
    setUnitCostStr('');
    setDescription('');
    setDateStr(todayISODate());
    setShowDatePicker(false);
    setUomPickerVisible(false);
    setEntryTypePickerVisible(false);
  }, [lockedAdjustmentType]);

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

  const loadUomsForItemNo = useCallback(
    async (itemNo: string, preferredUomId: number | null) => {
      try {
        const rows = await fetchItemUnitsOfMeasure(itemNo.trim());
        const uoms: ItemUomOption[] = (rows || []).map(u => ({
          id: u.id,
          unit_of_measure: u.unit_of_measure,
          quantity_per_unit: Number(u.quantity_per_unit ?? 1),
          default: !!u.default,
        }));
        setAvailableItemUoms(uoms);
        if (preferredUomId != null && uoms.some(u => u.id === preferredUomId)) {
          setSelectedItemUomId(preferredUomId);
          return preferredUomId;
        }
        const next = pickDefaultItemUomId(uoms);
        setSelectedItemUomId(next);
        return next;
      } catch {
        setAvailableItemUoms([]);
        return null;
      }
    },
    [],
  );

  const persistLine = useCallback(
    (
      overrides: Partial<{
        item: string;
        entry_type: ItemJournalEntryType;
        quantity: number;
        unit_cost: number;
        description: string;
        date: string;
        item_unit_of_measure: number | null;
        efris_stock_in_type: string;
        efris_adjust_type: string;
      }> = {},
    ): Promise<PersistLineResult> => {
      const previous = persistInFlightRef.current;
      const next = (async (): Promise<PersistLineResult> => {
        if (previous) {
          try {
            await previous;
          } catch {
            // The earlier save already reported its own result.
          }
        }
        if (!visible || !userId) {
          return 'skipped';
        }
        const current = formRef.current;
        const itemNo = (overrides.item ?? current.selectedItemNo).trim();
        const uomId =
          overrides.item_unit_of_measure !== undefined
            ? overrides.item_unit_of_measure
            : current.selectedItemUomId;
        const nextEntryType = overrides.entry_type ?? current.entryType;
        const qty =
          overrides.quantity !== undefined
            ? overrides.quantity
            : parseSaleQuantity(current.quantityStr) ?? 0;
        const unitCost =
          overrides.unit_cost !== undefined
            ? overrides.unit_cost
            : parseFloat(current.unitCostStr.replace(/,/g, '')) || 0;
        const nextDescription =
          overrides.description !== undefined
            ? overrides.description
            : current.description.trim();
        const nextDate =
          overrides.date !== undefined
            ? overrides.date
            : current.dateStr.trim() || todayISODate();
        const nextStockIn =
          overrides.efris_stock_in_type !== undefined
            ? overrides.efris_stock_in_type
            : current.efrisStockInType;
        const nextAdjust =
          overrides.efris_adjust_type !== undefined
            ? overrides.efris_adjust_type
            : current.efrisAdjustType;

        const existingId = persistedIdRef.current;
        if (existingId != null ? !canEdit : !canCreate) {
          return 'skipped';
        }
        if (!itemNo && existingId == null) {
          return 'skipped';
        }
        if (!Number.isFinite(qty) || qty <= 0) {
          return 'skipped';
        }
        if (
          existingId == null &&
          (uomId == null || typeof uomId !== 'number' || !Number.isFinite(uomId))
        ) {
          return 'skipped';
        }

        const snapshot = JSON.stringify({
          item: itemNo,
          entry_type: nextEntryType,
          quantity: qty,
          unit_cost: unitCost,
          description: nextDescription,
          date: nextDate,
          item_unit_of_measure: uomId,
          efris_stock_in_type: efrisEnabled ? nextStockIn : '',
          efris_adjust_type: efrisEnabled ? nextAdjust : '',
        });
        if (snapshot === lastSavedRef.current) {
          return 'skipped';
        }

        const payload: ItemJournalUpsertPayload = {
          entry_type: nextEntryType,
          quantity: qty,
          unit_cost: unitCost,
          unit_amount: unitCost,
          description: nextDescription,
          date: nextDate,
          user: userId,
          adjustment_type: lockedAdjustmentType,
          ...(efrisEnabled
            ? {
                efris_stock_in_type:
                  nextEntryType === 'PositiveAdjustment' ? nextStockIn : '',
                efris_adjust_type:
                  nextEntryType === 'NegativeAdjustment' ? nextAdjust : '',
              }
            : {}),
        };
        if (itemNo) {
          payload.item = itemNo;
        }
        if (uomId != null && typeof uomId === 'number' && Number.isFinite(uomId)) {
          payload.item_unit_of_measure = uomId;
        }
        if (existingId != null) {
          payload.id = existingId;
        }

        savingRef.current = true;
        setIsSaving(true);
        try {
          const response = await upsertItemJournal(payload);
          const saved = normalizeLine(
            (response?.data ?? {}) as Record<string, unknown>,
          );
          if (!saved) {
            Toast.show({
              type: 'error',
              text1: 'Save failed',
              text2: 'The line could not be saved.',
            });
            return 'failed';
          }
          setPersistedId(saved.id);
          persistedIdRef.current = saved.id;
          setDocumentNo(saved.document_no || '');
          lastSavedRef.current = snapshot;
          pendingUnitCostRef.current = null;
          onSaved(saved);
          flashSaved();
          return 'saved';
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
          return 'failed';
        } finally {
          savingRef.current = false;
          setIsSaving(false);
        }
      })();

      let task: Promise<PersistLineResult>;
      task = next.finally(() => {
        if (persistInFlightRef.current === task) {
          persistInFlightRef.current = null;
        }
      });
      persistInFlightRef.current = task;
      return task;
    },
    [visible, userId, canCreate, canEdit, lockedAdjustmentType, efrisEnabled, onSaved, flashSaved],
  );

  const handlePost = useCallback(() => {
    if (!canEdit || isPosting || savingRef.current) {
      return;
    }
    const current = formRef.current;
    const qty = parseSaleQuantity(current.quantityStr) ?? 0;
    if (!current.selectedItemNo.trim() || !Number.isFinite(qty) || qty <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Cannot post',
        text2: 'Choose an item and enter a quantity first.',
      });
      return;
    }
    if (efrisEnabled && current.entryType === 'PositiveAdjustment' && !current.efrisStockInType) {
      Toast.show({
        type: 'error',
        text1: 'Stock increase reason',
        text2: 'Choose how this quantity entered stock.',
      });
      return;
    }
    if (efrisEnabled && current.entryType === 'NegativeAdjustment' && !current.efrisAdjustType) {
      Toast.show({
        type: 'error',
        text1: 'Stock decrease reason',
        text2: 'Choose why this quantity is leaving stock.',
      });
      return;
    }
    const label = documentNo || 'this line';
    Alert.alert(
      'Post to inventory',
      `Post ${label} to inventory? This cannot be undone from the app.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Post',
          onPress: () => {
            void (async () => {
              setIsPosting(true);
              try {
                const saved = await persistLine();
                if (saved === 'failed') {
                  return;
                }
                const id = persistedIdRef.current;
                if (id == null) {
                  Toast.show({
                    type: 'error',
                    text1: 'Cannot post',
                    text2: 'Save the line before posting.',
                  });
                  return;
                }
                const result = await postItemJournalLines([id]);
                if (result?.error) {
                  throw result;
                }
                const invalid = result?.invalid_journals?.[0];
                if (invalid) {
                  const detail = (invalid.errors || []).filter(Boolean).join('\n');
                  throw new Error(detail || 'This line could not be posted.');
                }
                Toast.show({type: 'success', text1: 'Posted'});
                onClose();
              } catch (e: unknown) {
                const ax = e as {
                  response?: {data?: {error?: string; detail?: unknown}};
                  message?: string;
                };
                const data = ax?.response?.data;
                const invalid = (data as {invalid_journals?: Array<{errors?: string[]}>} | undefined)
                  ?.invalid_journals?.[0];
                const fromInvalid = (invalid?.errors || []).filter(Boolean).join('\n');
                const msg =
                  fromInvalid ||
                  (typeof data?.error === 'string' ? data.error : '') ||
                  (typeof data?.detail === 'string' ? data.detail : '') ||
                  (e instanceof Error ? e.message : '') ||
                  ax?.message ||
                  'Could not post this line.';
                Toast.show({type: 'error', text1: 'Could not post', text2: msg});
              } finally {
                setIsPosting(false);
              }
            })();
          },
        },
      ],
    );
  }, [canEdit, documentNo, efrisEnabled, isPosting, onClose, persistLine]);

  useEffect(() => {
    if (!visible) {
      hydrateRequestIdRef.current += 1;
      return;
    }

    if (line) {
      setPersistedId(line.id);
      persistedIdRef.current = line.id;
      setDocumentNo(line.document_no || '');
      setSelectedItemNo(line.item);
      setSelectedItemName(line.item_name);
      setEntryType((line.entry_type as ItemJournalEntryType) || 'PositiveAdjustment');
      const stockIn =
        efrisReasonCode(line.efris_stock_in_type) ||
        (lockedAdjustmentType === 'opening_balance' ? '104' : '');
      const adjust = efrisReasonCode(line.efris_adjust_type);
      setEfrisStockInType(stockIn);
      setEfrisAdjustType(adjust);
      setQuantityStr(String(line.quantity ?? ''));
      setUnitCostStr(formatUnitCostForInput(Number(line.unit_cost)));
      setDescription(line.description || '');
      setDateStr(line.date || todayISODate());
      const preferredUom = line.item_unit_of_measure ?? null;
      setSelectedItemUomId(preferredUom);
      setUomLabelFallback(line.unit_of_measure_code || '');
      setItemSearch('');
      setItemResults([]);
      lastSavedRef.current = JSON.stringify({
        item: line.item,
        entry_type: (line.entry_type as ItemJournalEntryType) || 'PositiveAdjustment',
        quantity: Number(line.quantity ?? 0),
        unit_cost: Number(line.unit_cost ?? 0),
        description: (line.description || '').trim(),
        date: line.date || todayISODate(),
        item_unit_of_measure: preferredUom,
        efris_stock_in_type: efrisEnabled ? stockIn : '',
        efris_adjust_type: efrisEnabled ? adjust : '',
      });
      const hydrateId = ++hydrateRequestIdRef.current;
      void loadUomsForItemNo(line.item, preferredUom).then(uomId => {
        if (hydrateId !== hydrateRequestIdRef.current) {
          return;
        }
        if (pendingUnitCostRef.current == null) {
          return;
        }
        void persistLine({
          item: line.item,
          item_unit_of_measure: uomId ?? preferredUom,
          unit_cost: pendingUnitCostRef.current,
        });
      });
      if (!line.item) {
        void fetchItemJournalDetail(line)
          .then(async data => {
            if (hydrateId !== hydrateRequestIdRef.current) {
              return;
            }
            const detail = normalizeLine(
              (data ?? {}) as Record<string, unknown>,
            );
            if (!detail?.item) {
              return;
            }
            setSelectedItemNo(detail.item);
            if (detail.item_name) {
              setSelectedItemName(detail.item_name);
            }
            if (detail.unit_of_measure_code) {
              setUomLabelFallback(detail.unit_of_measure_code);
            }
            const nextUom = detail.item_unit_of_measure ?? preferredUom;
            if (detail.item_unit_of_measure != null) {
              setSelectedItemUomId(detail.item_unit_of_measure);
            }
            if (pendingUnitCostRef.current == null && detail.unit_cost != null) {
              setUnitCostStr(formatUnitCostForInput(Number(detail.unit_cost)));
            }
            const detailStockIn =
              efrisReasonCode(detail.efris_stock_in_type) || stockIn;
            const detailAdjust =
              efrisReasonCode(detail.efris_adjust_type) || adjust;
            setEfrisStockInType(detailStockIn);
            setEfrisAdjustType(detailAdjust);
            lastSavedRef.current = JSON.stringify({
              item: detail.item,
              entry_type:
                (detail.entry_type as ItemJournalEntryType) ||
                'PositiveAdjustment',
              quantity: Number(detail.quantity ?? line.quantity ?? 0),
              unit_cost: Number(detail.unit_cost ?? line.unit_cost ?? 0),
              description: (detail.description || line.description || '').trim(),
              date: detail.date || line.date || todayISODate(),
              item_unit_of_measure: nextUom,
              efris_stock_in_type: efrisEnabled ? detailStockIn : '',
              efris_adjust_type: efrisEnabled ? detailAdjust : '',
            });
            const uomId = await loadUomsForItemNo(detail.item, nextUom);
            if (hydrateId !== hydrateRequestIdRef.current) {
              return;
            }
            if (pendingUnitCostRef.current != null) {
              void persistLine({
                item: detail.item,
                item_unit_of_measure: uomId ?? nextUom,
                unit_cost: pendingUnitCostRef.current,
              });
            }
          })
          .catch(() => undefined);
      }
    } else {
      resetForm();
    }
  }, [line, visible, efrisEnabled, loadUomsForItemNo, resetForm]);

  const fetchSearchPage = useCallback(
    async (page: number, q: string, append: boolean) => {
      const requestId = ++searchRequestIdRef.current;
      if (append) {
        setLoadingMore(true);
      } else {
        setItemsLoading(true);
      }
      try {
        const res = await listItems({
          page,
          q: q || undefined,
          pageSize: 20,
        });
        if (requestId !== searchRequestIdRef.current) {
          return;
        }
        const mapped = (res.results as Record<string, unknown>[])
          .map(mapCatalogHit)
          .filter(it => it.no && isStockItem(it.type));
        setItemResults(prev => (append ? [...prev, ...mapped] : mapped));
        setSearchPage(page);
        setHasNextPage(Boolean(res.next) || mapped.length >= 20);
      } catch {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }
        if (!append) {
          setItemResults([]);
        }
        setHasNextPage(false);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setItemsLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!visible || !isSearchPanelVisible) {
      return;
    }
    const q = itemSearch.trim();
    const t = setTimeout(
      () => {
        void fetchSearchPage(1, q, false);
      },
      q ? 300 : 80,
    );
    return () => {
      clearTimeout(t);
    };
  }, [visible, isSearchPanelVisible, itemSearch, fetchSearchPage]);

  const openSearchPanel = useCallback(() => {
    if (!canWrite) {
      return;
    }
    setItemSearch('');
    setIsSearchPanelVisible(true);
    setShowDatePicker(false);
    setUomPickerVisible(false);
    setEntryTypePickerVisible(false);
  }, [canWrite]);

  const closeSearchPanel = useCallback(() => {
    setIsSearchPanelVisible(false);
    setItemSearch('');
    Keyboard.dismiss();
  }, []);

  const handleSavePress = useCallback(async () => {
    const keyboardOpen = Keyboard.isVisible();
    await new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        hideSub.remove();
        clearTimeout(timer);
        resolve();
      };
      const hideSub = Keyboard.addListener('keyboardDidHide', finish);
      const timer = setTimeout(finish, keyboardOpen ? 250 : 0);
      Keyboard.dismiss();
    });
    const result = await persistLine();
    if (result === 'skipped' && lastSavedRef.current) {
      flashSaved();
    }
  }, [persistLine, flashSaved]);

  const requestClose = useCallback(() => {
    if (isSearchPanelVisible) {
      closeSearchPanel();
      return;
    }
    if (closeInFlightRef.current) {
      return;
    }
    closeInFlightRef.current = true;
    void (async () => {
      try {
        // Blur writes the native field text into formRef. Wait until that
        // happens before reading the form, or the save still sees the old value.
        const keyboardOpen = Keyboard.isVisible();
        await new Promise<void>(resolve => {
          let settled = false;
          const finish = () => {
            if (settled) {
              return;
            }
            settled = true;
            hideSub.remove();
            clearTimeout(timer);
            resolve();
          };
          const hideSub = Keyboard.addListener('keyboardDidHide', finish);
          const timer = setTimeout(finish, keyboardOpen ? 250 : 0);
          Keyboard.dismiss();
        });
        let result = await persistLine();
        while (persistInFlightRef.current) {
          result = await persistInFlightRef.current;
        }
        if (result === 'failed') {
          return;
        }
        onClose();
      } finally {
        closeInFlightRef.current = false;
      }
    })();
  }, [isSearchPanelVisible, closeSearchPanel, persistLine, onClose]);

  const handleDateChange = useCallback(
    (event: {type?: string}, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
        if (event.type !== 'set' || !selectedDate) {
          return;
        }
      } else {
        setShowDatePicker(false);
        if (!selectedDate) {
          return;
        }
      }
      const nextDate = formatISODateLocal(selectedDate);
      setDateStr(nextDate);
      void persistLine({date: nextDate});
    },
    [persistLine],
  );

  const applySelectedItem = useCallback(
    async (it: ItemSearchHit) => {
      const itemNo = (it.no || '').trim();
      if (!itemNo || !canWrite) {
        return;
      }
      setSelectedItemNo(itemNo);
      setSelectedItemName(it.item_name);
      setItemSearch('');
      setItemResults([]);
      setIsSearchPanelVisible(false);
      Keyboard.dismiss();
      let cost = resolveItemUnitCost(it);
      try {
        const detail = await fetchItemCardDetail({no: itemNo});
        const detailCost = Number(detail?.unit_cost);
        if (Number.isFinite(detailCost) && detailCost >= 0) {
          cost = detailCost;
        }
      } catch {
        // Keep catalog unit_cost when the item card cannot be loaded.
      }
      setUnitCostStr(formatUnitCostForInput(cost));
      let uoms = it.item_units_of_measure;
      let uomId = pickDefaultItemUomId(uoms);
      if (!uoms.length) {
        uomId = await loadUomsForItemNo(itemNo, null);
      } else {
        setAvailableItemUoms(uoms);
        setSelectedItemUomId(uomId);
      }
      setUomLabelFallback('');
      if (uomId == null) {
        Toast.show({
          type: 'error',
          text1: 'Unit of measure required',
          text2: 'Pick an item that has at least one unit of measure.',
        });
        return;
      }
      await persistLine({
        item: itemNo,
        unit_cost: cost,
        item_unit_of_measure: uomId,
        quantity: persistedIdRef.current != null
          ? parseSaleQuantity(formRef.current.quantityStr) ?? 0
          : 1,
      });
    },
    [canWrite, loadUomsForItemNo, persistLine],
  );

  const previewName = (selectedItemName || 'Select an item').trim();
  const previewInitials = itemInitials(previewName);
  const entryLabel =
    ENTRY_OPTIONS.find(o => o.value === entryType)?.label || entryType;
  const selectedUomLabel =
    availableItemUoms.find(u => u.id === selectedItemUomId)?.unit_of_measure ||
    uomLabelFallback ||
    '';
  const uomSelectOptions = availableItemUoms.map(u => ({
    id: u.id,
    label: u.unit_of_measure || 'UOM',
    subtitle: `×${u.quantity_per_unit}${u.default ? ' · Default' : ''}`,
  }));
  const entryTypeSelectOptions = ENTRY_OPTIONS.map(opt => ({
    id: opt.value,
    label: opt.label,
  }));
  const efrisReasonOptions =
    entryType === 'NegativeAdjustment'
      ? STOCK_DECREASE_REASONS
      : STOCK_INCREASE_REASONS;
  const efrisReasonValue =
    entryType === 'NegativeAdjustment' ? efrisAdjustType : efrisStockInType;
  const efrisReasonLabel =
    efrisReasonOptions.find(option => option.id === efrisReasonValue)?.label ||
    '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={requestClose}>
      <View style={[styles.pageRoot, themed.pageRoot]}>
        {isSearchPanelVisible ? null : (
        <View style={[styles.pageHeader, {paddingTop: topInset}]}>
          <QuickIconPressable
            onPress={requestClose}
            style={[styles.headerIconButton, themed.headerIconButton]}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityLabel="Close">
            <Image
              source={icons.cross}
              style={[styles.headerIcon, themed.headerIcon]}
              resizeMode="contain"
            />
          </QuickIconPressable>

          {canWrite ? (
            <TouchableOpacity
              style={[
                styles.savePill,
                showSaved && !isSaving ? styles.savePillSaved : null,
              ]}
              onPress={() => void handleSavePress()}
              disabled={isSaving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                isSaving ? 'Saving' : showSaved ? 'Saved' : 'Save'
              }>
              <Text style={styles.savePillText}>
                {isSaving ? 'Saving' : showSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
        )}

        {isSearchPanelVisible ? (
          <View style={[styles.searchPage, {paddingTop: topInset}]}>
            <View style={styles.searchRow}>
              <View style={[styles.searchBarWrap, themed.searchWrap]}>
                <QuickIconPressable
                  onPress={closeSearchPanel}
                  style={styles.searchBackButton}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  accessibilityLabel="Close search">
                  <Image
                    source={icons.back}
                    style={[styles.searchBackIcon, themed.searchBackIcon]}
                  />
                </QuickIconPressable>
                <TextInput
                  style={[styles.searchBarInput, {color: colors.textPrimary}]}
                  placeholder="Search"
                  placeholderTextColor={colors.placeholder}
                  value={itemSearch}
                  onChangeText={setItemSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoFocus
                  clearButtonMode={
                    Platform.OS === 'ios' && itemSearch.length > 0
                      ? 'while-editing'
                      : 'never'
                  }
                />
                {itemSearch.length > 0 && Platform.OS === 'android' ? (
                  <QuickIconPressable
                    onPress={() => setItemSearch('')}
                    style={styles.searchClearButton}
                    hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
                    accessibilityLabel="Clear search">
                    <Image
                      source={icons.cross}
                      style={[styles.searchClearIcon, themed.searchIcon]}
                    />
                  </QuickIconPressable>
                ) : null}
              </View>
            </View>
            {itemsLoading && itemResults.length === 0 ? (
              <View style={styles.searchState}>
                <ActivityIndicator size="small" color={COLORS.primary2} />
                <Text style={[styles.searchStateText, themed.stateText]}>
                  Searching items...
                </Text>
              </View>
            ) : (
              <FlatList
                style={styles.searchList}
                data={itemResults}
                keyExtractor={(it, index) => it.no || `${it.item_name}-${index}`}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                  if (!hasNextPage || loadingMore || itemsLoading) {
                    return;
                  }
                  void fetchSearchPage(
                    searchPage + 1,
                    itemSearch.trim(),
                    true,
                  );
                }}
                contentContainerStyle={
                  itemResults.length === 0
                    ? styles.searchListEmpty
                    : styles.searchListContent
                }
                ListEmptyComponent={
                  <Text style={[styles.searchStateText, themed.stateText]}>
                    {itemSearch.trim()
                      ? 'No items found'
                      : 'Browse items to add'}
                  </Text>
                }
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.searchFooter}>
                      <ActivityIndicator size="small" color={COLORS.primary2} />
                    </View>
                  ) : null
                }
                renderItem={({item: it}) => {
                  const imageUrl = it.item_images?.[0]?.url;
                  const sub = [it.no, it.bar_code_no]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <TouchableOpacity
                      style={[styles.searchResultRow, themed.searchResultRow]}
                      onPress={() => void applySelectedItem(it)}
                      activeOpacity={0.75}>
                      {imageUrl ? (
                        <Image
                          source={{uri: imageUrl}}
                          style={styles.searchResultThumb}
                        />
                      ) : (
                        <View style={styles.searchResultInitialsTile}>
                          <Text style={styles.searchResultInitialsText}>
                            {itemInitials(it.item_name)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.searchResultTextCol}>
                        <Text
                          style={[
                            styles.searchResultName,
                            themed.searchResultName,
                          ]}
                          numberOfLines={1}>
                          {it.item_name}
                        </Text>
                        {sub ? (
                          <Text
                            style={[
                              styles.searchResultSub,
                              themed.searchResultSub,
                            ]}
                            numberOfLines={1}>
                            {sub}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.pageTitle, themed.pageTitle]}>
            {isPersisted ? editFormTitle : addFormTitle}
          </Text>
          <Text style={[styles.autoSaveHint, themed.autoSaveHint]}>
            Tap Save to keep your changes. Leaving a field also saves.
          </Text>

          <View style={[styles.previewSection, themed.previewSection]}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitials}>{previewInitials}</Text>
            </View>
            <View style={styles.previewMeta}>
              <Text
                style={[styles.previewName, themed.previewName]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {previewName}
              </Text>
              <Text
                style={[styles.previewSubtext, themed.previewSubtext]}
                numberOfLines={1}>
                {documentNo ? `${documentNo} · ${entryLabel}` : entryLabel}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>Item</Text>

            {isPersisted ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, themed.label]}>Item name</Text>
                  <TextInput
                    style={[styles.input, themed.input, themed.disabledInput]}
                    value={selectedItemName}
                    editable={false}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, themed.label]}>Item number</Text>
                  <TextInput
                    style={[styles.input, themed.input, themed.disabledInput]}
                    value={selectedItemNo}
                    editable={false}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, themed.label]}>Find item</Text>
                  <TouchableOpacity
                    style={[styles.searchInputWrap, themed.input]}
                    onPress={openSearchPanel}
                    disabled={!canWrite}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Search items">
                    <Image
                      source={icons.search}
                      style={[styles.searchIcon, themed.searchIcon]}
                      resizeMode="contain"
                    />
                    <Text
                      style={[
                        styles.searchInput,
                        {
                          color: selectedItemName
                            ? colors.textPrimary
                            : colors.placeholder,
                        },
                      ]}
                      numberOfLines={1}>
                      {selectedItemName ||
                        'Search by name, barcode, or item no.'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {(selectedItemNo || isPersisted) && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, themed.label]}>Unit of measure</Text>
                {availableItemUoms.length > 0 || selectedItemUomId != null ? (
                  <TouchableOpacity
                    style={[
                      styles.selectRow,
                      themed.selectRow,
                      !canWrite && themed.selectRowDisabled,
                    ]}
                    onPress={() => {
                      if (!canWrite || availableItemUoms.length === 0) {
                        return;
                      }
                      Keyboard.dismiss();
                      setUomPickerVisible(true);
                    }}
                    activeOpacity={0.7}
                    disabled={!canWrite || availableItemUoms.length === 0}>
                    <Text
                      style={[
                        styles.selectRowText,
                        themed.selectRowText,
                        !selectedUomLabel && themed.selectRowPlaceholder,
                      ]}
                      numberOfLines={1}>
                      {selectedUomLabel || 'Select unit of measure'}
                    </Text>
                    <Text style={[styles.selectRowChevron, themed.selectRowChevron]}>
                      ›
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.helperText, themed.helperText]}>
                    No units loaded for this item. Check item setup in the web app.
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={[styles.sectionDivider, themed.sectionDivider]} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>
              Adjustment
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Entry type</Text>
              <TouchableOpacity
                style={[
                  styles.selectRow,
                  themed.selectRow,
                  !canWrite && themed.selectRowDisabled,
                ]}
                onPress={() => {
                  if (!canWrite) {
                    return;
                  }
                  Keyboard.dismiss();
                  setEntryTypePickerVisible(true);
                }}
                activeOpacity={0.7}
                disabled={!canWrite}>
                <Text
                  style={[styles.selectRowText, themed.selectRowText]}
                  numberOfLines={1}>
                  {entryLabel}
                </Text>
                <Text style={[styles.selectRowChevron, themed.selectRowChevron]}>
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            {efrisEnabled &&
            (entryType === 'PositiveAdjustment' ||
              entryType === 'NegativeAdjustment') ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, themed.label]}>
                  {entryType === 'NegativeAdjustment'
                    ? 'Stock decrease reason'
                    : 'Stock increase reason'}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectRow,
                    themed.selectRow,
                    !canWrite && themed.selectRowDisabled,
                  ]}
                  onPress={() => {
                    if (!canWrite) {
                      return;
                    }
                    Keyboard.dismiss();
                    setEfrisReasonPickerVisible(true);
                  }}
                  activeOpacity={0.7}
                  disabled={!canWrite}>
                  <Text
                    style={[
                      styles.selectRowText,
                      themed.selectRowText,
                      !efrisReasonLabel && {color: colors.placeholder},
                    ]}
                    numberOfLines={1}>
                    {efrisReasonLabel || 'Select reason'}
                  </Text>
                  <Text style={[styles.selectRowChevron, themed.selectRowChevron]}>
                    ›
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Quantity</Text>
              <TextInput
                style={[styles.input, themed.input]}
                keyboardType="number-pad"
                value={quantityStr}
                onChangeText={value => {
                  formRef.current.quantityStr = value;
                  setQuantityStr(value);
                }}
                onBlur={event => {
                  formRef.current.quantityStr = event.nativeEvent.text;
                  if (closeInFlightRef.current) {
                    return;
                  }
                  setQuantityStr(event.nativeEvent.text);
                  void persistLine();
                }}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                editable={canWrite}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Date</Text>
              <TouchableOpacity
                style={[
                  styles.selectRow,
                  themed.selectRow,
                  !canWrite && themed.selectRowDisabled,
                ]}
                onPress={() => {
                  if (!canWrite) {
                    return;
                  }
                  Keyboard.dismiss();
                  setShowDatePicker(true);
                }}
                activeOpacity={0.7}
                disabled={!canWrite}>
                <Text
                  style={[styles.selectRowText, themed.selectRowText]}
                  numberOfLines={1}>
                  {dateStr || 'Select date'}
                </Text>
                <Text style={[styles.selectRowChevron, themed.selectRowChevron]}>
                  ›
                </Text>
              </TouchableOpacity>
              {showDatePicker ? (
                <DateTimePicker
                  value={parseISODateLocal(dateStr)}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              ) : null}
            </View>
          </View>

          <View style={[styles.sectionDivider, themed.sectionDivider]} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>
              Cost & notes
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Unit cost</Text>
              <TextInput
                style={[styles.input, themed.input]}
                keyboardType="decimal-pad"
                value={unitCostStr}
                onChangeText={text => {
                  const formatted = formatUnitCostCommaInput(text);
                  formRef.current.unitCostStr = formatted;
                  setUnitCostStr(formatted);
                }}
                onFocus={() => {
                  const n = parseFloat(unitCostStr.replace(/,/g, ''));
                  if (!unitCostStr.trim() || !Number.isFinite(n) || n === 0) {
                    setUnitCostStr('');
                  }
                }}
                onBlur={event => {
                  const typed = event.nativeEvent.text;
                  formRef.current.unitCostStr = typed;
                  const n = parseFloat(typed.replace(/,/g, ''));
                  const cost = Number.isFinite(n) && n > 0 ? n : 0;
                  if (closeInFlightRef.current) {
                    return;
                  }
                  setUnitCostStr(formatUnitCostForInput(cost));
                  pendingUnitCostRef.current = cost;
                  void persistLine({unit_cost: cost});
                }}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                editable={canWrite}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, themed.label]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, themed.input]}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={value => {
                  formRef.current.description = value;
                  setDescription(value);
                }}
                onBlur={event => {
                  formRef.current.description = event.nativeEvent.text;
                  if (closeInFlightRef.current) {
                    return;
                  }
                  setDescription(event.nativeEvent.text);
                  void persistLine();
                }}
                placeholder="Optional notes"
                placeholderTextColor={colors.placeholder}
                editable={canWrite}
              />
            </View>
          </View>
        </ScrollView>
        )}
        {!isSearchPanelVisible && canEdit && isPersisted ? (
          <View
            style={[
              styles.postBar,
              {
                paddingBottom: Math.max(bottomInset, 12),
                borderTopColor: colors.border,
              },
            ]}>
            <TouchableOpacity
              style={[styles.postButton, isPosting && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={isPosting || isSaving}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Post to inventory">
              {isPosting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <SearchableSelectModal
        visible={uomPickerVisible}
        title="Select unit of measure"
        options={uomSelectOptions}
        selectedId={selectedItemUomId}
        searchPlaceholder="Search units…"
        onClose={() => setUomPickerVisible(false)}
        onSelect={id => {
          const next = typeof id === 'number' ? id : Number(id);
          if (!Number.isFinite(next)) {
            setUomPickerVisible(false);
            return;
          }
          setSelectedItemUomId(next);
          setUomPickerVisible(false);
          void persistLine({item_unit_of_measure: next});
        }}
      />
      <SearchableSelectModal
        visible={entryTypePickerVisible}
        title="Select entry type"
        options={entryTypeSelectOptions}
        selectedId={entryType}
        searchPlaceholder="Search…"
        onClose={() => setEntryTypePickerVisible(false)}
        onSelect={id => {
          const next = String(id) as ItemJournalEntryType;
          setEntryType(next);
          setEntryTypePickerVisible(false);
          void persistLine({entry_type: next});
        }}
      />
      <SearchableSelectModal
        visible={efrisReasonPickerVisible}
        title={
          entryType === 'NegativeAdjustment'
            ? 'Stock decrease reason'
            : 'Stock increase reason'
        }
        options={efrisReasonOptions}
        selectedId={efrisReasonValue || null}
        searchPlaceholder="Search reasons…"
        onClose={() => setEfrisReasonPickerVisible(false)}
        onSelect={id => {
          const next = String(id);
          setEfrisReasonPickerVisible(false);
          if (entryType === 'NegativeAdjustment') {
            setEfrisAdjustType(next);
            void persistLine({efris_adjust_type: next});
            return;
          }
          setEfrisStockInType(next);
          void persistLine({efris_stock_in_type: next});
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 16,
    height: 16,
  },
  savePill: {
    minWidth: 72,
    height: 36,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  savePillSaved: {
    backgroundColor: COLORS.success,
  },
  savePillText: {
    ...FONTS.body4,
    fontWeight: '600',
    fontSize: 15,
    color: COLORS.white,
  },
  headerSpacer: {
    width: 72,
    height: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  postBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  postButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    opacity: 0.7,
  },
  postButtonText: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: '700',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 8,
  },
  autoSaveHint: {
    ...FONTS.body5,
    marginBottom: 20,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  previewSubtext: {
    ...FONTS.body4,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 6,
    marginBottom: 26,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    ...FONTS.body4,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...FONTS.body3,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 14,
  },
  selectRowText: {
    flex: 1,
    ...FONTS.body3,
  },
  selectRowChevron: {
    fontSize: 22,
    fontWeight: '300',
    marginLeft: 8,
  },
  searchInputWrap: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  searchClearIcon: {
    width: 14,
    height: 14,
    marginLeft: 8,
  },
  searchPage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 16,
    borderWidth: 1.4,
  },
  searchBackButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  searchBackIcon: {
    width: 18,
    height: 18,
  },
  searchBarInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    ...FONTS.body3,
  },
  searchClearButton: {
    padding: 4,
    marginLeft: 4,
  },
  searchList: {
    flex: 1,
    minHeight: 0,
  },
  searchListContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  searchListEmpty: {
    flexGrow: 1,
    paddingTop: 32,
    alignItems: 'center',
  },
  searchState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  searchStateText: {
    ...FONTS.body4,
    marginTop: 8,
  },
  searchFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: COLORS.lightGray1,
  },
  searchResultInitialsTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E4E4E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultInitialsText: {
    ...FONTS.body4,
    color: '#5C5C5C',
    fontWeight: '600',
  },
  searchResultTextCol: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  searchResultName: {
    ...FONTS.body3,
    fontWeight: '700',
  },
  searchResultSub: {
    ...FONTS.body4,
    marginTop: 2,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  disabledInput: {},
  helperText: {
    ...FONTS.body4,
    lineHeight: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  pickList: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  pickRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: COLORS.lightGray1,
  },
  pickThumbFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: COLORS.primary3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickThumbInitials: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  pickRowText: {
    flex: 1,
    minWidth: 0,
  },
  pickRowTitle: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 2,
  },
  pickRowSub: {
    ...FONTS.body4,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineLoadingText: {
    ...FONTS.body4,
    marginLeft: 8,
  },
});

export default ItemJournalFormModal;
