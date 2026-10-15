import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {safeGoBack} from '../../hooks/NavigationService';
import DateTimePicker from '@react-native-community/datetimepicker';
import ReactNativeModal from 'react-native-modal';
import {Expense} from '../../@types/expense';
import ExpenseListItem from './ExpenseListItem';
import ExpenseFormModal from './ExpenseFormModal';
import {ExpenseServices} from '../../services/ExpenseServices';
import Toast from 'react-native-toast-message';
import {
  COLORS,
  FONTS,
  SIZES,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import icons from '../../constants/icons';
import {usePermissions} from '../../hooks/usePermissions';
import {
  useExpensesQuery,
  useExpenseTypesQuery,
  useInvalidateExpenses,
} from '../../hooks/useExpensesQuery';
import {usePaymentMethodsQuery} from '../../hooks/useCustomersQuery';
import {PAGE_NAMES} from '../../constants/pageNames';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {
  formatDateYmdLocal,
  localDateRangeForFilter,
  parseLocalISODate,
  type ExpenseDateFilter,
} from '../../utils/localDate';

type DateFilter = ExpenseDateFilter;
const DATE_FILTERS: {id: Exclude<DateFilter, 'custom'>; label: string}[] = [
  {id: 'today', label: 'Today'},
  {id: 'yesterday', label: 'Yesterday'},
  {id: 'thismonth', label: 'This month'},
  {id: 'last7days', label: 'Last 7 days'},
  {id: 'last30days', label: 'Last 30 days'},
  {id: 'last3months', label: 'Last 3 months'},
  {id: 'alltime', label: 'All time'},
];
const STATUS_OPTIONS = ['Posted', 'Reversed', 'All'] as const;

const ExpenseHistory = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {canRead, canEdit} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.EXPENSE_HISTORY;
  const hasAccess =
    canRead(PAGE_NAME) ||
    canRead('PaymentHistoryList') ||
    canRead(PAGE_NAMES.EXPENSES) ||
    canRead('ExpenseList');
  const {colors, isDark} = useTheme();
  const t = useMemo(
    () => ({
      container: {backgroundColor: colors.background},
      topHeader: {backgroundColor: colors.background},
      headerBorder: {borderBottomColor: colors.border},
      headerRoundButton: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      headerRoundIcon: {tintColor: colors.textPrimary},
      topTitle: {color: colors.textPrimary},
      filterSection: {backgroundColor: colors.background},
      searchPill: {
        borderColor: colors.border,
        backgroundColor: colors.screenMuted,
      },
      searchIcon: {tintColor: colors.iconMuted},
      searchInput: {color: colors.textPrimary},
      filterInlineIcon: {tintColor: colors.iconMuted},
      filterSummaryRow: {backgroundColor: colors.screenMuted},
      filterSummaryLabel: {color: colors.textSecondary},
      filterSummaryValue: {color: colors.textPrimary},
      dateChip: {backgroundColor: colors.screenMuted},
      dateChipText: {color: colors.textSecondary},
      customDateBtn: {backgroundColor: colors.screenMuted},
      filterChip: {backgroundColor: colors.screenMuted},
      filterChipText: {color: colors.textSecondary},
      summaryContainer: {backgroundColor: colors.background},
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
      emptyTitle: {color: colors.textSecondary},
      emptyBody: {color: colors.textSecondary},
      loadingText: {color: colors.textSecondary},
      accessContainer: {backgroundColor: colors.background},
      accessMessage: {color: colors.textSecondary},
      bottomSheetContent: {backgroundColor: colors.surface},
      sheetHandle: {backgroundColor: colors.iconMuted},
      sheetHeader: {borderBottomColor: colors.border},
      sheetTitle: {color: colors.textPrimary},
      clearFiltersBtn: {backgroundColor: colors.screenMuted},
      sheetCloseBtn: {backgroundColor: colors.backButtonBg},
      sheetCloseText: {color: colors.textSecondary},
      sheetSection: {borderBottomColor: colors.border},
      sheetSectionTitle: {color: colors.textPrimary},
    }),
    [colors, isDark],
  );

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('thismonth');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>('Posted');
  const [paymentMethodIdFilter, setPaymentMethodIdFilter] = useState<number | null>(
    null,
  );
  const [expenseTypeIdFilter, setExpenseTypeIdFilter] = useState<number | null>(
    null,
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'from' | 'to' | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const invalidateExpenses = useInvalidateExpenses();
  const {data: paymentMethods = []} = usePaymentMethodsQuery(hasAccess);
  const {data: expenseTypes = []} = useExpenseTypesQuery(hasAccess);

  const presetRange = useMemo(
    () => localDateRangeForFilter(dateFilter),
    [dateFilter],
  );
  const startDate =
    dateFilter === 'alltime'
      ? null
      : dateFilter === 'custom'
        ? dateFrom
        : presetRange.startDate;
  const endDate =
    dateFilter === 'alltime'
      ? null
      : dateFilter === 'custom'
        ? dateTo
        : presetRange.endDate;

  const {
    expenses,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage: hasMore,
    refetch: refetchExpenses,
    fetchNextPage,
  } = useExpensesQuery({
    enabled: hasAccess,
    search: debouncedSearchQuery,
    status: statusFilter,
    startDate,
    endDate,
    paymentMethod: paymentMethodIdFilter,
    expenseType: expenseTypeIdFilter,
  });

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await invalidateExpenses();
      await refetchExpenses();
    } finally {
      setRefreshing(false);
    }
  }, [invalidateExpenses, refetchExpenses]);

  const canModify =
    canEdit(PAGE_NAMES.EXPENSES) ||
    canEdit(PAGE_NAME) ||
    canEdit('ExpenseList') ||
    canEdit('PaymentHistoryList');

  const handleOpenExpense = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setIsFormModalVisible(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormModalVisible(false);
    setSelectedExpense(null);
  }, []);

  const handleReverse = useCallback(
    (expense: Expense) => {
      if (expense.status !== 'Posted') {
        Alert.alert(
          'Cannot reverse',
          'Only posted expenses can be reversed.',
        );
        return;
      }

      Alert.alert(
        'Reverse entries',
        'To reverse these entries, correcting entries will be posted.\n\nDo you want to reverse the entries?',
        [
          {text: 'No', style: 'cancel'},
          {
            text: 'Yes',
            onPress: async () => {
              try {
                const result = await ExpenseServices.reverseExpense(expense.id);
                Toast.show({
                  type: 'success',
                  text1: 'Reversed',
                  text2:
                    result.message ||
                    'Correcting G/L entries were posted for this expense.',
                });
                handleCloseForm();
                await onRefresh();
              } catch (error: any) {
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2:
                    error?.response?.data?.error ||
                    error?.response?.data?.detail ||
                    'Failed to reverse expense',
                });
              }
            },
          },
        ],
      );
    },
    [handleCloseForm, onRefresh],
  );

  const handleLoadMore = () => {
    if (!loading && !isFetchingNextPage && hasMore) {
      fetchNextPage();
    }
  };

  const summary = useMemo(() => {
    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const reversedCount = expenses.filter(exp => exp.status === 'Reversed').length;
    return {
      count: expenses.length,
      totalAmount,
      average: expenses.length ? totalAmount / expenses.length : 0,
      reversedCount,
    };
  }, [expenses]);

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
      const dateStr = formatDateYmdLocal(selectedDate);
      if (datePickerMode === 'from') {
        setDateFrom(dateStr);
        if (Platform.OS === 'ios') {
          setDatePickerMode('to');
        } else {
          setTimeout(() => {
            setIsDatePickerVisible(true);
            setDatePickerMode('to');
          }, 100);
        }
      } else {
        setDateTo(dateStr);
        setDatePickerMode(null);
        setIsDatePickerVisible(false);
        setDateFilter('custom');
      }
    }
  };

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    
    let dateLabel = 'All time';
    if (dateFilter === 'custom' && dateFrom && dateTo) {
      dateLabel = `${dateFrom} → ${dateTo}`;
    } else if (dateFilter !== 'alltime') {
      const match = DATE_FILTERS.find(filter => filter.id === dateFilter);
      dateLabel = match ? match.label : 'Custom range';
    }
    parts.push(dateLabel);
    
    const statusLabel =
      statusFilter === 'All' ? 'All statuses' : `${statusFilter} only`;
    parts.push(statusLabel);

    if (paymentMethodIdFilter != null) {
      const pm = paymentMethods.find(m => m.id === paymentMethodIdFilter);
      parts.push(pm ? pm.code || pm.description : 'Payment method');
    } else {
      parts.push('Any payment method');
    }

    if (expenseTypeIdFilter != null) {
      const et = expenseTypes.find(type => type.id === expenseTypeIdFilter);
      parts.push(et ? et.name || et.code : 'Expense type');
    }
    
    return parts.join(' · ');
  }, [
    dateFilter,
    dateFrom,
    dateTo,
    statusFilter,
    paymentMethodIdFilter,
    expenseTypeIdFilter,
    paymentMethods,
    expenseTypes,
  ]);

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
            onPress={() => {
              setDateFilter(filter.id);
              setDateFrom(null);
              setDateTo(null);
            }}>
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
        onPress={() => {
          setDatePickerMode('from');
          setIsDatePickerVisible(true);
        }}>
        <Text style={styles.customDateButtonText}>Custom Range</Text>
      </TouchableOpacity>
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
                setDateFilter('thismonth');
                setStatusFilter('Posted');
                setPaymentMethodIdFilter(null);
                setExpenseTypeIdFilter(null);
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
              {STATUS_OPTIONS.map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    statusFilter === status && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setStatusFilter(status);
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

          <View style={[styles.bottomSheetSection, t.sheetSection]}>
            <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>
              Payment method
            </Text>
            <View style={styles.filterChipsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  t.filterChip,
                  paymentMethodIdFilter == null && styles.filterChipActive,
                ]}
                onPress={() => setPaymentMethodIdFilter(null)}>
                <Text
                  style={[
                    styles.filterChipText,
                    t.filterChipText,
                    paymentMethodIdFilter == null && styles.filterChipTextActive,
                  ]}>
                  All
                </Text>
              </TouchableOpacity>
              {paymentMethods.map(pm => (
                <TouchableOpacity
                  key={pm.id}
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    paymentMethodIdFilter === pm.id && styles.filterChipActive,
                  ]}
                  onPress={() => setPaymentMethodIdFilter(pm.id)}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
                      paymentMethodIdFilter === pm.id &&
                        styles.filterChipTextActive,
                    ]}>
                    {pm.code || pm.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.bottomSheetSection, t.sheetSection]}>
            <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>
              Expense type
            </Text>
            <View style={styles.filterChipsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  t.filterChip,
                  expenseTypeIdFilter == null && styles.filterChipActive,
                ]}
                onPress={() => setExpenseTypeIdFilter(null)}>
                <Text
                  style={[
                    styles.filterChipText,
                    t.filterChipText,
                    expenseTypeIdFilter == null && styles.filterChipTextActive,
                  ]}>
                  All
                </Text>
              </TouchableOpacity>
              {expenseTypes.map(et => (
                <TouchableOpacity
                  key={et.id}
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    expenseTypeIdFilter === et.id && styles.filterChipActive,
                  ]}
                  onPress={() => setExpenseTypeIdFilter(et.id)}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
                      expenseTypeIdFilter === et.id &&
                        styles.filterChipTextActive,
                    ]}>
                    {et.name || et.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </ReactNativeModal>
  );

  const renderFilters = () => (
    <View style={[styles.filterSection, t.filterSection]}>
      <View style={styles.searchContainer}>
        <View style={[styles.searchPill, t.searchPill]}>
          <Image source={icons.search as any} style={[styles.searchIcon, t.searchIcon]} />
          <TextInput
            style={[styles.searchInput, t.searchInput]}
            placeholder="Search expense history"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.filterInlineButton}
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}>
            <Image source={icons.filter as any} style={[styles.filterInlineIcon, t.filterInlineIcon]} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterSummaryRow, t.filterSummaryRow]}>
        <Text style={[styles.filterSummaryLabel, t.filterSummaryLabel]}>Active filters:</Text>
        <Text style={[styles.filterSummaryValue, t.filterSummaryValue]}>{activeFilterLabel}</Text>
      </View>
    </View>
  );

  const renderTopBar = () => (
    <View
      style={[
        styles.topHeader,
        t.topHeader,
        {
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
      <Text style={[styles.topTitle, t.topTitle]}>Expense History</Text>
      <View style={styles.headerTrailingSpacer} />
    </View>
  );

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
        <Text style={styles.summaryLabel}>Total Amount</Text>
        <Text style={styles.summaryValuePrimary}>
          {formatCurrencyCompact(summary.totalAmount)}
        </Text>
        <Text style={styles.summarySubtext}>{summary.count} records</Text>
      </View>
      <View style={[styles.summaryCard, styles.summaryCardSecondary]}>
        <Text style={styles.summaryLabel}>Average</Text>
        <Text style={styles.summaryValueSecondary}>
          {formatCurrencyCompact(summary.average)}
        </Text>
        <Text style={styles.summarySubtext}>
          {summary.reversedCount} reversed
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, t.emptyTitle]}>No posted expenses</Text>
      <Text style={[styles.emptyBody, t.emptyBody]}>
        Adjust your search or date filters to see more results.
      </Text>
    </View>
  );

  if (!hasAccess) {
    return (
      <View style={[styles.accessDeniedContainer, t.accessContainer]}>
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={[styles.accessDeniedMessage, t.accessMessage]}>
          You don't have permission to view expense history.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, t.container]} edges={['left', 'right', 'bottom']}>
      {renderTopBar()}
      {renderFilters()}
      {renderSummary()}

      {loading && expenses.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, t.loadingText]}>Loading expense history...</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id.toString()}
          renderItem={({item}) => (
            <ExpenseListItem
              expense={item}
              onView={handleOpenExpense}
              onReverse={canModify ? handleReverse : undefined}
            />
          )}
          ListEmptyComponent={!loading ? renderEmptyState : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          contentContainerStyle={
            expenses.length === 0 ? styles.emptyContentPadding : undefined
          }
        />
      )}

      {isDatePickerVisible && (
        <DateTimePicker
          value={
            datePickerMode === 'from' && dateFrom
              ? parseLocalISODate(dateFrom) ?? new Date()
              : datePickerMode === 'to' && dateTo
              ? parseLocalISODate(dateTo) ?? new Date()
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

      <ExpenseFormModal
        visible={isFormModalVisible}
        onClose={handleCloseForm}
        expense={selectedExpense}
        onSave={() => {
          void onRefresh();
        }}
        onReversed={() => {
          handleCloseForm();
          void onRefresh();
        }}
        expenseTypes={expenseTypes}
        paymentMethods={paymentMethods}
        canCreate={false}
        canEdit={false}
        canDelete={false}
        canPost={canModify}
      />
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
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  filterSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: SIZES.base,
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
  searchContainer: {
    marginBottom: SIZES.base / 2,
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
  filterInlineButton: {
    padding: 8,
    marginRight: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterInlineIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray,
  },
  sectionLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: SIZES.base / 2,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SIZES.base,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontSize: 12,
    marginRight: 4,
  },
  filterSummaryValue: {
    ...FONTS.body4,
    color: COLORS.black,
    fontSize: 12,
    flex: 1,
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
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.white,
  },
  summaryCard: {
    flex: 1,
    padding: SIZES.base,
    marginHorizontal: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
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
  emptyContentPadding: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.gray,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptyBody: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.base,
  },
  footerLoader: {
    paddingVertical: SIZES.base,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
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

export default ExpenseHistory;

