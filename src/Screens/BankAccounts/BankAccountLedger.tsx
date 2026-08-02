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
} from 'react-native';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants';
import Header from '../../Components/Header';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {
  BankAccountLedgerEntry,
  PaginatedBankAccountLedgerResponse,
} from '../../@types/bankAccount';
import {BankAccountServices} from '../../services/BankAccountServices';

const formatAmount = (amt?: number) =>
  formatCurrencyCompact(amt);

const BankAccountLedger: React.FC = () => {
  const {canRead} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.BANK_ACCOUNT_LEDGER_ENTRIES;

  const [entries, setEntries] = useState<BankAccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header title="Bank Account Ledger" showBack />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view bank account ledgers.
          </Text>
        </View>
      </View>
    );
  }

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
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
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, bankAccountNo]);

  const buildParams = () => {
    const params: any = {page, page_size: 20, ordering: '-posting_date'};
    if (debouncedSearch) params.search = debouncedSearch;
    if (bankAccountNo) params.bank_account_no = bankAccountNo;
    return params;
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const response: PaginatedBankAccountLedgerResponse =
        await BankAccountServices.getBankAccountLedgerEntries(buildParams());
      if (response?.results && Array.isArray(response.results)) {
        if (page === 1) {
          setEntries(response.results);
        } else {
          setEntries(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setEntries([]);
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
        setEntries([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.response?.data?.detail || 'Failed to load ledger entries',
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
    loadEntries();
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) setPage(prev => prev + 1);
  };

  const renderItem = ({item}: {item: BankAccountLedgerEntry}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.document_no || 'Doc'}</Text>
        <Text style={styles.cardBadge}>{item.bank_account_no || '—'}</Text>
      </View>
      <Text style={styles.cardSub}>
        {item.posting_date} • {item.document_type || '—'}
      </Text>
      <Text style={styles.cardDesc}>{item.description || '—'}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Debit</Text>
        <Text style={styles.cardValue}>{formatAmount(item.debit_amount)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Credit</Text>
        <Text style={styles.cardValue}>{formatAmount(item.credit_amount)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Balance</Text>
        <Text style={styles.cardValue}>{formatAmount(item.balance)}</Text>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search ledger entries..."
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
        <TextInput
          placeholder="Bank Account No (optional)"
          placeholderTextColor={COLORS.gray}
          value={bankAccountNo}
          onChangeText={setBankAccountNo}
          style={[styles.searchInput, {marginTop: SIZES.base}]}
        />
        <Text style={styles.totalText}>{totalCount} items</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Bank Account Ledger" showBack />
      {renderHeader()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading ledger entries...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => `${item.entry_no || idx}`}
          renderItem={renderItem}
          contentContainerStyle={
            entries.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No ledger entries found</Text>
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
    marginTop: SIZES.base,
  },
  totalText: {...FONTS.body4, color: COLORS.gray, marginTop: SIZES.base / 2},
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
  cardBadge: {
    ...FONTS.body4,
    color: COLORS.primary,
    backgroundColor: COLORS.lightGray1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardSub: {...FONTS.body4, color: COLORS.gray, marginBottom: 4},
  cardDesc: {...FONTS.body4, color: COLORS.black},
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLabel: {...FONTS.body4, color: COLORS.gray},
  cardValue: {...FONTS.body3, color: COLORS.black, fontWeight: '600'},
  emptyState: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  emptyText: {...FONTS.body3, color: COLORS.gray, marginBottom: SIZES.base},
  footerLoader: {padding: SIZES.padding, alignItems: 'center'},
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

export default BankAccountLedger;



