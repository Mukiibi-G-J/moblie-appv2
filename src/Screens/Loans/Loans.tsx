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
  Loan,
  LoanListParams,
  LoanStatus,
  PaginatedLoanResponse,
} from '../../@types/loans';
import {LoanServices} from '../../services/LoanServices';
import LoanFormModal from './LoanFormModal';

const STATUS_FILTERS: (LoanStatus | 'All')[] = ['Open', 'Posted', 'Cancelled', 'All'];

const formatAmount = (amount?: number) => {
  return `UGX ${(amount || 0)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const Loans: React.FC = () => {
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.LOAN_REGISTRATION;
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'All'>('Open');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header title="Loans" showBack />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view loans.
          </Text>
        </View>
      </View>
    );
  }

  // Debounce search
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

  useEffect(() => {
    loadLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter]);

  const buildParams = (): LoanListParams => {
    const params: LoanListParams = {
      page,
      page_size: 20,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== 'All') params.status = statusFilter;
    return params;
  };

  const loadLoans = async () => {
    try {
      setLoading(true);
      const response: PaginatedLoanResponse = await LoanServices.getLoans(
        buildParams(),
      );
      if (response && response.results && Array.isArray(response.results)) {
        if (page === 1) {
          setLoans(response.results);
        } else {
          setLoans(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setLoans([]);
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
        setLoans([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.response?.data?.detail || 'Failed to load loans',
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
    loadLoans();
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleCreate = () => {
    setSelectedLoan(null);
    setIsFormVisible(true);
  };

  const handleEdit = (loan: Loan) => {
    if (loan.status === 'Posted') {
      Alert.alert('Cannot Edit', 'Posted loans cannot be edited.');
      return;
    }
    setSelectedLoan(loan);
    setIsFormVisible(true);
  };

  const handleDelete = (loan: Loan) => {
    if (loan.status === 'Posted') {
      Alert.alert('Cannot Delete', 'Posted loans cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete Loan',
      `Are you sure you want to delete ${loan.document_no || 'this loan'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await LoanServices.deleteLoan(loan.id);
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Loan deleted successfully',
              });
              handleRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to delete loan',
              });
            }
          },
        },
      ],
    );
  };

  const handlePost = (loan: Loan) => {
    if (loan.status === 'Posted') {
      Alert.alert('Already Posted', 'This loan is already posted.');
      return;
    }
    // Basic bank validation
    if (
      loan.repayment_account === 'Bank/Mobile Money' &&
      !loan.bank_account
    ) {
      Alert.alert(
        'Bank Account Required',
        'Please set a bank account before posting.',
      );
      return;
    }
    Alert.alert(
      'Post Loan',
      `Post loan ${loan.document_no || loan.id}? This will create ledger entries.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Post',
          onPress: async () => {
            try {
              await LoanServices.postLoan(loan.id);
              Toast.show({
                type: 'success',
                text1: 'Posted',
                text2: 'Loan posted successfully',
              });
              handleRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to post loan',
              });
            }
          },
        },
      ],
    );
  };

  const renderLoan = ({item}: {item: Loan}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleEdit(item)}
      activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.document_no || 'New Loan'}</Text>
        <Text
          style={[
            styles.statusBadge,
            item.status === 'Posted' ? styles.statusPosted : styles.statusOpen,
          ]}>
          {item.status || 'Open'}
        </Text>
      </View>
      <Text style={styles.cardSubtitle}>{item.lender_name || '—'}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Amount</Text>
        <Text style={styles.cardValue}>{formatAmount(item.loan_amount)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Repayment</Text>
        <Text style={styles.cardValue}>
          {item.repayment_period || 0} months · {item.repayment_account || '—'}
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
        {canEdit(PAGE_NAME) && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => handlePost(item)}>
            <Text style={styles.linkText}>Post</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search loans..."
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
      <Header title="Loans" showBack />
      {renderHeader()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading loans...</Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLoan}
          contentContainerStyle={
            loans.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No loans found</Text>
              {canCreate(PAGE_NAME) && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreate}>
                  <Text style={styles.primaryButtonText}>Create Loan</Text>
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

      <LoanFormModal
        visible={isFormVisible}
        onClose={() => {
          setIsFormVisible(false);
          setSelectedLoan(null);
        }}
        loan={selectedLoan}
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
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    backgroundColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  totalText: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.base,
  },
  list: {
    padding: SIZES.padding,
  },
  emptyList: {
    flexGrow: 1,
    padding: SIZES.padding,
  },
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
  cardTitle: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
  },
  cardSubtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  cardValue: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: 12,
    ...FONTS.body4,
  },
  statusPosted: {
    backgroundColor: '#E7F5FF',
    color: '#1C7ED6',
  },
  statusOpen: {
    backgroundColor: '#F4FCE3',
    color: '#2B8A3E',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SIZES.base,
    gap: 16,
  },
  linkButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  linkText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: SIZES.base,
  },
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
  footerLoader: {
    padding: SIZES.padding,
    alignItems: 'center',
  },
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
  fabText: {
    ...FONTS.h2,
    color: COLORS.white,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: SIZES.radius,
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

export default Loans;



