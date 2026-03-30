import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../constants';
import {
  fetchCategories,
  fetchItems,
  ItemCategory,
} from '../services/app.services';
import type {CartItem} from '../@types/types.dto';

type BrowseTab = 'keypad' | 'library' | 'favorites';

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

type Props = {
  onAddItem: (item: CartItem) => void;
  onScanPress?: () => void;
  showScanButton?: boolean;
  hideSearchBar?: boolean;
};

const TAB_OPTIONS: Array<{id: BrowseTab; label: string}> = [
  {id: 'keypad', label: 'Keypad'},
  {id: 'library', label: 'Library'},
  {id: 'favorites', label: 'Favorites'},
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
    return 'USh0.00';
  }

  return `USh${parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const SalesItemBrowser: React.FC<Props> = ({
  onAddItem,
  onScanPress,
  showScanButton = false,
  hideSearchBar = false,
}) => {
  const [activeTab, setActiveTab] = useState<BrowseTab>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<SalesCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | number | null
  >(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cachedItems, setCachedItems] = useState<Record<string, CartItem>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Record<string, boolean>>(
    {},
  );
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const libraryListRef = useRef<FlatList<CartItem>>(null);
  const addedTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const selectedCategory = useMemo(
    () =>
      categories.find(category => String(category.id) === String(selectedCategoryId)) ??
      null,
    [categories, selectedCategoryId],
  );

  const favoriteItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return favoriteIds
      .map(id => cachedItems[id])
      .filter(Boolean)
      .filter(item => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          item.item_name?.toLowerCase().includes(normalizedQuery) ||
          item.no?.toLowerCase().includes(normalizedQuery) ||
          item.bar_code_no?.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [cachedItems, favoriteIds, searchQuery]);

  const keypadItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    return items;
  }, [items, searchQuery]);

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
        activeTab === 'library' || (activeTab === 'keypad' && searchQuery.trim());

      if (!shouldBrowseLibrary) {
        return;
      }

      try {
        if (replace) {
          setLoadingItems(true);
        } else {
          setLoadingMore(true);
        }

        const response: PaginatedItemsResponse = await fetchItems(
          pageToLoad,
          searchQuery,
          selectedCategoryId ? Number(selectedCategoryId) || (selectedCategoryId as any) : undefined,
        );

        const nextItems = Array.isArray(response?.results) ? response.results : [];
        mergeCachedItems(nextItems);
        setItems(previous => (replace ? nextItems : [...previous, ...nextItems]));
        setCurrentPage(pageToLoad);
        setHasNextPage(Boolean(response?.next));
      } catch (error) {
        console.error('Error loading sales browser items:', error);
        if (replace) {
          setItems([]);
        }
        setHasNextPage(false);
      } finally {
        setLoadingItems(false);
        setLoadingMore(false);
      }
    },
    [activeTab, mergeCachedItems, searchQuery, selectedCategoryId],
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
      if (
        activeTab === 'library' ||
        (activeTab === 'keypad' && searchQuery.trim().length > 0)
      ) {
        loadItems(1, true);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [activeTab, searchQuery, selectedCategoryId, loadItems]);

  useEffect(() => {
    if (activeTab !== 'library') {
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

  const handleToggleFavorite = (item: CartItem) => {
    mergeCachedItems([item]);
    setFavoriteIds(previous =>
      previous.includes(item.system_id)
        ? previous.filter(id => id !== item.system_id)
        : [item.system_id, ...previous],
    );
  };

  const handleAddItem = (item: CartItem) => {
    if ((Number(item.inventory) || 0) <= 0) {
      return;
    }

    onAddItem(item);

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
  };

  const renderTabButton = (tab: {id: BrowseTab; label: string}) => {
    const isActive = activeTab === tab.id;

    return (
      <TouchableOpacity
        key={tab.id}
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab.id)}
        activeOpacity={0.8}>
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSearchBar = () => (
    <View style={styles.searchRow}>
      <View style={styles.searchInputWrap}>
        <Image source={icons.search} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            activeTab === 'favorites'
              ? 'Search favorites'
              : activeTab === 'keypad'
                ? 'Search or scan item code'
                : selectedCategory
                  ? `Search in ${selectedCategory.name}`
                  : 'Search products'
          }
          placeholderTextColor={COLORS.gray}
          style={styles.searchInput}
          returnKeyType="search"
        />
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

  const renderCategoryRow = ({item}: {item: SalesCategory}) => (
    <TouchableOpacity
      style={[
        styles.listRow,
        String(selectedCategoryId) === String(item.id) && styles.selectedListRow,
      ]}
      onPress={() => {
        setSelectedCategoryId(item.id);
        setTimeout(() => {
          libraryListRef.current?.scrollToOffset({
            offset: categories.length * 74 + 28,
            animated: true,
          });
        }, 120);
      }}
      activeOpacity={0.75}>
      <View style={styles.initialsTile}>
        <Text style={styles.initialsText}>{item.initials}</Text>
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSubtitle}>
          {String(selectedCategoryId) === String(item.id)
            ? 'Showing items below'
            : 'Tap to browse items'}
        </Text>
      </View>

      <Image source={icons.down_arrow} style={styles.rowChevron} />
    </TouchableOpacity>
  );

  const renderItemRow = ({item}: {item: CartItem}) => {
    const isFavorite = favoriteIds.includes(item.system_id);
    const isRecentlyAdded = Boolean(recentlyAddedIds[item.system_id]);
    const isOutOfStock = (Number(item.inventory) || 0) <= 0;
    const initials = getInitials(item.item_name || 'IT') || 'IT';

    return (
      <TouchableOpacity
        style={[styles.listRow, isOutOfStock && styles.disabledListRow]}
        onPress={() => handleAddItem(item)}
        activeOpacity={isOutOfStock ? 1 : 0.75}
        disabled={isOutOfStock}>
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
            style={[styles.rowSubtitle, isOutOfStock && styles.disabledRowSubtitle]}
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
            <>
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={event => {
                  event.stopPropagation();
                  handleToggleFavorite(item);
                }}
                activeOpacity={0.7}>
                <Image
                  source={icons.star}
                  style={[
                    styles.favoriteIcon,
                    isFavorite && styles.favoriteIconActive,
                  ]}
                />
              </TouchableOpacity>
              <Text style={styles.rowAmount}>{formatMoney(item.unit_price)}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderLibrary = () => {
    if (loadingCategories && !categories.length) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="small" color={COLORS.primary2} />
          <Text style={styles.stateText}>Loading categories...</Text>
        </View>
      );
    }

    return (
      <FlatList
        ref={libraryListRef}
        data={items}
        keyExtractor={item => item.system_id}
        renderItem={renderItemRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {categories.length ? (
              <View>
                {categories.map(category => (
                  <View key={String(category.id)}>{renderCategoryRow({item: category})}</View>
                ))}
                <View style={styles.librarySectionGap} />
              </View>
            ) : (
              <View style={styles.stateWrap}>
                <Text style={styles.stateText}>No categories available.</Text>
              </View>
            )}

            {selectedCategory ? (
              <View style={styles.libraryItemsHeader}>
                <Text style={styles.libraryItemsHeaderText}>
                  {selectedCategory.name}
                </Text>
              </View>
            ) : null}
          </View>
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
              <Text style={styles.stateText}>Loading items...</Text>
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>No items found for this search.</Text>
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

  const renderKeypad = () => (
    <View>
      {!searchQuery.trim() ? (
        <View style={styles.keypadCard}>
          <Text style={styles.keypadTitle}>Quick item search</Text>
          <Text style={styles.keypadSubtitle}>
            Type an item name or barcode above, or tap scan to add products fast.
          </Text>
        </View>
      ) : loadingItems && !keypadItems.length ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="small" color={COLORS.primary2} />
          <Text style={styles.stateText}>Searching items...</Text>
        </View>
      ) : (
        <FlatList
          data={keypadItems}
          keyExtractor={item => item.system_id}
          renderItem={renderItemRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>No items match this code or name.</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderFavorites = () => (
    <FlatList
      data={favoriteItems}
      keyExtractor={item => item.system_id}
      renderItem={renderItemRow}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>
            No favorites yet. Tap the star on an item to save it here.
          </Text>
        </View>
      }
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabsWrap}>{TAB_OPTIONS.map(renderTabButton)}</View>
      {!hideSearchBar ? renderSearchBar() : null}
      <View style={styles.bodyCard}>
        {activeTab === 'library' && renderLibrary()}
        {activeTab === 'keypad' && renderKeypad()}
        {activeTab === 'favorites' && renderFavorites()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.transparentPrimary2,
    borderRadius: 18,
    padding: 4,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.white,
    shadowColor: COLORS.primary2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  tabButtonText: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: COLORS.primary2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: COLORS.transparentPrimary2,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    ...FONTS.body4,
    color: COLORS.primary2,
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
  bodyCard: {
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    minHeight: 220,
    maxHeight: 450,
  },
  listContent: {
    paddingVertical: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
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
  favoriteButton: {
    marginBottom: 4,
    padding: 2,
  },
  favoriteIcon: {
    width: 16,
    height: 16,
    tintColor: '#BFC3C9',
  },
  favoriteIconActive: {
    tintColor: COLORS.primary2,
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
  keypadCard: {
    padding: 18,
  },
  keypadTitle: {
    ...FONTS.h3,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  keypadSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray,
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
});

export default SalesItemBrowser;
