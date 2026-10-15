import React, {useState, useEffect, useCallback, useRef} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {usePermissions} from '../../hooks/usePermissions';
import {
  useCustomersQuery,
  usePaymentMethodsQuery,
  useInvalidateCustomers,
} from '../../hooks/useCustomersQuery';
import {PAGE_NAMES} from '../../constants/pageNames';
import {CustomerServices} from '../../services/CustomerServices';
import {PaymentJournalServices} from '../../services/PaymentJournalServices';
import {Customer} from '../../@types/customer';
import {CustomerLedgerEntry} from '../../@types/paymentJournal';
import {QuickIconPressable} from '../../Components';
import CustomerListItem from './CustomerListItem';
import CustomerFormModal from './CustomerFormModal';

const isProtectedGeneralCustomer = (customer?: Customer | null) => {
  const normalizedName = customer?.name?.trim().toLowerCase();
  return normalizedName === 'general' || normalizedName === 'general customer';
};


const Customers = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.CUSTOMER_MANAGEMENT;

  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(
    typeof route.params?.initialSearch === 'string'
      ? route.params.initialSearch
      : '',
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    typeof route.params?.initialSearch === 'string'
      ? route.params.initialSearch
      : '',
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [ledgerModalVisible, setLedgerModalVisible] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] =
    useState<Customer | null>(null);
  const [customerLedgerEntries, setCustomerLedgerEntries] = useState<
    CustomerLedgerEntry[]
  >([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const invalidateCustomers = useInvalidateCustomers();
  const {data: paymentMethods = []} = usePaymentMethodsQuery();
  const {
    customers,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage: hasMore,
    refetch: refetchCustomers,
    fetchNextPage,
    error: customersError,
  } = useCustomersQuery({
    searchQuery: debouncedSearchQuery,
  });

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setSearchLoading(false);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!customersError) {
      return;
    }
    const detail =
      (customersError as any)?.response?.data?.detail ||
      (customersError as any)?.message ||
      'Failed to load customers';
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: String(detail),
    });
  }, [customersError]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await invalidateCustomers();
      await refetchCustomers();
    } finally {
      setRefreshing(false);
    }
  }, [invalidateCustomers, refetchCustomers]);

  const handleLoadMore = () => {
    if (!loading && !isFetchingNextPage && hasMore) {
      fetchNextPage();
    }
  };

  const handleCreate = () => {
    setSelectedCustomer(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (customer: Customer) => {
    if (isProtectedGeneralCustomer(customer)) {
      Alert.alert(
        'Protected customer',
        'The General Customer cannot be edited.',
      );
      return;
    }

    setSelectedCustomer(customer);
    setIsFormModalVisible(true);
  };

  const handleDelete = async (customer: Customer) => {
    if (isProtectedGeneralCustomer(customer)) {
      Alert.alert(
        'Protected customer',
        'The General Customer cannot be deleted.',
      );
      return;
    }

    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete customer ${customer.name}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CustomerServices.deleteCustomer(customer.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Customer deleted successfully',
              });
              onRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to delete customer',
              });
            }
          },
        },
      ],
    );
  };

  const handleOpenBalanceDrilldown = async (customer: Customer) => {
    const hasBalance = Math.abs(parseFloat(customer.balance || '0')) > 0;
    if (!hasBalance) {
      return;
    }

    setSelectedLedgerCustomer(customer);
    setLedgerModalVisible(true);
    setLedgerLoading(true);
    try {
      const response = await PaymentJournalServices.getCustomerLedgerEntries(
        customer.id,
      );
      setCustomerLedgerEntries(response?.ledger_entries || []);
    } catch (error) {
      console.error('Error loading customer ledger entries:', error);
      setCustomerLedgerEntries([]);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load customer ledger entries.',
      });
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleFormSave = () => {
    onRefresh();
  };

  const handleRecordChange = (record: Customer) => {
    setSelectedCustomer(record);
  };

  const hasActiveFilters = searchQuery.trim() !== '';

  const handleClearFilter = () => {
    setSearchQuery('');
    setFilterModalVisible(false);
  };

  const handleApplyFilter = () => {
    setFilterModalVisible(false);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Image
          source={icons.cross}
          style={styles.emptyIconImage}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.emptyText}>No customers found</Text>
      <Text style={styles.emptySubtext}>
        {hasActiveFilters
          ? 'Try adjusting your filters or search query.'
          : canCreate(PAGE_NAME)
          ? 'Create your first customer to get started.'
          : 'No customers available.'}
      </Text>
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create Customer</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  const renderTopHeader = (showTrailingMenu = true) => (
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
        Customers
      </Text>
      <View style={styles.headerTrailing}>
        {showTrailingMenu ? (
          <TouchableOpacity
            style={[
              styles.headerRoundButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.75}
            accessibilityLabel="Open filters">
            <Image
              source={icons.menu}
              style={[styles.headerMenuIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
      </View>
    </View>
  );

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        {renderTopHeader(false)}
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view customers.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.headerSection, {backgroundColor: colors.background}]}>
        {renderTopHeader(true)}

        <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={styles.searchIconContainer}>
            <Image
              source={icons.search}
              style={styles.searchIcon}
              resizeMode="contain"
            />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchLoading && (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            hasActiveFilters && styles.filterButtonActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}>
          <Image
            source={icons.filter}
            style={[
              styles.filterIcon,
              hasActiveFilters && styles.filterIconActive,
            ]}
            resizeMode="contain"
          />
          {hasActiveFilters && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>
      </View>

      {loading && customers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={customers}
          keyExtractor={item => item.id.toString()}
          renderItem={({item}) => (
            <CustomerListItem
              customer={item}
              onEdit={canEdit(PAGE_NAME) ? handleEdit : undefined}
              onDelete={canDelete(PAGE_NAME) ? handleDelete : undefined}
              onBalancePress={handleOpenBalanceDrilldown}
            />
          )}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          contentContainerStyle={
            customers.length === 0
              ? styles.emptyListContainer
              : styles.listContentContainer
          }
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          bounces={true}
        />
      )}

      {canCreate(PAGE_NAME) && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={handleCreate}
          activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Customers</Text>
              <QuickIconPressable
                onPress={() => setFilterModalVisible(false)}
                style={styles.filterCloseButton}
                accessibilityLabel="Close">
                <Image
                  source={icons.cross}
                  style={styles.filterCloseIcon}
                  resizeMode="contain"
                />
              </QuickIconPressable>
            </View>

            <ScrollView
              style={styles.filterScrollView}
              showsVerticalScrollIndicator={false}>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>
                  Search Customers
                </Text>
                <Text style={styles.filterSectionSubtext}>
                  Use the search bar above to find customers by name, phone, or ID
                </Text>
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

      <Modal
        visible={ledgerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLedgerModalVisible(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>
                {selectedLedgerCustomer?.name || 'Customer'} balance
              </Text>
              <QuickIconPressable
                onPress={() => setLedgerModalVisible(false)}
                style={styles.filterCloseButton}
                accessibilityLabel="Close">
                <Image
                  source={icons.cross}
                  style={styles.filterCloseIcon}
                  resizeMode="contain"
                />
              </QuickIconPressable>
            </View>

            <View style={styles.ledgerSummaryCard}>
              <Text style={styles.ledgerSummaryLabel}>Outstanding balance</Text>
              <Text style={styles.ledgerSummaryValue}>
                {getLocalCurrencyCode()}{' '}
                {(parseFloat(selectedLedgerCustomer?.balance || '0') || 0)
                  .toFixed(0)
                  .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </Text>
            </View>

            {ledgerLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary2} />
                <Text style={styles.loadingText}>Loading ledger entries...</Text>
              </View>
            ) : (
              <FlatList
                data={customerLedgerEntries}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.ledgerListContent}
                ListEmptyComponent={
                  <View style={styles.contactsEmptyContainer}>
                    <Text style={styles.emptyText}>No ledger entries found</Text>
                    <Text style={styles.emptySubtext}>
                      This customer has no open receivable entries to drill into.
                    </Text>
                  </View>
                }
                renderItem={({item}) => (
                  <View style={styles.ledgerRow}>
                    <View style={styles.ledgerRowTextWrap}>
                      <Text style={styles.ledgerDocumentNo}>{item.document_no}</Text>
                      <Text style={styles.ledgerDescription}>
                        {item.description || 'Customer ledger entry'}
                      </Text>
                    </View>
                    <Text style={styles.ledgerAmount}>
                      {formatCurrencyCompact(item.remaining_amount)}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <CustomerFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedCustomer(null);
          onRefresh();
        }}
        customer={selectedCustomer}
        onSave={handleFormSave}
        onRecordChange={handleRecordChange}
        paymentMethods={paymentMethods}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 180,
  },
  headerSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
  },
  allItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerMenuIcon: {
    width: 18,
    height: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  searchIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
    paddingVertical: 0,
  },
  searchLoadingContainer: {
    marginLeft: SIZES.base,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  filterButtonActive: {
    backgroundColor: COLORS.transparentPrimary,
    borderColor: COLORS.primary2,
  },
  filterIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  filterIconActive: {
    tintColor: COLORS.primary2,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingTop: 36,
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
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyIconImage: {
    width: 40,
    height: 40,
    tintColor: COLORS.primary2,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: SIZES.base * 2,
  },
  emptyButton: {
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    shadowColor: COLORS.primary2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
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
  fab: {
    position: 'absolute',
    right: SIZES.padding,
    bottom: 130,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  fabText: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: '300',
    lineHeight: 32,
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
  filterModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '80%',
    paddingBottom: SIZES.padding,
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
    ...FONTS.h3,
    color: COLORS.black,
    fontWeight: '600',
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCloseIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  filterScrollView: {
    maxHeight: 400,
  },
  ledgerSummaryCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.transparentPrimary,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  ledgerSummaryLabel: {
    ...FONTS.body4,
    color: COLORS.primary3,
    marginBottom: 6,
    fontWeight: '600',
  },
  ledgerSummaryValue: {
    ...FONTS.h3,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  ledgerListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    gap: 12,
  },
  ledgerRowTextWrap: {
    flex: 1,
  },
  ledgerDocumentNo: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '700',
    marginBottom: 4,
  },
  ledgerDescription: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  ledgerAmount: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  contactsEmptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  filterSection: {
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  filterSectionLabel: {
    ...FONTS.h4,
    color: COLORS.black,
    marginBottom: SIZES.base * 1.5,
    fontWeight: '600',
  },
  filterSectionSubtext: {
    ...FONTS.body4,
    color: COLORS.gray2,
    lineHeight: 20,
  },
  stockFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.base,
  },
  stockFilterButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  stockFilterButtonActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  stockFilterButtonText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  stockFilterButtonTextActive: {
    color: COLORS.primary,
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
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearFilterText: {
    ...FONTS.button,
    color: COLORS.gray2,
    fontSize: 14,
  },
  applyFilterText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
  },
});

export default Customers;
