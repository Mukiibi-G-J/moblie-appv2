import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import ReactNativeModal from 'react-native-modal';
import { COLORS, FONTS, SIZES, icons } from '../../constants';
import { usePermissions } from '../../hooks/usePermissions';
import { PAGE_NAMES } from '../../constants/pageNames';
import Header from '../../Components/Header';
import { ExpenseServices } from '../../services/ExpenseServices';
import { Expense, ExpenseType, PaymentMethod } from '../../@types/expense';
import ExpenseListItem from './ExpenseListItem';
import ExpenseFormModal from './ExpenseFormModal';

type DateFilter =
  | 'today'
  | 'last7days'
  | 'last30days'
  | 'last3months'
  | 'alltime';

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'last7days', label: 'Last 7 days' },
  { id: 'last30days', label: 'Last 30 days' },
  { id: 'last3months', label: 'Last 3 months' },
  { id: 'alltime', label: 'All time' },
];

const DEFAULT_DATE_FILTER: DateFilter = 'alltime';

const getDateRangeForFilter = (filter: DateFilter) => {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (filter === 'alltime') {
    return { startDate: null, endDate: null };
  }

  const start = new Date(end);

  if (filter === 'today') {
    // start already set
  } else if (filter === 'last7days') {
    start.setDate(end.getDate() - 6);
  } else if (filter === 'last30days') {
    start.setDate(end.getDate() - 29);
  } else if (filter === 'last3months') {
    start.setMonth(end.getMonth() - 3);
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

const Expenses = () => {
  const navigation = useNavigation < any > ();
  const { canRead, canCreate, canEdit, canDelete } = usePermissions();
  const PAGE_NAME = PAGE_NAMES.EXPENSES;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view expenses.
          </Text>
        </View>
      </View>
    );
  }

  // State management
  const [expenses, setExpenses] = useState < Expense[] > ([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const STATUS_FILTERS = useMemo(() => ['Open', 'Reversed'] as const, []);
  const [statusFilter, setStatusFilter] =
    useState < (typeof STATUS_FILTERS)[number] > ('Open');
  const [dateFilter, setDateFilter] = useState < DateFilter > (DEFAULT_DATE_FILTER);
  const initialRange = useMemo(
    () => getDateRangeForFilter(DEFAULT_DATE_FILTER),
    [],
  );
  const [dateFrom, setDateFrom] = useState < string | null > (
    initialRange.startDate,
  );
  const [dateTo, setDateTo] = useState < string | null > (initialRange.endDate);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expenseTypes, setExpenseTypes] = useState < ExpenseType[] > ([]);
  const [paymentMethods, setPaymentMethods] = useState < PaymentMethod[] > ([]);
  const [selectedExpenseType, setSelectedExpenseType] = useState < number | null > (
    null,
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState < number | null > (
    null,
  );
  const [selectedExpense, setSelectedExpense] = useState < Expense | null > (null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState < 'from' | 'to' | null > (
    null,
  );
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeoutRef = useRef < NodeJS.Timeout | null > (null);

  // Update date range when filter changes
  useEffect(() => {
    if (dateFilter === 'alltime') {
      setDateFrom(null);
      setDateTo(null);
    } else {
      const range = getDateRangeForFilter(dateFilter);
      setDateFrom(range.startDate);
      setDateTo(range.endDate);
    }
  }, [dateFilter]);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load expense types and payment methods
  useEffect(() => {
    loadReferenceData();
  }, []);

  // Load expenses when filters change
  useEffect(() => {
    loadExpenses();
  }, [page, statusFilter, dateFrom, dateTo, debouncedSearchQuery, selectedExpenseType, selectedPaymentMethod]);

  const loadReferenceData = async () => {
    try {
      const [types, methods] = await Promise.all([
        ExpenseServices.getExpenseTypes(),
        ExpenseServices.getPaymentMethods(),
      ]);
      setExpenseTypes(types);
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading reference data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load expense types and payment methods',
      });
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: 20,
      };

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      params.status = statusFilter;

      if (dateFrom) {
        params.start_date = dateFrom;
      }

      if (dateTo) {
        params.end_date = dateTo;
      }

      if (selectedExpenseType) {
        params.expense_type = selectedExpenseType;
      }

      if (selectedPaymentMethod) {
        params.payment_method = selectedPaymentMethod;
      }

      const response = await ExpenseServices.getExpenses(params);

      if (response && response.results && Array.isArray(response.results)) {
        if (page === 1) {
          setExpenses(response.results);
        } else {
          setExpenses(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setExpenses([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('Error loading expenses:', error);
      const invalidPage =
        error?.response?.data?.detail === 'Invalid page.' ||
        error?.response?.data?.error === 'Invalid page.';

      if (invalidPage && page > 1) {
        setPage(1);
        setHasMore(false);
      } else {
        setExpenses([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error?.response?.data?.detail || 'Failed to load expenses',
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
    loadExpenses();
  }, [statusFilter, dateFrom, dateTo, debouncedSearchQuery]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleCreate = () => {
    setSelectedExpense(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (expense: Expense) => {
    if (expense.status !== 'Open') {
      Alert.alert(
        'Cannot Edit',
        'Only expenses with "Open" status can be edited.',
      );
      return;
    }
    setSelectedExpense(expense);
    setIsFormModalVisible(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (expense.status !== 'Open') {
      Alert.alert(
        'Cannot Delete',
        'Only expenses with "Open" status can be deleted.',
      );
      return;
    }

    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete expense ${expense.document_no}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ExpenseServices.deleteExpense(expense.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Expense deleted successfully',
              });
              onRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to delete expense',
              });
            }
          },
        },
      ],
    );
  };

  const handlePost = async (expense: Expense) => {
    if (expense.status !== 'Open') {
      Alert.alert(
        'Cannot Post',
        'Only expenses with "Open" status can be posted.',
      );
      return;
    }

    if (!expense.payment_method) {
      Alert.alert(
        'Payment Method Required',
        'Please add a payment method before posting this expense.',
        [
          { text: 'OK' },
          {
            text: 'Edit Now',
            onPress: () => {
              setSelectedExpense(expense);
              setIsFormModalVisible(true);
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Post Expense',
      `Are you sure you want to post expense ${expense.document_no}? This will create G/L entries and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Post',
          onPress: async () => {
            try {
              const result = await ExpenseServices.postExpense(expense.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: result.message || 'Expense posted successfully',
              });
              onRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to post expense',
              });
            }
          },
        },
      ],
    );
  };

  const handleFormSave = () => {
    setIsFormModalVisible(false);
    setSelectedExpense(null);
    onRefresh();
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalAmount = expenses.reduce(
      (sum, exp) => sum + (exp.amount || 0),
      0,
    );
    const openCount = expenses.filter(exp => exp.status === 'Open').length;
    const averageAmount =
      expenses.length > 0 ? totalAmount / expenses.length : 0;

    return {
      totalAmount,
      openCount,
      averageAmount,
      totalCount: expenses.length,
    };
  }, [expenses]);

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    setPage(1);
  };

  const handleCustomDateRange = () => {
    setIsDatePickerVisible(true);
    setDatePickerMode('from');
  };

  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setIsDatePickerVisible(false);
    }

    if (event.type === 'dismissed') {
      setIsDatePickerVisible(false);
      setDatePickerMode(null);
      return;
    }

    if (selectedDate && datePickerMode) {
      const dateStr = selectedDate.toISOString().split('T')[0];

      if (datePickerMode === 'from') {
        setDateFrom(dateStr);
        if (Platform.OS === 'ios') {
          setDatePickerMode('to');
        } else {
          // Android: show second picker
          setTimeout(() => {
            setIsDatePickerVisible(true);
            setDatePickerMode('to');
          }, 100);
        }
      } else {
        setDateTo(dateStr);
        setDatePickerMode(null);
        setIsDatePickerVisible(false);
        setDateFilter('alltime'); // Switch to custom range
        setPage(1);
      }
    }
  };

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
        <Text style={styles.summaryLabel}>Total Amount</Text>
        <Text style={styles.summaryValuePrimary}>
          UGX {summaryStats.totalAmount.toLocaleString()}
        </Text>
        <Text style={styles.summarySubtext}>
          {summaryStats.totalCount} expenses
        </Text>
      </View>
      <View style={[styles.summaryCard, styles.summaryCardSecondary]}>
        <Text style={styles.summaryLabel}>Open Items</Text>
        <Text style={styles.summaryValueSecondary}>
          {summaryStats.openCount}
        </Text>
        <Text style={styles.summarySubtext}>
          Avg {summaryStats.averageAmount.toFixed(0).toLocaleString()} UGX
        </Text>
      </View>
    </View>
  );

  const renderHistoryLink = () => (
    <TouchableOpacity
      style={styles.historyLink}
      onPress={() => navigation.navigate('ExpenseHistory')}>
      <Text style={styles.historyLinkTitle}>View Posted Expenses</Text>
      <Text style={styles.historyLinkChevron}>›</Text>
    </TouchableOpacity>
  );

  const renderDateFilters = () => (
    <View style={styles.dateFilterContainer}>
      <View style={styles.dateFilterRow}>
        {DATE_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.dateFilterChip,
              dateFilter === filter.id && styles.dateFilterChipActive,
            ]}
            onPress={() => handleDateFilterChange(filter.id)}>
            <Text
              style={[
                styles.dateFilterChipText,
                dateFilter === filter.id && styles.dateFilterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.customDateButton}
        onPress={handleCustomDateRange}>
        <Text style={styles.customDateButtonText}>Custom Range</Text>
      </TouchableOpacity>
    </View>
  );

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];

    let dateLabel = 'All time';
    if (dateFilter !== 'alltime') {
      const match = DATE_FILTERS.find(filter => filter.id === dateFilter);
      dateLabel = match ? match.label : 'Custom range';
    } else if (dateFrom && dateTo) {
      dateLabel = `${dateFrom} → ${dateTo}`;
    }
    parts.push(dateLabel);

    parts.push(`${statusFilter} only`);

    if (selectedExpenseType) {
      const type = expenseTypes.find(t => t.id === selectedExpenseType);
      if (type) {
        parts.push(type.name);
      }
    }

    if (selectedPaymentMethod) {
      const method = paymentMethods.find(m => m.id === selectedPaymentMethod);
      if (method) {
        parts.push(method.description || method.code);
      }
    }

    return parts.join(' · ');
  }, [dateFilter, dateFrom, dateTo, statusFilter, selectedExpenseType, selectedPaymentMethod, expenseTypes, paymentMethods]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Search Bar with Filter Button */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}>
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Filter summary */}
      <View style={styles.filterSummaryRow}>
        <Text style={styles.filterSummaryLabel}>Active filters: </Text>
        <Text style={styles.filterSummaryValue}>{activeFilterLabel}</Text>
      </View>
    </View>
  );

  const renderFilterBottomSheet = () => (
    <ReactNativeModal
      isVisible={showFilters}
      onBackdropPress={() => setShowFilters(false)}
      onBackButtonPress={() => setShowFilters(false)}
      style={styles.bottomSheet}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      useNativeDriver={true}
      backdropOpacity={0.5}>
      <View style={styles.bottomSheetContent}>
        {/* Drag Handle */}
        <View style={styles.bottomSheetHandle} />

        <View style={styles.bottomSheetHeader}>
          <Text style={styles.bottomSheetTitle}>Filters</Text>
          <View style={styles.bottomSheetHeaderActions}>
            <TouchableOpacity
              onPress={() => {
                setDateFilter(DEFAULT_DATE_FILTER);
                setStatusFilter('Open');
                setSelectedExpenseType(null);
                setSelectedPaymentMethod(null);
                setPage(1);
              }}
              style={styles.clearFiltersButton}>
              <Text style={styles.clearFiltersButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilters(false)}
              style={styles.bottomSheetCloseButton}>
              <Text style={styles.bottomSheetCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.bottomSheetScrollView}
          contentContainerStyle={styles.bottomSheetScrollContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}>
          {/* Date Range Filters */}
          <View style={styles.bottomSheetSection}>
            <Text style={styles.bottomSheetSectionTitle}>Date Range</Text>
            {renderDateFilters()}
          </View>

          {/* Status Filter Chips */}
          <View style={styles.bottomSheetSection}>
            <Text style={styles.bottomSheetSectionTitle}>Status</Text>
            <View style={styles.filterChipsContainer}>
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
          </View>

          {/* Expense Type Filter */}
          {expenseTypes.length > 0 && (
            <View style={styles.bottomSheetSection}>
              <Text style={styles.bottomSheetSectionTitle}>Expense Type</Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedExpenseType === null && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedExpenseType(null);
                    setPage(1);
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedExpenseType === null && styles.filterChipTextActive,
                    ]}>
                    All Types
                  </Text>
                </TouchableOpacity>
                {expenseTypes.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.filterChip,
                      selectedExpenseType === type.id && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      setSelectedExpenseType(type.id);
                      setPage(1);
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedExpenseType === type.id &&
                        styles.filterChipTextActive,
                      ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Payment Method Filter */}
          {paymentMethods.length > 0 && (
            <View style={styles.bottomSheetSection}>
              <Text style={styles.bottomSheetSectionTitle}>Payment Method</Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedPaymentMethod === null && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedPaymentMethod(null);
                    setPage(1);
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedPaymentMethod === null && styles.filterChipTextActive,
                    ]}>
                    All Methods
                  </Text>
                </TouchableOpacity>
                {paymentMethods.map(method => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.filterChip,
                      selectedPaymentMethod === method.id && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod(method.id);
                      setPage(1);
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedPaymentMethod === method.id &&
                        styles.filterChipTextActive,
                      ]}>
                      {method.description || method.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </ReactNativeModal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No expenses found</Text>
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create Your First Expense</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header
        title="EXPENSES"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      // containerStyle={{ zIndex: -1 }}

      />
      {renderHeader()}
      {renderSummaryCards()}
      {renderHistoryLink()}

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading expenses...</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ExpenseListItem
              expense={item}
              onEdit={canEdit(PAGE_NAME) ? handleEdit : undefined}
              onDelete={canDelete(PAGE_NAME) ? handleDelete : undefined}
              onPost={canEdit(PAGE_NAME) ? handlePost : undefined}
            />
          )}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={
            expenses.length === 0 ? styles.emptyListContainer : undefined
          }
        />
      )}

      {/* Floating Action Button */}
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.fab} onPress={handleCreate}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Form Modal */}
      <ExpenseFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedExpense(null);
        }}
        expense={selectedExpense}
        onSave={handleFormSave}
        expenseTypes={expenseTypes}
        paymentMethods={paymentMethods}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
        canPost={canEdit(PAGE_NAME)}
      />

      {/* Date Picker Modal */}
      {isDatePickerVisible && (
        <DateTimePicker
          value={
            datePickerMode === 'from' && dateFrom
              ? new Date(dateFrom)
              : datePickerMode === 'to' && dateTo
                ? new Date(dateTo)
                : new Date()
          }
          mode="date"
          display="default"
          onChange={handleDatePickerChange}
          maximumDate={new Date()}
        />
      )}

      {/* Filter Bottom Sheet */}
      {renderFilterBottomSheet()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: SIZES.base / 2,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    ...FONTS.body3,
    color: COLORS.black,
    marginRight: SIZES.base,
  },
  filterButton: {
    paddingHorizontal: SIZES.radius,
    height: 40,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    marginTop: SIZES.base / 2,
  },
  filterSummaryTextWrapper: {
    flex: 1,
    marginRight: SIZES.base,
  },
  filterSummaryLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontSize: 11,
  },
  filterSummaryValue: {
    ...FONTS.body4,
    color: COLORS.black,
    fontSize: 11,
    flex: 1,
  },
  filterToggleButton: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
  },
  filterToggleButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SIZES.base,
  },
  filterChip: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
    marginRight: SIZES.base,
    marginBottom: SIZES.base / 2,
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
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.gray,
    marginBottom: SIZES.radius,
    textAlign: 'center',
  },
  emptyButton: {
    paddingHorizontal: SIZES.radius * 2,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    marginTop: SIZES.base,
  },
  emptyButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
  },
  footerLoader: {
    paddingVertical: SIZES.base,
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
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: 'bold',
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
  dateFilterContainer: {
    marginBottom: SIZES.base,
  },
  dateFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SIZES.base,
  },
  dateFilterChip: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
    marginRight: SIZES.base,
    marginBottom: SIZES.base / 2,
  },
  dateFilterChipActive: {
    backgroundColor: COLORS.primary,
  },
  dateFilterChipText: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  dateFilterChipTextActive: {
    color: COLORS.white,
  },
  customDateButton: {
    paddingVertical: SIZES.base / 2,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
    alignSelf: 'flex-start',
  },
  customDateButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryCard: {
    flex: 1,
    padding: SIZES.base / 2,
    marginHorizontal: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryCardPrimary: {
    backgroundColor: '#F0FFF7',
    borderColor: '#C7F1DA',
  },
  summaryCardSecondary: {
    backgroundColor: '#F2F5FF',
    borderColor: '#D3DBFF',
  },
  summaryLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontSize: 10,
    marginBottom: 2,
  },
  summaryValuePrimary: {
    ...FONTS.h3,
    color: '#099268',
    fontSize: 16,
    marginBottom: 2,
  },
  summaryValueSecondary: {
    ...FONTS.h3,
    color: '#2F53D8',
    fontSize: 16,
    marginBottom: 2,
  },
  summarySubtext: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontSize: 10,
  },
  historyLink: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base / 2,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base / 2,
    paddingHorizontal: SIZES.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  historyLinkTitle: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  historyLinkSubtitle: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontSize: 10,
  },
  historyLinkChevron: {
    ...FONTS.h2,
    color: COLORS.primary,
  },
  bottomSheet: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  bottomSheetContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: Dimensions.get('window').height * 0.85,
    minHeight: Dimensions.get('window').height * 0.5,
    flexDirection: 'column',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.gray,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SIZES.base,
    marginBottom: SIZES.base / 2,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  bottomSheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  clearFiltersButton: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray1,
  },
  clearFiltersButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontSize: 12,
  },
  bottomSheetTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    fontWeight: '600',
  },
  bottomSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetCloseText: {
    ...FONTS.h3,
    color: COLORS.gray,
  },
  bottomSheetScrollView: {
    flex: 1,
  },
  bottomSheetScrollContent: {
    flexGrow: 1,
    paddingBottom: SIZES.padding * 2,
  },
  bottomSheetSection: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  bottomSheetSectionTitle: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base,
  },
});

export default Expenses;
