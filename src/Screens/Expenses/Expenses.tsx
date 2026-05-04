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
  Platform,
  ScrollView,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { safeGoBack } from '../../hooks/NavigationService';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import ReactNativeModal from 'react-native-modal';
import { QuickIconPressable } from '../../Components';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import { usePermissions } from '../../hooks/usePermissions';
import { PAGE_NAMES } from '../../constants/pageNames';
import { ExpenseServices } from '../../services/ExpenseServices';
import { Expense, ExpenseType, PaymentMethod } from '../../@types/expense';
import ExpenseListItem from './ExpenseListItem';
import ExpenseFormModal from './ExpenseFormModal';
import { useTheme } from '../../context/ThemeContext';

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
  const insets = useSafeAreaInsets();
  const { canRead, canCreate, canEdit, canDelete } = usePermissions();
  const PAGE_NAME = PAGE_NAMES.EXPENSES;
  const { colors } = useTheme();
  const t = useMemo(
    () => ({
      container: { backgroundColor: colors.background },
      topHeader: { backgroundColor: colors.background },
      headerBorder: { borderBottomColor: colors.border },
      headerRoundButton: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      headerRoundIcon: { tintColor: colors.textPrimary },
      topTitle: { color: colors.textPrimary },
      searchContainer: { backgroundColor: colors.background },
      searchPill: {
        borderColor: colors.border,
        backgroundColor: colors.screenMuted,
      },
      searchIcon: { tintColor: colors.iconMuted },
      searchInput: { color: colors.textPrimary },
      filterIconInline: { tintColor: colors.iconMuted },
      postedExpensesRow: { backgroundColor: colors.background },
      postedRowLabel: { color: colors.textPrimary },
      postedRowChevron: { color: colors.textSecondary },
      rowDivider: { backgroundColor: colors.border },
      dateChip: { backgroundColor: colors.screenMuted },
      dateChipText: { color: colors.textSecondary },
      customDateBtn: { backgroundColor: colors.screenMuted },
      bottomSheetContent: { backgroundColor: colors.surface },
      sheetHandle: { backgroundColor: colors.iconMuted },
      sheetHeader: { borderBottomColor: colors.border },
      sheetTitle: { color: colors.textPrimary },
      clearFiltersBtn: { backgroundColor: colors.screenMuted },
      sheetCloseBtn: { backgroundColor: colors.backButtonBg },
      sheetCloseText: { color: colors.textSecondary },
      sheetSection: { borderBottomColor: colors.border },
      sheetSectionTitle: { color: colors.textPrimary },
      filterChip: { backgroundColor: colors.screenMuted },
      filterChipText: { color: colors.textSecondary },
      loadingText: { color: colors.textSecondary },
      emptyIconWrap: { backgroundColor: colors.screenMuted },
      emptyIcon: { tintColor: colors.iconMuted },
      emptyTitle: { color: colors.textPrimary },
      emptySubtext: { color: colors.textSecondary },
      accessWrap: { backgroundColor: colors.background },
      accessCard: { backgroundColor: colors.card },
      accessMessage: { color: colors.textSecondary },
    }),
    [colors],
  );

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={[styles.container, t.accessWrap]}>
        <View style={[styles.accessDeniedContainer, t.accessCard]}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={[styles.accessDeniedMessage, t.accessMessage]}>
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

  const hasActiveFilters = useMemo(() => {
    if (dateFilter !== DEFAULT_DATE_FILTER) {
      return true;
    }
    if (dateFrom && dateTo) {
      return true;
    }
    if (selectedExpenseType != null || selectedPaymentMethod != null) {
      return true;
    }
    if (statusFilter !== 'Open') {
      return true;
    }
    return false;
  }, [
    dateFilter,
    dateFrom,
    dateTo,
    selectedExpenseType,
    selectedPaymentMethod,
    statusFilter,
  ]);

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

  const renderPostedExpensesRow = () => (
    <>
      <TouchableOpacity
        style={[styles.postedExpensesRow, t.postedExpensesRow]}
        onPress={() => navigation.navigate('ExpenseHistory')}
        activeOpacity={0.65}>
        <Text style={[styles.postedExpensesRowLabel, t.postedRowLabel]}>
          View posted expenses
        </Text>
        <Text style={[styles.postedExpensesRowChevron, t.postedRowChevron]}>›</Text>
      </TouchableOpacity>
      <View style={[styles.rowDivider, t.rowDivider]} />
    </>
  );

  const renderDateFilters = () => (
    <View style={styles.dateFilterContainer}>
      <View style={styles.dateFilterRow}>
        {DATE_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.dateFilterChip,
              t.dateChip,
              dateFilter === filter.id && styles.dateFilterChipActive,
            ]}
            onPress={() => handleDateFilterChange(filter.id)}>
            <Text
              style={[
                styles.dateFilterChipText,
                t.dateChipText,
                dateFilter === filter.id && styles.dateFilterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.customDateButton, t.customDateBtn]}
        onPress={handleCustomDateRange}>
        <Text style={styles.customDateButtonText}>Custom Range</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchSection = () => (
    <View style={[styles.searchContainer, t.searchContainer]}>
      <View style={[styles.searchPill, t.searchPill]}>
        <Image source={icons.search as any} style={[styles.searchIcon, t.searchIcon]} />
        <TextInput
          style={[styles.searchInput, t.searchInput]}
          placeholder="Search expenses"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.filterInlineHit}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Filter expenses">
          <Image
            source={icons.filter as any}
            style={[
              styles.filterIconInline,
              t.filterIconInline,
              hasActiveFilters ? styles.filterIconInlineActive : null,
            ]}
          />
          {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTopBar = () => (
    <View
      style={[
        styles.topHeader,
        t.topHeader,
        {
          // Match Edit Item header: one top inset (SafeAreaView does not pad top here).
          paddingTop: Math.max(
            insets.top,
            Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
            12,
          ),
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        t.headerBorder,
      ]}>
      <QuickIconPressable
        style={[styles.headerRoundButton, t.headerRoundButton]}
        onPress={() => safeGoBack(navigation, 'Home')}
        accessibilityLabel="Go back">
        <Image source={icons.back as any} style={[styles.headerRoundIcon, t.headerRoundIcon]} />
      </QuickIconPressable>
      <Text style={[styles.topTitle, t.topTitle]}>Expenses</Text>
      <View style={styles.headerTrailing}>
        {canCreate(PAGE_NAME) ? (
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleCreate}
            activeOpacity={0.8}>
            <Image source={icons.plus as any} style={styles.headerActionIcon} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
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
      <View style={[styles.bottomSheetContent, t.bottomSheetContent]}>
        {/* Drag Handle */}
        <View style={[styles.bottomSheetHandle, t.sheetHandle]} />

        <View style={[styles.bottomSheetHeader, t.sheetHeader]}>
          <Text style={[styles.bottomSheetTitle, t.sheetTitle]}>Filters</Text>
          <View style={styles.bottomSheetHeaderActions}>
            <TouchableOpacity
              onPress={() => {
                setDateFilter(DEFAULT_DATE_FILTER);
                setStatusFilter('Open');
                setSelectedExpenseType(null);
                setSelectedPaymentMethod(null);
                setPage(1);
              }}
              style={[styles.clearFiltersButton, t.clearFiltersBtn]}>
              <Text style={styles.clearFiltersButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilters(false)}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              style={[styles.bottomSheetCloseButton, t.sheetCloseBtn]}>
              <Text style={[styles.bottomSheetCloseText, t.sheetCloseText]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.bottomSheetScrollView}
          contentContainerStyle={styles.bottomSheetScrollContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}>
          {/* Date Range Filters */}
          <View style={[styles.bottomSheetSection, t.sheetSection]}>
            <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>Date Range</Text>
            {renderDateFilters()}
          </View>

          {/* Status Filter Chips */}
          <View style={[styles.bottomSheetSection, t.sheetSection]}>
            <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>Status</Text>
            <View style={styles.filterChipsContainer}>
              {STATUS_FILTERS.map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    statusFilter === status && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
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
            <View style={[styles.bottomSheetSection, t.sheetSection]}>
              <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>Expense Type</Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    selectedExpenseType === null && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedExpenseType(null);
                    setPage(1);
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
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
                      t.filterChip,
                      selectedExpenseType === type.id && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      setSelectedExpenseType(type.id);
                      setPage(1);
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        t.filterChipText,
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
            <View style={[styles.bottomSheetSection, t.sheetSection]}>
              <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>Payment Method</Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    selectedPaymentMethod === null && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedPaymentMethod(null);
                    setPage(1);
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
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
                      t.filterChip,
                      selectedPaymentMethod === method.id && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethod(method.id);
                      setPage(1);
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        t.filterChipText,
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
      <View style={[styles.emptyIconContainer, t.emptyIconWrap]}>
        <Image
          source={icons.coupon as any}
          style={[styles.emptyIconImage, t.emptyIcon]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.emptyTitle, t.emptyTitle]}>No expenses found</Text>
      <Text style={[styles.emptySubtext, t.emptySubtext]}>
        {searchQuery.trim()
          ? 'Try adjusting your search or filters.'
          : canCreate(PAGE_NAME)
            ? 'Create your first expense to get started.'
            : 'No expenses available.'}
      </Text>
      {canCreate(PAGE_NAME) && !searchQuery.trim() ? (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create expense</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary2} />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, t.container]} edges={['left', 'right', 'bottom']}>
      {renderTopBar()}
      {renderSearchSection()}
      {renderPostedExpensesRow()}

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.loadingText, t.loadingText]}>Loading expenses...</Text>
        </View>
      ) : (
        <View style={styles.listFlex}>
          <FlatList
            style={styles.listFlex}
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
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary2]}
                tintColor={COLORS.primary2}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            contentContainerStyle={
              expenses.length === 0 ? styles.emptyListContainer : undefined
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  headerRoundIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.black,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
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
  searchContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: COLORS.lightGray2,
    backgroundColor: COLORS.lightGray1,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: COLORS.gray,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
    minHeight: 48,
    paddingVertical: 12,
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
    tintColor: COLORS.gray,
  },
  filterIconInlineActive: {
    tintColor: COLORS.primary2,
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
  postedExpensesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  postedExpensesRowLabel: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    flex: 1,
  },
  postedExpensesRowChevron: {
    ...FONTS.h3,
    color: COLORS.gray2,
    fontSize: 22,
    fontWeight: '300',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lightGray1,
    marginLeft: SIZES.padding,
  },
  listFlex: {
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
    color: COLORS.gray2,
    marginTop: SIZES.base,
  },
  emptyListContainer: {
    flexGrow: 1,
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
    width: 36,
    height: 36,
    tintColor: COLORS.gray2,
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: SIZES.base,
    alignItems: 'center',
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
