import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {fetchPurchasesData} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import Header from '../../Components/Header';

type PurchaseHistoryFilter = 'today' | 'last7days' | 'last30days';

type PurchaseLine = {
  id: number;
  item_name: string;
  item_no: string;
  quantity: string;
  unit_cost: string;
  total_amount: string;
  unit_of_measure?: string;
};

type PurchaseInvoice = {
  id?: number;
  system_id?: string;
  invoice_no?: string;
  vendor_name?: string;
  document_date?: string;
  total_amount?: number;
  status?: 'Open' | 'Posted' | 'Draft' | 'Cancelled';
  vendor_invoice_no?: string;
  lines?: PurchaseLine[];
};

const FILTERS: {id: PurchaseHistoryFilter; label: string}[] = [
  {id: 'today', label: 'Today'},
  {id: 'last7days', label: 'Last 7 days'},
  {id: 'last30days', label: 'Last 30 days'},
];

const Purchases = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const {canRead, canCreate, canEdit} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PURCHASES;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header
          title="Purchases"
          showBack={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view purchases.
          </Text>
        </View>
      </View>
    );
  }

  const [activeFilter, setActiveFilter] =
    useState<PurchaseHistoryFilter>('today');
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PurchaseInvoice | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'Posted'>(
    'Open',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  const {startDate, endDate} = useMemo(() => {
    // Get current date in local timezone (Uganda)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    // Create date objects in local timezone (not UTC)
    const end = new Date(year, month, day);

    let start = new Date(year, month, day);

    if (activeFilter === 'last7days') {
      start = new Date(year, month, day - 6);
    } else if (activeFilter === 'last30days') {
      start = new Date(year, month, day - 29);
    }

    // Format dates as YYYY-MM-DD in local timezone
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const formattedStart = formatDate(start);
    const formattedEnd = formatDate(end);

    return {
      startDate: formattedStart,
      endDate: formattedEnd,
    };
  }, [activeFilter]);

  const loadPurchases = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {
        startDate,
        endDate,
        page: currentPage,
        pageSize: itemsPerPage,
      };

      // Apply status filter
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      // Apply search
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }

      const response = await fetchPurchasesData(filters);

      if (response && response.results && Array.isArray(response.results)) {
        setPurchases(response.results);
        setTotalCount(response.count || 0);
        setTotalPages(Math.ceil((response.count || 0) / itemsPerPage));
      } else {
        setPurchases([]);
        setTotalPages(0);
        setTotalCount(0);
      }
    } catch (err: any) {
      console.error('Purchases: Error loading purchases:', err);
      setError('Unable to load purchases. Please try again.');
      setPurchases([]);
      setTotalPages(0);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadPurchases();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [startDate, endDate, currentPage, statusFilter, searchQuery]);

  // Reload data when screen is focused
  useEffect(() => {
    if (isFocused) {
      loadPurchases();
    }
  }, [isFocused]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadPurchases();
    setRefreshing(false);
  }, [startDate, endDate, statusFilter, searchQuery]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1);
    setSearchLoading(true);
  };

  const handleApplyFilter = () => {
    setCurrentPage(1);
    setFilterModalVisible(false);
    loadPurchases();
  };

  const handleClearFilter = () => {
    setStatusFilter('Open');
    setSearchQuery('');
    setCurrentPage(1);
    setFilterModalVisible(false);
  };

  const hasActiveFilters = statusFilter !== 'Open' || searchQuery.trim() !== '';

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[
            styles.pageButton,
            currentPage === 1 && styles.disabledButton,
          ]}
          onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          activeOpacity={0.7}>
          <Text
            style={
              currentPage === 1
                ? styles.disabledButtonText
                : styles.pageButtonText
            }>
            ⟨ Previous
          </Text>
        </TouchableOpacity>

        <View style={styles.pageInfoContainer}>
          <Text style={styles.pageInfo}>
            Page {currentPage} of {totalPages || 0}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.pageButton,
            currentPage === (totalPages || 0) && styles.disabledButton,
          ]}
          onPress={() =>
            setCurrentPage(prev => Math.min(totalPages || 0, prev + 1))
          }
          disabled={currentPage === (totalPages || 0)}
          activeOpacity={0.7}>
          <Text
            style={
              currentPage === (totalPages || 0)
                ? styles.disabledButtonText
                : styles.pageButtonText
            }>
            Next ⟩
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const totalAmount = useMemo(() => {
    return purchases.reduce(
      (sum, invoice) => sum + (invoice?.total_amount || 0),
      0,
    );
  }, [purchases]);

  const averagePurchase = useMemo(() => {
    if (!purchases.length) {
      return 0;
    }
    return totalAmount / purchases.length;
  }, [purchases.length, totalAmount]);

  const renderFilterPills = () => (
    <View style={styles.filterRow}>
      {FILTERS.map(filter => {
        const isActive = activeFilter === filter.id;
        return (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterPill, isActive && styles.filterPillActive]}
            onPress={() => setActiveFilter(filter.id)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.filterLabel,
                isActive && styles.filterLabelActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryCardIcon}>
          <Image
            source={icons.salesCount as ImageSourcePropType}
            style={styles.summaryCardIconImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.summaryLabel}>Purchase Count</Text>
        <Text style={styles.summaryValue}>
          {totalCount || purchases.length}
        </Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryCardIcon, styles.revenueIcon]}>
          <Image
            source={icons.revenue as ImageSourcePropType}
            style={styles.summaryCardIconImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.summaryLabel}>Total Amount</Text>
        <Text style={styles.summaryValue}>
          UGX {Math.round(totalAmount).toLocaleString()}
        </Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryCardIcon, styles.avgIcon]}>
          <Image
            source={icons.average as ImageSourcePropType}
            style={styles.summaryCardIconImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.summaryLabel}>Avg Purchase</Text>
        <Text style={styles.summaryValue}>
          UGX {Math.round(averagePurchase).toLocaleString()}
        </Text>
      </View>
    </View>
  );

  const getStatusColor = (status: PurchaseInvoice['status']) => {
    switch (status) {
      case 'Posted':
        return COLORS.success;
      case 'Open':
        return COLORS.warning;
      case 'Draft':
        return COLORS.primary;
      case 'Cancelled':
        return COLORS.error;
      default:
        return COLORS.gray;
    }
  };

  const handleEditPurchase = (purchase: PurchaseInvoice) => {
    if (!canEdit(PAGE_NAME)) {
      Alert.alert(
        'Access Denied',
        'You do not have permission to edit purchases.',
      );
      return;
    }
    if (purchase.status === 'Posted') {
      Alert.alert('Cannot Edit', 'Posted purchases cannot be edited.');
      return;
    }
    (navigation as any).navigate('PurchaseCreation', {purchase});
  };

  const renderHistoryItem = ({item}: {item: PurchaseInvoice}) => (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={() => {
        if (item.status === 'Posted' || !canEdit(PAGE_NAME)) {
          setSelectedItem(item);
          setModalVisible(true);
        } else {
          handleEditPurchase(item);
        }
      }}
      activeOpacity={0.7}>
      <View style={styles.historyCardHeader}>
        <View style={styles.historyCardLeft}>
          <Text style={styles.historyTitle} numberOfLines={1}>
            {item?.vendor_name || 'Unknown Vendor'}
          </Text>
          <Text style={styles.historyInvoice}>
            Invoice #{item?.invoice_no || '—'}
          </Text>
        </View>
        <View style={styles.historyCardRight}>
          <Text style={styles.historyAmount}>
            UGX {(item?.total_amount || 0).toLocaleString()}
          </Text>
          {item?.status && (
            <View
              style={[
                styles.statusBadge,
                {backgroundColor: getStatusColor(item.status) + '20'},
              ]}>
              <View
                style={[
                  styles.statusDot,
                  {backgroundColor: getStatusColor(item.status)},
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {color: getStatusColor(item.status)},
                ]}>
                {item.status}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.historyCardFooter}>
        <View style={styles.historyMetaItem}>
          <Image
            source={icons.calender as ImageSourcePropType}
            style={styles.metaIcon}
            resizeMode="contain"
          />
          <Text style={styles.historyMeta}>
            {new Date(item?.document_date || '').toLocaleDateString()}
          </Text>
        </View>
        {item?.vendor_invoice_no && (
          <View style={styles.historyMetaItem}>
            <Image
              source={icons.calender as ImageSourcePropType}
              style={styles.metaIcon}
              resizeMode="contain"
            />
            <Text style={styles.historyMeta}>{item.vendor_invoice_no}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHistory = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading purchases...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Image
              source={icons.cross as ImageSourcePropType}
              style={styles.emptyIconImage}
            />
          </View>
          <Text style={styles.emptyTitle}>Error Loading Purchases</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadPurchases}
            activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={purchases}
        keyExtractor={item =>
          `${
            item?.id ||
            item?.system_id ||
            item?.invoice_no ||
            Math.random().toString(36)
          }`
        }
        renderItem={renderHistoryItem}
        contentContainerStyle={
          purchases.length ? styles.listContent : styles.emptyContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Image
                source={icons.cross as ImageSourcePropType}
                style={styles.emptyIconImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.emptyTitle}>No purchases found</Text>
            <Text style={styles.emptyText}>
              {hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'Change the date filter or try again later.'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={handleClearFilter}
                activeOpacity={0.7}>
                <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />
    );
  };

  const renderDetailModal = () => {
    if (!selectedItem) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Invoice: {selectedItem.invoice_no || '—'}
              </Text>
              <TouchableOpacity
                style={styles.closeIconButton}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}>
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={styles.closeIcon}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalInfoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Vendor:</Text>
                  <Text style={styles.infoValue}>
                    {selectedItem.vendor_name || 'Unknown Vendor'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(
                      selectedItem.document_date || '',
                    ).toLocaleDateString()}
                  </Text>
                </View>
                {selectedItem.status && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusColor(selectedItem.status) + '20',
                        },
                      ]}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getStatusColor(
                              selectedItem.status,
                            ),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          {color: getStatusColor(selectedItem.status)},
                        ]}>
                        {selectedItem.status}
                      </Text>
                    </View>
                  </View>
                )}
                {selectedItem.vendor_invoice_no && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vendor Invoice No:</Text>
                    <Text style={styles.infoValue}>
                      {selectedItem.vendor_invoice_no}
                    </Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total:</Text>
                  <Text style={styles.totalAmount}>
                    UGX {(selectedItem.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              {selectedItem.lines && selectedItem.lines.length > 0 && (
                <View style={styles.linesContainer}>
                  <Text style={styles.modalSubtitle}>Items Purchased</Text>
                  {selectedItem.lines.map((line, index) => (
                    <View key={line.id || index} style={styles.lineItem}>
                      <View style={styles.lineItemHeader}>
                        <Text style={styles.lineItemName}>
                          {line.item_name}
                        </Text>
                        <Text style={styles.lineItemCode}>{line.item_no}</Text>
                      </View>
                      <View style={styles.lineItemDetails}>
                        <Text style={styles.lineItemDetail}>
                          Qty: {line.quantity} {line.unit_of_measure || 'PCS'}
                        </Text>
                        <Text style={styles.lineItemDetail}>
                          Cost: UGX{' '}
                          {parseFloat(line.unit_cost || '0').toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>
                        Total: UGX{' '}
                        {parseFloat(line.total_amount || '0').toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Purchases"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={styles.searchIconContainer}>
            <Image
              source={icons.search as ImageSourcePropType}
              style={styles.searchIcon}
              resizeMode="contain"
            />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by vendor or invoice..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading && (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
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
            source={icons.filter as ImageSourcePropType}
            style={[
              styles.filterIcon,
              hasActiveFilters && styles.filterIconActive,
            ]}
            resizeMode="contain"
          />
          {hasActiveFilters && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {renderFilterPills()}
        {renderSummaryCards()}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Purchase History</Text>
            {canCreate(PAGE_NAME) && (
              <TouchableOpacity
                style={styles.newPurchaseButton}
                onPress={() => (navigation as any).navigate('PurchaseCreation')}
                activeOpacity={0.7}>
                <Image
                  source={icons.plus as ImageSourcePropType}
                  style={styles.newPurchaseIcon}
                  resizeMode="contain"
                />
                <Text style={styles.newPurchaseButtonText}>New Purchase</Text>
              </TouchableOpacity>
            )}
          </View>
          {renderHistory()}
        </View>
      </View>

      {/* Pagination */}
      {renderPagination()}

      {renderDetailModal()}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Purchases</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.filterCloseButton}>
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={styles.filterCloseIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.filterScrollView}
              showsVerticalScrollIndicator={false}>
              {/* Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Status</Text>
                <View style={styles.stockFilterContainer}>
                  {[
                    {value: 'all', label: 'All Status'},
                    {value: 'Open', label: 'Open'},
                    {value: 'Posted', label: 'Posted'},
                  ].map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.stockFilterButton,
                        statusFilter === option.value &&
                          styles.stockFilterButtonActive,
                      ]}
                      onPress={() => setStatusFilter(option.value as any)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.stockFilterButtonText,
                          statusFilter === option.value &&
                            styles.stockFilterButtonTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray2,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightGray2,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    margin: SIZES.base * 2,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  searchContainer: {
    padding: SIZES.base * 2,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    height: 48,
  },
  searchIconContainer: {
    marginRight: SIZES.base,
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
    width: 48,
    height: 48,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  filterIconActive: {
    tintColor: COLORS.white,
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
  filterRow: {
    flexDirection: 'row',
    marginBottom: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 2,
    gap: SIZES.base,
  },
  filterPill: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius * 2,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontSize: 13,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: COLORS.white,
    fontWeight: '600',
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
  revenueIcon: {
    backgroundColor: COLORS.success + '15',
  },
  avgIcon: {
    backgroundColor: COLORS.warning + '15',
  },
  summaryCardIconImage: {
    width: 24,
    height: 24,
    tintColor: COLORS.primary,
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
  historySection: {
    flex: 1,
    paddingHorizontal: SIZES.base * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  sectionHeading: {
    ...FONTS.h3,
    color: COLORS.black,
    fontWeight: '600',
    flex: 1,
  },
  newPurchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    gap: SIZES.base * 0.5,
  },
  newPurchaseIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.white,
  },
  newPurchaseButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: SIZES.padding,
  },
  emptyContent: {
    flexGrow: 1,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
    marginBottom: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.base * 1.5,
  },
  historyCardLeft: {
    flex: 1,
    marginRight: SIZES.base,
  },
  historyCardRight: {
    alignItems: 'flex-end',
  },
  historyTitle: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  historyInvoice: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontSize: 12,
  },
  historyAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: SIZES.radius * 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SIZES.base * 0.5,
  },
  statusText: {
    ...FONTS.body5,
    fontSize: 11,
    fontWeight: '600',
  },
  historyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SIZES.base * 1.5,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    gap: SIZES.base * 2,
  },
  historyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base * 0.5,
  },
  metaIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  historyMeta: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    marginTop: SIZES.base * 1.5,
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
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyIconImage: {
    width: 40,
    height: 40,
    tintColor: COLORS.gray2,
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: SIZES.base * 2,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
  },
  clearFiltersButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginTop: SIZES.base,
  },
  clearFiltersButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 2,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  pageButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray1,
    opacity: 0.5,
  },
  pageButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  disabledButtonText: {
    ...FONTS.body4,
    color: COLORS.gray3,
  },
  pageInfoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pageInfo: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '90%',
    paddingBottom: SIZES.padding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    fontWeight: '600',
    flex: 1,
  },
  closeIconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  modalInfoContainer: {
    padding: SIZES.base * 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  infoLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  infoValue: {
    ...FONTS.body4,
    color: COLORS.black,
    flex: 1,
    textAlign: 'right',
  },
  totalAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: '600',
  },
  linesContainer: {
    padding: SIZES.base * 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  modalSubtitle: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 1.5,
  },
  lineItem: {
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.5,
    marginBottom: SIZES.base,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.base * 0.75,
  },
  lineItemName: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    flex: 1,
  },
  lineItemCode: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 11,
  },
  lineItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.base * 0.5,
  },
  lineItemDetail: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 12,
  },
  lineItemTotal: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'right',
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
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

export default Purchases;
