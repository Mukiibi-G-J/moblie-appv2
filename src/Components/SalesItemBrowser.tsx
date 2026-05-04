import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  fetchCategories,
  fetchItems,
  ItemCategory,
} from '../services/app.services';
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

/** Assigned after `styles` (below) so the row can use shared `StyleSheet` styles. */
let LibraryPosItemRow: React.MemoExoticComponent<
  React.FC<LibraryPosItemRowProps>
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
    return 'UGX 0.00';
  }

  return `UGX ${parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const SalesItemBrowser: React.FC<Props> = ({
  onAddItem,
  onScanPress,
  showScanButton = false,
  hideSearchBar = false,
  onOpenCreateItem,
  onOpenCreateService,
}) => {
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
  const [pendingSearchItem, setPendingSearchItem] = useState<CartItem | null>(null);
  const libraryListRef = useRef<FlatList<CartItem>>(null);
  const addedTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Skip one debounced `loadItems` after add-from-search (avoids a slow refetch right when the cart updates). */
  const skipNextLibraryFetchRef = useRef(false);

  const [favoriteSlots, setFavoriteSlots] = useState<(CartItem | null)[]>(() =>
    Array.from({length: FAVORITE_DEFAULT_VISIBLE_SLOTS}, () => null),
  );
  const favoritesHydratedRef = useRef(false);
  /** Skip one debounced PUT after hydrating from GET or AsyncStorage (avoid useless round-trip). */
  const skipNextFavoritePutRef = useRef(true);
  const addFavoriteTargetSlotRef = useRef<number | null>(null);
  const [favoritesSyncError, setFavoritesSyncError] = useState<string | null>(null);

  const [addFavoriteModalVisible, setAddFavoriteModalVisible] = useState(false);
  const [addFavoriteSearchQuery, setAddFavoriteSearchQuery] = useState('');
  const [addFavoriteResults, setAddFavoriteResults] = useState<CartItem[]>([]);
  const [addFavoriteLoading, setAddFavoriteLoading] = useState(false);

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
      searchResultPending: {backgroundColor: colors.screenMuted},
      searchResultTile: {backgroundColor: colors.inputBackground},
      searchResultTileDis: {backgroundColor: colors.border},
      searchResultInitials: {color: colors.textSecondary},
      searchResultName: {color: colors.textPrimary},
      searchResultNameDis: {color: colors.textTertiary},
      searchResultPrice: {color: colors.textPrimary},
      searchResultHint: {color: colors.textTertiary},
      stateText: {color: colors.textSecondary},
      listRow: {borderBottomColor: colors.border},
      selectedRow: {
        backgroundColor: isDark ? 'rgba(2, 134, 255, 0.12)' : COLORS.transparentPrimary2,
      },
      disabledRow: {backgroundColor: colors.screenMuted},
      rowSub: {color: colors.textSecondary},
      rowSubDis: {color: colors.textTertiary},
      libraryGap: {
        backgroundColor: isDark ? 'rgba(2, 134, 255, 0.08)' : COLORS.transparentPrimary2,
      },
      libHdr: {backgroundColor: colors.surface},
      categoryBack: {
        borderBottomColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
    }),
    [colors, isDark],
  );

  const libraryRowTheme = useMemo(
    () => ({
      listRow: bt.listRow,
      disabledRow: bt.disabledRow,
      rowSub: bt.rowSub,
      rowSubDis: bt.rowSubDis,
    }),
    [bt],
  );

  const recentlyAddedIdsRef = useRef(recentlyAddedIds);
  recentlyAddedIdsRef.current = recentlyAddedIds;

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
    async (pageToLoad: number, replace: boolean) => {
      const shouldBrowseLibrary =
        isSearchPanelVisible || activeTab === 'pos';

      if (!shouldBrowseLibrary) {
        return;
      }

      try {
        if (replace) {
          setItemsLoadError(false);
          setLoadingItems(true);
        } else {
          setLoadingMore(true);
        }

        const response: PaginatedItemsResponse = await fetchItems(
          pageToLoad,
          searchQuery,
          isSearchPanelVisible
            ? undefined
            : selectedCategoryId
              ? Number(selectedCategoryId) || (selectedCategoryId as any)
              : undefined,
        );

        const nextItems = Array.isArray(response?.results) ? response.results : [];
        mergeCachedItems(nextItems);
        setItems(previous => (replace ? nextItems : [...previous, ...nextItems]));
        setCurrentPage(pageToLoad);
        setHasNextPage(Boolean(response?.next));
      } catch (error) {
        console.error('Error loading sales browser items:', error);
        if (replace) {
          setItemsLoadError(true);
          setItems([]);
        }
        setHasNextPage(false);
      } finally {
        setLoadingItems(false);
        setLoadingMore(false);
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

  const handleCategoryPress = useCallback(
    (category: SalesCategory) => {
      setSelectedCategoryId(category.id);
      setTimeout(() => {
        libraryListRef.current?.scrollToOffset({
          offset: categories.length * 74 + 28,
          animated: true,
        });
      }, 120);
    },
    [categories.length],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

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
          const response: PaginatedItemsResponse = await fetchItems(
            1,
            addFavoriteSearchQuery,
            undefined,
          );
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

  const handleFavoriteFilledSlotLongPress = useCallback(
    (index: number) => {
      const slot = favoriteSlots[index];
      if (!slot) {
        return;
      }
      Alert.alert(slot.item_name || 'Favorite', 'Choose an action', [
        {
          text: 'Replace',
          onPress: () => openAddFavoriteModal(index),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFavoriteAt(index),
        },
        {text: 'Cancel', style: 'cancel'},
      ]);
    },
    [favoriteSlots, openAddFavoriteModal, removeFavoriteAt],
  );

  const handleAddItem = useCallback(
    (item: CartItem) => {
      if ((Number(item.inventory) || 0) <= 0) {
        return;
      }

      const hadSearchPanelOpen = isSearchPanelVisible;

      onAddItem(item);

      setTimeout(() => {
        if (hadSearchPanelOpen) {
          skipNextLibraryFetchRef.current = true;
        }
        setPendingSearchItem(null);
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
        isOutOfStock={(Number(item.inventory) || 0) <= 0}
        onAdd={handleAddItem}
        theme={libraryRowTheme}
      />
    ),
    [handleAddItem, libraryRowTheme],
  );

  const libraryListHeader = useMemo(
    () => (
      <PosLibraryListHeader
        categories={categories}
        categoriesLoadError={categoriesLoadError}
        selectedCategory={selectedCategory}
        selectedCategoryId={selectedCategoryId}
        bt={bt}
        onRetry={handleRetryLibrary}
        onCategoryPress={handleCategoryPress}
      />
    ),
    [
      categories,
      categoriesLoadError,
      selectedCategory,
      selectedCategoryId,
      bt,
      handleRetryLibrary,
      handleCategoryPress,
    ],
  );

  const onSearchChangeText = (text: string) => {
    setSearchQuery(text);
    setPendingSearchItem(prev => {
      if (!prev) {
        return null;
      }
      if (text.trim().toLowerCase() !== (prev.item_name || '').trim().toLowerCase()) {
        return null;
      }
      return prev;
    });
  };

  const showTypedSearchResults =
    isSearchPanelVisible && searchQuery.trim().length > 0;

  const searchFilterChipLabel = useMemo(() => {
    const opt = SEARCH_FILTER_OPTIONS.find(o => o.id === selectedSearchFilter);
    return opt?.label ?? 'Items';
  }, [selectedSearchFilter]);

  const handleTypedResultPress = (item: CartItem) => {
    if ((Number(item.inventory) || 0) <= 0) {
      return;
    }
    if (pendingSearchItem?.system_id === item.system_id) {
      handleAddItem(item);
      return;
    }
    setPendingSearchItem(item);
    setSearchQuery(item.item_name || '');
  };

  const trySubmitPendingSearchItem = () => {
    if (!pendingSearchItem) {
      return;
    }
    if ((Number(pendingSearchItem.inventory) || 0) <= 0) {
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const n = (pendingSearchItem.item_name || '').trim().toLowerCase();
    if (q === n) {
      handleAddItem(pendingSearchItem);
    }
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
              setPendingSearchItem(null);
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
                  : 'Search products'
            }
            placeholderTextColor={colors.placeholder}
            style={[styles.searchInputUnified, bt.searchInput]}
            returnKeyType={showTypedSearchResults ? 'done' : 'search'}
            onSubmitEditing={
              showTypedSearchResults ? trySubmitPendingSearchItem : undefined
            }
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
              setPendingSearchItem(null);
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
                setPendingSearchItem(null);
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
    const isOutOfStock = (Number(item.inventory) || 0) <= 0;
    const initialsShort = getSearchResultInitials(item.item_name || '');
    const isPending = pendingSearchItem?.system_id === item.system_id;

    return (
      <TouchableOpacity
        style={[
          styles.searchResultRow,
          bt.searchResultRow,
          isOutOfStock && styles.searchResultRowDisabled,
          isPending && styles.searchResultRowPending,
          isPending && bt.searchResultPending,
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
          {isPending && !isOutOfStock ? (
            <Text style={[styles.searchResultHint, bt.searchResultHint]}>Tap again to add to sale</Text>
          ) : null}
        </View>
        <Text style={[styles.searchResultPrice, bt.searchResultPrice]}>
          {formatMoney(item.unit_price)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTypedSearchList = () => {
    if (loadingItems && items.length === 0) {
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
        extraData={pendingSearchItem}
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
      <FlatList
        ref={libraryListRef}
        style={styles.libraryList}
        data={items}
        keyExtractor={item => item.system_id}
        renderItem={renderLibraryItemRow}
        extraData={recentlyAddedIds}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={libraryListHeader}
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
                    color: cell ? 'rgba(2, 134, 255, 0.22)' : 'rgba(0,0,0,0.08)',
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
                    ? 'rgba(2, 134, 255, 0.14)'
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
              const noStock = (Number(item.inventory) || 0) <= 0;
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
  searchResultRowPending: {
    backgroundColor: '#F4F4F4',
  },
  searchResultTextCol: {
    flex: 1,
    marginRight: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  searchResultHint: {
    ...FONTS.body5,
    color: '#888',
    marginTop: 2,
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
  selectedListRow: {
    backgroundColor: COLORS.transparentPrimary2,
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
  rowChevron: {
    width: 14,
    height: 14,
    marginRight: 12,
    tintColor: COLORS.primary2,
    transform: [{rotate: '-90deg'}],
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
  categoryBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E4',
    backgroundColor: '#F8FAFD',
  },
  categoryBackIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary2,
  },
  categoryBackText: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '700',
    marginLeft: 8,
  },
  footerLoader: {
    paddingVertical: 14,
  },
  librarySectionGap: {
    height: 14,
    backgroundColor: COLORS.transparentPrimary2,
  },
  libraryItemsHeader: {
    paddingHorizontal: 14,
    paddingVertical: 2,
    backgroundColor: COLORS.white,
  },
  libraryItemsHeaderText: {
    ...FONTS.body4,
    color: 'transparent',
    fontWeight: '700',
  },
  libraryRowPressed: {
    opacity: 0.75,
  },
});

/** Subset of SalesItemBrowser `bt` used by POS library header rows. */
type PosLibraryHeaderTheme = {
  listRow: object;
  rowSub: object;
  selectedRow: object;
  libraryGap: object;
  libHdr: object;
  stateText: object;
};

type PosLibraryCategoryRowProps = {
  item: SalesCategory;
  selectedCategoryId: string | number | null;
  bt: PosLibraryHeaderTheme;
  onPress: (category: SalesCategory) => void;
};

const PosLibraryCategoryRow = React.memo(function PosLibraryCategoryRowInner({
  item,
  selectedCategoryId,
  bt,
  onPress,
}: PosLibraryCategoryRowProps) {
  const isSelected = String(selectedCategoryId) === String(item.id);
  return (
    <TouchableOpacity
      style={[
        styles.listRow,
        bt.listRow,
        isSelected && styles.selectedListRow,
        isSelected && bt.selectedRow,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}>
      <View style={styles.initialsTile}>
        <Text style={styles.initialsText}>{item.initials}</Text>
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={[styles.rowSubtitle, bt.rowSub]}>
          {isSelected ? 'Showing items below' : 'Tap to browse items'}
        </Text>
      </View>

      <Image source={icons.down_arrow} style={styles.rowChevron} />
    </TouchableOpacity>
  );
});

type PosLibraryListHeaderProps = {
  categories: SalesCategory[];
  categoriesLoadError: boolean;
  selectedCategory: SalesCategory | null;
  selectedCategoryId: string | number | null;
  bt: PosLibraryHeaderTheme;
  onRetry: () => void;
  onCategoryPress: (category: SalesCategory) => void;
};

const PosLibraryListHeader = React.memo(function PosLibraryListHeaderInner({
  categories,
  categoriesLoadError,
  selectedCategory,
  selectedCategoryId,
  bt,
  onRetry,
  onCategoryPress,
}: PosLibraryListHeaderProps) {
  return (
    <View>
      {categories.length ? (
        <View>
          {categories.map(category => (
            <View key={String(category.id)}>
              <PosLibraryCategoryRow
                item={category}
                selectedCategoryId={selectedCategoryId}
                bt={bt}
                onPress={onCategoryPress}
              />
            </View>
          ))}
          <View style={[styles.librarySectionGap, bt.libraryGap]} />
        </View>
      ) : (
        <View style={styles.stateWrap}>
          <Text style={[styles.stateText, bt.stateText]}>
            {categoriesLoadError
              ? "Couldn't load categories."
              : 'No categories available.'}
          </Text>
          {categoriesLoadError ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.85}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {selectedCategory ? (
        <View style={[styles.libraryItemsHeader, bt.libHdr]}>
          <Text style={styles.libraryItemsHeaderText}>{selectedCategory.name}</Text>
        </View>
      ) : null}
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
          {isOutOfStock
            ? 'Out of stock'
            : `Stock ${item.inventory ?? 0}${
                item.unit_of_measure ? ` • ${item.unit_of_measure}` : ''
              }`}
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

