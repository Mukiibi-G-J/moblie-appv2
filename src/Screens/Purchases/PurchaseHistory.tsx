import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Platform,
  StatusBar,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import PurchaseHistoryListItem from './PurchaseHistoryListItem';
import {fetchPurchasesData} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {QuickIconPressable} from '../../Components';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import {safeGoBack} from '../../hooks/NavigationService';

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

const PurchaseHistory = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const {selectedTab, setSelectedTab} = useTabContext();

  const t = useMemo(
    () => ({
      summaryPrimary: isDark
        ? {
            backgroundColor: 'rgba(9, 146, 104, 0.2)',
            borderColor: 'rgba(74, 222, 128, 0.35)',
          }
        : {backgroundColor: '#F0FFF7', borderColor: '#C7F1DA'},
      summarySecondary: isDark
        ? {
            backgroundColor: 'rgba(47, 83, 216, 0.22)',
            borderColor: 'rgba(147, 180, 255, 0.35)',
          }
        : {backgroundColor: '#F2F5FF', borderColor: '#D3DBFF'},
      summaryLabel: {color: colors.textSecondary},
      summaryValuePrimary: {color: isDark ? '#4ADE80' : '#099268'},
      summaryValueSecondary: {color: isDark ? '#93B4FF' : '#2F53D8'},
      summarySubtext: {color: colors.textSecondary},
      filterSummaryRow: {backgroundColor: colors.screenMuted},
      filterSummaryLabel: {color: colors.textSecondary},
      filterSummaryValue: {color: colors.textPrimary},
    }),
    [colors, isDark],
  );
  const {canRead, canCreate, canEdit} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PURCHASES;
  /** Boolean — stable across renders unless auth changes (unlike `canRead` fn reference). */
  const canReadPurchases = canRead(PAGE_NAME);

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
    if (!canReadPurchases) {
      return;
    }
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
    if (!canReadPurchases) {
      return;
    }
    const debounceTimer = setTimeout(() => {
      loadPurchases();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [
    startDate,
    endDate,
    currentPage,
    statusFilter,
    searchQuery,
    canReadPurchases,
  ]);

  // Reload when screen gains focus (e.g. return from Purchase creation)
  useEffect(() => {
    if (!canReadPurchases || !isFocused) {
      return;
    }
    loadPurchases();
  }, [isFocused, canReadPurchases]);

  const onRefresh = useCallback(async () => {
    if (!canReadPurchases) {
      return;
    }
    setRefreshing(true);
    setCurrentPage(1);
    await loadPurchases();
    setRefreshing(false);
  }, [startDate, endDate, statusFilter, searchQuery, canReadPurchases]);

  const onSelectTab = (tab: string) => {
    setSelectedTab(tab);
    navigation.navigate('Home' as never);
  };

  if (!canReadPurchases) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        <View
          style={[
            styles.allItemsHeader,
            {
              paddingTop: Math.max(insets.top, 10),
              backgroundColor: colors.background,
            },
          ]}>
          <QuickIconPressable
            onPress={() => safeGoBack(navigation, 'Home')}
            style={[
              styles.headerRoundButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityLabel="Go back">
            <Image
              source={icons.back}
              style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.screenTitle, {color: colors.textPrimary}]}>
            Purchases
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>
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
            You don't have permission to view purchases.
          </Text>
        </View>
        <MainBottomTabBar
          selectedTab={selectedTab}
          onSelectTab={onSelectTab}
        />
      </View>
    );
  }

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
    setActiveFilter('today');
    setStatusFilter('Open');
    setSearchQuery('');
    setCurrentPage(1);
    setFilterModalVisible(false);
  };

  const hasActiveFilters =
    activeFilter !== 'today' ||
    statusFilter !== 'Open' ||
    searchQuery.trim() !== '';

  const activeFilterLabel = useMemo(() => {
    const dateLabel =
      FILTERS.find(f => f.id === activeFilter)?.label ?? 'Today';
    const statusLabel =
      statusFilter === 'all' ? 'All statuses' : `${statusFilter} only`;
    const parts = [dateLabel, statusLabel];
    if (searchQuery.trim()) {
      parts.push(`Search: "${searchQuery.trim()}"`);
    }
    return parts.join(' · ');
  }, [activeFilter, statusFilter, searchQuery]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <View
        style={[
          styles.paginationContainer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}>
        <TouchableOpacity
          style={[
            styles.pageButton,
            {backgroundColor: colors.inputBackground},
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
          <Text style={[styles.pageInfo, {color: colors.textSecondary}]}>
            Page {currentPage} of {totalPages || 0}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.pageButton,
            {backgroundColor: colors.inputBackground},
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

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, t.summaryPrimary, {borderWidth: 1}]}>
        <Text style={[styles.summaryCardLabel, t.summaryLabel]}>
          Total amount
        </Text>
        <Text style={[styles.summaryValuePrimary, t.summaryValuePrimary]}>
          {formatCurrencyCompact(totalAmount)}
        </Text>
        <Text style={[styles.summarySubtext, t.summarySubtext]}>
          {totalCount || purchases.length} invoice(s) · this page
        </Text>
      </View>
      <View style={[styles.summaryCard, t.summarySecondary, {borderWidth: 1}]}>
        <Text style={[styles.summaryCardLabel, t.summaryLabel]}>
          Avg. purchase
        </Text>
        <Text style={[styles.summaryValueSecondary, t.summaryValueSecondary]}>
          {formatCurrencyCompact(averagePurchase)}
        </Text>
        <Text style={[styles.summarySubtext, t.summarySubtext]}>
          Per invoice (visible rows)
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

  const handlePurchaseRowPress = (item: PurchaseInvoice) => {
    if (item.status === 'Posted' || !canEdit(PAGE_NAME)) {
      setSelectedItem(item);
      setModalVisible(true);
    } else {
      handleEditPurchase(item);
    }
  };

  const renderHistory = () => {
    if (isLoading) {
      return (
        <View style={[styles.listFlex, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading purchases...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.listFlex, styles.emptyContainer]}>
          <View
            style={[
              styles.emptyIconContainer,
              {backgroundColor: colors.inputBackground},
            ]}>
            <Image
              source={icons.cross as ImageSourcePropType}
              style={[styles.emptyIconImage, {tintColor: colors.textTertiary}]}
            />
          </View>
          <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
            Error Loading Purchases
          </Text>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {error}
          </Text>
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
        style={styles.listFlex}
        data={purchases}
        keyExtractor={item =>
          `${
            item?.id ||
            item?.system_id ||
            item?.invoice_no ||
            Math.random().toString(36)
          }`
        }
        renderItem={({item}) => (
          <PurchaseHistoryListItem
            item={item}
            onPress={() => handlePurchaseRowPress(item)}
          />
        )}
        contentContainerStyle={
          purchases.length ? styles.listContent : styles.emptyContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconContainer,
                {backgroundColor: colors.inputBackground},
              ]}>
              <Image
                source={icons.cross as ImageSourcePropType}
                style={[styles.emptyIconImage, {tintColor: colors.textTertiary}]}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
              No purchases found
            </Text>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
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
          <View
            style={[
              styles.modalContent,
              {backgroundColor: colors.surface},
            ]}>
            <View
              style={[
                styles.modalHeader,
                {borderBottomColor: colors.border},
              ]}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                Invoice: {selectedItem.invoice_no || '—'}
              </Text>
              <QuickIconPressable
                style={styles.closeIconButton}
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Close">
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={[styles.closeIcon, {tintColor: colors.textTertiary}]}
                />
              </QuickIconPressable>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalInfoContainer}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>
                    Vendor:
                  </Text>
                  <Text style={[styles.infoValue, {color: colors.textPrimary}]}>
                    {selectedItem.vendor_name || 'Unknown Vendor'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>
                    Date:
                  </Text>
                  <Text style={[styles.infoValue, {color: colors.textPrimary}]}>
                    {new Date(
                      selectedItem.document_date || '',
                    ).toLocaleDateString()}
                  </Text>
                </View>
                {selectedItem.status && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>
                      Status:
                    </Text>
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
                    <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>
                      Vendor Invoice No:
                    </Text>
                    <Text style={[styles.infoValue, {color: colors.textPrimary}]}>
                      {selectedItem.vendor_invoice_no}
                    </Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>
                    Total:
                  </Text>
                  <Text style={styles.totalAmount}>
                    {formatCurrencyCompact(selectedItem.total_amount || 0)}
                  </Text>
                </View>
              </View>

              {selectedItem.lines && selectedItem.lines.length > 0 && (
                <View
                  style={[
                    styles.linesContainer,
                    {borderTopColor: colors.border},
                  ]}>
                  <Text style={[styles.modalSubtitle, {color: colors.textPrimary}]}>
                    Items Purchased
                  </Text>
                  {selectedItem.lines.map((line, index) => (
                    <View
                      key={line.id || index}
                      style={[
                        styles.lineItem,
                        {backgroundColor: colors.inputBackground},
                      ]}>
                      <View style={styles.lineItemHeader}>
                        <Text style={[styles.lineItemName, {color: colors.textPrimary}]}>
                          {line.item_name}
                        </Text>
                        <Text style={[styles.lineItemCode, {color: colors.textSecondary}]}>
                          {line.item_no}
                        </Text>
                      </View>
                      <View style={styles.lineItemDetails}>
                        <Text style={[styles.lineItemDetail, {color: colors.textSecondary}]}>
                          Qty: {line.quantity} {line.unit_of_measure || 'PCS'}
                        </Text>
                        <Text style={[styles.lineItemDetail, {color: colors.textSecondary}]}>
                          Cost: {getLocalCurrencyCode()}{' '}
                          {parseFloat(line.unit_cost || '0').toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>
                        Total: {getLocalCurrencyCode()}{' '}
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
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View
        style={[
          styles.allItemsHeader,
          {
            paddingTop: Math.max(
              insets.top,
              10,
              Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
            ),
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
            source={icons.back as ImageSourcePropType}
            style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.screenTitle, {color: colors.textPrimary}]}>
          Purchases
        </Text>
        <View style={styles.headerTrailing}>
          {canCreate(PAGE_NAME) ? (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('PurchaseCreation')}
              style={styles.headerActionButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="New purchase">
              <Image
                source={icons.plus as ImageSourcePropType}
                style={styles.headerActionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerTrailingSpacer} />
          )}
        </View>
      </View>

      <View
        style={[
          styles.searchContainer,
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
            source={icons.search as ImageSourcePropType}
            style={[styles.searchIcon, {tintColor: colors.iconMuted}]}
            resizeMode="contain"
          />
          <TextInput
            style={[styles.searchInput, {color: colors.textPrimary}]}
            placeholder="Search vendor or invoice"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading ? (
            <View style={styles.searchLoadingPill}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.filterInlineHit}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Filter purchases">
            <Image
              source={icons.filter as ImageSourcePropType}
              style={[
                styles.filterIconInline,
                {
                  tintColor: hasActiveFilters
                    ? COLORS.primary2
                    : colors.iconMuted,
                },
              ]}
              resizeMode="contain"
            />
            {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterSummaryRow, t.filterSummaryRow]}>
        <Text style={[styles.filterSummaryLabel, t.filterSummaryLabel]}>
          Active filters:
        </Text>
        <Text style={[styles.filterSummaryValue, t.filterSummaryValue]}>
          {activeFilterLabel}
        </Text>
      </View>

      {renderSummary()}

      <View style={styles.listFlex}>{renderHistory()}</View>

      {renderPagination()}

      {renderDetailModal()}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.filterModalOverlay}>
          <View
            style={[
              styles.filterModalContent,
              {backgroundColor: colors.surface},
            ]}>
            <View
              style={[
                styles.filterModalHeader,
                {borderBottomColor: colors.border},
              ]}>
              <Text style={[styles.filterModalTitle, {color: colors.textPrimary}]}>
                Filter Purchases
              </Text>
              <QuickIconPressable
                onPress={() => setFilterModalVisible(false)}
                style={styles.filterCloseButton}
                accessibilityLabel="Close">
                <Image
                  source={icons.cross as ImageSourcePropType}
                  style={[styles.filterCloseIcon, {tintColor: colors.textTertiary}]}
                  resizeMode="contain"
                />
              </QuickIconPressable>
            </View>

            <ScrollView
              style={styles.filterScrollView}
              showsVerticalScrollIndicator={false}>
              <View
                style={[
                  styles.filterSection,
                  {borderBottomColor: colors.border},
                ]}>
                <Text
                  style={[styles.filterSectionLabel, {color: colors.textPrimary}]}>
                  Date range
                </Text>
                <View style={styles.stockFilterContainer}>
                  {FILTERS.map(filter => (
                    <TouchableOpacity
                      key={filter.id}
                      style={[
                        styles.stockFilterButton,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                        },
                        activeFilter === filter.id &&
                          styles.stockFilterButtonActive,
                      ]}
                      onPress={() => setActiveFilter(filter.id)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.stockFilterButtonText,
                          {color: colors.textSecondary},
                          activeFilter === filter.id &&
                            styles.stockFilterButtonTextActive,
                        ]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View
                style={[
                  styles.filterSection,
                  {borderBottomColor: colors.border},
                ]}>
                <Text
                  style={[styles.filterSectionLabel, {color: colors.textPrimary}]}>
                  Status
                </Text>
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
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                        },
                        statusFilter === option.value &&
                          styles.stockFilterButtonActive,
                      ]}
                      onPress={() => setStatusFilter(option.value as any)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.stockFilterButtonText,
                          {color: colors.textSecondary},
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
            <View
              style={[styles.filterActions, {borderTopColor: colors.border}]}>
              <TouchableOpacity
                style={[
                  styles.filterActionButton,
                  styles.clearFilterButton,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleClearFilter}
                activeOpacity={0.7}>
                <Text style={[styles.clearFilterText, {color: colors.textSecondary}]}>
                  Clear All
                </Text>
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

      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectTab}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  headerRoundIcon: {
    width: 20,
    height: 20,
  },
  screenTitle: {
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
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.white,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    margin: SIZES.base * 2,
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
  searchContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 12,
    minHeight: 48,
  },
  searchLoadingPill: {
    marginRight: 8,
  },
  filterInlineHit: {
    position: 'relative',
    padding: 8,
    marginRight: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIconInline: {
    width: 20,
    height: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base / 2,
    marginBottom: SIZES.base / 2,
  },
  filterSummaryLabel: {
    ...FONTS.body5,
    fontSize: 12,
    marginRight: 4,
  },
  filterSummaryValue: {
    ...FONTS.body4,
    fontSize: 12,
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  summaryCard: {
    flex: 1,
    padding: SIZES.base,
    marginHorizontal: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  summaryCardLabel: {
    ...FONTS.body5,
    fontSize: 10,
    marginBottom: 2,
  },
  summaryValuePrimary: {
    ...FONTS.h3,
    fontSize: 16,
    marginBottom: 2,
    fontWeight: '700',
  },
  summaryValueSecondary: {
    ...FONTS.h3,
    fontSize: 16,
    marginBottom: 2,
    fontWeight: '700',
  },
  summarySubtext: {
    ...FONTS.body5,
    fontSize: 10,
  },
  listFlex: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContent: {
    flexGrow: 1,
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

export default PurchaseHistory;
