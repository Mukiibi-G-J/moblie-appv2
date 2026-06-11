import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {safeGoBack} from '../../hooks/NavigationService';
import {fetchItemJournal} from '../../services/app.services';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {QuickIconPressable} from '../../Components';
import ItemJournalListItem, {type ItemJournalLine} from './ItemJournalListItem';
import {normalizeLine} from './itemJournalUtils';

const PAGE_NAME = PAGE_NAMES.ADJUST_INVENTORY_HISTORY;

const ItemJournalHistory = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {canRead} = usePermissions();
  const hasAccess = canRead(PAGE_NAME);

  const [journals, setJournals] = useState<ItemJournalLine[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
      setSearchLoading(false);
    }, 500);
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery]);

  const loadJournals = useCallback(
    async (pageOverride?: number) => {
      const p = pageOverride ?? page;
      try {
        setLoading(true);
        const response = await fetchItemJournal(p, debouncedSearch, {
          status: 'Posted',
        });
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
      } catch {
        if (p === 1) {
          setJournals([]);
        }
        setHasMore(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch],
  );

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    loadJournals();
  }, [loadJournals, hasAccess]);

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

  const summary = useMemo(() => {
    const totalQty = journals.reduce((sum, line) => sum + (line.quantity || 0), 0);
    return {
      count: journals.length,
      totalQty,
    };
  }, [journals]);

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You do not have permission to view posted adjustments.
          </Text>
        </View>
      </View>
    );
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No posted adjustments</Text>
      <Text style={styles.emptySubtext}>
        Adjust your search to see more results.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
              12,
            ),
          },
        ]}>
        <QuickIconPressable
          style={styles.backButton}
          onPress={() => safeGoBack(navigation, 'ItemJournal')}
          accessibilityLabel="Go back">
          <Image source={icons.back} style={styles.backButtonIcon} resizeMode="contain" />
        </QuickIconPressable>
        <Text style={styles.topTitle}>Posted adjustments</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Image source={icons.search} style={styles.searchIcon} resizeMode="contain" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by document, item, description..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary2} />
          ) : null}
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Records</Text>
          <Text style={styles.summaryValue}>{summary.count}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSecondary]}>
          <Text style={styles.summaryLabel}>Total quantity</Text>
          <Text style={[styles.summaryValue, styles.summaryValueSecondary]}>
            {summary.totalQty.toLocaleString()}
          </Text>
        </View>
      </View>

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.loadingText}>Loading posted adjustments...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={journals}
          keyExtractor={item => item.system_id || String(item.id)}
          renderItem={({item}) => (
            <ItemJournalListItem
              line={item}
              onPress={() => {}}
              onPost={() => {}}
              canOpenLine={false}
              canPost={false}
            />
          )}
          ListEmptyComponent={!loading ? renderEmptyState : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && page > 1 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          contentContainerStyle={
            journals.length === 0 ? styles.emptyListContainer : styles.listContentContainer
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default ItemJournalHistory;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary3,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
    paddingVertical: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.transparentPrimary,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  summaryCardSecondary: {
    backgroundColor: '#F2F5FF',
    borderColor: '#D3DBFF',
  },
  summaryLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginBottom: 4,
    fontWeight: '600',
  },
  summaryValue: {
    ...FONTS.h3,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  summaryValueSecondary: {
    color: '#2F53D8',
  },
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 40,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingTop: 36,
  },
  emptyContainer: {
    paddingVertical: SIZES.padding * 2,
    paddingHorizontal: SIZES.padding,
    alignItems: 'center',
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 280,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    marginTop: SIZES.base,
  },
  footerLoader: {
    paddingVertical: SIZES.padding,
    alignItems: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 16,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.white,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
