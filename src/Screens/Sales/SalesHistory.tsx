import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {
  fetchSalesData,
  fetchSalesSummary,
  fetchSalesUserSummary,
  getSalesInvoice,
  fetchPaymentMethods,
  PaymentMethod,
  SalesHistorySummary,
  SalesUserSummaryRow,
} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

type SalesHistoryFilter = 'today' | 'last7days' | 'last30days';

type SalesLine = {
  id: number;
  item_name: string;
  item_no: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  unit_of_measure?: string;
};

type SalesInvoice = {
  id?: number;
  invoice_no?: string;
  customer_name?: string;
  document_date?: string;
  total_amount?: number;
  payment_method_name?: string;
  status?: 'Draft' | 'Open' | 'Posted' | 'Cancelled';
  user_name?: string;
  lines?: SalesLine[];
};

const FILTERS: {id: SalesHistoryFilter; label: string}[] = [
  {id: 'today', label: 'Today'},
  {id: 'last7days', label: 'Last 7 days'},
  {id: 'last30days', label: 'Last 30 days'},
];

const SalesHistory = () => {
  const {canRead} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.SALES_HISTORY;
  const isFocused = useIsFocused();
  const [activeFilter, setActiveFilter] = useState<SalesHistoryFilter>('today');
  const [sales, setSales] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalesInvoice | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Posted' | 'Draft'>(
    'Posted',
  );
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    'all' | 'paid' | 'unpaid'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;
  const [summaryFromApi, setSummaryFromApi] = useState<SalesHistorySummary | null>(
    null,
  );
  const [userSummaries, setUserSummaries] = useState<SalesUserSummaryRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodIdFilter, setPaymentMethodIdFilter] = useState('');
  const [detailForModal, setDetailForModal] = useState<SalesInvoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

    // Debug logging to verify dates
    console.log('SalesHistory: Date calculation:', {
      now: now.toISOString(),
      localDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day,
      ).padStart(2, '0')}`,
      activeFilter,
      startDate: formattedStart,
      endDate: formattedEnd,
    });

    return {
      startDate: formattedStart,
      endDate: formattedEnd,
    };
  }, [activeFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const methods = await fetchPaymentMethods();
        if (!cancelled) {
          setPaymentMethods(methods);
        }
      } catch {
        if (!cancelled) {
          setPaymentMethods([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSales = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(
        'SalesHistory: Fetching sales data from',
        startDate,
        'to',
        endDate,
      );

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

      // Apply payment status filter
      if (paymentStatusFilter === 'unpaid') {
        filters.paymentMethod = 'not_paid';
      } else if (paymentMethodIdFilter) {
        filters.paymentMethod = paymentMethodIdFilter;
      }

      // Apply search
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }

      const response = await fetchSalesData(filters);

      console.log(
        'SalesHistory: Received sales data:',
        response?.results?.length || 0,
        'items',
      );

      if (response && response.results && Array.isArray(response.results)) {
        console.log(
          'SalesHistory: Setting sales data, first item:',
          response.results[0],
        );
        setSales(response.results);
        setTotalCount(response.count || 0);
        setTotalPages(Math.ceil((response.count || 0) / itemsPerPage));

        const summaryFilters = {
          startDate,
          endDate,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          paymentMethod: filters.paymentMethod,
          search: searchQuery.trim() || undefined,
        };
        const [summary, users] = await Promise.all([
          fetchSalesSummary(summaryFilters),
          fetchSalesUserSummary(summaryFilters),
        ]);
        setSummaryFromApi(summary);
        setUserSummaries(users);
      } else {
        console.log('SalesHistory: Invalid response format:', response);
        setSales([]);
        setTotalPages(0);
        setTotalCount(0);
        setSummaryFromApi(null);
        setUserSummaries([]);
      }
    } catch (err: any) {
      console.error('SalesHistory: Error loading sales:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError('Unable to load sales history. Please try again.');
      setSales([]);
      setTotalPages(0);
      setTotalCount(0);
      setSummaryFromApi(null);
      setUserSummaries([]);
    } finally {
      setIsLoading(false);
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadSales();
    }, 500); // Debounce search

    return () => clearTimeout(debounceTimer);
  }, [
    startDate,
    endDate,
    currentPage,
    statusFilter,
    paymentStatusFilter,
    paymentMethodIdFilter,
    searchQuery,
  ]);

  // Reload data when screen is focused (like Cart)
  useEffect(() => {
    if (isFocused) {
      loadSales();
    }
  }, [isFocused]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadSales();
    setRefreshing(false);
  }, [
    startDate,
    endDate,
    statusFilter,
    paymentStatusFilter,
    paymentMethodIdFilter,
    searchQuery,
  ]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1); // Reset to first page when searching
    setSearchLoading(true);
  };

  const handleApplyFilter = () => {
    setCurrentPage(1); // Reset to first page when filtering
    setFilterModal(false);
    loadSales();
  };

  const handleClearFilter = () => {
    setStatusFilter('Posted');
    setPaymentStatusFilter('all');
    setPaymentMethodIdFilter('');
    setSearchQuery('');
    setCurrentPage(1);
    setFilterModal(false);
  };

  const hasActiveFilters =
    statusFilter !== 'Posted' ||
    paymentStatusFilter !== 'all' ||
    paymentMethodIdFilter !== '' ||
    searchQuery.trim() !== '';

  const openSaleDetail = async (item: SalesInvoice) => {
    setSelectedItem(item);
    setDetailForModal(null);
    setModalVisible(true);
    if (item.id == null) {
      setDetailForModal(item);
      return;
    }
    setDetailLoading(true);
    try {
      const full = await getSalesInvoice(item.id);
      setDetailForModal({
        ...item,
        ...full,
        lines: full?.lines ?? item.lines,
      });
    } catch {
      setDetailForModal(item);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setModalVisible(false);
    setDetailForModal(null);
    setSelectedItem(null);
    setDetailLoading(false);
  };

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

  const pageRevenueFallback = useMemo(() => {
    return sales.reduce(
      (sum, invoice) => sum + (invoice?.total_amount || 0),
      0,
    );
  }, [sales]);

  const pageProductsFallback = useMemo(() => {
    return sales.reduce((sum, inv) => {
      const lineQty = (inv.lines || []).reduce(
        (ls, line) => ls + (parseInt(String(line.quantity), 10) || 0),
        0,
      );
      return sum + lineQty;
    }, 0);
  }, [sales]);

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

  const renderSummaryCards = () => {
    const invoiceCount =
      summaryFromApi?.total_invoices ?? totalCount ?? sales.length;
    const revenue = summaryFromApi?.total_sales ?? pageRevenueFallback;
    const productsSold =
      summaryFromApi?.total_products ?? pageProductsFallback;

    return (
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryCardIcon}>
            <Image
              source={icons.salesCount}
              style={styles.summaryCardIconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.summaryLabel}>Invoices</Text>
          <Text style={styles.summaryValue}>{invoiceCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryCardIcon, styles.revenueIcon]}>
            <Image
              source={icons.revenue}
              style={styles.summaryCardIconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.summaryLabel}>Revenue</Text>
          <Text style={styles.summaryValue}>
            UGX {Math.round(revenue).toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryCardIcon, styles.avgIcon]}>
            <Image
              source={icons.product}
              style={styles.summaryCardIconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.summaryLabel}>Qty sold</Text>
          <Text style={styles.summaryValue}>
            {Math.round(productsSold).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  const renderUserSummaries = () => {
    if (!userSummaries.length) {
      return null;
    }
    return (
      <View style={styles.userSummarySection}>
        <Text style={styles.userSummaryHeading}>Sales by user</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.userSummaryChips}>
          {userSummaries.map((u, idx) => (
            <View key={`${u.user_id ?? 'u'}-${idx}`} style={styles.userSummaryChip}>
              <Text style={styles.userSummaryName} numberOfLines={1}>
                {u.user_name || 'Unknown'}
              </Text>
              <Text style={styles.userSummaryMeta}>
                UGX {Math.round(u.total_sales).toLocaleString()} ·{' '}
                {u.total_invoices} inv.
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Posted':
        return COLORS.success;
      case 'Open':
        return COLORS.warning;
      case 'Draft':
        return COLORS.info;
      case 'Cancelled':
        return COLORS.error;
      default:
        return COLORS.gray2;
    }
  };

  const renderHistoryItem = ({item}: {item: SalesInvoice}) => (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={() => openSaleDetail(item)}
      activeOpacity={0.7}>
      <View style={styles.historyCardHeader}>
        <View style={styles.historyCardLeft}>
          <Text style={styles.historyTitle} numberOfLines={1}>
            {item?.customer_name || 'Walk-in Customer'}
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
            source={icons.calender}
            style={styles.metaIcon}
            resizeMode="contain"
          />
          <Text style={styles.historyMeta}>
            {new Date(item?.document_date || '').toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.historyMetaItem}>
          <Image
            source={icons.wallet}
            style={styles.metaIcon}
            resizeMode="contain"
          />
          <Text style={styles.historyMeta}>
            {item?.payment_method_name || 'Cash'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHistory = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading sales...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Image source={icons.cross} style={styles.emptyIconImage} />
          </View>
          <Text style={styles.emptyTitle}>Error Loading Sales</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadSales}
            activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={sales}
        keyExtractor={item =>
          `${item?.id || item?.invoice_no || Math.random().toString(36)}`
        }
        renderItem={renderHistoryItem}
        contentContainerStyle={
          sales.length ? styles.listContent : styles.emptyContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Image
                source={icons.cross}
                style={styles.emptyIconImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.emptyTitle}>No sales found</Text>
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
    const displayItem = detailForModal ?? selectedItem;
    if (!displayItem) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeDetailModal}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Invoice: {displayItem.invoice_no || '—'}
              </Text>
              <TouchableOpacity
                style={styles.closeIconButton}
                onPress={closeDetailModal}
                activeOpacity={0.7}>
                <Image
                  source={icons.cross}
                  style={styles.closeIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {detailLoading && (
                <View style={styles.modalLoadingInline}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.modalLoadingText}>Loading line items…</Text>
                </View>
              )}
              <View style={styles.modalInfoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Customer:</Text>
                  <Text style={styles.infoValue}>
                    {displayItem.customer_name || 'Walk-in Customer'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(
                      displayItem.document_date || '',
                    ).toLocaleDateString()}
                  </Text>
                </View>
                {displayItem.status && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusColor(displayItem.status) + '20',
                        },
                      ]}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getStatusColor(
                              displayItem.status,
                            ),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          {color: getStatusColor(displayItem.status)},
                        ]}>
                        {displayItem.status}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment Method:</Text>
                  <Text style={styles.infoValue}>
                    {displayItem.payment_method_name || 'Cash'}
                  </Text>
                </View>
                {displayItem.user_name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Sold by:</Text>
                    <Text style={styles.infoValue}>
                      {displayItem.user_name}
                    </Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total:</Text>
                  <Text style={styles.totalAmount}>
                    UGX {(displayItem.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              {displayItem.lines && displayItem.lines.length > 0 && (
                <View style={styles.linesContainer}>
                  <Text style={styles.modalSubtitle}>Items Sold</Text>
                  {displayItem.lines.map((line, index) => (
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
                          Price: UGX{' '}
                          {parseFloat(line.unit_price || '0').toLocaleString()}
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
              onPress={closeDetailModal}
              activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view sales history.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
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
            placeholder="Search by customer or invoice..."
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
          onPress={() => setFilterModal(true)}
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

      <View style={styles.content}>
        {renderFilterPills()}
        {renderSummaryCards()}
        {renderUserSummaries()}
        <View style={styles.historySection}>
          <Text style={styles.sectionHeading}>Sales History</Text>
          {renderHistory()}
        </View>
      </View>

      {/* Pagination */}
      {renderPagination()}

      {renderDetailModal()}

      {/* Filter Modal */}
      <Modal
        visible={filterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModal(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Sales</Text>
              <TouchableOpacity
                onPress={() => setFilterModal(false)}
                style={styles.filterCloseButton}>
                <Image
                  source={icons.cross}
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
                    {value: 'Posted', label: 'Posted'},
                    {value: 'Draft', label: 'Draft'},
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
                          styles.stockFilterText,
                          statusFilter === option.value &&
                            styles.stockFilterTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionLabel}>Payment Status</Text>
                <View style={styles.stockFilterContainer}>
                  {[
                    {value: 'all', label: 'All'},
                    {value: 'paid', label: 'Paid'},
                    {value: 'unpaid', label: 'Unpaid'},
                  ].map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.stockFilterButton,
                        paymentStatusFilter === option.value &&
                          styles.stockFilterButtonActive,
                      ]}
                      onPress={() => {
                        setPaymentStatusFilter(option.value as any);
                        if (option.value === 'unpaid') {
                          setPaymentMethodIdFilter('');
                        }
                      }}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.stockFilterText,
                          paymentStatusFilter === option.value &&
                            styles.stockFilterTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment method (same as web: financials payment method id) */}
              {paymentStatusFilter !== 'unpaid' && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionLabel}>
                    Payment method
                  </Text>
                  <View style={styles.paymentMethodChips}>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodChip,
                        paymentMethodIdFilter === '' &&
                          styles.paymentMethodChipActive,
                      ]}
                      onPress={() => setPaymentMethodIdFilter('')}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.paymentMethodChipText,
                          paymentMethodIdFilter === '' &&
                            styles.paymentMethodChipTextActive,
                        ]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {paymentMethods.map(pm => (
                      <TouchableOpacity
                        key={pm.id}
                        style={[
                          styles.paymentMethodChip,
                          paymentMethodIdFilter === String(pm.id) &&
                            styles.paymentMethodChipActive,
                        ]}
                        onPress={() =>
                          setPaymentMethodIdFilter(String(pm.id))
                        }
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.paymentMethodChipText,
                            paymentMethodIdFilter === String(pm.id) &&
                              styles.paymentMethodChipTextActive,
                          ]}
                          numberOfLines={1}>
                          {pm.code || pm.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
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

export default SalesHistory;

const styles = StyleSheet.create({
  container: {
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
    marginBottom: SIZES.base * 1.5,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.lightGray2,
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
    marginBottom: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 2,
    gap: SIZES.base,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  revenueIcon: {
    backgroundColor: COLORS.success + '15',
  },
  avgIcon: {
    backgroundColor: COLORS.warning + '15',
  },
  summaryCardIconImage: {
    width: 28,
    height: 28,
    tintColor: COLORS.primary,
  },
  summaryCardIconText: {
    fontSize: 24,
  },
  summaryLabel: {
    ...FONTS.body5,
    color: COLORS.gray2,
    marginBottom: SIZES.base * 0.5,
    fontSize: 11,
    textAlign: 'center',
  },
  summaryValue: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    textAlign: 'center',
  },
  userSummarySection: {
    marginBottom: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 2,
  },
  userSummaryHeading: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginBottom: SIZES.base,
    fontWeight: '600',
  },
  userSummaryChips: {
    flexDirection: 'row',
    gap: SIZES.base,
    paddingRight: SIZES.base * 2,
  },
  userSummaryChip: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    minWidth: 140,
  },
  userSummaryName: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 4,
  },
  userSummaryMeta: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 11,
  },
  paymentMethodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.base,
  },
  paymentMethodChip: {
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    maxWidth: '48%',
  },
  paymentMethodChipActive: {
    backgroundColor: COLORS.primary + '18',
    borderColor: COLORS.primary,
  },
  paymentMethodChipText: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 12,
  },
  paymentMethodChipTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalLoadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
    marginBottom: SIZES.base * 1.5,
  },
  modalLoadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  historySection: {
    flex: 1,
    paddingHorizontal: SIZES.base * 2,
  },
  sectionHeading: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base * 1.5,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
    marginBottom: SIZES.base,
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
    marginBottom: SIZES.base * 0.5,
    fontWeight: '600',
  },
  historyAmount: {
    ...FONTS.h5,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: SIZES.base * 0.5,
  },
  historyInvoice: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 11,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SIZES.base * 1.5,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  historyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base * 0.5,
  },
  metaIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.gray2,
  },
  historyMeta: {
    ...FONTS.body5,
    color: COLORS.gray2,
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: 12,
    gap: SIZES.base * 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...FONTS.body5,
    fontSize: 10,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: SIZES.padding * 2,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
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
  emptyIcon: {
    fontSize: 40,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.overlay2,
    paddingHorizontal: SIZES.base * 2.5,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    width: '100%',
    maxHeight: '90%',
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.black,
    flex: 1,
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalInfoContainer: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  infoLabel: {
    ...FONTS.h4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  infoValue: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  totalAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: '700',
  },
  linesContainer: {
    padding: SIZES.padding,
  },
  modalSubtitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base * 2,
    fontWeight: '600',
  },
  lineItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    paddingVertical: SIZES.base * 1.5,
    marginBottom: SIZES.base,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  lineItemName: {
    ...FONTS.h4,
    fontWeight: '600',
    color: COLORS.black,
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
    marginBottom: SIZES.base,
  },
  lineItemDetail: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  lineItemTotal: {
    ...FONTS.h5,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  closeButton: {
    margin: SIZES.padding,
    padding: SIZES.base * 1.5,
    backgroundColor: COLORS.primary,
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
    fontSize: 15,
  },
  // Pagination Styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  pageButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray1,
  },
  pageButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 13,
  },
  disabledButtonText: {
    ...FONTS.button,
    color: COLORS.gray3,
    fontSize: 13,
  },
  pageInfoContainer: {
    paddingHorizontal: SIZES.base * 2,
  },
  pageInfo: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay2,
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '80%',
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: -5},
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
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
    ...FONTS.h2,
    color: COLORS.black,
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCloseIcon: {
    width: 16,
    height: 16,
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
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  stockFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stockFilterText: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  stockFilterTextActive: {
    color: COLORS.white,
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
    fontSize: 15,
  },
  applyFilterText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
  },
});
