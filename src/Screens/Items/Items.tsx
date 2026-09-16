import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import {
  launchImageLibrary,
  launchCamera,
  ImageLibraryOptions,
  CameraOptions,
} from 'react-native-image-picker';
import {
  updateItem,
  deleteItem,
  createItem,
  fetchCategories,
  fetchAllItemLedgerEntries,
  uploadItemImage,
  deleteItemImage,
  fetchItemUnitsOfMeasure,
  fetchItemCardDetail,
  type ItemCategory,
} from '../../services/app.services';
import ItemUnitOfMeasureModal from './ItemUnitOfMeasureModal';
import ItemCategoryFormModal from './ItemCategoryFormModal';
import { usePermissions } from '../../hooks/usePermissions';
import {
  useItemsQuery,
  useCategoriesQuery,
  useInvalidateItems,
  type ItemRow,
} from '../../hooks/useItemsQuery';
import { safeGoBack } from '../../hooks/NavigationService';
import { consumeCategoryPickerSession, isPickingCategory, subscribeCategoryPickerResult } from './categoryPickerSession';
import { PAGE_NAMES } from '../../constants/pageNames';
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import { ICON_BUTTON_ACTIVE_OPACITY, ICON_BUTTON_HIT_SLOP } from '../../constants';
import icons from '../../constants/icons';
import { QuickIconPressable } from '../../Components';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import { useTheme } from '../../context/ThemeContext';
import { useAppContext, useTabContext } from '../../context/Store';
import Toast from 'react-native-toast-message';
import {appToastConfig} from '../../Components/AppToast';
import {getApiErrorMessage} from '../../utils/apiError';
// CameraRoll import removed - using native gallery picker instead

export type Item = ItemRow;

interface Category {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
}

interface InventoryEntry {
  lot_no?: string;
  remaining_quantity?: number;
  quantity?: number;
  document_no?: string;
  entry_type?: string;
  document_type?: string;
  expiry_date?: string;
  posting_date?: string;
  date?: string;
  location_name?: string;
}

const createEmptyItemDraft = (
  defaultType: 'Inventory' | 'Service' | 'Non-Inventory' = 'Inventory',
): Item => ({
  system_id: '',
  item_name: '',
  unit_price: 0,
  item_images: [],
  inventory: 0,
  description: '',
  bar_code_no: '',
  type: defaultType,
});

const EditItemModal = ({
  visible,
  onClose,
  item,
  onSave,
  onDelete,
  canEdit,
  canCreate,
  canDelete,
  mode = 'edit',
  defaultCreateType = 'Inventory',
  allowInventoryType = true,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  /** Called after a successful auto-save so the list can refresh (does not close). */
  onSave: (updatedItem: Item) => void;
  onDelete?: (item: Item) => void;
  canEdit: boolean;
  canCreate?: boolean;
  canDelete: boolean;
  mode?: 'edit' | 'create';
  defaultCreateType?: 'Inventory' | 'Service' | 'Non-Inventory';
  allowInventoryType?: boolean;
}) => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isCreateMode = mode === 'create';
  const [editedItem, setEditedItem] = useState < Item | null > (null);
  const [categories, setCategories] = useState < Category[] > ([]);
  const [selectedImage, setSelectedImage] = useState < any > (null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageDeleteLoading, setImageDeleteLoading] = useState(false);
  const [itemDeleteLoading, setItemDeleteLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState < string | null > (null);
  const [inventoryEntriesVisible, setInventoryEntriesVisible] = useState(false);
  const [inventoryEntriesLoading, setInventoryEntriesLoading] = useState(false);
  const [inventoryEntriesError, setInventoryEntriesError] = useState<string | null>(null);
  const [inventoryEntries, setInventoryEntries] = useState<InventoryEntry[]>([]);
  const [uomModalVisible, setUomModalVisible] = useState(false);
  const [itemUomCount, setItemUomCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [pickerSelectedCode, setPickerSelectedCode] = useState<string | null>(null);
  const [categoryFormVisible, setCategoryFormVisible] = useState(false);
  const {canCreate: canCreateCategory, canEdit: canEditCategory} =
    usePermissions();
  const CATEGORY_PAGE_NAME = PAGE_NAMES.ITEM_CATEGORIES;

  const editedItemRef = useRef<Item | null>(null);
  const categoriesRef = useRef<Category[]>([]);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last values successfully saved to the server — used for dirty checks (not live form state). */
  const lastSavedRef = useRef<Record<string, any>>({});

  editedItemRef.current = editedItem;
  categoriesRef.current = categories;

  const loadItemUomCount = useCallback(async (itemNo: string) => {
    try {
      const rows = await fetchItemUnitsOfMeasure(itemNo);
      setItemUomCount(rows.length);
    } catch {
      setItemUomCount(0);
    }
  }, []);

  const { colors } = useTheme();
  const appCtx = useAppContext();
  /** Match web: only hide when permission is explicitly false (undefined defaults to allowed). */
  const canSeeBuyingPriceUi =
    appCtx?.auth?.userPermissions?.canSeeBuyingPrice !== false;
  const canSeeProfitMarginUi =
    appCtx?.auth?.userPermissions?.canSeeProfitMargin !== false;
  const editTheme = useMemo(
    () => ({
      root: { backgroundColor: colors.background },
      flex: { backgroundColor: colors.background },
      header: {
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      },
      headerTitle: { color: colors.textPrimary },
      closeCircle: { backgroundColor: colors.backButtonBg },
      closeIcon: { tintColor: colors.textPrimary },
      loadingText: { color: colors.textSecondary },
      scrollBg: { backgroundColor: colors.background },
      tileOuter: { backgroundColor: colors.surface },
      tileInner: { backgroundColor: colors.card },
      tileInitials: { color: colors.textPrimary },
      tileName: { color: colors.textSecondary },
      tileImage: { backgroundColor: colors.screenMuted },
      changePill: { backgroundColor: colors.screenMuted },
      changePillText: { color: colors.textSecondary },
      outlineField: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      outlineLabel: { color: colors.textSecondary },
      outlineInput: { color: colors.textPrimary },
      staticValue: { color: colors.textPrimary },
      staticChevron: { color: colors.textSecondary },
      thickBar: { backgroundColor: colors.border },
      sectionHeading: { color: colors.textPrimary },
      folderWrap: { borderColor: colors.border },
      folderIcon: { tintColor: colors.iconMuted },
      catTitle: { color: colors.textPrimary },
      catSubtitle: { color: colors.textSecondary },
      optionsCopy: { color: colors.textSecondary },
      learnMore: { color: colors.textPrimary },
      addOptionsPill: { backgroundColor: colors.inputBackground },
      addOptionsPillText: { color: colors.textPrimary },
      priceInput: { color: colors.textPrimary },
      settingsChevron: { tintColor: colors.iconMuted },
      invSheet: { backgroundColor: colors.surface },
      invTitle: { color: colors.textPrimary },
      invSubtitle: { color: colors.textSecondary },
      invCloseBtn: { backgroundColor: colors.backButtonBg },
      invCloseText: { color: colors.textPrimary },
      invSummaryCard: { backgroundColor: colors.screenMuted },
      invSummaryLabel: { color: colors.textSecondary },
      invSummaryValue: { color: colors.textPrimary },
      invStateText: { color: colors.textSecondary },
      invEntryCard: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      invEntryType: { color: colors.textPrimary },
      invEntryDate: { color: colors.textSecondary },
      invMeta: { color: colors.textSecondary },
    }),
    [colors],
  );

  const formatAmountWithCommas = (value: number | string | undefined | null) => {
    const numericValue =
      typeof value === 'number' ? value : parseFloat(String(value || 0));
    if (!Number.isFinite(numericValue)) {
      return '0';
    }
    return numericValue.toLocaleString('en-US');
  };

  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const categoriesData = await fetchCategories();

      // fetchCategories now returns an array directly (handles both array and paginated responses)
      if (!Array.isArray(categoriesData)) {
        console.warn('Categories response is not an array:', categoriesData);
        setCategories([]);
        return;
      }

      // Map categories to expected format (code/description -> id/name)
      const mappedCategories = categoriesData.map((cat: any, index: number) => ({
        id: cat.id || cat.code || `cat_${index}`, // Use code as id if no id exists
        code: cat.code,
        name: cat.name || cat.description || cat.code,
        description: cat.description || cat.code,
      }));

      setCategories(mappedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setEditedItem(null);
      setSelectedImage(null);
      setImageUploadError(null);
      setFieldErrors({});
      setShowSaved(false);
      setCategoryPickerVisible(false);
      setPickerSelectedCode(null);
      setCategoryFormVisible(false);
      lastSavedRef.current = {};
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      return;
    }

    if (item) {
      const currentId =
        editedItemRef.current?.system_id ||
        editedItemRef.current?.id ||
        editedItemRef.current?.no;
      const nextId = item.system_id || item.id || item.no;
      if (!currentId || String(currentId) !== String(nextId || '')) {
        setEditedItem(item);
        lastSavedRef.current = {
          item_name: item.item_name ?? '',
          description: item.description ?? '',
          bar_code_no: item.bar_code_no ?? '',
          unit_price: Number(item.unit_price) || 0,
          unit_cost: Number(item.unit_cost) || 0,
          minimum_stock: item.minimum_stock ?? null,
          type: item.type ?? '',
          category_id: item.category_id ?? null,
        };
      } else {
        setEditedItem(prev => (prev ? {...prev, ...item} : item));
      }
    } else if (isCreateMode && !editedItemRef.current?.system_id && !editedItemRef.current?.id) {
      setEditedItem(createEmptyItemDraft(defaultCreateType));
      lastSavedRef.current = {
        item_name: '',
        description: '',
        bar_code_no: '',
        unit_price: 0,
        unit_cost: 0,
        minimum_stock: null,
        type: defaultCreateType,
        category_id: null,
      };
    }
    setSelectedImage(null);
    setImageUploadError(null);
    setFieldErrors({});
    setShowSaved(false);
    loadCategories();
  }, [item?.system_id, item?.id, item?.no, item?.category_id, visible, isCreateMode, loadCategories, defaultCreateType]);

  useEffect(() => {
    if (!visible || isCreateMode || !item) {
      return;
    }
    const systemId = String(item.system_id || '').trim();
    const itemNo = String(item.no || '').trim();
    if (!systemId && !itemNo) {
      return;
    }
    let cancelled = false;
    void fetchItemCardDetail({system_id: systemId, no: itemNo}).then(detail => {
      if (cancelled || !detail) {
        return;
      }
      setEditedItem(prev => {
        if (!prev) {
          return prev;
        }
        const nextBarcode =
          prev.bar_code_no?.trim() || detail.bar_code_no || prev.bar_code_no || '';
        const prevCost = Number(prev.unit_cost);
        const detailCost = Number(detail.unit_cost);
        const nextCost =
          Number.isFinite(prevCost) && prevCost > 0
            ? prevCost
            : Number.isFinite(detailCost)
              ? detailCost
              : prev.unit_cost;
        lastSavedRef.current = {
          ...lastSavedRef.current,
          bar_code_no: nextBarcode,
          unit_cost: Number(nextCost) || 0,
          description: prev.description || detail.description || '',
        };
        return {
          ...prev,
          bar_code_no: nextBarcode,
          unit_cost: nextCost,
          description: prev.description || detail.description || prev.description,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [visible, isCreateMode, item?.system_id, item?.no]);

  useEffect(() => {
    if (!visible) {
      setInventoryEntriesVisible(false);
      setInventoryEntries([]);
      setInventoryEntriesError(null);
      setUomModalVisible(false);
      setItemUomCount(0);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && editedItem?.no) {
      loadItemUomCount(editedItem.no);
    }
  }, [visible, editedItem?.no, loadItemUomCount]);

  const isPersisted = !!(
    editedItem?.system_id ||
    editedItem?.id ||
    (editedItem?.no && String(editedItem.no).trim())
  );
  const canWrite = isPersisted ? canEdit : !!canCreate;

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

  const resolveCategoryCode = useCallback(
    (categoryId: Item['category_id'], cats: Category[] = categoriesRef.current) => {
      if (categoryId == null || categoryId === '') {
        return undefined;
      }
      const selectedCategory = cats.find(
        cat => String(cat.id || cat.code) === String(categoryId),
      );
      return selectedCategory?.code;
    },
    [],
  );

  const normalizeSavedItem = useCallback((data: any, previous: Item): Item => {
    const categoryCode =
      typeof data?.item_category === 'string'
        ? data.item_category
        : data?.item_category?.code;
    let category_id = previous.category_id ?? null;
    if (categoryCode) {
      const matched = categoriesRef.current.find(cat => cat.code === categoryCode);
      if (matched) {
        category_id = (matched.id || matched.code) as any;
      }
    }
    return {
      ...previous,
      ...data,
      id: data?.id ?? previous.id,
      no: data?.no ?? previous.no,
      system_id: data?.system_id || data?.no || previous.system_id || '',
      item_name: data?.item_name ?? previous.item_name,
      description: data?.description ?? previous.description,
      bar_code_no: data?.bar_code_no ?? previous.bar_code_no,
      unit_price: Number(data?.unit_price ?? previous.unit_price) || 0,
      unit_cost:
        data?.unit_cost !== undefined
          ? Number(data.unit_cost) || 0
          : previous.unit_cost,
      minimum_stock:
        data?.minimum_stock !== undefined
          ? data.minimum_stock
          : previous.minimum_stock,
      type: data?.type ?? previous.type,
      inventory: Number(data?.inventory ?? previous.inventory) || 0,
      item_images: data?.item_images ?? previous.item_images ?? [],
      item_category: data?.item_category ?? previous.item_category,
      category_id,
    };
  }, []);

  const extractItemError = (error: any, field: string) => {
    return getApiErrorMessage(error, {
      field,
      itemName: editedItemRef.current?.item_name,
      fallback: `Failed to save ${field.replace(/_/g, ' ')}`,
    });
  };

  const autoSaveField = useCallback(
    async (field: string, rawValue: any) => {
      const current = editedItemRef.current;
      if (!visible || !current || !canWrite || savingRef.current) {
        return;
      }

      const value =
        typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      const persisted = !!(
        current.system_id ||
        current.id ||
        (current.no && String(current.no).trim())
      );

      // Compare against last successfully saved value, not live form state
      // (onChange already updates editedItem before onBlur runs).
      const previousValue = lastSavedRef.current[field];
      if (String(previousValue ?? '') === String(value ?? '')) {
        return;
      }

      if (field === 'item_name' && (!value || !String(value).trim())) {
        setFieldErrors(prev => ({...prev, item_name: 'Item name is required'}));
        return;
      }

      if (!persisted && !current.item_name?.trim() && field !== 'item_name') {
        return;
      }

      setFieldErrors(prev => {
        const next = {...prev};
        delete next[field];
        return next;
      });

      savingRef.current = true;
      setIsSaving(true);
      try {
        const nextValues: Item = {...current, [field]: value} as Item;

        if (!persisted) {
          if (!nextValues.item_name?.trim()) {
            return;
          }
          const createPayload: any = {
            item_name: nextValues.item_name.trim(),
            type: nextValues.type?.trim() || defaultCreateType,
          };
          if (nextValues.description?.trim()) {
            createPayload.description = nextValues.description.trim();
          }
          if (nextValues.bar_code_no?.trim()) {
            createPayload.bar_code_no = nextValues.bar_code_no.trim();
          }
          if ((Number(nextValues.unit_price) || 0) > 0) {
            createPayload.unit_price = Number(nextValues.unit_price) || 0;
          }
          const catCode = resolveCategoryCode(nextValues.category_id);
          if (catCode) {
            createPayload.item_category = catCode;
          }
          const itemType = createPayload.type;
          if (
            (itemType === 'Service' || itemType === 'Non-Inventory') &&
            nextValues.unit_cost !== undefined &&
            nextValues.unit_cost !== null
          ) {
            createPayload.unit_cost = Number(nextValues.unit_cost) || 0;
          }
          if (itemType === 'Inventory' && nextValues.minimum_stock != null) {
            const minStock = Number(nextValues.minimum_stock);
            if (minStock > 0) {
              createPayload.minimum_stock = minStock;
            }
          }

          const response = await createItem(createPayload);
          const saved = normalizeSavedItem(response.data, nextValues);
          setEditedItem(saved);
          editedItemRef.current = saved;
          lastSavedRef.current = {
            ...lastSavedRef.current,
            item_name: saved.item_name ?? '',
            description: saved.description ?? '',
            bar_code_no: saved.bar_code_no ?? '',
            unit_price: Number(saved.unit_price) || 0,
            unit_cost: Number(saved.unit_cost) || 0,
            minimum_stock: saved.minimum_stock ?? null,
            type: saved.type ?? '',
            category_id: saved.category_id ?? null,
          };
          onSave(saved);
          flashSaved();
        } else {
          const itemId = current.system_id || current.no || current.id;
          if (!itemId) {
            return;
          }
          const updatePayload: any = {
            system_id: current.system_id || current.no || String(itemId),
            item_name: nextValues.item_name,
          };
          if (field === 'category_id') {
            const catCode = resolveCategoryCode(value);
            updatePayload.item_category = catCode || null;
          } else {
            updatePayload[field] = value;
          }

          const response = await updateItem(itemId, updatePayload);
          const saved = normalizeSavedItem(response.data, nextValues);
          setEditedItem(saved);
          editedItemRef.current = saved;
          lastSavedRef.current = {
            ...lastSavedRef.current,
            [field]:
              field === 'category_id'
                ? saved.category_id ?? null
                : (saved as any)[field] ?? value,
            item_name: saved.item_name ?? lastSavedRef.current.item_name,
          };
          onSave(saved);
          flashSaved();
        }
      } catch (error: any) {
        console.error('Error auto-saving item:', error);
        const message = extractItemError(error, field);
        setFieldErrors(prev => ({...prev, [field]: message}));
        Toast.show({
          type: 'error',
          text1: 'Could not save item',
          text2: message,
          visibilityTime: 5000,
        });
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [
      visible,
      canWrite,
      defaultCreateType,
      resolveCategoryCode,
      normalizeSavedItem,
      onSave,
      flashSaved,
    ],
  );

  const getSelectedCategoryLabel = () => {
    if (!editedItem || !editedItem.category_id) {
      return 'Select category';
    }
    const selected = categories.find(
      cat => (cat.id || cat.code) === editedItem.category_id,
    );
    return selected?.name || selected?.description || selected?.code || 'Select category';
  };

  const getItemInitials = (name?: string) => {
    const words = (name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return 'IT';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  const formatInventoryEntryDate = (value?: string) => {
    if (!value) {
      return 'No date';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenInventoryEntries = async () => {
    if (isCreateMode || !editedItem) {
      return;
    }

    const itemId = editedItem.id || editedItem.no || editedItem.system_id;
    if (!itemId) {
      Alert.alert('Unavailable', 'Inventory details are not available for this item.');
      return;
    }

    setInventoryEntriesVisible(true);
    setInventoryEntriesLoading(true);
    setInventoryEntriesError(null);

    try {
      const entries = await fetchAllItemLedgerEntries(itemId);
      setInventoryEntries(entries || []);
    } catch (error: any) {
      console.error('Error loading inventory ledger entries:', error);
      setInventoryEntries([]);
      setInventoryEntriesError(
        error?.response?.data?.detail ||
          error?.message ||
          'Failed to load ledger entries.',
      );
    } finally {
      setInventoryEntriesLoading(false);
    }
  };

  const openCategoriesPicker = () => {
    if (!editedItem || categoriesLoading) {
      return;
    }

    let initial: string | null = null;
    if (editedItem.category_id != null) {
      const match = categories.find(
        c => String(c.id || c.code) === String(editedItem.category_id),
      );
      if (match?.code) {
        initial = String(match.code);
      }
    }
    setPickerSelectedCode(initial);
    setCategoryPickerVisible(true);
  };

  const categoryRecords: ItemCategory[] = useMemo(
    () =>
      categories.map(cat => ({
        code: String(cat.code || cat.id || ''),
        description: String(cat.description || cat.name || cat.code || ''),
        parent_id: null,
      })),
    [categories],
  );

  const applyPickedCategory = (code: string | null) => {
    setCategoryPickerVisible(false);
    setEditedItem(prev => {
      if (!prev) {
        return prev;
      }
      if (code == null || code === '') {
        void autoSaveField('category_id', null);
        return {...prev, category_id: null};
      }
      const cat = categories.find(c => c.code === code);
      const nextCategoryId = (cat?.id ?? cat?.code ?? code) as
        | number
        | string
        | null;
      void autoSaveField('category_id', nextCategoryId);
      return {
        ...prev,
        category_id: nextCategoryId,
      };
    });
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    const pick = route.params?.categoryPick;
    if (pick === undefined) {
      return;
    }

    navigation.setParams({categoryPick: undefined} as never);
    setEditedItem(prev => {
      if (!prev) {
        return prev;
      }
      if (pick.code == null || pick.code === '') {
        void autoSaveField('category_id', null);
        return {...prev, category_id: null};
      }
      const cat = categories.find(c => c.code === pick.code);
      const nextCategoryId = (cat?.id ?? cat?.code ?? pick.code) as
        | number
        | string
        | null;
      void autoSaveField('category_id', nextCategoryId);
      return {
        ...prev,
        category_id: nextCategoryId,
      };
    });
  }, [visible, route.params?.categoryPick, navigation, categories, autoSaveField]);

  // Map item_category to category_id when categories are loaded
  useEffect(() => {
    if (editedItem && categories.length > 0 && editedItem.item_category) {
      const categoryCode =
        typeof editedItem.item_category === 'string'
          ? editedItem.item_category
          : editedItem.item_category?.code;
      if (categoryCode && !editedItem.category_id) {
        const matchedCategory = categories.find(
          cat => cat.code === categoryCode,
        );
        if (matchedCategory) {
          setEditedItem({
            ...editedItem,
            category_id: (matchedCategory.id || matchedCategory.code) as any,
          });
        }
      }
    }
  }, [categories]);

  // Don't render anything if modal is not visible
  if (!visible) {
    return null;
  }

  const handleImagePick = async () => {
    console.log('handleImagePick called');

    if (!isPersisted) {
      Alert.alert('Save item first', 'Enter an item name so it can auto-save, then add an image.');
      return;
    }

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 1 as const,
      includeBase64: false,
      maxHeight: 1024,
      maxWidth: 1024,
      selectionLimit: 1,
    };

    const cameraOptions: CameraOptions = {
      mediaType: 'photo',
      quality: 0.7, // Reduce quality to reduce file size
      includeBase64: false,
      maxHeight: 1024,
      maxWidth: 1024,
    };

    try {
      // Show action sheet to let user choose between camera and gallery
      Alert.alert(
        'Select Image Source',
        'Choose how you want to add an image (Camera is recommended)',
        [
          {
            text: '📷 Camera (Recommended)',
            onPress: async () => {
              try {
                console.log('User chose camera...');
                // Add a small delay to prevent conflicts
                await new Promise(resolve => setTimeout(resolve, 100));
                const response = await launchCamera(cameraOptions);
                handleImageResponse(response);
              } catch (cameraError) {
                console.error('Camera error:', cameraError);
                Alert.alert(
                  'Error',
                  'Failed to open camera. Please try again.',
                );
              }
            },
          },
          {
            text: '🖼️ Gallery',
            onPress: async () => {
              try {
                console.log('User chose gallery...');
                // Sunmi module disabled, gallery should work now
                await openNativeGallery();
              } catch (libraryError) {
                console.error('Gallery error:', libraryError);
                Alert.alert(
                  'Error',
                  'Gallery is unavailable. Please use camera.',
                );
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      );
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open image picker. Please try again.');
    }
  };

  // Uses Android Photo Picker / iOS system gallery — no READ_MEDIA_* permissions.
  const openNativeGallery = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        includeBase64: false,
        selectionLimit: 1,
        includeExtra: false,
        maxWidth: 1024,
        maxHeight: 1024,
      });
      await handleImageResponse(response);
    } catch (error) {
      console.error('Error opening native gallery:', error);
      Alert.alert(
        'Gallery Unavailable',
        'Could not open the photo picker. Please use the camera option instead.',
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Try Camera',
            onPress: async () => {
              try {
                const cameraOptions: CameraOptions = {
                  mediaType: 'photo',
                  quality: 1,
                  includeBase64: false,
                  maxHeight: 1024,
                  maxWidth: 1024,
                };
                const cameraResponse = await launchCamera(cameraOptions);
                await handleImageResponse(cameraResponse);
              } catch (cameraError) {
                console.error('Camera also failed:', cameraError);
                Alert.alert(
                  'Error',
                  'Camera is also unavailable. Please try again later.',
                );
              }
            },
          },
        ],
      );
    }
  };

  const handleImageResponse = async (response: any) => {
    console.log('Image picker response:', response);

    // Check if response is null or undefined (can happen with native module conflicts)
    if (!response) {
      console.error('No response received from image picker');
      Alert.alert('Error', 'Image picker failed to respond. Please try again.');
      return;
    }

    console.log('Checking response properties...');
    console.log('didCancel:', response.didCancel);
    console.log('errorCode:', response.errorCode);
    console.log('assets:', response.assets);
    console.log('assets[0]:', response.assets?.[0]);
    console.log('assets[0].uri:', response.assets?.[0]?.uri);

    if (response.didCancel) {
      console.log('Image picker cancelled');
      return;
    }

    if (response.errorCode) {
      console.error('Image picker error:', response.errorMessage);
      Alert.alert(
        'Error',
        `Image picker error: ${response.errorMessage || 'Unknown error'}`,
      );
      return;
    }

    console.log('Checking if assets exist...');
    console.log('response.assets:', response.assets);
    console.log('response.assets[0]:', response.assets?.[0]);
    console.log('editedItem:', editedItem);

    if (response.assets && response.assets[0] && editedItem) {
      console.log('All conditions met, proceeding with image processing...');

      const imageUri = response.assets[0].uri;
      console.log('Selected image URI:', imageUri);

      if (!imageUri) {
        console.error('No image URI received');
        return;
      }

      // For camera images, we might need to handle the URI differently
      let processedUri = imageUri;
      if (imageUri.startsWith('file://')) {
        console.log('Processing file URI for camera image');
        // Camera images are usually already in the correct format
        processedUri = imageUri;
      } else if (imageUri.startsWith('content://')) {
        console.log('Processing content URI for camera image');
        // Content URIs might need special handling
        processedUri = imageUri;
      }

      console.log('Processed URI:', processedUri);

      // Now let's upload the image to the server
      console.log('About to upload image to server...');
      setImageUploadLoading(true);

      try {
        const itemId = editedItem.id || editedItem.no;
        if (!itemId) {
          console.error('No item ID available for upload');
          return;
        }
        console.log('Uploading image for item ID:', itemId);

        const uploadResponse = await uploadItemImage(itemId, processedUri);
        console.log('Upload response:', uploadResponse);

        if (uploadResponse && uploadResponse.data) {
          const uploadedImage = uploadResponse.data;
          console.log('Uploaded image data:', uploadedImage);

          // Update the state with the server response
          setEditedItem({
            ...editedItem,
            item_images: [
              {
                url: uploadedImage.url,
                id: uploadedImage.id,
              },
            ],
          });

          setImageUploadError(null);
          Toast.show({
            type: 'success',
            text1: 'Photo saved',
            text2: 'Item image updated.',
          });

          console.log(
            'setEditedItem called successfully with server URL:',
            uploadedImage.url,
          );
        } else {
          console.error('Invalid upload response:', uploadResponse);
          // Fallback to local URI if upload fails
          setEditedItem({
            ...editedItem,
            item_images: [
              {
                url: processedUri,
                id: 0,
              },
            ],
          });
        }
      } catch (uploadError: any) {
        console.error('Error uploading image:', uploadError);

        // Show user-friendly error message
        let errorMessage = 'Failed to upload image. Please try again.';

        if (
          uploadError?.message?.includes('413') ||
          uploadError?.message?.includes('too large')
        ) {
          errorMessage =
            'Image file is too large. Please select a smaller image (under 5MB).';
        } else if (uploadError?.message?.includes('network')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        } else if (
          uploadError?.message?.includes('401') ||
          uploadError?.message?.includes('403')
        ) {
          errorMessage = 'Permission denied. Please log in again.';
        }

        Alert.alert('Upload Failed', errorMessage, [
          { text: 'OK', style: 'default' },
          {
            text: 'Try Again',
            onPress: () => {
              // Option to retry with the same image
              handleImageResponse(response);
            },
          },
        ]);

        // Set error state for visual feedback
        setImageUploadError(errorMessage);

        // Don't update the item with local URI if upload failed
        console.log('Upload failed - not updating item with local URI');

        // Clear error after 5 seconds
        setTimeout(() => {
          setImageUploadError(null);
        }, 5000);
      } finally {
        setImageUploadLoading(false);
      }

      // Log success message
      console.log('Image processing completed');
    }
  };

  const handleDeleteImage = async () => {
    if (
      !editedItem ||
      !editedItem.item_images ||
      editedItem.item_images.length === 0
    ) {
      Alert.alert('No Image', 'There is no image to delete.');
      return;
    }

    const imageId = editedItem.item_images[0].id;
    if (!imageId) {
      Alert.alert('Error', 'Cannot delete image: No image ID found.');
      return;
    }

    Alert.alert('Delete Image', 'Are you sure you want to delete this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setImageDeleteLoading(true);
            console.log('Deleting image with ID:', imageId);

            const response = await deleteItemImage(imageId);
            console.log('Delete response:', response);

            // Update the state to remove the image
            setEditedItem({
              ...editedItem,
              item_images: [],
            });

            Alert.alert('Success', 'Image deleted successfully');
          } catch (error) {
            console.error('Error deleting image:', error);
            Alert.alert('Error', 'Failed to delete image. Please try again.');
          } finally {
            setImageDeleteLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteItem = () => {
    if (!editedItem || !onDelete || !canDelete || !isPersisted) {
      return;
    }

    const itemLabel = editedItem.item_name?.trim() || 'this item';
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${itemLabel}"? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setItemDeleteLoading(true);
              await onDelete(editedItem);
            } finally {
              setItemDeleteLoading(false);
            }
          },
        },
      ],
    );
  };

  const previewUri =
    selectedImage?.uri ||
    (editedItem?.item_images?.[0]?.url
      ? editedItem.item_images[0].url
      : undefined);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}>
        <View style={[styles.editItemModalRoot, editTheme.root]}>
          <KeyboardAvoidingView
            style={[styles.editItemModalFlex, editTheme.flex]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            {!editedItem ? (
              <View style={styles.editItemLoadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary2} />
                <Text style={[styles.editItemLoadingText, editTheme.loadingText]}>
                  Loading item…
                </Text>
                <TouchableOpacity
                  style={styles.editItemLoadingClose}
                  onPress={onClose}
                  activeOpacity={0.7}>
                  <Text style={styles.editItemLoadingCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.editItemHeader,
                    editTheme.header,
                    { paddingTop: Math.max(insets.top, 12) },
                  ]}>
                  <View style={styles.editItemHeaderSide}>
                    <QuickIconPressable
                      onPress={
                        categoryPickerVisible
                          ? () => setCategoryPickerVisible(false)
                          : onClose
                      }
                      style={[styles.editItemCloseCircle, editTheme.closeCircle]}
                      accessibilityLabel={
                        categoryPickerVisible ? 'Close categories' : 'Close'
                      }>
                      <Image
                        source={icons.cross as any}
                        style={[styles.editItemCloseIcon, editTheme.closeIcon]}
                        resizeMode="contain"
                      />
                    </QuickIconPressable>
                  </View>
                  <Text style={[styles.editItemHeaderTitle, editTheme.headerTitle]}>
                    {categoryPickerVisible
                      ? 'Categories'
                      : isCreateMode && !isPersisted
                        ? editedItem?.type === 'Service'
                          ? 'Create Service'
                          : 'Create Item'
                        : 'Edit Item'}
                  </Text>
                  <View style={[styles.editItemHeaderSide, styles.editItemHeaderSideEnd]}>
                    {categoryPickerVisible ? (
                      <TouchableOpacity
                        style={styles.editItemDonePill}
                        onPress={() => applyPickedCategory(pickerSelectedCode)}
                        activeOpacity={0.7}>
                        <Text style={styles.editItemDonePillText}>Done</Text>
                      </TouchableOpacity>
                    ) : canWrite && (isSaving || showSaved) ? (
                      <View
                        style={styles.editItemSavePill}
                        accessibilityRole="text"
                        accessibilityLabel={isSaving ? 'Saving' : 'Saved'}>
                        <Text
                          style={[
                            styles.editItemSavePillText,
                            {color: colors.textSecondary},
                          ]}>
                          {isSaving ? 'Saving...' : 'Saved'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.editItemHeaderSpacer} />
                    )}
                  </View>
                </View>

                {categoryPickerVisible ? (
                  <FlatList
                    style={[styles.modalScrollView, editTheme.scrollBg]}
                    data={categories}
                    keyExtractor={(cat, index) =>
                      String(cat.code || cat.id || index)
                    }
                    contentContainerStyle={[
                      styles.editItemScrollContent,
                      {paddingBottom: Math.max(insets.bottom, 20) + 24},
                      categories.length === 0 ? {flexGrow: 1} : null,
                    ]}
                    ListHeaderComponent={
                      canCreateCategory(CATEGORY_PAGE_NAME) ? (
                        <TouchableOpacity
                          style={styles.editItemPickerCreateRow}
                          onPress={() => setCategoryFormVisible(true)}
                          activeOpacity={0.65}>
                          <Image
                            source={icons.plus as any}
                            style={[
                              styles.editItemPickerCreatePlus,
                              {tintColor: colors.textPrimary},
                            ]}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              styles.editItemPickerCreateLabel,
                              {color: colors.textPrimary},
                            ]}>
                            Create category
                          </Text>
                        </TouchableOpacity>
                      ) : null
                    }
                    ListEmptyComponent={
                      <Text style={[styles.editItemOptionsCopy, editTheme.optionsCopy]}>
                        {categoriesLoading
                          ? 'Loading categories…'
                          : canCreateCategory(CATEGORY_PAGE_NAME)
                            ? 'No categories yet. Tap Create category to add one.'
                            : 'No categories found'}
                      </Text>
                    }
                    renderItem={({item: cat}) => {
                      const code = String(cat.code || '');
                      const checked = pickerSelectedCode === code;
                      const name =
                        (cat.description && String(cat.description).trim()) ||
                        cat.name ||
                        code ||
                        'Category';
                      return (
                        <TouchableOpacity
                          style={styles.editItemPickerRow}
                          onPress={() =>
                            setPickerSelectedCode(prev =>
                              prev === code ? null : code,
                            )
                          }
                          activeOpacity={0.7}>
                          <Image
                            source={
                              checked
                                ? (icons.check_on as any)
                                : (icons.check_off as any)
                            }
                            style={styles.editItemPickerCheck}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              styles.editItemPickerRowTitle,
                              editTheme.catTitle,
                            ]}
                            numberOfLines={1}>
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : (
                <ScrollView
                  style={[styles.modalScrollView, editTheme.scrollBg]}
                  contentContainerStyle={[
                    styles.editItemScrollContent,
                    { paddingBottom: Math.max(insets.bottom, 20) + 24 },
                  ]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}>
                  <Text style={[styles.editItemAutoSaveHint, editTheme.optionsCopy]}>
                    Changes save automatically when you leave a field
                  </Text>
                  {imageUploadError ? (
                    <View style={styles.errorContainer}>
                      <View style={styles.errorIconContainer}>
                        <Text style={styles.errorIcon}>⚠</Text>
                      </View>
                      <View style={styles.errorContent}>
                        <Text style={styles.errorTitle}>Upload Failed</Text>
                        <Text style={styles.errorText}>{imageUploadError}</Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={[styles.squareTileOuter, editTheme.tileOuter]}>
                    <View
                      style={[
                        styles.squareTileInner,
                        editTheme.tileInner,
                        previewUri ? styles.squareTileInnerFilled : null,
                      ]}>
                      {previewUri ? (
                        <View style={styles.squareTileImageWrap}>
                          <Image
                            source={{ uri: previewUri }}
                            style={[styles.squareTileImage, editTheme.tileImage]}
                            resizeMode="cover"
                          />
                        </View>
                      ) : (
                        <>
                          <Text style={[styles.squareTileInitials, editTheme.tileInitials]}>
                            {getItemInitials(
                              editedItem.item_name || (isCreateMode ? 'New Item' : 'Item'),
                            )}
                          </Text>
                          <Text style={[styles.squareTileName, editTheme.tileName]} numberOfLines={2}>
                            {editedItem.item_name || (isCreateMode ? 'New Item' : 'Item')}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.squareChangeImagePill,
                      editTheme.changePill,
                      imageUploadLoading && { opacity: 0.6 },
                    ]}
                    onPress={handleImagePick}
                    disabled={imageUploadLoading}
                    activeOpacity={0.7}>
                    {imageUploadLoading ? (
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                      <Text style={[styles.squareChangeImagePillText, editTheme.changePillText]}>
                        {!isPersisted ? 'Add image after name saves' : 'Change image'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!isCreateMode &&
                    editedItem.item_images &&
                    editedItem.item_images.length > 0 &&
                    canDelete ? (
                    <TouchableOpacity
                      onPress={handleDeleteImage}
                      disabled={imageDeleteLoading}
                      style={styles.squareRemoveImage}>
                      <Text style={styles.squareRemoveImageText}>
                        {imageDeleteLoading ? 'Removing…' : 'Remove image'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                    <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>Name</Text>
                    <TextInput
                      style={[styles.squareOutlineInput, editTheme.outlineInput]}
                      value={editedItem.item_name}
                      onChangeText={text =>
                        setEditedItem({ ...editedItem, item_name: text })
                      }
                      onBlur={() =>
                        void autoSaveField(
                          'item_name',
                          editedItemRef.current?.item_name || '',
                        )
                      }
                      editable={canWrite}
                      placeholder="Item name"
                      placeholderTextColor={colors.placeholder}
                    />
                    {fieldErrors.item_name ? (
                      <Text style={styles.editItemFieldError}>{fieldErrors.item_name}</Text>
                    ) : null}
                  </View>

                  <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                    <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>
                      Barcode
                    </Text>
                    <TextInput
                      style={[styles.squareOutlineInput, editTheme.outlineInput]}
                      value={editedItem.bar_code_no ?? ''}
                      onChangeText={text =>
                        setEditedItem({...editedItem, bar_code_no: text})
                      }
                      onBlur={() =>
                        void autoSaveField(
                          'bar_code_no',
                          editedItemRef.current?.bar_code_no || '',
                        )
                      }
                      editable={canWrite}
                      placeholder="Leave blank to auto-generate"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={100}
                    />
                    {fieldErrors.bar_code_no ? (
                      <Text style={styles.editItemFieldError}>{fieldErrors.bar_code_no}</Text>
                    ) : (
                      <Text style={[styles.editItemFieldHint, {color: colors.textSecondary}]}>
                        Barcode is generated automatically. Enter one only if you want to use your own.
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.squareOutlineField,
                      styles.squareOutlineFieldTall,
                      editTheme.outlineField,
                    ]}>
                    <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>Description</Text>
                    <TextInput
                      style={[
                        styles.squareOutlineInput,
                        styles.squareOutlineMultiline,
                        editTheme.outlineInput,
                      ]}
                      value={editedItem.description ?? ''}
                      onChangeText={text =>
                        setEditedItem({ ...editedItem, description: text })
                      }
                      onBlur={() =>
                        void autoSaveField(
                          'description',
                          editedItemRef.current?.description || '',
                        )
                      }
                      editable={canWrite}
                      placeholder="Description"
                      placeholderTextColor={colors.placeholder}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>

                  {!isPersisted ? (
                    <>
                      <View style={[styles.editItemThickBar, editTheme.thickBar]} />
                      <Text style={[styles.editItemSectionHeading, editTheme.sectionHeading]}>
                        Type
                      </Text>
                      <Text style={[styles.editItemOptionsCopy, editTheme.optionsCopy]}>
                        Services are sold without stock tracking. Inventory items use your stock levels.
                      </Text>
                      <View style={styles.itemTypeChipRow}>
                        {(
                          [
                            ...(allowInventoryType
                              ? [{value: 'Inventory' as const, label: 'Inventory'}]
                              : []),
                            {value: 'Service' as const, label: 'Service'},
                            {value: 'Non-Inventory' as const, label: 'Non-Inventory'},
                          ] as const
                        ).map(opt => {
                          const selected =
                            (editedItem.type || defaultCreateType) === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[
                                styles.itemTypeChip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: selected
                                    ? COLORS.primary2
                                    : colors.inputBackground,
                                },
                              ]}
                              onPress={() => {
                                setEditedItem({...editedItem, type: opt.value});
                                void autoSaveField('type', opt.value);
                              }}
                              activeOpacity={0.75}
                              disabled={!canWrite}>
                              <Text
                                style={[
                                  styles.itemTypeChipText,
                                  {color: selected ? COLORS.white : colors.textPrimary},
                                ]}>
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : null}

                  <View style={[styles.editItemThickBar, editTheme.thickBar]} />

                  <Text style={[styles.editItemSectionHeading, editTheme.sectionHeading]}>
                    Categorization
                  </Text>
                  <TouchableOpacity
                    style={styles.editItemCategoryRow}
                    onPress={openCategoriesPicker}
                    disabled={categoriesLoading}
                    activeOpacity={0.65}>
                    <View style={[styles.editItemFolderIconWrap, editTheme.folderWrap]}>
                      <Image
                        source={icons.product as any}
                        style={[styles.editItemFolderIcon, editTheme.folderIcon]}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.editItemCategoryRowText}>
                      <Text style={[styles.editItemCategoryRowTitle, editTheme.catTitle]}>
                        Categories
                      </Text>
                      <Text style={[styles.editItemCategoryRowSubtitle, editTheme.catSubtitle]}>
                        {categoriesLoading
                          ? 'Loading…'
                          : editedItem.category_id
                            ? getSelectedCategoryLabel()
                            : 'None selected'}
                      </Text>
                    </View>
                    <Image
                      source={icons.down_arrow as any}
                      style={[styles.squareSettingsChevron, editTheme.settingsChevron]}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>

                  <View style={[styles.editItemThickBar, editTheme.thickBar]} />

                  <Text style={[styles.editItemSectionHeading, editTheme.sectionHeading]}>
                    Units of measure
                  </Text>
                  <Text style={[styles.editItemOptionsCopy, editTheme.optionsCopy]}>
                    Define how this item is sold (e.g. PCS, BOX). The default unit must
                    have quantity per unit of 1.
                  </Text>
                  {!isPersisted || !editedItem.no ? (
                    <Text style={[styles.editItemOptionsCopy, editTheme.optionsCopy]}>
                      Enter a name to auto-save the item, then add units of measure.
                    </Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.editItemCategoryRow}
                      onPress={() => setUomModalVisible(true)}
                      disabled={!canEdit}
                      activeOpacity={0.65}>
                      <View style={[styles.editItemFolderIconWrap, editTheme.folderWrap]}>
                        <Image
                          source={icons.product as any}
                          style={[styles.editItemFolderIcon, editTheme.folderIcon]}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.editItemCategoryRowText}>
                        <Text style={[styles.editItemCategoryRowTitle, editTheme.catTitle]}>
                          Manage units
                        </Text>
                        <Text style={[styles.editItemCategoryRowSubtitle, editTheme.catSubtitle]}>
                          {itemUomCount === 0
                            ? 'No units yet — tap to add'
                            : `${itemUomCount} unit${itemUomCount === 1 ? '' : 's'}`}
                        </Text>
                      </View>
                      <Image
                        source={icons.down_arrow as any}
                        style={[styles.squareSettingsChevron, editTheme.settingsChevron]}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  )}

                  <View style={[styles.editItemThickBar, editTheme.thickBar]} />

                  <Text style={[styles.editItemSectionHeading, editTheme.sectionHeading]}>
                    Price and inventory
                  </Text>
                  <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                    <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>{formatCurrencyLabel('Price')}</Text>
                    <View style={styles.squarePriceRow}>
                      <Text style={styles.squarePricePrefix}>{getLocalCurrencyCode()}</Text>
                      <TextInput
                        style={[styles.squarePriceInput, editTheme.priceInput]}
                        value={formatAmountWithCommas(editedItem.unit_price)}
                        onChangeText={text => {
                          const numericValue =
                            parseFloat(text.replace(/,/g, '')) || 0;
                          setEditedItem({
                            ...editedItem,
                            unit_price: numericValue,
                          });
                        }}
                        onBlur={() =>
                          void autoSaveField(
                            'unit_price',
                            Number(editedItemRef.current?.unit_price) || 0,
                          )
                        }
                        editable={canWrite}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                      />
                    </View>
                    {fieldErrors.unit_price ? (
                      <Text style={styles.editItemFieldError}>{fieldErrors.unit_price}</Text>
                    ) : null}
                  </View>

                  {canSeeBuyingPriceUi ? (
                    <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                      <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>
                        {formatCurrencyLabel('Buying price / Unit cost')}
                      </Text>
                      {editedItem.type === 'Service' ||
                      editedItem.type === 'Non-Inventory' ? (
                        <View style={styles.squarePriceRow}>
                          <Text style={styles.squarePricePrefix}>{getLocalCurrencyCode()}</Text>
                          <TextInput
                            style={[styles.squarePriceInput, editTheme.priceInput]}
                            value={formatAmountWithCommas(editedItem.unit_cost ?? 0)}
                            onChangeText={text => {
                              const numericValue =
                                parseFloat(text.replace(/,/g, '')) || 0;
                              setEditedItem({
                                ...editedItem,
                                unit_cost: numericValue,
                              });
                            }}
                            onBlur={() =>
                              void autoSaveField(
                                'unit_cost',
                                Number(editedItemRef.current?.unit_cost) || 0,
                              )
                            }
                            editable={canWrite}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                      ) : (
                        <View style={styles.squareOutlineStaticRow}>
                          <Text
                            style={[
                              styles.squareOutlineStaticValue,
                              editTheme.staticValue,
                            ]}>
                            {formatCurrencyCompact(editedItem.unit_cost ?? 0)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {editedItem.type !== 'Service' &&
                  editedItem.type !== 'Non-Inventory' ? (
                    <>
                      <Text style={[styles.editItemOptionsCopy, editTheme.optionsCopy]}>
                        Buying price and quantity are not typed here. They are set
                        when you record a purchase or opening stock.
                      </Text>
                      {isPersisted ? (
                        <View style={styles.costSourceActionRow}>
                          <TouchableOpacity
                            style={[
                              styles.costSourceActionPill,
                              editTheme.addOptionsPill,
                            ]}
                            onPress={() => {
                              onClose();
                              (navigation as any).navigate('OpeningBalanceJournal');
                            }}
                            activeOpacity={0.7}>
                            <Text
                              style={[
                                styles.costSourceActionPillText,
                                editTheme.addOptionsPillText,
                              ]}>
                              Opening stock
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.costSourceActionPill,
                              editTheme.addOptionsPill,
                            ]}
                            onPress={() => {
                              onClose();
                              (navigation as any).navigate('PurchaseCreation');
                            }}
                            activeOpacity={0.7}>
                            <Text
                              style={[
                                styles.costSourceActionPillText,
                                editTheme.addOptionsPillText,
                              ]}>
                              Purchase
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={[styles.editItemOptionsCopy, editTheme.optionsCopy]}>
                          Save the item first, then add opening stock or a purchase.
                        </Text>
                      )}
                    </>
                  ) : null}

                  {canSeeProfitMarginUi ? (
                    <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                      <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>
                        Profit margin
                      </Text>
                      <View style={styles.squareOutlineStaticRow}>
                        <Text
                          style={[
                            styles.squareOutlineStaticValue,
                            editTheme.staticValue,
                          ]}>
                          {(() => {
                            const up = Number(editedItem.unit_price) || 0;
                            const uc = Number(editedItem.unit_cost) || 0;
                            if (up <= 0) {
                              return '—';
                            }
                            const pct = ((up - uc) / up) * 100;
                            return `${pct.toFixed(2)}%`;
                          })()}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {editedItem.type === 'Inventory' ? (
                    <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                      <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>
                        Minimum stock
                      </Text>
                      <TextInput
                        style={[styles.squareOutlineInput, editTheme.outlineInput]}
                        value={
                          editedItem.minimum_stock != null &&
                          editedItem.minimum_stock > 0
                            ? String(editedItem.minimum_stock)
                            : ''
                        }
                        onChangeText={text => {
                          const digits = text.replace(/[^0-9]/g, '');
                          setEditedItem({
                            ...editedItem,
                            minimum_stock:
                              digits.length > 0 ? parseInt(digits, 10) : null,
                          });
                        }}
                        onBlur={() =>
                          void autoSaveField(
                            'minimum_stock',
                            editedItemRef.current?.minimum_stock ?? null,
                          )
                        }
                        editable={canWrite}
                        keyboardType="number-pad"
                        placeholder="Reorder threshold"
                        placeholderTextColor={colors.placeholder}
                      />
                    </View>
                  ) : null}

                  {isPersisted &&
                  editedItem.type !== 'Service' &&
                  editedItem.type !== 'Non-Inventory' ? (
                    <View style={[styles.squareOutlineField, editTheme.outlineField]}>
                      <Text style={[styles.squareOutlineLabel, editTheme.outlineLabel]}>Quantity</Text>
                      <TouchableOpacity
                        style={styles.squareOutlineStaticRow}
                        activeOpacity={0.7}
                        onPress={handleOpenInventoryEntries}>
                        <Text
                          style={[
                            styles.squareOutlineStaticValue,
                            styles.squareOutlineLinkValue,
                            editTheme.staticValue,
                          ]}>
                          {String(
                            Math.max(0, Math.floor(Number(editedItem.inventory) || 0)),
                          )}
                        </Text>
                        <Text style={[styles.squareOutlineStaticChevron, editTheme.staticChevron]}>
                          v
                        </Text>
                      </TouchableOpacity>
                      <Text style={[styles.editItemFieldHint, editTheme.optionsCopy]}>
                        Tap quantity to see stock movements
                      </Text>
                    </View>
                  ) : null}

                  {isPersisted && canDelete && onDelete ? (
                    <>
                      <View style={[styles.editItemThickBar, editTheme.thickBar]} />
                      <TouchableOpacity
                        style={[
                          styles.squareDeleteItemButton,
                          itemDeleteLoading && {opacity: 0.6},
                        ]}
                        onPress={handleDeleteItem}
                        disabled={itemDeleteLoading}
                        activeOpacity={0.75}>
                        {itemDeleteLoading ? (
                          <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                          <Text style={styles.squareDeleteItemButtonText}>
                            Delete item
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : null}
                </ScrollView>
                )}
              </>
            )}
          </KeyboardAvoidingView>
        </View>

        {/* Native gallery picker is used instead of in-app modal */}
        <Toast config={appToastConfig} position="top" topOffset={48} />
      </Modal>
      <Modal
        visible={inventoryEntriesVisible && visible}
        transparent
        animationType="slide"
        onRequestClose={() => setInventoryEntriesVisible(false)}>
        <View style={styles.inventoryEntriesOverlay}>
          <View style={[styles.inventoryEntriesSheet, editTheme.invSheet]}>
            <View style={styles.inventoryEntriesHeader}>
              <View style={styles.inventoryEntriesHeaderTextWrap}>
                <Text style={[styles.inventoryEntriesTitle, editTheme.invTitle]}>
                  Inventory Details
                </Text>
                <Text
                  style={[styles.inventoryEntriesSubtitle, editTheme.invSubtitle]}
                  numberOfLines={1}>
                  {editedItem?.item_name || 'Item'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInventoryEntriesVisible(false)}
                activeOpacity={0.7}
                style={[styles.inventoryEntriesCloseButton, editTheme.invCloseBtn]}>
                <Text style={[styles.inventoryEntriesCloseText, editTheme.invCloseText]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inventoryEntriesSummaryCard, editTheme.invSummaryCard]}>
              <Text style={[styles.inventoryEntriesSummaryLabel, editTheme.invSummaryLabel]}>
                Current Quantity
              </Text>
              <Text style={[styles.inventoryEntriesSummaryValue, editTheme.invSummaryValue]}>
                {String(Math.max(0, Math.floor(Number(editedItem?.inventory) || 0)))}
              </Text>
            </View>

            {inventoryEntriesLoading ? (
              <View style={styles.inventoryEntriesStateWrap}>
                <ActivityIndicator size="small" color={COLORS.primary2} />
                <Text style={[styles.inventoryEntriesStateText, editTheme.invStateText]}>
                  Loading ledger entries...
                </Text>
              </View>
            ) : inventoryEntriesError ? (
              <View style={styles.inventoryEntriesStateWrap}>
                <Text style={styles.inventoryEntriesErrorText}>
                  {inventoryEntriesError}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.inventoryEntriesList}
                showsVerticalScrollIndicator={false}>
                {inventoryEntries.length > 0 ? (
                  inventoryEntries.map((entry, index) => (
                    <View
                      key={`${entry.document_no || 'entry'}-${entry.lot_no || index}-${index}`}
                      style={[styles.inventoryEntryCard, editTheme.invEntryCard]}>
                      <View style={styles.inventoryEntryTopRow}>
                        <Text style={[styles.inventoryEntryType, editTheme.invEntryType]}>
                          {entry.entry_type || entry.document_type || 'Entry'}
                        </Text>
                        <Text style={[styles.inventoryEntryDate, editTheme.invEntryDate]}>
                          {formatInventoryEntryDate(
                            entry.posting_date || entry.date || entry.expiry_date,
                          )}
                        </Text>
                      </View>

                      <Text style={styles.inventoryEntryDocument}>
                        {entry.document_no || 'No document number'}
                      </Text>

                      <View style={styles.inventoryEntryMetaRow}>
                        <Text style={[styles.inventoryEntryMetaText, editTheme.invMeta]}>
                          Qty: {Number(entry.quantity ?? entry.remaining_quantity ?? 0)}
                        </Text>
                        <Text style={[styles.inventoryEntryMetaText, editTheme.invMeta]}>
                          Remaining: {Number(entry.remaining_quantity ?? 0)}
                        </Text>
                      </View>

                      <View style={styles.inventoryEntryMetaRow}>
                        <Text style={[styles.inventoryEntryMetaText, editTheme.invMeta]}>
                          Lot: {entry.lot_no || '-'}
                        </Text>
                        <Text style={[styles.inventoryEntryMetaText, editTheme.invMeta]}>
                          Location: {entry.location_name || '-'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.inventoryEntriesStateWrap}>
                    <Text style={[styles.inventoryEntriesStateText, editTheme.invStateText]}>
                      No ledger entries found.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      <ItemUnitOfMeasureModal
        visible={uomModalVisible && visible}
        onClose={() => setUomModalVisible(false)}
        itemNo={editedItem?.no ?? ''}
        itemName={editedItem?.item_name}
        canEdit={canEdit}
        onChanged={() => {
          if (editedItem?.no) {
            loadItemUomCount(editedItem.no);
          }
        }}
      />
      <ItemCategoryFormModal
        visible={categoryFormVisible && visible}
        onClose={() => setCategoryFormVisible(false)}
        category={null}
        onSave={() => {
          void loadCategories();
        }}
        onRecordChange={record => {
          if (record?.code) {
            setPickerSelectedCode(String(record.code));
          }
          void loadCategories();
        }}
        canCreate={canCreateCategory(CATEGORY_PAGE_NAME)}
        canEdit={canEditCategory(CATEGORY_PAGE_NAME)}
        categories={categoryRecords}
      />
    </>
  );
};

const Items = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { selectedTab, setSelectedTab } = useTabContext();
  const appCtx = useAppContext();
  const canSeeBuyingPriceUi =
    appCtx?.auth?.userPermissions?.canSeeBuyingPrice !== false;
  const { canRead, canCreate, canEdit, canDelete } = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEMS;
  const isAllServicesScreen = route.name === 'AllServices';
  const defaultCreateType: 'Inventory' | 'Service' = isAllServicesScreen
    ? 'Service'
    : 'Inventory';

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createDraftItem, setCreateDraftItem] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState < Item | null > (null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | string | null>(null);
  const [stockFilter, setStockFilter] = useState <
    'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  > ('all');
  const invalidateItems = useInvalidateItems();
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useCategoriesQuery();
  const {
    items,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    refetch: refetchItems,
    fetchNextPage,
  } = useItemsQuery({
    searchQuery: debouncedSearchQuery,
    categoryId: selectedCategory,
    stockFilter,
    servicesOnly: isAllServicesScreen,
  });

  const screenTitle = useMemo(() => {
    if (isAllServicesScreen) {
      return 'All services';
    }
    if (stockFilter === 'low_stock') {
      return 'Low stock items';
    }
    if (stockFilter === 'out_of_stock') {
      return 'Out of stock';
    }
    if (stockFilter === 'in_stock') {
      return 'In stock items';
    }
    return 'All items';
  }, [isAllServicesScreen, stockFilter]);

  const formatAmountWithCommas = (value: number | string | undefined | null) => {
    const numericValue =
      typeof value === 'number' ? value : parseFloat(String(value || 0));
    if (!Number.isFinite(numericValue)) {
      return '0';
    }
    return numericValue.toLocaleString('en-US');
  };

  useEffect(() => {
    setSearchLoading(true);
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setSearchLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      const incomingSearch = route.params?.initialSearch as string | undefined;
      if (typeof incomingSearch === 'string' && incomingSearch.trim()) {
        setSearchQuery(incomingSearch);
        setDebouncedSearchQuery(incomingSearch);
        navigation.setParams({initialSearch: undefined} as never);
      }
      const incoming = route.params?.stockFilter as
        | 'all'
        | 'in_stock'
        | 'low_stock'
        | 'out_of_stock'
        | undefined;
      if (
        incoming &&
        ['all', 'in_stock', 'low_stock', 'out_of_stock'].includes(incoming)
      ) {
        setStockFilter(incoming);
        navigation.setParams({ stockFilter: undefined } as never);
      }
    }, [navigation, route.params?.stockFilter, route.params?.initialSearch]),
  );

  const reopenItemFromPicker = useCallback(
    (
      reopenMode: 'create' | 'edit',
      incomingDraft: Item | null | undefined,
      categoryCode: string | null | undefined,
    ) => {
      const resolvedCategoryValue =
        categoryCode === undefined
          ? incomingDraft?.category_id
          : categoryCode === null || categoryCode === ''
            ? null
            : (categories.find(cat => cat.code === categoryCode)?.id ??
                categories.find(cat => cat.code === categoryCode)?.code ??
                categoryCode);

      const nextDraft =
        incomingDraft != null
          ? {
              ...incomingDraft,
              category_id: resolvedCategoryValue,
            }
          : createEmptyItemDraft(defaultCreateType);

      if (reopenMode === 'create') {
        setEditModal(false);
        setSelectedItem(null);
        setCreateDraftItem(nextDraft);
        setCreateModal(true);
      } else {
        setCreateModal(false);
        setCreateDraftItem(null);
        setSelectedItem(nextDraft);
        setEditModal(true);
      }
    },
    [categories, defaultCreateType],
  );

  useEffect(() => {
    const pending = consumeCategoryPickerSession();
    if (pending) {
      reopenItemFromPicker(
        pending.mode,
        (pending.draft as Item | null | undefined) ?? null,
        pending.categoryCode,
      );
    }
    return subscribeCategoryPickerResult(result => {
      reopenItemFromPicker(
        result.mode,
        (result.draft as Item | null | undefined) ?? null,
        result.categoryCode,
      );
    });
  }, [reopenItemFromPicker]);

  useEffect(() => {
    const reopenMode = route.params?.reopenItemModal as 'create' | 'edit' | undefined;
    if (!reopenMode) {
      return;
    }

    const incomingDraft = (route.params?.itemDraft as Item | null | undefined) ?? null;
    const categoryCode = route.params?.categoryPick?.code as string | null | undefined;
    reopenItemFromPicker(reopenMode, incomingDraft, categoryCode);

    navigation.setParams({
      reopenItemModal: undefined,
      itemDraft: undefined,
      categoryPick: undefined,
    } as never);
  }, [
    route.params?.reopenItemModal,
    route.params?.itemDraft,
    route.params?.categoryPick,
    navigation,
    reopenItemFromPicker,
  ]);

  const reloadItems = useCallback(async () => {
    await invalidateItems();
    await refetchItems();
  }, [invalidateItems, refetchItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchItems(), refetchCategories()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setSearchLoading(true);
  };

  const handleApplyFilter = () => {
    setFilterModal(false);
  };

  const handleClearFilter = () => {
    setSelectedCategory(null);
    setStockFilter('all');
    setFilterModal(false);
  };

  const hasActiveFilters = selectedCategory !== null || stockFilter !== 'all';

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (stockFilter === 'low_stock') {
      parts.push('Low stock');
    } else if (stockFilter === 'out_of_stock') {
      parts.push('Out of stock');
    } else if (stockFilter === 'in_stock') {
      parts.push('In stock');
    }
    if (selectedCategory !== null) {
      const cat = categories.find(c => c.id === selectedCategory);
      parts.push(cat?.name ? `Category: ${cat.name}` : 'Category filter');
    }
    if (searchQuery.trim()) {
      parts.push(`Search: "${searchQuery.trim()}"`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'All items';
  }, [stockFilter, selectedCategory, categories, searchQuery]);

  const handleLoadMore = () => {
    if (
      loading ||
      loadingMore ||
      refreshing ||
      !hasNextPage ||
      items.length === 0
    ) {
      return;
    }

    fetchNextPage();
  };

  const handleCreateItem = () => {
    if (!canCreate(PAGE_NAME)) {
      Alert.alert(
        'Access Denied',
        'You do not have permission to create items.',
      );
      return;
    }
    // Ensure only one form modal is open at a time.
    setEditModal(false);
    setSelectedItem(null);
    setCreateDraftItem(createEmptyItemDraft(defaultCreateType));
    setCreateModal(true);
  };

  const handleEditItem = (item: Item) => {
    console.log('handleEditItem called with:', item);
    if (!item || (!item.id && !item.no)) {
      console.warn('Invalid item data for editing - missing id or no field');
      return;
    }
    console.log('Setting selectedItem and opening modal');
    // Ensure only one form modal is open at a time.
    setCreateModal(false);
    setSelectedItem(item);
    setEditModal(true);
  };

  const formatItemPrice = (value: number | string | undefined | null) =>
    formatCurrencyCompact(value);

  const getItemInitials = (name?: string) => {
    const words = (name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return 'IT';
    }

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  const renderItemCard = ({ item }: { item: Item }) => {
    const initials = getItemInitials(item?.item_name);
    return (
      <TouchableOpacity
        style={[styles.itemCard, { borderBottomColor: colors.border }]}
        activeOpacity={0.7}
        disabled={!canEdit(PAGE_NAME)}
        onPress={() => canEdit(PAGE_NAME) && handleEditItem(item)}>
        <View
          style={[
            styles.itemImageContainer,
            { backgroundColor: colors.screenMuted },
          ]}>
          {item?.item_images &&
            item.item_images.length > 0 &&
            item.item_images[0]?.url ? (
            <Image
              source={{ uri: item.item_images[0].url }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: colors.screenMuted },
              ]}>
              <Text style={[styles.itemInitials, { color: colors.textSecondary }]}>
                {initials}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemInfo}>
          <View style={styles.itemTopRow}>
            <Text
              style={[styles.itemName, { color: colors.textPrimary }]}
              numberOfLines={1}>
              {item?.item_name || 'Unnamed Item'}
            </Text>
            <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>
              {formatItemPrice(item?.unit_price)}
            </Text>
          </View>
          {item?.bar_code_no?.trim() ? (
            <Text
              style={[styles.itemBarcodeMeta, {color: colors.textSecondary}]}
              numberOfLines={1}>
              Barcode: {item.bar_code_no.trim()}
            </Text>
          ) : null}
          {canSeeBuyingPriceUi && Number(item?.unit_cost) > 0 ? (
            <Text
              style={[styles.itemBarcodeMeta, {color: colors.textSecondary}]}
              numberOfLines={1}>
              Cost: {formatItemPrice(item.unit_cost)}
            </Text>
          ) : null}
          {stockFilter !== 'all' && item?.type !== 'Service' && item?.type !== 'Non-Inventory' ? (
            <Text
              style={[
                styles.itemStockMeta,
                {
                  color:
                    stockFilter === 'low_stock' ? COLORS.error : colors.textSecondary,
                },
              ]}
              numberOfLines={1}>
              Qty {Math.max(0, Math.floor(Number(item?.inventory) || 0))}
              {item?.minimum_stock != null && item.minimum_stock > 0
                ? ` · Min ${item.minimum_stock}`
                : ''}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const handleItemDelete = async (itemToDelete: Item) => {
    if (!canDelete(PAGE_NAME)) {
      Alert.alert('Access Denied', 'You do not have permission to delete items.');
      return;
    }

    const itemId = itemToDelete.id || itemToDelete.no;
    if (!itemToDelete.system_id && !itemId) {
      Alert.alert('Error', 'Cannot delete item: missing item identifier.');
      return;
    }

    try {
      const response = await deleteItem(itemToDelete);
      if (response.status === 200) {
        Toast.hide();
        Toast.show({
          type: 'success',
          text1: 'Item deleted',
          text2: 'The item has been removed from your catalog.',
        });
        setEditModal(false);
        setSelectedItem(null);
        reloadItems();
      } else {
        Alert.alert(
          'Cannot delete item',
          getApiErrorMessage(response?.data, {
            itemName: itemToDelete.item_name,
            fallback:
              'This item could not be deleted. It may have stock or sales/purchase history.',
          }),
        );
      }
    } catch (error: any) {
      console.error('Error deleting item:', error);
      Toast.hide();
      Alert.alert(
        'Cannot delete item',
        getApiErrorMessage(error, {
          itemName: itemToDelete.item_name,
          fallback:
            'This item could not be deleted. It may have stock or sales/purchase history.',
        }),
      );
    }
  };

  const handleItemSave = (savedItem: Item) => {
    setSelectedItem(savedItem);
    reloadItems();
  };

  const handleCreateSave = (savedItem: Item) => {
    setCreateDraftItem(savedItem);
    reloadItems();
  };

  const onSelectMainTab = (tab: string) => {
    setSelectedTab(tab);
    navigation.navigate('Home' as never);
  };

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view items.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.allItemsHeader,
          {
            paddingTop: Math.max(insets.top, 10),
            backgroundColor: colors.background,
          },
        ]}>
        <QuickIconPressable
          style={[
            styles.headerRoundButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          onPress={() => safeGoBack(navigation, 'Home')}
          accessibilityLabel="Go back">
          <Image
            source={icons.back as any}
            style={[styles.headerRoundIcon, { tintColor: colors.textPrimary }]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.allItemsTitle, { color: colors.textPrimary }]}>
          {screenTitle}
        </Text>
        <View style={styles.headerTrailing}>
          {canCreate(PAGE_NAME) ? (
            <TouchableOpacity
              onPress={handleCreateItem}
              style={styles.headerActionButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add item">
              <Image
                source={icons.plus as any}
                style={styles.headerActionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerTrailingSpacer} />
          )}
        </View>
      </View>

      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.background },
        ]}>
        <View
          style={[
            styles.searchPill,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.border,
            },
          ]}>
          <Image
            source={icons.search as any}
            style={[styles.searchIcon, { tintColor: colors.iconMuted }]}
            resizeMode="contain"
          />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading ? (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.filterInlineHit}
            onPress={() => setFilterModal(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Filter items">
            <Image
              source={icons.filter as any}
              style={[
                styles.filterIconInline,
                { tintColor: hasActiveFilters ? COLORS.primary2 : colors.iconMuted },
              ]}
              resizeMode="contain"
            />
            {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      {hasActiveFilters ? (
        <View
          style={[
            styles.filterSummaryRow,
            { backgroundColor: colors.screenMuted },
          ]}>
          <Text style={[styles.filterSummaryLabel, { color: colors.textSecondary }]}>
            Active filters:
          </Text>
          <Text style={[styles.filterSummaryValue, { color: colors.textPrimary }]}>
            {activeFilterLabel}
          </Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading items...
          </Text>
        </View>
      ) : (
        <View style={styles.listFlex}>
          <FlatList
            style={styles.listFlex}
            data={items || []}
            renderItem={renderItemCard}
            keyExtractor={item =>
              item?.id?.toString() ||
              item?.no ||
              item?.system_id ||
              Math.random().toString()
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={
              (items?.length || 0) === 0 ? styles.listEmptyGrow : undefined
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.listFooterLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconContainer,
                    { backgroundColor: colors.screenMuted },
                  ]}
                  accessibilityRole="image"
                  accessibilityLabel="No items">
                  {searchQuery.trim() ? (
                    <Text style={styles.emptyEmojiLarge}>🔍</Text>
                  ) : (
                    <Image
                      source={icons.product as any}
                      style={[
                        styles.emptyStateIcon,
                        { tintColor: colors.iconMuted },
                      ]}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No items found
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : stockFilter === 'low_stock'
                      ? 'No low stock items right now. Set minimum stock levels on inventory items to track them.'
                      : canCreate(PAGE_NAME)
                        ? 'Create your first item to get started.'
                        : 'No items available at the moment'}
                </Text>
                {canCreate(PAGE_NAME) && !searchQuery ? (
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={handleCreateItem}>
                    <Text style={styles.emptyButtonText}>Create Item</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
          />
        </View>
      )}

      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectMainTab}
      />

      {/* Create Item Modal */}
      <EditItemModal
        visible={createModal}
        onClose={() => {
          if (isPickingCategory()) {
            setCreateModal(false);
            return;
          }
          setCreateModal(false);
          setCreateDraftItem(null);
          setSelectedItem(null);
          reloadItems();
        }}
        item={createDraftItem}
        onSave={handleCreateSave}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
        mode="create"
        defaultCreateType={defaultCreateType}
        allowInventoryType={!isAllServicesScreen}
      />

      {/* Edit Item Modal */}
      <EditItemModal
        visible={editModal}
        onClose={() => {
          if (isPickingCategory()) {
            setEditModal(false);
            return;
          }
          setEditModal(false);
          setSelectedItem(null);
          reloadItems();
        }}
        item={selectedItem}
        onSave={handleItemSave}
        onDelete={handleItemDelete}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
      />

      {/* Filter Modal */}
      <Modal
        visible={filterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModal(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Items</Text>
              <TouchableOpacity
                onPress={() => setFilterModal(false)}
                style={styles.filterCloseButton}
                activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
                hitSlop={ICON_BUTTON_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Close filters">
                <Text style={styles.filterCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScrollView}>
              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Category</Text>
                <View style={styles.pickerContainer}>
                  {categoriesLoading ? (
                    <View style={styles.categoryLoadingContainer}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.categoryLoadingText}>
                        Loading categories...
                      </Text>
                    </View>
                  ) : (
                    <Picker
                      selectedValue={selectedCategory || 0}
                      onValueChange={value =>
                        setSelectedCategory(value === 0 ? null : value)
                      }
                      style={styles.picker}>
                      <Picker.Item label="All Categories" value={0} />
                      {categories?.map(category => (
                        <Picker.Item
                          key={category.id}
                          label={category.name}
                          value={category.id}
                        />
                      ))}
                    </Picker>
                  )}
                </View>
              </View>

              {/* Stock Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Stock Status</Text>
                <View style={styles.stockFilterContainer}>
                  {[
                    { value: 'all', label: 'All Items' },
                    { value: 'in_stock', label: 'In Stock' },
                    { value: 'low_stock', label: 'Low Stock' },
                    { value: 'out_of_stock', label: 'Out of Stock' },
                  ].map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.stockFilterButton,
                        stockFilter === option.value &&
                        styles.stockFilterButtonActive,
                      ]}
                      onPress={() => setStockFilter(option.value as any)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.stockFilterText,
                          stockFilter === option.value &&
                          styles.stockFilterTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Filter Actions */}
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.filterActionButton, styles.clearFilterButton]}
                onPress={handleClearFilter}
                activeOpacity={0.7}>
                <Text style={styles.clearFilterText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterActionButton, styles.applyFilterButton]}
                onPress={handleApplyFilter}
                activeOpacity={0.7}>
                <Text style={styles.applyFilterText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debug info */}
      {/* {__DEV__ && (
        <View
          style={{
            position: 'absolute',
            top: 100,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 10,
            borderRadius: 5,
          }}>
          <Text style={{color: 'white', fontSize: 10}}>
            editModal: {editModal.toString()}
          </Text>
          <Text style={{color: 'white', fontSize: 10}}>
            selectedItem: {selectedItem ? 'yes' : 'no'}
          </Text>
        </View>
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  allItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 10,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRoundIcon: {
    width: 20,
    height: 20,
  },
  allItemsTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailing: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    margin: SIZES.base * 2,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base * 1.5,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 12,
    minHeight: 48,
  },
  filterInlineHit: {
    position: 'relative',
    padding: 8,
    marginRight: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIconInline: {
    width: 20,
    height: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  listFlex: {
    flex: 1,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  listFooterLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
    marginHorizontal: SIZES.padding,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemImageContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: COLORS.lightGray2,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInitials: {
    ...FONTS.body3,
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemName: {
    ...FONTS.h3,
    flex: 1,
    marginRight: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  itemPrice: {
    ...FONTS.body3,
    fontWeight: '600',
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
    paddingHorizontal: SIZES.padding,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyStateIcon: {
    width: 40,
    height: 40,
  },
  emptyEmojiLarge: {
    fontSize: 40,
    lineHeight: 44,
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 250,
  },
  emptyButton: {
    marginTop: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SIZES.padding,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.white,
  },
  pageButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray1,
  },
  pageButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 13,
  },
  disabledButtonText: {
    ...FONTS.button,
    color: COLORS.gray3,
    fontSize: 13,
  },
  pageInfoContainer: {
    paddingHorizontal: SIZES.base * 2,
  },
  pageInfo: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  editItemModalRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  editItemModalFlex: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  editItemLoadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  editItemLoadingText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    marginTop: SIZES.base * 1.5,
  },
  editItemLoadingClose: {
    marginTop: SIZES.padding * 2,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  editItemLoadingCloseText: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  editItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.white,
  },
  editItemHeaderSide: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editItemHeaderSideEnd: {
    justifyContent: 'flex-end',
  },
  editItemHeaderSpacer: {
    width: 72,
    height: 36,
  },
  editItemCloseCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editItemCloseIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.black,
  },
  editItemHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
  editItemSavePill: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  editItemDonePill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    minWidth: 72,
    alignItems: 'center',
  },
  editItemDonePillText: {
    ...FONTS.body4,
    fontWeight: '600',
    color: COLORS.white,
    fontSize: 15,
  },
  editItemPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
  },
  editItemPickerCheck: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  editItemPickerRowTitle: {
    ...FONTS.body3,
    fontSize: 16,
    flex: 1,
  },
  editItemPickerCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 4,
  },
  editItemPickerCreatePlus: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  editItemPickerCreateLabel: {
    ...FONTS.body3,
    fontSize: 16,
  },
  editItemSavePillText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '600',
    fontSize: 15,
  },
  modalScrollView: {
    flex: 1,
    flexGrow: 1,
  },
  editItemScrollContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 1.25,
  },
  editItemAutoSaveHint: {
    ...FONTS.body5,
    marginBottom: 12,
  },
  editItemFieldError: {
    ...FONTS.body5,
    color: COLORS.error,
    marginTop: 6,
  },
  editItemFieldHint: {
    ...FONTS.body5,
    marginTop: 6,
    lineHeight: 16,
  },
  squareTileOuter: {
    alignSelf: 'center',
    width: 112,
    height: 112,
    backgroundColor: '#ECECEC',
    borderRadius: 14,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: 6,
    marginBottom: 10,
  },
  squareTileInner: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  /** When showing a photo, inner fills the outer tile so the image can be large and clear. */
  squareTileInnerFilled: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  squareTileImageWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray2,
  },
  squareTileImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.lightGray2,
  },
  squareTileInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  squareTileName: {
    ...FONTS.body4,
    fontSize: 10,
    color: COLORS.gray2,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
  squareChangeImagePill: {
    alignSelf: 'center',
    backgroundColor: '#E8EAED',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 10,
    minWidth: 124,
    alignItems: 'center',
  },
  squareChangeImagePillText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '600',
    fontSize: 13,
  },
  squareRemoveImage: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  squareRemoveImageText: {
    ...FONTS.body5,
    color: COLORS.error,
    fontWeight: '600',
  },
  squareDeleteItemButton: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  squareDeleteItemButtonText: {
    ...FONTS.body4,
    color: COLORS.error,
    fontWeight: '700',
  },
  squareOutlineField: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 18,
    backgroundColor: COLORS.white,
  },
  squareOutlineFieldTall: {
    minHeight: 120,
    paddingBottom: 14,
  },
  squareOutlineLabel: {
    ...FONTS.body5,
    fontSize: 12,
    color: COLORS.gray2,
    fontWeight: '600',
    marginBottom: 6,
  },
  squareOutlineInput: {
    ...FONTS.body3,
    fontSize: 16,
    color: COLORS.black,
    padding: 0,
    margin: 0,
  },
  squareOutlineStaticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  squareOutlineStaticValue: {
    ...FONTS.body3,
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
    marginRight: SIZES.base,
  },
  squareOutlineLinkValue: {
    textDecorationLine: 'underline',
  },
  squareOutlineStaticChevron: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '700',
  },
  editItemFieldHint: {
    ...FONTS.body5,
    fontSize: 12,
    marginTop: 8,
  },
  costSourceActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  costSourceActionPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  costSourceActionPillText: {
    ...FONTS.body4,
    fontSize: 14,
    fontWeight: '600',
  },
  inventoryEntriesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.32)',
    justifyContent: 'flex-end',
  },
  inventoryEntriesSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  inventoryEntriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inventoryEntriesHeaderTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  inventoryEntriesTitle: {
    ...FONTS.h2,
    color: COLORS.black,
    fontWeight: '700',
  },
  inventoryEntriesSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: 4,
  },
  inventoryEntriesCloseButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.lightGray2,
  },
  inventoryEntriesCloseText: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '600',
  },
  inventoryEntriesSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inventoryEntriesSummaryLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginBottom: 6,
  },
  inventoryEntriesSummaryValue: {
    ...FONTS.h1,
    color: COLORS.black,
    fontWeight: '700',
  },
  inventoryEntriesList: {
    flexGrow: 0,
  },
  inventoryEntriesStateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryEntriesStateText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: 10,
    textAlign: 'center',
  },
  inventoryEntriesErrorText: {
    ...FONTS.body4,
    color: COLORS.error,
    textAlign: 'center',
  },
  inventoryEntryCard: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  inventoryEntryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inventoryEntryType: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '700',
  },
  inventoryEntryDate: {
    ...FONTS.body5,
    color: COLORS.gray2,
  },
  inventoryEntryDocument: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
    marginBottom: 10,
  },
  inventoryEntryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  inventoryEntryMetaText: {
    ...FONTS.body5,
    color: COLORS.gray2,
    flex: 1,
  },
  squareOutlineMultiline: {
    minHeight: 72,
    paddingTop: 4,
  },
  squareSettingsChevron: {
    width: 14,
    height: 14,
    tintColor: COLORS.gray3,
    transform: [{ rotate: '-90deg' }],
  },
  editItemThickBar: {
    height: 8,
    backgroundColor: '#EBEBEB',
    borderRadius: 2,
    marginVertical: 22,
    marginHorizontal: -SIZES.padding,
  },
  editItemSectionHeading: {
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  editItemCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  editItemFolderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  editItemFolderIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.gray2,
  },
  editItemCategoryRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  editItemCategoryRowTitle: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  editItemCategoryRowSubtitle: {
    ...FONTS.body4,
    fontSize: 14,
    color: COLORS.gray2,
    marginTop: 4,
  },
  editItemOptionsCopy: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.gray2,
    marginBottom: 10,
  },
  itemTypeChipRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  itemTypeChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTypeChipText: {
    ...FONTS.body3,
    fontSize: 15,
    fontWeight: '600',
  },
  editItemLearnMore: {
    ...FONTS.body4,
    fontSize: 15,
    color: COLORS.black,
    textDecorationLine: 'underline',
    fontWeight: '500',
    marginBottom: 18,
  },
  editItemAddOptionsPill: {
    alignSelf: 'stretch',
    backgroundColor: '#E8EAED',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 4,
  },
  editItemAddOptionsPillText: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  squarePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  squarePricePrefix: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary2,
    marginRight: 8,
  },
  squarePriceInput: {
    flex: 1,
    ...FONTS.body3,
    fontSize: 16,
    color: COLORS.black,
    padding: 0,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: SIZES.padding,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  productImageLarge: {
    width: 130,
    height: 130,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 1.5,
    borderWidth: 2,
    borderColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
  },
  imagePickerButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 1.5,
    minHeight: 48,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: SIZES.base * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  imageButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  deleteImageButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SIZES.base * 1.5,
    minHeight: 48,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: SIZES.base * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  // Gallery styles
  galleryContainer: {
    flex: 1,
    padding: 10,
  },
  galleryInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  galleryItem: {
    width: '32%',
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedGalleryItem: {
    borderColor: '#005151',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyGallery: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyGalleryText: {
    fontSize: 16,
    color: '#666',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadMoreText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  label: {
    ...FONTS.h4,
    color: COLORS.black,
    marginBottom: SIZES.base,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 1.5,
    ...FONTS.body3,
    color: COLORS.black,
    marginBottom: SIZES.base * 2,
    backgroundColor: '#F8FAFC',
    minHeight: 48,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 1.5,
    minHeight: 48,
  },
  pricePrefix: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: SIZES.base,
  },
  priceInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
    paddingVertical: SIZES.base * 1.5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    marginBottom: SIZES.base * 2,
    backgroundColor: '#F8FAFC',
    // Picker dropdown can extend beyond the container bounds on Android.
    // If we clip it, the dropdown can appear as a black block.
    overflow: 'visible',
  },
  picker: {
    height: 50,
    color: COLORS.black,
  },
  pickerItem: {
    color: COLORS.black,
  },
  categoryPickerButton: {
    height: 50,
    paddingHorizontal: SIZES.base * 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPickerButtonText: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
    marginRight: SIZES.base,
  },
  categoryPickerButtonPlaceholder: {
    color: COLORS.gray3,
  },
  categoryPickerArrow: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  categoryPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.base * 2,
  },
  categoryPickerModalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    maxHeight: 320,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  categoryPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  categoryPickerModalTitle: {
    ...FONTS.h3,
    color: COLORS.black,
  },
  categoryPickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPickerCloseIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  categoryPickerModalList: {
    maxHeight: 240,
  },
  categoryPickerModalItem: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryPickerModalItemText: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
    marginRight: SIZES.base,
  },
  categoryPickerModalItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoryPickerCheckIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base * 1.5,
    paddingBottom: SIZES.base * 2,
    gap: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
    flexShrink: 0,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  imageActionButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '700',
  },
  cancelButtonText: {
    ...FONTS.button,
    color: COLORS.gray2,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
    minHeight: 200,
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    marginTop: SIZES.base * 1.5,
  },
  categoryLoadingContainer: {
    paddingVertical: SIZES.base * 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLoadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: SIZES.base,
  },
  searchLoadingContainer: {
    marginLeft: SIZES.base,
  },
  uploadLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorContainer: {
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
    marginBottom: SIZES.base * 2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base * 1.5,
  },
  errorIcon: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    ...FONTS.h4,
    color: COLORS.error,
    marginBottom: SIZES.base * 0.25,
  },
  errorText: {
    ...FONTS.body4,
    color: COLORS.error,
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay2,
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '80%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  filterModalTitle: {
    ...FONTS.h2,
    color: COLORS.black,
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCloseIcon: {
    fontSize: 18,
    color: COLORS.gray2,
    fontWeight: 'bold',
  },
  filterScrollView: {
    maxHeight: 400,
  },
  filterSection: {
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  filterLabel: {
    ...FONTS.h4,
    color: COLORS.black,
    marginBottom: SIZES.base * 1.5,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base / 2,
  },
  filterSummaryLabel: {
    ...FONTS.body5,
    fontSize: 12,
    marginRight: 4,
  },
  filterSummaryValue: {
    ...FONTS.body4,
    fontSize: 12,
    flex: 1,
  },
  itemBarcodeMeta: {
    ...FONTS.body5,
    fontSize: 12,
    marginTop: 4,
  },
  itemStockMeta: {
    ...FONTS.body5,
    fontSize: 12,
    marginTop: 2,
  },
  stockFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.base,
  },
  stockFilterButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  stockFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stockFilterText: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  stockFilterTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    padding: SIZES.base * 2,
    gap: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  filterActionButton: {
    flex: 1,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFilterButton: {
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  applyFilterButton: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearFilterText: {
    ...FONTS.button,
    color: COLORS.gray2,
    fontSize: 15,
  },
  applyFilterText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
  },
});

export default Items;
