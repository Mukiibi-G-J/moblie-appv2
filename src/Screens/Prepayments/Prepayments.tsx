import React, {useEffect, useRef, useState, useCallback} from 'react';
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
} from 'react-native';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants';
import Header from '../../Components/Header';
import {usePermissions} from '../../hooks/usePermissions';
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
  `UGX ${(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const Prepayments: React.FC = () => {
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PREPAYMENTS;
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

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header title="Prepayments" showBack />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view prepayments.
          </Text>
        </View>
      </View>
    );
  }

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
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    loadPrepayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter]);

  const buildParams = (): PrepaymentListParams => {
    const params: PrepaymentListParams = {page, page_size: 20};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== 'All') params.status = statusFilter;
    return params;
  };

  const loadPrepayments = async () => {
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
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadPrepayments();
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) setPage(prev => prev + 1);
  };

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

  const renderItem = ({item}: {item: Prepayment}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleEdit(item)}
      activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.document_no || 'Prepayment'}</Text>
        <Text
          style={[
            styles.statusBadge,
            item.status === 'Posted' ? styles.statusPosted : styles.statusOpen,
          ]}>
          {item.status || 'Draft'}
        </Text>
      </View>
      <Text style={styles.cardSubtitle}>{item.customer_name || 'Customer'}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Deposit</Text>
        <Text style={styles.cardValue}>
          {formatAmount(item.deposit_amount || item.total_amount)}
        </Text>
      </View>
      <View style={styles.cardActions}>
        {canDelete(PAGE_NAME) && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => handleDelete(item)}>
            <Text style={styles.linkText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search prepayments..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
        {searchLoading && (
          <ActivityIndicator size="small" color={COLORS.primary} />
        )}
      </View>
      <View style={styles.filterRow}>
        <View style={styles.filterChipRow}>
          {STATUS_FILTERS.map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                statusFilter === status && styles.filterChipActive,
              ]}
              onPress={() => {
                setStatusFilter(status);
                setPage(1);
              }}>
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === status && styles.filterChipTextActive,
                ]}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.totalText}>{totalCount} items</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Prepayments" showBack />
      {renderHeader()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading prepayments...</Text>
        </View>
      ) : (
        <FlatList
          data={prepayments}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={
            prepayments.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No prepayments found</Text>
              {canCreate(PAGE_NAME) && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreate}>
                  <Text style={styles.primaryButtonText}>Create Prepayment</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
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
        />
      )}
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.fab} onPress={handleCreate}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
      <PrepaymentFormModal
        visible={isFormVisible}
        onClose={() => {
          setIsFormVisible(false);
          setSelectedPrepayment(null);
        }}
        prepayment={selectedPrepayment}
        onSaved={handleRefresh}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.white},
  header: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
    backgroundColor: COLORS.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
  },
  searchInput: {
    flex: 1,
    height: 44,
    ...FONTS.body3,
    color: COLORS.black,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.base,
  },
  filterChipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  filterChip: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    backgroundColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
  },
  filterChipActive: {backgroundColor: COLORS.primary},
  filterChipText: {...FONTS.body4, color: COLORS.gray},
  filterChipTextActive: {color: COLORS.white},
  totalText: {...FONTS.body4, color: COLORS.gray},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {...FONTS.body3, color: COLORS.gray, marginTop: SIZES.base},
  list: {padding: SIZES.padding},
  emptyList: {flexGrow: 1, padding: SIZES.padding},
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {...FONTS.h4, color: COLORS.black, fontWeight: '600'},
  cardSubtitle: {...FONTS.body3, color: COLORS.gray, marginBottom: 6},
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLabel: {...FONTS.body4, color: COLORS.gray},
  cardValue: {...FONTS.body3, color: COLORS.black, fontWeight: '600'},
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: 12,
    ...FONTS.body4,
  },
  statusPosted: {backgroundColor: '#E7F5FF', color: '#1C7ED6'},
  statusOpen: {backgroundColor: '#F4FCE3', color: '#2B8A3E'},
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SIZES.base,
    gap: 16,
  },
  linkButton: {paddingHorizontal: 6, paddingVertical: 2},
  linkText: {...FONTS.body4, color: COLORS.primary, fontWeight: '600'},
  emptyState: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  emptyText: {...FONTS.body3, color: COLORS.gray, marginBottom: SIZES.base},
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
  },
  primaryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  footerLoader: {padding: SIZES.padding, alignItems: 'center'},
  fab: {
    position: 'absolute',
    right: SIZES.padding,
    bottom: SIZES.padding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: {...FONTS.h2, color: COLORS.white},
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: SIZES.radius,
  },
  accessDeniedTitle: {...FONTS.h2, color: COLORS.error, marginBottom: SIZES.base},
  accessDeniedMessage: {...FONTS.body3, color: COLORS.gray, textAlign: 'center'},
});

export default Prepayments;



