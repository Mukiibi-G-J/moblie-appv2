import React, {useState, useEffect, useCallback, useRef} from 'react';
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
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {VendorServices} from '../../services/VendorServices';
import {PaymentJournalServices} from '../../services/PaymentJournalServices';
import {
  Vendor,
  PaymentMethod,
} from '../../@types/vendor';
import {VendorLedgerEntry} from '../../@types/paymentJournal';
import {QuickIconPressable} from '../../Components';
import SupplierListItem from './SupplierListItem';
import VendorFormModal from './VendorFormModal';

const isProtectedGeneralVendor = (vendor?: Vendor | null) =>
  vendor?.no === 'VENDOR-000001';

const Suppliers: React.FC = () => {
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.SUPPLIERS;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view suppliers.
          </Text>
        </View>
      </View>
    );
  }

  // State management
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [ledgerModalVisible, setLedgerModalVisible] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [selectedLedgerVendor, setSelectedLedgerVendor] =
    useState<Vendor | null>(null);
  const [vendorLedgerEntries, setVendorLedgerEntries] = useState<
    VendorLedgerEntry[]
  >([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1); // Reset to first page on search
      setSearchLoading(false);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load reference data
  useEffect(() => {
    loadReferenceData();
  }, []);

  // Load vendors when filters change
  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearchQuery]);

  const loadReferenceData = async () => {
    try {
      const methods = await VendorServices.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading reference data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load reference data',
      });
    }
  };

  const loadVendors = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: 20,
      };

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      const response = await VendorServices.getVendors(params);

      if (response && response.results && Array.isArray(response.results)) {
        if (page === 1) {
          setVendors(response.results);
        } else {
          setVendors(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setVendors([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('Error loading vendors:', error);
      const invalidPage =
        error?.response?.data?.detail === 'Invalid page.' ||
        error?.response?.data?.error === 'Invalid page.';

      if (invalidPage && page > 1) {
        setPage(1);
        setHasMore(false);
      } else {
        setVendors([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.response?.data?.detail || 'Failed to load suppliers',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadVendors();
  }, [debouncedSearchQuery]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleCreate = () => {
    setSelectedVendor(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (vendor: Vendor) => {
    if (isProtectedGeneralVendor(vendor)) {
      Alert.alert(
        'Protected supplier',
        'The General Vendor cannot be edited.',
      );
      return;
    }
    setSelectedVendor(vendor);
    setIsFormModalVisible(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (isProtectedGeneralVendor(vendor)) {
      Alert.alert(
        'Protected supplier',
        'The General Vendor cannot be deleted.',
      );
      return;
    }

    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to delete supplier ${vendor.name}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await VendorServices.deleteVendor(vendor.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Supplier deleted successfully',
              });
              onRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to delete supplier',
              });
            }
          },
        },
      ],
    );
  };

  const handleFormSave = () => {
    setIsFormModalVisible(false);
    setSelectedVendor(null);
    onRefresh();
  };

  const handleOpenBalanceDrilldown = async (vendor: Vendor) => {
    const hasBalance = Math.abs(parseFloat(vendor.balance || '0')) > 0;
    if (!hasBalance) {
      return;
    }

    setSelectedLedgerVendor(vendor);
    setLedgerModalVisible(true);
    setLedgerLoading(true);
    try {
      const response = await PaymentJournalServices.getVendorLedgerEntries(
        vendor.id,
      );
      setVendorLedgerEntries(response?.ledger_entries || []);
    } catch (error) {
      console.error('Error loading vendor ledger entries:', error);
      setVendorLedgerEntries([]);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load supplier ledger entries.',
      });
    } finally {
      setLedgerLoading(false);
    }
  };

  const hasActiveFilters = searchQuery.trim() !== '';

  const handleClearFilter = () => {
    setSearchQuery('');
    setPage(1);
    setFilterModalVisible(false);
  };

  const handleApplyFilter = () => {
    setPage(1);
    setFilterModalVisible(false);
    loadVendors();
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
      <Text style={styles.emptyText}>No suppliers found</Text>
      <Text style={styles.emptySubtext}>
        {hasActiveFilters
          ? 'Try adjusting your filters or search query.'
          : canCreate(PAGE_NAME)
          ? 'Create your first supplier to get started.'
          : 'No suppliers available.'}
      </Text>
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create Supplier</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Suppliers</Text>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.75}>
            <Image
              source={icons.menu}
              style={styles.moreButtonIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

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
            placeholder="Search suppliers..."
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

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.loadingText}>Loading suppliers...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={vendors}
          keyExtractor={item => item.id.toString()}
          renderItem={({item}) => (
            <SupplierListItem
              vendor={item}
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
            vendors.length === 0
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
              <Text style={styles.filterModalTitle}>Filter Suppliers</Text>
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
                  Search Suppliers
                </Text>
                <Text style={styles.filterSectionSubtext}>
                  Use the search bar above to find suppliers by name, phone, or
                  ID
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
                {selectedLedgerVendor?.name || 'Supplier'} balance
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
                UGX{' '}
                {(parseFloat(selectedLedgerVendor?.balance || '0') || 0)
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
                data={vendorLedgerEntries}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.ledgerListContent}
                ListEmptyComponent={
                  <View style={styles.ledgerEmptyContainer}>
                    <Text style={styles.emptyText}>No ledger entries found</Text>
                    <Text style={styles.emptySubtext}>
                      This supplier has no open payable entries to drill into.
                    </Text>
                  </View>
                }
                renderItem={({item}) => (
                  <View style={styles.ledgerRow}>
                    <View style={styles.ledgerRowTextWrap}>
                      <Text style={styles.ledgerDocumentNo}>{item.document_no}</Text>
                      <Text style={styles.ledgerDescription}>
                        {item.description || 'Supplier ledger entry'}
                      </Text>
                    </View>
                    <Text style={styles.ledgerAmount}>
                      UGX {item.remaining_amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <VendorFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedVendor(null);
        }}
        vendor={selectedVendor}
        onSave={handleFormSave}
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
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  screenTitle: {
    ...FONTS.h1,
    color: COLORS.black,
    fontSize: 24,
    fontWeight: '700',
  },
  moreButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.primary3,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.base * 2,
    marginBottom: SIZES.base * 1.5,
    paddingHorizontal: SIZES.base * 2,
    gap: SIZES.base,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  summaryCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 0.75,
  },
  summaryCardIconSecondary: {
    backgroundColor: COLORS.success + '15',
  },
  summaryCardIconImage: {
    width: 24,
    height: 24,
    tintColor: COLORS.primary,
  },
  summaryCardIconImageSecondary: {
    tintColor: COLORS.success,
  },
  summaryLabel: {
    ...FONTS.body5,
    color: COLORS.gray2,
    marginBottom: SIZES.base * 0.25,
    fontSize: 10,
    textAlign: 'center',
  },
  summaryValue: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SIZES.base * 0.25,
    fontSize: 16,
  },
  summarySubtext: {
    ...FONTS.body5,
    color: COLORS.gray2,
    textAlign: 'center',
    fontSize: 10,
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
  ledgerEmptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 8,
    alignItems: 'center',
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

export default Suppliers;
