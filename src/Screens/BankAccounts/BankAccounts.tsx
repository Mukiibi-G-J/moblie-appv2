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
  BankAccount,
  PaginatedBankAccountResponse,
} from '../../@types/bankAccount';
import {BankAccountServices} from '../../services/BankAccountServices';
import BankAccountFormModal from './BankAccountFormModal';

const formatAmount = (amt?: number) =>
  `UGX ${(amt || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const BankAccounts: React.FC = () => {
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.BANK_ACCOUNT_MANAGEMENT;

  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header title="Bank Accounts" showBack />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view bank accounts.
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
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const buildParams = () => {
    const params: any = {page, page_size: 20};
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const response: PaginatedBankAccountResponse =
        await BankAccountServices.getBankAccounts(buildParams());
      if (response?.results && Array.isArray(response.results)) {
        if (page === 1) {
          setItems(response.results);
        } else {
          setItems(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setItems([]);
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
        setItems([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.response?.data?.detail || 'Failed to load bank accounts',
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
    loadItems();
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) setPage(prev => prev + 1);
  };

  const handleCreate = () => {
    setSelected(null);
    setIsFormVisible(true);
  };

  const handleEdit = (item: BankAccount) => {
    setSelected(item);
    setIsFormVisible(true);
  };

  const handleDelete = (item: BankAccount) => {
    Alert.alert(
      'Delete Bank Account',
      `Delete ${item.name || item.no || 'this account'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await BankAccountServices.deleteBankAccount(item.no || item.id!);
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Bank account deleted',
              });
              handleRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail ||
                  'Failed to delete bank account',
              });
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}: {item: BankAccount}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleEdit(item)}
      activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name || 'Bank Account'}</Text>
        <Text style={styles.cardBadge}>{item.no || item.id}</Text>
      </View>
      <Text style={styles.cardSub}>{item.bank_account_no || '—'}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Posting Group</Text>
        <Text style={styles.cardValue}>{item.bank_account_posting_group || '—'}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Min Balance</Text>
        <Text style={styles.cardValue}>{formatAmount(item.min_balance)}</Text>
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
          placeholder="Search bank accounts..."
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
        <Text style={styles.totalText}>{totalCount} items</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Bank Accounts" showBack />
      {renderHeader()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading bank accounts...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, idx) => `${item.no || item.id || idx}`}
          renderItem={renderItem}
          contentContainerStyle={
            items.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No bank accounts found</Text>
              {canCreate(PAGE_NAME) && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreate}>
                  <Text style={styles.primaryButtonText}>Create Bank Account</Text>
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
      <BankAccountFormModal
        visible={isFormVisible}
        onClose={() => {
          setIsFormVisible(false);
          setSelected(null);
        }}
        onSaved={handleRefresh}
        bankAccount={selected}
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
  cardBadge: {
    ...FONTS.body4,
    color: COLORS.primary,
    backgroundColor: COLORS.lightGray1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardSub: {...FONTS.body4, color: COLORS.gray, marginBottom: 6},
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLabel: {...FONTS.body4, color: COLORS.gray},
  cardValue: {...FONTS.body3, color: COLORS.black, fontWeight: '600'},
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

export default BankAccounts;



