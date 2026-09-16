import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../utils/currency';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_HIT_SLOP,
  ICON_BUTTON_QUICK_PRESS,
} from '../constants';
import {QuickIconPressable} from './QuickIconPressable';
import ChooseActionSheet, {type ChooseActionItem} from './ChooseActionSheet';
import {
  fetchCategories,
  ItemCategory,
} from '../services/app.services';
import {cacheItemsLocally, listItems} from '../services/itemCatalogService';
import {
  loadFavoriteGridSlots,
  saveFavoriteGridSlots,
} from '../services/salesFavoritesStorage';
import {
  buildFavoriteGridFromApi,
  FAVORITE_API_MIN_SLOTS,
  FAVORITE_DEFAULT_VISIBLE_SLOTS,
  fetchSalesFavorites,
  normalizeFavoriteGridForGrowth,
  putSalesFavorites,
} from '../services/salesFavoritesApi';
import type {CartItem} from '../@types/types.dto';
import {useTheme} from '../context/ThemeContext';
import {
  applySoldQuantitiesToItem,
  buildSoldQuantityMaps,
  isPosItemOutOfStock,
  mergeCatalogInventoryIntoFavorites,
  posItemStockLabel,
} from '../utils/posItemStock';
import {isWideLayout, posCatalogColumnCount} from '../utils/layout';

type BrowseTab = 'pos' | 'favorites';

type SalesCategory = {
  id: string | number;
  code: string;
  name: string;
  initials: string;
};

type PaginatedItemsResponse = {
  count?: number;
  next?: string | null;
  results?: CartItem[];
};

type LibraryPosItemRowProps = {
  item: CartItem;
  isRecentlyAdded: boolean;
  isOutOfStock: boolean;
  onAdd: (item: CartItem) => void;
  theme: {
    listRow: object;
    disabledRow: object;
    rowSub: object;
    rowSubDis: object;
  };
};

type LibraryPosItemTileProps = {
  item: CartItem;
  isRecentlyAdded: boolean;
  isOutOfStock: boolean;
  onAdd: (item: CartItem) => void;
  theme: {
    tile: object;
    tileActive: object;
    name: object;
    meta: object;
  };
};

/** Assigned after `styles` (below) so the row can use shared `StyleSheet` styles. */
let LibraryPosItemRow: React.MemoExoticComponent<
  React.FC<LibraryPosItemRowProps>
>;
let LibraryPosItemTile: React.MemoExoticComponent<
  React.FC<LibraryPosItemTileProps>
>;

type Props = {
  onAddItem: (item: CartItem) => void;
  onScanPress?: () => void;
  showScanButton?: boolean;
  hideSearchBar?: boolean;
  /** From Add to Favorites — open All Items create flow (inventory item). */
  onOpenCreateItem?: () => void;
  /** From Add to Favorites — open All Items create flow preset as service. */
  onOpenCreateService?: () => void;
  /** Increment after a posted sale so POS stock reloads. */
  catalogRefreshKey?: number;
  /** Cart lines from the sale that just posted — used to drop stock immediately. */
  soldItemsForStockRefresh?: CartItem[];
  /** POS / tablet layout: product tiles instead of a list. */
  preferGrid?: boolean;
};

const TAB_OPTIONS: Array<{id: BrowseTab; label: string}> = [
  {id: 'pos', label: 'POS'},
  {id: 'favorites', label: 'Favorites'},
];
const SEARCH_FILTER_OPTIONS: Array<{
  id: 'items' | 'services' | 'discounts' | 'categories';
  label: string;
}> = [
  {id: 'items', label: 'Items'},
  {id: 'services', label: 'Services'},
  {id: 'discounts', label: 'Discounts'},
  {id: 'categories', label: 'Categories'},
];

const getInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

const formatMoney = (value: number | string | undefined | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return formatCurrencyCompact(0);
  }

  return formatCurrencyCompact(parsed);
};

const SalesItemBrowser: React.FC<Props> = ({
  onAddItem,
  onScanPress,
  showScanButton = false,
  hideSearchBar = false,
  onOpenCreateItem,
  onOpenCreateService,
  catalogRefreshKey = 0,
  soldItemsForStockRefresh = [],
  preferGrid = false,
}) => {
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<BrowseTab>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<SalesCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | number | null
  >(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cachedItems, setCachedItems] = useState<Record<string, CartItem>>({});
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Record<string, boolean>>(
    {},
  );
  const [isSearchPanelVisible, setIsSearchPanelVisible] = useState(false);
  const [selectedSearchFilter, setSelectedSearchFilter] = useState<
    'items' | 'services' | 'discounts' | 'categories'
  >('items');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoriesLoadError, setCategoriesLoadError] = useState(false);
  const [itemsLoadError, setItemsLoadError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const libraryListRef = useRef<FlatList<CartItem>>(null);
  const addedTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Skip one debounced `loadItems` after add-from-search (avoids a slow refetch right when the cart updates). */
  const skipNextLibraryFetchRef = useRef(false);
  /** Bumps on each replace fetch so slower older responses cannot overwrite newer search results. */
  const loadItemsRequestIdRef = useRef(0);

  const [favoriteSlots, setFavoriteSlots] = useState<(CartItem | null)[]>(() =>
    Array.from({length: FAVORITE_DEFAULT_VISIBLE_SLOTS}, () => null),
  );
  const favoritesHydratedRef = useRef(false);
  /** Skip one debounced PUT after hydrating from GET or AsyncStorage (avoid useless round-trip). */
  const skipNextFavoritePutRef = useRef(true);
  const addFavoriteTargetSlotRef = useRef<number | null>(null);
  const [favoritesSyncError, setFavoritesSyncError] = useState<string | null>(null);

  const [addFavoriteModalVisible, setAddFavoriteModalVisible] = useState(false);
  const [favoriteActionIndex, setFavoriteActionIndex] = useState<number | null>(
    null,
  );
  const [addFavoriteSearchQuery, setAddFavoriteSearchQuery] = useState('');
  const [addFavoriteResults, setAddFavoriteResults] = useState<CartItem[]>([]);
  const [addFavoriteLoading, setAddFavoriteLoading] = useState(false);
  const [catalogLayoutOverride, setCatalogLayoutOverride] = useState<
    'grid' | 'list' | null
  >(null);

  const selectedCategory = useMemo(
    () =>
      categories.find(category => String(category.id) === String(selectedCategoryId)) ??
      null,
    [categories, selectedCategoryId],
  );

  const {colors, isDark} = useTheme();
  const bt = useMemo(
    () => ({
      container: {backgroundColor: colors.background},
      tabsWrap: {backgroundColor: colors.screenMuted},
      tabActive: {backgroundColor: colors.surface},
      tabText: {color: colors.textSecondary},
      tabTextActive: {color: colors.textPrimary},
      searchWrap: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
      },
      searchWrapActive: {borderColor: colors.textPrimary},
      searchIcon: {tintColor: colors.iconMuted},
      searchBackIcon: {tintColor: colors.textPrimary},
      searchInput: {color: colors.textPrimary},
      searchClearIcon: {tintColor: colors.iconMuted},
      bodyCard: {backgroundColor: colors.surface},
      searchPanel: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      panelHeading: {color: colors.textSecondary},
      filterChip: {backgroundColor: colors.inputBackground},
      filterChipActive: {backgroundColor: colors.border},
      filterChipText: {color: colors.textPrimary},
      filterChipTextActive: {color: colors.textPrimary},
      panelSub: {color: colors.textSecondary},
      searchRecentBorder: {borderBottomColor: colors.border},
      searchRecentTitle: {color: colors.textPrimary},
      searchRecentBadge: {backgroundColor: colors.inputBackground},
      searchRecentBadgeText: {color: colors.textSecondary},
      searchRecentIcon: {tintColor: colors.iconMuted},
      searchEmpty: {color: colors.textSecondary},
      barFilterChip: {backgroundColor: colors.inputBackground},
      barFilterChipText: {color: colors.textPrimary},
      barFilterRemove: {tintColor: colors.iconMuted},
      searchResultRow: {borderBottomColor: colors.border},
      searchResultTile: {backgroundColor: colors.inputBackground},
      searchResultTileDis: {backgroundColor: colors.border},
      searchResultInitials: {color: colors.textSecondary},
      searchResultName: {color: colors.textPrimary},
      searchResultNameDis: {color: colors.textTertiary},
      searchResultPrice: {color: colors.textPrimary},
      stateText: {color: colors.textSecondary},
      listRow: {borderBottomColor: colors.border},
      disabledRow: {backgroundColor: colors.screenMuted},
      rowSub: {color: colors.textSecondary},
      rowSubDis: {color: colors.textTertiary},
      catChipBar: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      },
      catChip: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      catChipActive: {
        backgroundColor: isDark ? 'rgba(0, 81, 81, 0.18)' : COLORS.transparentPrimary2,
        borderColor: COLORS.primary2,
      },
      catChipText: {color: colors.textSecondary},
      catChipTextActive: {color: COLORS.primary2},
      layoutToggle: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      layoutToggleActive: {
        backgroundColor: isDark ? 'rgba(0, 81, 81, 0.18)' : COLORS.transparentPrimary2,
        borderColor: COLORS.primary2,
      },
      layoutToggleText: {color: colors.textSecondary},
      layoutToggleTextActive: {color: COLORS.primary2},
      gridTile: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      gridTileActive: {
        backgroundColor: isDark
          ? 'rgba(0, 81, 81, 0.14)'
          : COLORS.transparentPrimary2,
        borderColor: COLORS.primary2,
      },
      gridTileName: {color: colors.textPrimary},
      gridTileMeta: {color: colors.textSecondary},
    }),
    [colors, isDark],
  );

  const defaultCatalogGrid =
    preferGrid || isWideLayout(windowWidth, windowHeight);
  const useProductGrid =
    catalogLayoutOverride != null
      ? catalogLayoutOverride === 'grid'
      : defaultCatalogGrid;
  const catalogColumns = posCatalogColumnCount(windowWidth, windowHeight);

  const libraryRowTheme = useMemo(
    () => ({
      listRow: bt.listRow,
      disabledRow: bt.disabledRow,
      rowSub: bt.rowSub,
      rowSubDis: bt.rowSubDis,
    }),
    [bt],
  );

  const libraryTileTheme = useMemo(
    () => ({
      tile: bt.gridTile,
      tileActive: bt.gridTileActive,
      name: bt.gridTileName,
      meta: bt.gridTileMeta,
    }),
    [bt],
  );

  const recentlyAddedIdsRef = useRef(recentlyAddedIds);
  recentlyAddedIdsRef.current = recentlyAddedIds;
  const cachedItemsRef = useRef(cachedItems);
  cachedItemsRef.current = cachedItems;

  const recentViewedItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const matchesQuery = (item: CartItem) => {
      if (!normalizedQuery) {
        return true;
      }
      return (
        item.item_name?.toLowerCase().includes(normalizedQuery) ||
        item.no?.toLowerCase().includes(normalizedQuery) ||
        item.bar_code_no?.toLowerCase().includes(normalizedQuery)
      );
    };

    const matchesSelectedFilter = (item: CartItem) => {
      const normalizedType = (item.type || '').toLowerCase();
      if (selectedSearchFilter === 'items') {
        return !normalizedType.includes('service') && !normalizedType.includes('discount');
      }
      if (selectedSearchFilter === 'services') {
        return normalizedType.includes('service');
      }
      if (selectedSearchFilter === 'discounts') {
        return normalizedType.includes('discount');
      }
      return true;
    };

    return recentlyViewedIds
      .map(id => cachedItems[id])
      .filter(Boolean)
      .filter(item => matchesQuery(item) && matchesSelectedFilter(item))
      .slice(0, 8);
  }, [cachedItems, recentlyViewedIds, searchQuery, selectedSearchFilter]);

  const filteredCategories = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return categories.slice(0, 8);
    }
    return categories
      .filter(
        category =>
          category.name.toLowerCase().includes(normalizedQuery) ||
          category.code?.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [categories, searchQuery]);

  const mapCategories = (rows: ItemCategory[]) =>
    rows.map((category, index) => {
      const name = category.description || category.code || `Category ${index + 1}`;
      return {
        id: (category as any).id || category.code || `cat_${index}`,
        code: category.code,
        name,
        initials: getInitials(name || category.code || 'CA') || 'CA',
      };
    });

  const loadCategories = useCallback(async () => {
    setCategoriesLoadError(false);
    try {
      setLoadingCategories(true);
      const response = await fetchCategories();
      if (Array.isArray(response)) {
        setCategories(mapCategories(response));
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Error loading sales browser categories:', error);
      setCategoriesLoadError(true);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const mergeCachedItems = useCallback((incomingItems: CartItem[]) => {
    setCachedItems(previous => {
      const next = {...previous};
      incomingItems.forEach(item => {
        next[item.system_id] = item;
      });
      return next;
    });
  }, []);

  const loadItems = useCallback(
    async (
      pageToLoad: number,
      replace: boolean,
      options?: {preserveVisible?: boolean; force?: boolean},
    ) => {
      const shouldBrowseLibrary =
        isSearchPanelVisible || activeTab === 'pos';

      if (!shouldBrowseLibrary && !options?.force) {
        return undefined;
      }

      const requestId = replace
        ? ++loadItemsRequestIdRef.current
        : loadItemsRequestIdRef.current;

      try {
        if (replace) {
          setItemsLoadError(false);
          if (!options?.preserveVisible) {
            setLoadingItems(true);
            // Drop prior catalog/search rows immediately so typed queries never show
            // stale A–Z inventory while the new request is in flight.
            setItems([]);
            setHasNextPage(false);
          }
        } else {
          setLoadingMore(true);
        }

        const response = await listItems({
          page: pageToLoad,
          q: searchQuery,
          categoryId: isSearchPanelVisible
            ? undefined
            : selectedCategoryId
              ? Number(selectedCategoryId) || (selectedCategoryId as any)
              : undefined,
        });

        if (requestId !== loadItemsRequestIdRef.current) {
          return;
        }

        const nextItems = Array.isArray(response?.results) ? response.results : [];
        mergeCachedItems(nextItems);
        setItems(previous => (replace ? nextItems : [...previous, ...nextItems]));
        setCurrentPage(pageToLoad);
        setHasNextPage(Boolean(response?.next));
        return nextItems;
      } catch (error) {
        if (requestId !== loadItemsRequestIdRef.current) {
          return undefined;
        }
        console.error('Error loading sales browser items:', error);
        if (replace && !options?.preserveVisible) {
          setItemsLoadError(true);
          setItems([]);
        }
        setHasNextPage(false);
        return undefined;
      } finally {
        if (requestId === loadItemsRequestIdRef.current) {
          setLoadingItems(false);
          setLoadingMore(false);
        }
      }
    },
    [
      activeTab,
      isSearchPanelVisible,
      mergeCachedItems,
      searchQuery,
      selectedCategoryId,
    ],
  );

  const handleRetryLibrary = useCallback(() => {
    void loadCategories();
    void loadItems(1, true);
  }, [loadCategories, loadItems]);

  const handleCategoryPress = useCallback((categoryId: string | number | null) => {
    setSelectedCategoryId(categoryId);
    setTimeout(() => {
      libraryListRef.current?.scrollToOffset({offset: 0, animated: true});
    }, 80);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (skipNextLibraryFetchRef.current) {
        skipNextLibraryFetchRef.current = false;
        return;
      }
      if (isSearchPanelVisible || activeTab === 'pos') {
        loadItems(1, true);
      }
    }, isSearchPanelVisible ? 120 : 350);

    return () => clearTimeout(timer);
  }, [activeTab, isSearchPanelVisible, searchQuery, selectedCategoryId, loadItems]);

  const soldItemsForStockRefreshRef = useRef(soldItemsForStockRefresh);
  soldItemsForStockRefreshRef.current = soldItemsForStockRefresh;

  useEffect(() => {
    if (!catalogRefreshKey) {
      return;
    }

    const {bySystemId, byNo} = buildSoldQuantityMaps(
      soldItemsForStockRefreshRef.current,
    );
    const patchItem = (item: CartItem) =>
      applySoldQuantitiesToItem(item, bySystemId, byNo);

    if (bySystemId.size || byNo.size) {
      setItems(previous => previous.map(patchItem));
      setCachedItems(previous => {
        const next = {...previous};
        const patched: CartItem[] = [];
        Object.keys(next).forEach(key => {
          const updated = patchItem(next[key]);
          if (updated !== next[key]) {
            patched.push(updated);
          }
          next[key] = updated;
        });
        if (patched.length) {
          cacheItemsLocally(patched);
        }
        return next;
      });
      skipNextFavoritePutRef.current = true;
      setFavoriteSlots(previous =>
        previous.map(cell => (cell ? patchItem(cell) : cell)),
      );
    }

    skipNextLibraryFetchRef.current = false;
    void (async () => {
      const nextItems = await loadItems(1, true, {
        preserveVisible: true,
        force: true,
      });
      if (!nextItems?.length) {
        return;
      }
      skipNextFavoritePutRef.current = true;
      setFavoriteSlots(previous =>
        mergeCatalogInventoryIntoFavorites(previous, nextItems),
      );
    })();
  }, [catalogRefreshKey, loadItems]);

  useEffect(() => {
    if (activeTab !== 'pos') {
      setSelectedCategoryId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      Object.values(addedTimeoutsRef.current).forEach(timeoutId =>
        clearTimeout(timeoutId),
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const apiRes = await fetchSalesFavorites();
        if (cancelled) {
          return;
        }
        const grid = buildFavoriteGridFromApi(apiRes);
        favoritesHydratedRef.current = true;
        skipNextFavoritePutRef.current = true;
        setFavoritesSyncError(null);
        setFavoriteSlots(grid);
        const filled = grid.filter((c): c is CartItem => c != null);
        if (filled.length) {
          mergeCachedItems(filled);
        }
        await saveFavoriteGridSlots(grid);
      } catch {
        if (cancelled) {
          return;
        }
        const slots = await loadFavoriteGridSlots();
        if (cancelled) {
          return;
        }
        favoritesHydratedRef.current = true;
        skipNextFavoritePutRef.current = true;
        setFavoritesSyncError(null);
        setFavoriteSlots(slots);
        const filled = slots.filter((c): c is CartItem => c != null);
        if (filled.length) {
          mergeCachedItems(filled);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergeCachedItems]);

  useEffect(() => {
    if (!favoritesHydratedRef.current) {
      return;
    }

    if (skipNextFavoritePutRef.current) {
      skipNextFavoritePutRef.current = false;
      void saveFavoriteGridSlots(favoriteSlots);
      return;
    }

    const persistTimer = setTimeout(() => {
      void (async () => {
        try {
          await putSalesFavorites(favoriteSlots, FAVORITE_API_MIN_SLOTS);
          setFavoritesSyncError(null);
          await saveFavoriteGridSlots(favoriteSlots);
        } catch (e: unknown) {
          let message = 'Could not sync favorites';
          if (e && typeof e === 'object') {
            const ax = e as {
              message?: string;
              response?: {data?: {detail?: unknown; error?: unknown}};
            };
            const d = ax.response?.data?.detail ?? ax.response?.data?.error;
            if (typeof d === 'string') {
              message = d;
            } else if (Array.isArray(d) && d.length && typeof d[0] === 'string') {
              message = d[0];
            } else if (ax.message) {
              message = ax.message;
            }
          }
          setFavoritesSyncError(message);
          await saveFavoriteGridSlots(favoriteSlots);
        }
      })();
    }, 450);

    return () => clearTimeout(persistTimer);
  }, [favoriteSlots]);

  useEffect(() => {
    if (!addFavoriteModalVisible) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setAddFavoriteLoading(true);
        try {
          const response = await listItems({
            page: 1,
            q: addFavoriteSearchQuery,
          });
          const list = Array.isArray(response?.results) ? response.results : [];
          setAddFavoriteResults(list);
          mergeCachedItems(list);
        } catch {
          setAddFavoriteResults([]);
        } finally {
          setAddFavoriteLoading(false);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [addFavoriteSearchQuery, addFavoriteModalVisible, mergeCachedItems]);

  const openAddFavoriteModal = useCallback((slotIndex: number | null) => {
    addFavoriteTargetSlotRef.current = slotIndex;
    setAddFavoriteSearchQuery('');
    setAddFavoriteResults([]);
    setAddFavoriteModalVisible(true);
  }, []);

  const assignFavoriteFromModal = useCallback(
    (item: CartItem) => {
      setFavoriteSlots(prev => {
        const next = [...prev];
        const target = addFavoriteTargetSlotRef.current;
        let idx =
          target !== null && target >= 0
            ? target
            : next.findIndex(c => c == null);

        if (idx < 0) {
          next.push(item);
        } else {
          while (next.length <= idx) {
            next.push(null);
          }
          next[idx] = item;
        }
        return normalizeFavoriteGridForGrowth(next);
      });
      mergeCachedItems([item]);
      addFavoriteTargetSlotRef.current = null;
      setAddFavoriteModalVisible(false);
      setAddFavoriteSearchQuery('');
      setAddFavoriteResults([]);
    },
    [mergeCachedItems],
  );

  const removeFavoriteAt = useCallback((index: number) => {
    setFavoriteSlots(prev => {
      const next = [...prev];
      if (index >= 0 && index < next.length) {
        next[index] = null;
      }
      return normalizeFavoriteGridForGrowth(next);
    });
  }, []);

  const handleFavoriteFilledSlotLongPress = useCallback((index: number) => {
    const slot = favoriteSlots[index];
    if (!slot) {
      return;
    }
    setFavoriteActionIndex(index);
  }, [favoriteSlots]);

  const favoriteActionSlot =
    favoriteActionIndex != null ? favoriteSlots[favoriteActionIndex] : null;
  const favoriteActionItems: ChooseActionItem[] =
    favoriteActionIndex == null || !favoriteActionSlot
      ? []
      : [
          {
            key: 'replace',
            label: 'Replace',
            onPress: () => openAddFavoriteModal(favoriteActionIndex),
          },
          {
            key: 'remove',
            label: 'Remove',
            destructive: true,
            onPress: () => removeFavoriteAt(favoriteActionIndex),
          },
        ];

  const handleAddItem = useCallback(
    (item: CartItem) => {
      const latest = cachedItemsRef.current[item.system_id] || item;
      if (isPosItemOutOfStock(latest)) {
        return;
      }

      const hadSearchPanelOpen = isSearchPanelVisible;

      onAddItem(latest);

      setTimeout(() => {
        if (hadSearchPanelOpen) {
          skipNextLibraryFetchRef.current = true;
        }
        setRecentlyViewedIds(previous =>
          [item.system_id, ...previous.filter(id => id !== item.system_id)].slice(
            0,
            12,
          ),
        );
        setIsSearchPanelVisible(false);
        setSearchQuery('');
        Keyboard.dismiss();

        if (addedTimeoutsRef.current[item.system_id]) {
          clearTimeout(addedTimeoutsRef.current[item.system_id]);
        }

        setRecentlyAddedIds(previous => ({
          ...previous,
          [item.system_id]: true,
        }));

        addedTimeoutsRef.current[item.system_id] = setTimeout(() => {
          setRecentlyAddedIds(previous => {
            const next = {...previous};
            delete next[item.system_id];
            return next;
          });
          delete addedTimeoutsRef.current[item.system_id];
        }, 1400);
      }, 0);
    },
    [onAddItem, isSearchPanelVisible],
  );

  const renderLibraryItemRow = useCallback(
    ({item}: {item: CartItem}) => (
      <LibraryPosItemRow
        item={item}
        isRecentlyAdded={Boolean(recentlyAddedIdsRef.current[item.system_id])}
        isOutOfStock={isPosItemOutOfStock(item)}
        onAdd={handleAddItem}
        theme={libraryRowTheme}
      />
    ),
    [handleAddItem, libraryRowTheme],
  );

  const renderLibraryItemTile = useCallback(
    ({item}: {item: CartItem}) => (
      <LibraryPosItemTile
        item={item}
        isRecentlyAdded={Boolean(recentlyAddedIdsRef.current[item.system_id])}
        isOutOfStock={isPosItemOutOfStock(item)}
        onAdd={handleAddItem}
        theme={libraryTileTheme}
      />
    ),
    [handleAddItem, libraryTileTheme],
  );

  const onSearchChangeText = (text: string) => {
    setSearchQuery(text);
    // Clear immediately on keystroke (before debounce) so the previous catalog
    // cannot sit under a new query like "Mask". Invalidate in-flight requests
    // so a slower older response cannot repopulate the list.
    if (isSearchPanelVisible) {
      loadItemsRequestIdRef.current += 1;
      setItems([]);
      setHasNextPage(false);
      setLoadingItems(true);
    }
  };

  const showTypedSearchResults =
    isSearchPanelVisible && searchQuery.trim().length > 0;

  const searchFilterChipLabel = useMemo(() => {
    const opt = SEARCH_FILTER_OPTIONS.find(o => o.id === selectedSearchFilter);
    return opt?.label ?? 'Items';
  }, [selectedSearchFilter]);

  const handleTypedResultPress = (item: CartItem) => {
    if (isPosItemOutOfStock(item)) {
      return;
    }
    handleAddItem(item);
  };

  const renderTabButton = (tab: {id: BrowseTab; label: string}) => {
    const isActive = activeTab === tab.id;

    return (
      <Pressable
        key={tab.id}
        {...ICON_BUTTON_QUICK_PRESS}
        onPress={() => setActiveTab(tab.id)}
        style={({pressed}) => [
          styles.tabButton,
          isActive && styles.tabButtonActive,
          isActive && bt.tabActive,
          pressed && {opacity: isActive ? 0.92 : 0.82},
        ]}>
        <Text
          style={[
            styles.tabButtonText,
            bt.tabText,
            isActive && styles.tabButtonTextActive,
            isActive && bt.tabTextActive,
          ]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  const renderSearchBar = () => (
    <View style={styles.searchRow}>
      <View
        style={[
          styles.searchInputWrap,
          bt.searchWrap,
          isSearchPanelVisible && styles.searchInputWrapActive,
          isSearchPanelVisible && bt.searchWrapActive,
        ]}>
        {isSearchPanelVisible ? (
          <QuickIconPressable
            onPress={() => {
              setSearchQuery('');
              setIsSearchPanelVisible(false);
              Keyboard.dismiss();
            }}
            style={styles.searchBackButton}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityLabel="Close search">
            <Image source={icons.back} style={[styles.searchBackIcon, bt.searchBackIcon]} />
          </QuickIconPressable>
        ) : (
          <Image source={icons.search} style={[styles.searchIcon, bt.searchIcon]} />
        )}
        <View style={styles.searchBarInputCluster}>
          {showTypedSearchResults ? (
            <View style={[styles.searchBarFilterChip, bt.barFilterChip]}>
              <Text style={[styles.searchBarFilterChipText, bt.barFilterChipText]} numberOfLines={1}>
                {searchFilterChipLabel}
              </Text>
              <QuickIconPressable
                onPress={() => setSelectedSearchFilter('items')}
                style={styles.searchBarFilterChipRemove}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                accessibilityLabel="Clear search filter">
                <Image
                  source={icons.cross}
                  style={[styles.searchBarFilterChipRemoveIcon, bt.barFilterRemove]}
                />
              </QuickIconPressable>
            </View>
          ) : null}
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChangeText}
            placeholder={
              isSearchPanelVisible
                ? 'Search'
                : selectedCategory
                  ? `Search in ${selectedCategory.name}`
                  : 'Search all products'
            }
            placeholderTextColor={colors.placeholder}
            style={[styles.searchInputUnified, bt.searchInput]}
            returnKeyType="search"
            onFocus={() => setIsSearchPanelVisible(true)}
            clearButtonMode={
              Platform.OS === 'ios' && (isSearchPanelVisible || searchQuery.length > 0)
                ? 'while-editing'
                : 'never'
            }
          />
        </View>
        {searchQuery.length > 0 && Platform.OS === 'android' ? (
          <QuickIconPressable
            onPress={() => {
              setSearchQuery('');
            }}
            style={styles.searchClearButton}
            hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
            accessibilityLabel="Clear search">
            <Image source={icons.cross} style={[styles.searchClearIcon, bt.searchClearIcon]} />
          </QuickIconPressable>
        ) : null}
      </View>

      {showScanButton && (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={onScanPress}
          activeOpacity={0.8}>
          <Image source={icons.focus} style={styles.scanIcon} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSearchPanel = () => (
    <View style={[styles.searchPanelCard, bt.searchPanel]}>
      <Text style={[styles.searchPanelHeading, bt.panelHeading]}>Filter by</Text>
      <View style={styles.searchFilterWrap}>
        {SEARCH_FILTER_OPTIONS.map(filterOption => {
          const isSelected = selectedSearchFilter === filterOption.id;
          return (
            <TouchableOpacity
              key={filterOption.id}
              style={[
                styles.searchFilterChip,
                bt.filterChip,
                isSelected && styles.searchFilterChipActive,
                isSelected && bt.filterChipActive,
              ]}
              onPress={() => setSelectedSearchFilter(filterOption.id)}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.searchFilterChipText,
                  bt.filterChipText,
                  isSelected && styles.searchFilterChipTextActive,
                  isSelected && bt.filterChipTextActive,
                ]}>
                {filterOption.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.searchPanelSubheading, bt.panelSub]}>
        {selectedSearchFilter === 'categories' ? 'Categories' : 'Recently viewed'}
      </Text>

      {selectedSearchFilter === 'categories' ? (
        filteredCategories.length ? (
          filteredCategories.map(category => (
            <TouchableOpacity
              key={String(category.id)}
              style={[styles.searchRecentRow, bt.searchRecentBorder]}
              onPress={() => {
                setActiveTab('pos');
                setSelectedCategoryId(category.id);
                setSearchQuery('');
                setIsSearchPanelVisible(false);
                Keyboard.dismiss();
              }}
              activeOpacity={0.75}>
              <View style={styles.searchRecentIconWrap}>
                <Image source={icons.filter} style={[styles.searchRecentIcon, bt.searchRecentIcon]} />
              </View>
              <Text style={[styles.searchRecentTitle, bt.searchRecentTitle]} numberOfLines={1}>
                {category.name}
              </Text>
              <View style={[styles.searchRecentTypeBadge, bt.searchRecentBadge]}>
                <Text style={[styles.searchRecentTypeText, bt.searchRecentBadgeText]}>Category</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[styles.searchEmptyText, bt.searchEmpty]}>No categories found.</Text>
        )
      ) : recentViewedItems.length ? (
        recentViewedItems.map(item => (
          <TouchableOpacity
            key={item.system_id}
            style={[styles.searchRecentRow, bt.searchRecentBorder]}
            onPress={() => handleAddItem(item)}
            activeOpacity={0.75}>
            <View style={styles.searchRecentIconWrap}>
              <Image source={icons.clock} style={[styles.searchRecentIcon, bt.searchRecentIcon]} />
            </View>
            <Text style={[styles.searchRecentTitle, bt.searchRecentTitle]} numberOfLines={1}>
              {item.item_name}
            </Text>
            <View style={[styles.searchRecentTypeBadge, bt.searchRecentBadge]}>
              <Text style={[styles.searchRecentTypeText, bt.searchRecentBadgeText]}>
                {item.type?.trim() || 'Items'}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={[styles.searchEmptyText, bt.searchEmpty]}>
          Add items once and they will appear here.
        </Text>
      )}
    </View>
  );

  const getSearchResultInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const letters = parts.map(part => part[0] || '').join('');
    return (letters || 'it').slice(0, 2).toLowerCase();
  };

  const renderSearchResultRow = ({item}: {item: CartItem}) => {
    const isOutOfStock = isPosItemOutOfStock(item);
    const initialsShort = getSearchResultInitials(item.item_name || '');

    return (
      <TouchableOpacity
        style={[
          styles.searchResultRow,
          bt.searchResultRow,
          isOutOfStock && styles.searchResultRowDisabled,
        ]}
        onPress={() => handleTypedResultPress(item)}
        activeOpacity={isOutOfStock ? 1 : 0.75}
        disabled={isOutOfStock}>
        <View
          style={[
            styles.searchResultInitialsTile,
            bt.searchResultTile,
            isOutOfStock && styles.searchResultInitialsTileDisabled,
            isOutOfStock && bt.searchResultTileDis,
          ]}>
          <Text style={[styles.searchResultInitialsText, bt.searchResultInitials]}>
            {initialsShort}
          </Text>
        </View>
        <View style={styles.searchResultTextCol}>
          <Text
            style={[
              styles.searchResultName,
              bt.searchResultName,
              isOutOfStock && styles.searchResultNameDisabled,
              isOutOfStock && bt.searchResultNameDis,
            ]}
            numberOfLines={1}>
            {item.item_name}
          </Text>
        </View>
        <Text style={[styles.searchResultPrice, bt.searchResultPrice]}>
          {formatMoney(item.unit_price)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTypedSearchList = () => {
    if (loadingItems) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="small" color={COLORS.primary2} />
          <Text style={[styles.stateText, bt.stateText]}>Searching items...</Text>
        </View>
      );
    }

    return (
      <FlatList
        style={styles.libraryList}
        data={items}
        keyExtractor={it => it.system_id}
        renderItem={renderSearchResultRow}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.searchResultsListContent}
        onEndReached={() => {
          if (!loadingMore && hasNextPage) {
            loadItems(currentPage + 1, false);
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.stateWrap}>
            <Text style={[styles.stateText, bt.stateText]}>No items match your search.</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
            </View>
          ) : null
        }
      />
    );
  };

  const renderLibrary = () => {
    if (loadingCategories && !categories.length) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="small" color={COLORS.primary2} />
          <Text style={[styles.stateText, bt.stateText]}>Loading categories...</Text>
        </View>
      );
    }

    return (
      <View style={styles.libraryList}>
        <PosCategoryChipBar
          categories={categories}
          categoriesLoadError={categoriesLoadError}
          selectedCategoryId={selectedCategoryId}
          catalogLayout={useProductGrid ? 'grid' : 'list'}
          bt={bt}
          onRetry={handleRetryLibrary}
          onCategoryPress={handleCategoryPress}
          onLayoutChange={setCatalogLayoutOverride}
        />
        <FlatList
          ref={libraryListRef}
          key={`library-${useProductGrid ? catalogColumns : 'list'}`}
          style={styles.libraryList}
          data={items}
          keyExtractor={item => item.system_id}
          numColumns={useProductGrid ? catalogColumns : 1}
          renderItem={
            useProductGrid ? renderLibraryItemTile : renderLibraryItemRow
          }
          extraData={recentlyAddedIds}
          initialNumToRender={useProductGrid ? 18 : 12}
          maxToRenderPerBatch={useProductGrid ? 12 : 8}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={useProductGrid ? styles.gridRow : undefined}
          contentContainerStyle={
            useProductGrid ? styles.gridContent : styles.listContent
          }
          onEndReached={() => {
            if (!loadingMore && hasNextPage) {
              loadItems(currentPage + 1, false);
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loadingItems ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator size="small" color={COLORS.primary2} />
                <Text style={[styles.stateText, bt.stateText]}>Loading items...</Text>
              </View>
            ) : (
              <View style={styles.stateWrap}>
                <Text style={[styles.stateText, bt.stateText]}>
                  {itemsLoadError
                    ? "Couldn't load items."
                    : 'No items found for this search.'}
                </Text>
                {itemsLoadError ? (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetryLibrary}
                    activeOpacity={0.85}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary2} />
              </View>
            ) : null
          }
        />
      </View>
    );
  };

  const renderFavoritesGridIcon = () => (
    <View style={styles.favGridIconOuter}>
      <View style={[styles.favGridIconCell, styles.favGridIconCellBranded]} />
      <View style={[styles.favGridIconCell, styles.favGridIconCellBranded]} />
      <View style={[styles.favGridIconCell, styles.favGridIconCellBranded]} />
      <View style={[styles.favGridIconCell, styles.favGridIconCellBranded]} />
    </View>
  );

  const renderFavoritesPanel = () => {
    const hasAnyFavorite = favoriteSlots.some(cell => cell != null);

    return (
    <ScrollView
      style={styles.favScrollFill}
      contentContainerStyle={[
        styles.favScrollContent,
        hasAnyFavorite && styles.favScrollContentGridOnly,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {!hasAnyFavorite ? (
        <Pressable
          {...ICON_BUTTON_QUICK_PRESS}
          onPress={() => openAddFavoriteModal(0)}
          accessibilityRole="button"
          accessibilityLabel="Add your first favorite"
          style={({pressed}) => [styles.favHero, pressed && styles.favHeroPressed]}>
          {renderFavoritesGridIcon()}
          <Text style={[styles.favTitle, {color: colors.textPrimary}]}>
            Arrange your favorites
          </Text>
          <Text style={[styles.favSubtitle, {color: colors.textSecondary}]}>
            Tap here or an empty tile to add an item. Tap a saved item to add it to the sale. Press and
            hold a saved item to replace or remove it.
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.favGridWrap}>
        {favoriteSlots.map((cell, index) => (
          <Pressable
            key={`fav-slot-${index}`}
            {...ICON_BUTTON_QUICK_PRESS}
            onPress={() => {
              if (cell) {
                handleAddItem(cell);
              } else {
                openAddFavoriteModal(index);
              }
            }}
            onLongPress={cell ? () => handleFavoriteFilledSlotLongPress(index) : undefined}
            delayLongPress={cell ? 450 : undefined}
            android_ripple={
              Platform.OS === 'android'
                ? {
                    color: cell ? 'rgba(0, 81, 81, 0.22)' : 'rgba(0,0,0,0.08)',
                    foreground: true,
                  }
                : undefined
            }
            style={({pressed}) => [
              styles.favSlot,
              !cell && styles.favSlotEmptyLayout,
              {
                borderColor: cell ? COLORS.primary2 : colors.border,
                backgroundColor: cell
                  ? isDark
                    ? 'rgba(0, 81, 81, 0.14)'
                    : COLORS.transparentPrimary2
                  : colors.inputBackground,
                opacity: pressed ? 0.88 : 1,
              },
            ]}>
            {cell ? (
              <>
                <View style={styles.favSlotInitials}>
                  <Text style={styles.favSlotInitialsText}>
                    {getInitials(cell.item_name || 'IT')}
                  </Text>
                </View>
                <Text
                  style={[styles.favSlotName, {color: colors.textPrimary}]}
                  numberOfLines={2}>
                  {cell.item_name}
                </Text>
                <Text style={styles.favSlotPrice}>{formatMoney(cell.unit_price)}</Text>
              </>
            ) : (
              <Text style={[styles.favSlotEmptyHint, {color: colors.textTertiary}]}>
                Tap to add
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      <Text style={[styles.favHintFooter, {color: colors.textSecondary}]}>
        {favoritesSyncError
          ? `Could not sync to server — saved on this device. Pull to refresh the app to retry.`
          : `Favorites sync to your account when you are online.`}
      </Text>
      {favoritesSyncError ? (
        <Text style={[styles.favHintFooter, styles.favSyncErrorDetail, {color: colors.textTertiary}]}>
          {favoritesSyncError}
        </Text>
      ) : null}
    </ScrollView>
    );
  };

  const renderAddFavoriteModal = () => (
    <Modal
      visible={addFavoriteModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setAddFavoriteModalVisible(false);
        addFavoriteTargetSlotRef.current = null;
      }}>
      <View style={[styles.favModalRoot, {backgroundColor: colors.background}]}>
        <View style={[styles.favModalHeader, {borderBottomColor: colors.border}]}>
          <QuickIconPressable
            onPress={() => {
              setAddFavoriteModalVisible(false);
              addFavoriteTargetSlotRef.current = null;
            }}
            hitSlop={ICON_BUTTON_HIT_SLOP}
            accessibilityLabel="Close"
            style={styles.favModalClose}>
            <Image
              source={icons.cross}
              style={[styles.favModalCloseIcon, {tintColor: colors.textPrimary}]}
            />
          </QuickIconPressable>
          <Text style={[styles.favModalTitle, {color: colors.textPrimary}]}>
            Add to Favorites
          </Text>
          <View style={styles.favModalHeaderSpacer} />
        </View>

        <View
          style={[
            styles.favModalSearchWrap,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
            },
          ]}>
          <Image
            source={icons.search}
            style={[styles.favModalSearchIcon, {tintColor: colors.iconMuted}]}
          />
          <TextInput
            value={addFavoriteSearchQuery}
            onChangeText={setAddFavoriteSearchQuery}
            placeholder="Search"
            placeholderTextColor={colors.placeholder}
            style={[styles.favModalSearchInput, {color: colors.textPrimary}]}
          />
        </View>

        {addFavoriteLoading && addFavoriteResults.length === 0 ? (
          <View style={[styles.stateWrap, styles.favModalListFlex]}>
            <ActivityIndicator color={COLORS.primary2} />
          </View>
        ) : (
          <FlatList
            data={addFavoriteResults}
            keyExtractor={item => item.system_id}
            keyboardShouldPersistTaps="handled"
            style={styles.favModalListFlex}
            contentContainerStyle={styles.favModalListContent}
            renderItem={({item}) => {
              const initials = getInitials(item.item_name || 'IT');
              const noStock = isPosItemOutOfStock(item);
              return (
                <Pressable
                  {...ICON_BUTTON_QUICK_PRESS}
                  disabled={noStock}
                  onPress={() => assignFavoriteFromModal(item)}
                  android_ripple={
                    Platform.OS === 'android' && !noStock
                      ? {color: 'rgba(0,0,0,0.1)'}
                      : undefined
                  }
                  style={({pressed}) => [
                    styles.favModalRow,
                    {borderBottomColor: colors.border},
                    noStock && styles.favModalRowDisabled,
                    !noStock && pressed && styles.favModalRowPressed,
                  ]}>
                  <View
                    style={[
                      styles.favModalRowTile,
                      {backgroundColor: colors.inputBackground},
                    ]}>
                    <Text
                      style={[styles.favModalRowInitials, {color: colors.textSecondary}]}>
                      {initials}
                    </Text>
                  </View>
                  <View style={styles.favModalRowTextWrap}>
                    <Text
                      style={[
                        styles.favModalRowName,
                        {
                          color: noStock ? colors.textTertiary : colors.textPrimary,
                        },
                      ]}
                      numberOfLines={2}>
                      {item.item_name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.favModalRowMeta,
                      {color: noStock ? colors.textTertiary : COLORS.primary2},
                    ]}>
                    {noStock ? 'Out of stock' : formatMoney(item.unit_price)}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              !addFavoriteLoading ? (
                <Text
                  style={[
                    styles.favModalEmpty,
                    {color: colors.textSecondary},
                  ]}>
                  No items match your search.
                </Text>
              ) : null
            }
          />
        )}

        <View style={[styles.favModalFooter, {borderTopColor: colors.border}]}>
          <Pressable
            {...ICON_BUTTON_QUICK_PRESS}
            onPress={() => {
              setAddFavoriteModalVisible(false);
              addFavoriteTargetSlotRef.current = null;
              if (onOpenCreateItem) {
                onOpenCreateItem();
              } else {
                Toast.show({
                  type: 'info',
                  text1: 'Create an item',
                  text2: 'Open Items from the menu to add a new item.',
                  visibilityTime: 2600,
                });
              }
            }}
            android_ripple={
              Platform.OS === 'android'
                ? {color: 'rgba(0,0,0,0.08)', foreground: true}
                : undefined
            }
            style={({pressed}) => [
              styles.favModalFooterBtn,
              {backgroundColor: colors.inputBackground},
              pressed && styles.favModalFooterBtnPressed,
            ]}>
            <Text style={[styles.favModalFooterBtnText, {color: colors.textPrimary}]}>
              Create an item
            </Text>
          </Pressable>
          <Pressable
            {...ICON_BUTTON_QUICK_PRESS}
            onPress={() => {
              Toast.show({
                type: 'info',
                text1: 'Create a discount',
                text2: 'Discount setup is available on the web admin for now.',
                visibilityTime: 2600,
              });
            }}
            android_ripple={
              Platform.OS === 'android'
                ? {color: 'rgba(0,0,0,0.08)', foreground: true}
                : undefined
            }
            style={({pressed}) => [
              styles.favModalFooterBtn,
              {backgroundColor: colors.inputBackground},
              pressed && styles.favModalFooterBtnPressed,
            ]}>
            <Text style={[styles.favModalFooterBtnText, {color: colors.textPrimary}]}>
              Create a discount
            </Text>
          </Pressable>
          <Pressable
            {...ICON_BUTTON_QUICK_PRESS}
            onPress={() => {
              setAddFavoriteModalVisible(false);
              addFavoriteTargetSlotRef.current = null;
              if (onOpenCreateService) {
                onOpenCreateService();
              } else {
                Toast.show({
                  type: 'info',
                  text1: 'Create a service',
                  text2: 'Open Items from the menu to add a new service.',
                  visibilityTime: 2600,
                });
              }
            }}
            android_ripple={
              Platform.OS === 'android'
                ? {color: 'rgba(0,0,0,0.08)', foreground: true}
                : undefined
            }
            style={({pressed}) => [
              styles.favModalFooterBtn,
              {backgroundColor: colors.inputBackground},
              pressed && styles.favModalFooterBtnPressed,
            ]}>
            <Text style={[styles.favModalFooterBtnText, {color: colors.textPrimary}]}>
              Create a service
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, bt.container]}>
      {!showTypedSearchResults ? (
        <View style={[styles.tabsWrap, bt.tabsWrap]}>{TAB_OPTIONS.map(renderTabButton)}</View>
      ) : null}
      {!hideSearchBar && activeTab !== 'favorites' ? renderSearchBar() : null}
      <View
        style={[
          styles.bodyCardBase,
          bt.bodyCard,
          styles.bodyCardFill,
        ]}>
        {showTypedSearchResults ? (
          renderTypedSearchList()
        ) : isSearchPanelVisible ? (
          renderSearchPanel()
        ) : (
          <>
            {activeTab === 'pos' && renderLibrary()}
            {activeTab === 'favorites' && renderFavoritesPanel()}
          </>
        )}
      </View>
      {renderAddFavoriteModal()}
      <ChooseActionSheet
        visible={favoriteActionIndex != null && !!favoriteActionSlot}
        title={favoriteActionSlot?.item_name || 'Favorite'}
        actions={favoriteActionItems}
        onClose={() => setFavoriteActionIndex(null)}
      />
    </View>
  );
};

export default React.memo(SalesItemBrowser);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.white,
  },
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#EFEFEF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    ...FONTS.body3,
    color: '#6E6E6E',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#2A2A2A',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: COLORS.white,
    borderRadius: 28,
    paddingHorizontal: 16,
    borderWidth: 1.4,
    borderColor: '#1B1B1B',
  },
  searchInputWrapActive: {
    borderColor: '#111',
    borderWidth: 1.5,
  },
  searchIcon: {
    width: 16,
    height: 16,
    tintColor: '#8D8D8D',
  },
  searchBackButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBackIcon: {
    width: 18,
    height: 18,
    tintColor: '#171717',
  },
  searchInputUnified: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    ...FONTS.body3,
    color: '#171717',
  },
  searchClearButton: {
    padding: 4,
    marginLeft: 4,
  },
  searchClearIcon: {
    width: 18,
    height: 18,
    tintColor: '#8D8D8D',
  },
  searchBarInputCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginLeft: 8,
  },
  searchBarFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4E4E4',
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: '42%',
  },
  searchBarFilterChipText: {
    ...FONTS.body4,
    color: '#222',
    fontWeight: '600',
    marginRight: 4,
  },
  searchBarFilterChipRemove: {
    padding: 4,
  },
  searchBarFilterChipRemoveIcon: {
    width: 12,
    height: 12,
    tintColor: '#555',
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  scanIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.white,
  },
  bodyCardBase: {
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    minHeight: 220,
  },
  bodyCardFill: {
    flex: 1,
    minHeight: 0,
  },
  libraryList: {
    flex: 1,
    minHeight: 0,
  },
  categoryChipBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E4',
    backgroundColor: COLORS.white,
  },
  categoryChipBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChipScroll: {
    flex: 1,
  },
  categoryChipBarEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  layoutToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    paddingLeft: 4,
  },
  layoutToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  layoutToggleBtnActive: {
    borderColor: COLORS.primary2,
  },
  layoutToggleText: {
    ...FONTS.body5,
    fontWeight: '700',
  },
  gridRow: {
    gap: 10,
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  gridContent: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  gridTile: {
    flex: 1,
    minHeight: 128,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    overflow: 'hidden',
  },
  gridTileDisabled: {
    opacity: 0.55,
  },
  gridTileInitials: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTileInitialsDisabled: {
    backgroundColor: '#C9CDD3',
  },
  gridTileInitialsText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
  gridTileName: {
    ...FONTS.body4,
    fontWeight: '700',
    width: '100%',
    minHeight: 36,
  },
  gridTileMeta: {
    ...FONTS.body5,
    marginTop: 2,
    marginBottom: 6,
  },
  gridTilePrice: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '700',
    marginTop: 'auto',
  },
  categoryChipScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F3F3F3',
    marginRight: 8,
    maxWidth: 180,
  },
  categoryChipActive: {
    backgroundColor: COLORS.transparentPrimary2,
    borderColor: COLORS.primary2,
  },
  categoryChipText: {
    ...FONTS.body4,
    fontWeight: '600',
    color: '#555',
  },
  categoryChipTextActive: {
    color: COLORS.primary2,
    fontWeight: '700',
  },
  categoryChipRetry: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favScrollFill: {
    flex: 1,
    minHeight: 0,
  },
  favScrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  favScrollContentGridOnly: {
    paddingTop: 12,
  },
  favHero: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  favHeroPressed: {
    opacity: 0.92,
  },
  favGridIconOuter: {
    width: 56,
    height: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    marginBottom: 14,
  },
  favGridIconCell: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    margin: 3,
  },
  favGridIconCellBranded: {
    borderColor: COLORS.primary2,
    backgroundColor: COLORS.transparentPrimary,
  },
  favTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  favSubtitle: {
    ...FONTS.body4,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  favGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    columnGap: 10,
    marginTop: 8,
  },
  favSlot: {
    width: '48%',
    minHeight: 124,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  favSlotEmptyLayout: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  favSlotInitials: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  favSlotInitialsText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
  favSlotName: {
    ...FONTS.body4,
    fontWeight: '600',
    width: '100%',
  },
  favSlotPrice: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
    marginTop: 6,
  },
  favSlotEmptyHint: {
    ...FONTS.body4,
    textAlign: 'center',
    fontWeight: '500',
  },
  favHintFooter: {
    ...FONTS.body5,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  favSyncErrorDetail: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
  },
  favModalRoot: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  favModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  favModalClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favModalCloseIcon: {
    width: 20,
    height: 20,
  },
  favModalTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  favModalHeaderSpacer: {
    width: 40,
  },
  favModalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  favModalSearchIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  favModalSearchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 0,
  },
  favModalListFlex: {
    flex: 1,
    minHeight: 120,
  },
  favModalListContent: {
    paddingBottom: 16,
  },
  favModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  favModalRowDisabled: {
    opacity: 0.55,
  },
  favModalRowPressed: {
    opacity: 0.78,
  },
  favModalRowTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  favModalRowInitials: {
    ...FONTS.body3,
    fontWeight: '700',
  },
  favModalRowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  favModalRowName: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  favModalRowMeta: {
    ...FONTS.body4,
    fontWeight: '600',
    marginLeft: 8,
  },
  favModalEmpty: {
    ...FONTS.body3,
    textAlign: 'center',
    marginTop: 28,
  },
  favModalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    gap: 10,
  },
  favModalFooterBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  favModalFooterBtnPressed: {
    opacity: 0.88,
  },
  favModalFooterBtnText: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  searchResultsListContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6',
  },
  searchResultRowDisabled: {
    opacity: 0.55,
  },
  searchResultTextCol: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
    justifyContent: 'center',
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
  searchResultInitialsTileDisabled: {
    backgroundColor: '#D0D0D0',
  },
  searchResultInitialsText: {
    ...FONTS.body4,
    color: '#5C5C5C',
    fontWeight: '600',
  },
  searchResultName: {
    ...FONTS.body3,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  searchResultNameDisabled: {
    color: COLORS.gray,
  },
  searchResultPrice: {
    ...FONTS.body3,
    color: '#2A2A2A',
    fontWeight: '500',
  },
  searchPanelCard: {
    marginHorizontal: 4,
    marginTop: 2,
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: '#F3F3F3',
    borderWidth: 1,
    borderColor: '#E9E9E9',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchPanelHeading: {
    ...FONTS.body3,
    color: '#868686',
    fontWeight: '500',
  },
  searchFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  searchFilterChip: {
    borderRadius: 12,
    backgroundColor: '#E4E4E4',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  searchFilterChipActive: {
    backgroundColor: '#D8D8D8',
  },
  searchFilterChipText: {
    ...FONTS.body3,
    color: '#222',
    fontWeight: '600',
  },
  searchFilterChipTextActive: {
    color: '#111',
  },
  searchPanelSubheading: {
    ...FONTS.body3,
    color: '#9B9B9B',
    marginTop: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  searchRecentRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6',
  },
  searchRecentIconWrap: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  searchRecentIcon: {
    width: 16,
    height: 16,
    tintColor: '#A1A1A1',
  },
  searchRecentTitle: {
    ...FONTS.body3,
    color: '#1F1F1F',
    flex: 1,
    fontWeight: '700',
    marginRight: 10,
  },
  searchRecentTypeBadge: {
    borderRadius: 999,
    backgroundColor: '#E6E6E6',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  searchRecentTypeText: {
    ...FONTS.body5,
    color: '#616161',
    fontWeight: '600',
  },
  searchEmptyText: {
    ...FONTS.body4,
    color: COLORS.gray,
    paddingVertical: 18,
  },
  listContent: {
    paddingVertical: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.transparentPrimary2,
  },
  disabledListRow: {
    backgroundColor: '#F7F7F7',
  },
  initialsTile: {
    width: 52,
    minHeight: 58,
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledInitialsTile: {
    backgroundColor: '#C9CDD3',
  },
  initialsText: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: '500',
  },
  rowContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rowTitle: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  disabledRowTitle: {
    color: COLORS.gray,
    textDecorationLine: 'line-through',
  },
  rowSubtitle: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 2,
  },
  disabledRowSubtitle: {
    color: '#9AA0A6',
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 12,
    paddingLeft: 6,
  },
  rowAmount: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '500',
  },
  addedText: {
    ...FONTS.body3,
    color: COLORS.success,
    fontWeight: '700',
  },
  outOfStockText: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary2,
  },
  retryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  stateText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 14,
  },
  libraryRowPressed: {
    opacity: 0.75,
  },
});

/** Subset of SalesItemBrowser `bt` used by the POS category chip bar. */
type PosCategoryChipTheme = {
  catChipBar: object;
  catChip: object;
  catChipActive: object;
  catChipText: object;
  catChipTextActive: object;
  stateText: object;
  layoutToggle: object;
  layoutToggleActive: object;
  layoutToggleText: object;
  layoutToggleTextActive: object;
};

type PosCategoryChipBarProps = {
  categories: SalesCategory[];
  categoriesLoadError: boolean;
  selectedCategoryId: string | number | null;
  catalogLayout: 'grid' | 'list';
  bt: PosCategoryChipTheme;
  onRetry: () => void;
  onCategoryPress: (categoryId: string | number | null) => void;
  onLayoutChange: (layout: 'grid' | 'list') => void;
};

const PosCategoryChipBar = React.memo(function PosCategoryChipBarInner({
  categories,
  categoriesLoadError,
  selectedCategoryId,
  catalogLayout,
  bt,
  onRetry,
  onCategoryPress,
  onLayoutChange,
}: PosCategoryChipBarProps) {
  const layoutToggle = (
    <View style={styles.layoutToggleWrap}>
      <TouchableOpacity
        style={[
          styles.layoutToggleBtn,
          bt.layoutToggle,
          catalogLayout === 'grid' && styles.layoutToggleBtnActive,
          catalogLayout === 'grid' && bt.layoutToggleActive,
        ]}
        onPress={() => onLayoutChange('grid')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{selected: catalogLayout === 'grid'}}
        accessibilityLabel="Grid view">
        <Text
          style={[
            styles.layoutToggleText,
            bt.layoutToggleText,
            catalogLayout === 'grid' && bt.layoutToggleTextActive,
          ]}>
          Grid
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.layoutToggleBtn,
          bt.layoutToggle,
          catalogLayout === 'list' && styles.layoutToggleBtnActive,
          catalogLayout === 'list' && bt.layoutToggleActive,
        ]}
        onPress={() => onLayoutChange('list')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{selected: catalogLayout === 'list'}}
        accessibilityLabel="List view">
        <Text
          style={[
            styles.layoutToggleText,
            bt.layoutToggleText,
            catalogLayout === 'list' && bt.layoutToggleTextActive,
          ]}>
          List
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!categories.length) {
    return (
      <View style={[styles.categoryChipBar, bt.catChipBar, styles.categoryChipBarEmpty]}>
        <Text style={[styles.stateText, bt.stateText]} numberOfLines={1}>
          {categoriesLoadError
            ? "Couldn't load categories."
            : 'No categories available.'}
        </Text>
        {categoriesLoadError ? (
          <TouchableOpacity
            style={styles.categoryChipRetry}
            onPress={onRetry}
            activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
        {layoutToggle}
      </View>
    );
  }

  const isAllSelected = selectedCategoryId == null;

  return (
    <View style={[styles.categoryChipBar, bt.catChipBar, styles.categoryChipBarRow]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.categoryChipScrollContent}
        style={styles.categoryChipScroll}>
        <TouchableOpacity
          style={[
            styles.categoryChip,
            bt.catChip,
            isAllSelected && styles.categoryChipActive,
            isAllSelected && bt.catChipActive,
          ]}
          onPress={() => onCategoryPress(null)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{selected: isAllSelected}}
          accessibilityLabel="All categories">
          <Text
            style={[
              styles.categoryChipText,
              bt.catChipText,
              isAllSelected && styles.categoryChipTextActive,
              isAllSelected && bt.catChipTextActive,
            ]}
            numberOfLines={1}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map(category => {
          const isSelected = String(selectedCategoryId) === String(category.id);
          return (
            <TouchableOpacity
              key={String(category.id)}
              style={[
                styles.categoryChip,
                bt.catChip,
                isSelected && styles.categoryChipActive,
                isSelected && bt.catChipActive,
              ]}
              onPress={() => onCategoryPress(category.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{selected: isSelected}}
              accessibilityLabel={`Category ${category.name}`}>
              <Text
                style={[
                  styles.categoryChipText,
                  bt.catChipText,
                  isSelected && styles.categoryChipTextActive,
                  isSelected && bt.catChipTextActive,
                ]}
                numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {layoutToggle}
    </View>
  );
});

LibraryPosItemRow = React.memo(function LibraryPosItemRowInner({
  item,
  isRecentlyAdded,
  isOutOfStock,
  onAdd,
  theme,
}: LibraryPosItemRowProps) {
  const initials = getInitials(item.item_name || 'IT') || 'IT';

  return (
    <Pressable
      disabled={isOutOfStock}
      delayPressIn={0}
      unstable_pressDelay={0}
      android_ripple={
        Platform.OS === 'android' && !isOutOfStock
          ? {color: 'rgba(0,0,0,0.1)'}
          : undefined
      }
      style={({pressed}) => [
        styles.listRow,
        theme.listRow,
        isOutOfStock && styles.disabledListRow,
        isOutOfStock && theme.disabledRow,
        !isOutOfStock && pressed && styles.libraryRowPressed,
      ]}
      onPress={() => onAdd(item)}>
      <View style={[styles.initialsTile, isOutOfStock && styles.disabledInitialsTile]}>
        <Text style={styles.initialsText}>{initials}</Text>
      </View>

      <View style={styles.rowContent}>
        <Text
          style={[styles.rowTitle, isOutOfStock && styles.disabledRowTitle]}
          numberOfLines={1}>
          {item.item_name}
        </Text>
        <Text
          style={[
            styles.rowSubtitle,
            theme.rowSub,
            isOutOfStock && styles.disabledRowSubtitle,
            isOutOfStock && theme.rowSubDis,
          ]}
          numberOfLines={1}>
          {posItemStockLabel(item)}
        </Text>
      </View>

      <View style={styles.rowRight}>
        {isRecentlyAdded ? (
          <Text style={styles.addedText}>Added</Text>
        ) : isOutOfStock ? (
          <Text style={styles.outOfStockText}>Unavailable</Text>
        ) : (
          <Text style={styles.rowAmount}>{formatMoney(item.unit_price)}</Text>
        )}
      </View>
    </Pressable>
  );
});

LibraryPosItemTile = React.memo(function LibraryPosItemTileInner({
  item,
  isRecentlyAdded,
  isOutOfStock,
  onAdd,
  theme,
}: LibraryPosItemTileProps) {
  const initials = getInitials(item.item_name || 'IT') || 'IT';

  return (
    <Pressable
      disabled={isOutOfStock}
      delayPressIn={0}
      unstable_pressDelay={0}
      android_ripple={
        Platform.OS === 'android' && !isOutOfStock
          ? {color: 'rgba(0, 81, 81, 0.18)', foreground: true}
          : undefined
      }
      style={({pressed}) => [
        styles.gridTile,
        theme.tile,
        isRecentlyAdded && theme.tileActive,
        isOutOfStock && styles.gridTileDisabled,
        !isOutOfStock && pressed && styles.libraryRowPressed,
      ]}
      onPress={() => onAdd(item)}
      accessibilityRole="button"
      accessibilityState={{disabled: isOutOfStock}}
      accessibilityLabel={item.item_name}>
      <View
        style={[
          styles.gridTileInitials,
          isOutOfStock && styles.gridTileInitialsDisabled,
        ]}>
        <Text style={styles.gridTileInitialsText}>{initials}</Text>
      </View>
      <Text
        style={[
          styles.gridTileName,
          theme.name,
          isOutOfStock && styles.disabledRowTitle,
        ]}
        numberOfLines={2}>
        {item.item_name}
      </Text>
      <Text style={[styles.gridTileMeta, theme.meta]} numberOfLines={1}>
        {posItemStockLabel(item)}
      </Text>
      {isRecentlyAdded ? (
        <Text style={styles.addedText}>Added</Text>
      ) : isOutOfStock ? (
        <Text style={styles.outOfStockText}>Unavailable</Text>
      ) : (
        <Text style={styles.gridTilePrice}>{formatMoney(item.unit_price)}</Text>
      )}
    </Pressable>
  );
});

