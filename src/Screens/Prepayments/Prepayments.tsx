import React, {useEffect, useRef, useState, useCallback} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {QuickIconPressable} from '../../Components';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import {usePermissions} from '../../hooks/usePermissions';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';
import {
  PaginatedPrepaymentResponse,
  Prepayment,
  PrepaymentListParams,
  PrepaymentStatus,
} from '../../@types/prepayment';
import {PrepaymentService} from '../../services/PrepaymentService';
import PrepaymentFormModal from './PrepaymentFormModal';

const STATUS_FILTERS: (PrepaymentStatus | 'All')[] = [
  'Draft',
  'Posted',
  'Cancelled',
  'All',
];

const formatAmount = (amount?: number) =>
  formatCurrencyCompact(amount);

const getPrepaymentInitials = (documentNo?: string | null) => {
  if (!documentNo?.trim()) {
    return 'PP';
  }
  const alnum = documentNo.replace(/[^a-zA-Z0-9]/g, '');
  if (alnum.length >= 2) {
    return alnum.slice(0, 2).toUpperCase();
  }
  if (alnum.length === 1) {
    return alnum.toUpperCase();
  }
  return 'PP';
};

const Prepayments: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {selectedTab, setSelectedTab} = useTabContext();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PREPAYMENTS;
  const canReadPrepayments = canRead(PAGE_NAME);

  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PrepaymentStatus | 'All'>(
    'All',
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPrepayment, setSelectedPrepayment] =
    useState<Prepayment | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onSelectTab = useCallback(
    (tab: string) => {
      setSelectedTab(tab);
      navigation.navigate('Home' as never);
    },
    [navigation, setSelectedTab],
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
      setSearchLoading(false);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const buildParams = useCallback((): PrepaymentListParams => {
    const params: PrepaymentListParams = {page, page_size: 20};
    if (debouncedSearch) {
      params.search = debouncedSearch;
    }
    if (statusFilter !== 'All') {
      params.status = statusFilter;
    }
    return params;
  }, [page, debouncedSearch, statusFilter]);

  const loadPrepayments = useCallback(async () => {
    if (!canReadPrepayments) {
      return;
    }
    try {
      setLoading(true);
      const response: PaginatedPrepaymentResponse =
        await PrepaymentService.fetchPrepayments(buildParams());
      if (response?.results && Array.isArray(response.results)) {
        if (page === 1) {
          setPrepayments(response.results);
        } else {
          setPrepayments(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setPrepayments([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error: any) {
      const invalidPage =
        error?.response?.data?.detail === 'Invalid page.' ||
        error?.response?.data?.error === 'Invalid page.';
      if (invalidPage && page > 1) {
        setPage(1);
        setHasMore(false);
      } else {
        setPrepayments([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.response?.data?.detail || 'Failed to load prepayments',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildParams, canReadPrepayments, page]);

  useEffect(() => {
    loadPrepayments();
  }, [loadPrepayments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    if (page === 1) {
      loadPrepayments();
    } else {
      setPage(1);
    }
  }, [page, loadPrepayments]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && !refreshing) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore, refreshing]);

  const handleCreate = () => {
    setSelectedPrepayment(null);
    setIsFormVisible(true);
  };

  const handleEdit = (prepayment: Prepayment) => {
    setSelectedPrepayment(prepayment);
    setIsFormVisible(true);
  };

  const handleDelete = (prepayment: Prepayment) => {
    if (prepayment.status === 'Posted') {
      Alert.alert('Cannot Delete', 'Posted prepayments cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete Prepayment',
      `Delete ${prepayment.document_no || prepayment.id}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PrepaymentService.deletePrepayment(prepayment.id);
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Prepayment deleted',
              });
              handleRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail ||
                  'Failed to delete prepayment',
              });
            }
          },
        },
      ],
    );
  };

  const handleSaved = () => {
    setIsFormVisible(false);
    setSelectedPrepayment(null);
    setPage(1);
    loadPrepayments();
  };

  const renderTopHeader = (showTrailingCreate: boolean) => (
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
          source={icons.back}
          style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
          resizeMode="contain"
        />
      </QuickIconPressable>
      <Text style={[styles.allItemsTitle, {color: colors.textPrimary}]}>
        Prepayments
      </Text>
      <View style={styles.headerTrailing}>
        {showTrailingCreate && canCreate(PAGE_NAME) ? (
          <TouchableOpacity
            onPress={handleCreate}
            style={styles.headerActionButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Create prepayment">
            <Image
              source={icons.plus}
              style={styles.headerActionIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
      </View>
    </View>
  );

  const renderSearch = () => (
    <View
      style={[
        styles.searchContainerOuter,
        {backgroundColor: colors.background},
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
          source={icons.search}
          style={[styles.searchIcon, {tintColor: colors.iconMuted}]}
          resizeMode="contain"
        />
        <TextInput
          style={[styles.searchInput, {color: colors.textPrimary}]}
          placeholder="Search prepayments..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchLoading ? (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
          </View>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipRow}>
        {STATUS_FILTERS.map(status => {
          const active = statusFilter === status;
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active
                    ? COLORS.primary2
                    : colors.inputBackground,
                  borderColor: active ? COLORS.primary2 : colors.border,
                },
              ]}
              onPress={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.filterChipText,
                  {color: active ? COLORS.white : colors.textSecondary},
                ]}>
                {status}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[styles.totalText, {color: colors.textSecondary}]}>
        {totalCount} prepayment{totalCount === 1 ? '' : 's'}
      </Text>
    </View>
  );

  const renderItem = ({item}: {item: Prepayment}) => {
    const initials = getPrepaymentInitials(item.document_no);

    return (
      <TouchableOpacity
        style={[styles.row, {borderBottomColor: colors.border}]}
        onPress={() => handleEdit(item)}
        activeOpacity={0.7}>
        <View
          style={[
            styles.rowThumb,
            {backgroundColor: colors.screenMuted},
          ]}>
          <Text style={[styles.rowThumbText, {color: colors.textSecondary}]}>
            {initials}
          </Text>
        </View>
        <View style={styles.rowMiddle}>
          <Text
            style={[styles.rowTitle, {color: colors.textPrimary}]}
            numberOfLines={1}>
            {item.document_no || 'Prepayment'}
          </Text>
          <Text
            style={[styles.rowSubtitle, {color: colors.textSecondary}]}
            numberOfLines={1}>
            {item.customer_name || 'Customer'}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, {color: colors.textPrimary}]}>
            {formatAmount(item.deposit_amount || item.total_amount)}
          </Text>
          <View style={styles.rowRightBottom}>
            <Text
              style={[
                styles.statusPill,
                {
                  color: colors.textSecondary,
                  backgroundColor: colors.screenMuted,
                  borderColor: colors.border,
                },
              ]}>
              {item.status || 'Draft'}
            </Text>
            {canDelete(PAGE_NAME) && item.status !== 'Posted' ? (
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={ICON_BUTTON_HIT_SLOP}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete prepayment">
                <Image
                  source={icons.delete_icon}
                  style={styles.deleteIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconContainer,
          {backgroundColor: colors.screenMuted},
        ]}
        accessibilityRole="image"
        accessibilityLabel="No prepayments">
        <Image
          source={icons.wallet}
          style={[styles.emptyStateIcon, {tintColor: colors.iconMuted}]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
        No prepayments found
      </Text>
      <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
        {searchQuery.trim() || statusFilter !== 'All'
          ? 'Try adjusting your search or filters'
          : canCreate(PAGE_NAME)
            ? 'Create your first prepayment to get started.'
            : 'No prepayments at the moment.'}
      </Text>
      {canCreate(PAGE_NAME) &&
      !searchQuery.trim() &&
      statusFilter === 'All' ? (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create prepayment</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!canReadPrepayments) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        {renderTopHeader(false)}
        <View
          style={[
            styles.accessDeniedContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}>
          <Text style={[styles.accessDeniedTitle, {color: COLORS.error}]}>
            Access Denied
          </Text>
          <Text
            style={[styles.accessDeniedMessage, {color: colors.textSecondary}]}>
            You don't have permission to view prepayments.
          </Text>
        </View>
        <MainBottomTabBar
          selectedTab={selectedTab}
          onSelectTab={onSelectTab}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {renderTopHeader(true)}
      {renderSearch()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading prepayments...
          </Text>
        </View>
      ) : (
        <View style={styles.listFlex}>
          <FlatList
            style={styles.listFlex}
            data={prepayments}
            keyExtractor={item => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={
              prepayments.length === 0 ? styles.listEmptyGrow : undefined
            }
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.primary2]}
                tintColor={COLORS.primary2}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              loading && page > 1 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                </View>
              ) : null
            }
          />
        </View>
      )}
      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectTab}
      />
      <PrepaymentFormModal
        visible={isFormVisible}
        onClose={() => {
          setIsFormVisible(false);
          setSelectedPrepayment(null);
        }}
        prepayment={selectedPrepayment}
        onSaved={handleSaved}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
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
  headerRoundIcon: {width: 20, height: 20},
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
  headerTrailingSpacer: {width: 40, height: 40},
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: {width: 18, height: 18, tintColor: COLORS.white},
  searchContainerOuter: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchIcon: {width: 20, height: 20, marginRight: 10},
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 12,
    minHeight: 48,
  },
  searchLoadingContainer: {paddingLeft: 8},
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterChipText: {...FONTS.body4, fontWeight: '600'},
  totalText: {...FONTS.body4, marginTop: 4},
  listFlex: {flex: 1},
  listEmptyGrow: {flexGrow: 1},
  row: {
    marginHorizontal: SIZES.padding,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowThumbText: {...FONTS.body3, fontWeight: '700', fontSize: 13},
  rowMiddle: {flex: 1, minWidth: 0},
  rowTitle: {...FONTS.h3, fontSize: 16, fontWeight: '700', marginBottom: 2},
  rowSubtitle: {...FONTS.body3, marginBottom: 2},
  rowRight: {alignItems: 'flex-end', marginLeft: 8, maxWidth: '40%'},
  rowAmount: {...FONTS.body3, fontWeight: '600', marginBottom: 6, textAlign: 'right'},
  rowRightBottom: {flexDirection: 'row', alignItems: 'center', gap: 8},
  statusPill: {
    ...FONTS.body4,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleteIcon: {width: 20, height: 20, tintColor: COLORS.error},
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyStateIcon: {width: 40, height: 40},
  emptyTitle: {...FONTS.h3, marginBottom: SIZES.base, textAlign: 'center'},
  emptyText: {...FONTS.body3, textAlign: 'center', maxWidth: 280},
  emptyButton: {
    marginTop: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
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
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {...FONTS.body3, marginTop: SIZES.base},
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    margin: SIZES.base * 2,
    borderRadius: SIZES.radius,
  },
  accessDeniedTitle: {...FONTS.h2, marginBottom: SIZES.base * 1.5, textAlign: 'center'},
  accessDeniedMessage: {...FONTS.body3, textAlign: 'center'},
});

export default Prepayments;
