import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ReactNativeModal from 'react-native-modal';
import {Expense} from '../../@types/expense';
import {ExpenseServices} from '../../services/ExpenseServices';
import ExpenseListItem from './ExpenseListItem';
import Header from '../../Components/Header';
import {COLORS, FONTS, SIZES} from '../../constants';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

type DateFilter = 'today' | 'last7days' | 'last30days' | 'last3months' | 'alltime';
const DATE_FILTERS: {id: DateFilter; label: string}[] = [
  {id: 'today', label: 'Today'},
  {id: 'last7days', label: 'Last 7 days'},
  {id: 'last30days', label: 'Last 30 days'},
  {id: 'last3months', label: 'Last 3 months'},
  {id: 'alltime', label: 'All time'},
];
const STATUS_OPTIONS = ['Posted', 'Reversed', 'All'] as const;

const ExpenseHistory = () => {
  const navigation = useNavigation();
  const {canRead} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.EXPENSE_HISTORY;
  const hasAccess = canRead(PAGE_NAME);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('last30days');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>('Posted');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'from' | 'to' | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const {startDate, endDate} = useMemo(() => {
    const today = new Date();
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    let start = new Date(end);

    if (dateFilter === 'today') {
      start = new Date(end);
    } else if (dateFilter === 'last7days') {
      start.setDate(end.getDate() - 6);
    } else if (dateFilter === 'last30days') {
      start.setDate(end.getDate() - 29);
    } else if (dateFilter === 'last3months') {
      start.setMonth(end.getMonth() - 3);
    } else {
      return {startDate: null, endDate: null};
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [dateFilter]);

  useEffect(() => {
    if (dateFilter === 'alltime') {
      setDateFrom(null);
      setDateTo(null);
    } else {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  }, [dateFilter, startDate, endDate]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, dateFrom, dateTo, debouncedSearchQuery, hasAccess]);

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
      if (statusFilter !== 'All') {
        params.status = statusFilter;
      }
      if (dateFrom) {
        params.start_date = dateFrom;
      }
      if (dateTo) {
        params.end_date = dateTo;
      }

      const response = await ExpenseServices.getExpenses(params);

      if (response && response.results && Array.isArray(response.results)) {
        if (page === 1) {
          setExpenses(response.results);
        } else {
          setExpenses(prev => [...prev, ...response.results]);
        }
        setHasMore(!!response.next);
      } else {
        setExpenses([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading expense history:', error);
      setExpenses([]);
      setHasMore(false);
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
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
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
      const dateStr = selectedDate.toISOString().split('T')[0];
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
        setDateFilter('alltime');
        setPage(1);
      }
    }
  };

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
    
    const statusLabel =
      statusFilter === 'All' ? 'All statuses' : `${statusFilter} only`;
    parts.push(statusLabel);
    
    return parts.join(' · ');
  }, [dateFilter, dateFrom, dateTo, statusFilter]);

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
            onPress={() => {
              setDateFilter(filter.id);
              setPage(1);
            }}>
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
      <View style={styles.bottomSheetContent}>
        {/* Drag Handle */}
        <View style={styles.bottomSheetHandle} />
        
        <View style={styles.bottomSheetHeader}>
          <Text style={styles.bottomSheetTitle}>Filters</Text>
          <View style={styles.bottomSheetHeaderActions}>
            <TouchableOpacity
              onPress={() => {
                setDateFilter('last30days');
                setStatusFilter('Posted');
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
              {STATUS_OPTIONS.map(status => (
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
        </ScrollView>
      </View>
    </ReactNativeModal>
  );

  const renderFilters = () => (
    <View style={styles.filterSection}>
      {/* Search Bar with Filter Button */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search posted expenses..."
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

  const renderSummary = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
        <Text style={styles.summaryLabel}>Total Amount</Text>
        <Text style={styles.summaryValuePrimary}>
          UGX {summary.totalAmount.toLocaleString()}
        </Text>
        <Text style={styles.summarySubtext}>{summary.count} records</Text>
      </View>
      <View style={[styles.summaryCard, styles.summaryCardSecondary]}>
        <Text style={styles.summaryLabel}>Average</Text>
        <Text style={styles.summaryValueSecondary}>
          UGX {summary.average.toFixed(0).toLocaleString()}
        </Text>
        <Text style={styles.summarySubtext}>
          {summary.reversedCount} reversed
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No posted expenses</Text>
      <Text style={styles.emptyBody}>
        Adjust your search or date filters to see more results.
      </Text>
    </View>
  );

  if (!hasAccess) {
    return (
      <View style={styles.accessDeniedContainer}>
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedMessage}>
          You don't have permission to view expense history.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="EXPENSE HISTORY"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      {renderFilters()}
      {renderSummary()}

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading expense history...</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id.toString()}
          renderItem={({item}) => <ExpenseListItem expense={item} />}
          ListEmptyComponent={!loading ? renderEmptyState : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
          contentContainerStyle={
            expenses.length === 0 ? styles.emptyContentPadding : undefined
          }
        />
      )}

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
  filterSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
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
    shadowOffset: {width: 0, height: 1},
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

