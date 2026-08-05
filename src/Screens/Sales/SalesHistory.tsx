import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  formatCurrencyCompact,
  formatCurrencyLabel,
  getLocalCurrencyCode,
} from '../../utils/currency';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ReactNativeModal from 'react-native-modal';
import Toast from 'react-native-toast-message';
import {QuickIconPressable} from '../../Components';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  constants,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import {
  getCompanyInfo,
  getSalesApiErrorMessage,
  getSalesInvoice,
  isAlreadyPostedSalesError,
  postSalesInvoice,
  reverseSalesInvoice,
} from '../../services/app.services';
import {
  showUserError,
  showUserSuccess,
} from '../../utils/userFeedback';
import {requestLoadUnpostedIntoPos} from '../../utils/posInvoiceLoad';
import PrintService, {
  CompanyInfo,
  PrintReceiptData,
} from '../../services/PrintService';
import {useAuth, useTabContext} from '../../context/Store';
import {usePermissions} from '../../hooks/usePermissions';
import {usePaymentMethodsQuery} from '../../hooks/useCustomersQuery';
import {
  useSalesQuery,
  useSalesSummaryQuery,
  useSalesUserSummaryQuery,
  useUserSetupQuery,
  useInvalidateSales,
} from '../../hooks/useSalesQuery';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';
import {useTheme} from '../../context/ThemeContext';
import SalesHistoryListItem, {
  SalesHistoryListItemData,
  salesHistoryPaymentLabel,
} from './SalesHistoryListItem';
import SalesInvoiceStatusBadge from './SalesInvoiceStatusBadge';

type DateFilter =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last30days'
  | 'alltime'
  | 'custom';

/** Quick ranges aligned with web Sales History (default: this month). */
const DATE_FILTERS: {id: Exclude<DateFilter, 'custom'>; label: string}[] = [
  {id: 'this_month', label: 'This month'},
  {id: 'today', label: 'Today'},
  {id: 'yesterday', label: 'Yesterday'},
  {id: 'this_week', label: 'This week'},
  {id: 'last30days', label: 'Last 30 days'},
  {id: 'alltime', label: 'All time'},
];

/** Calendar YYYY-MM-DD in local timezone (toISOString() is UTC and shifts the day). */
function formatDateYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local calendar day at midnight (no time component). */
function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Sunday start of week — matches dayjs default used on web Sales History. */
function startOfWeekSunday(d: Date) {
  const day = startOfLocalDay(d);
  day.setDate(day.getDate() - day.getDay());
  return day;
}

function endOfWeekSaturday(d: Date) {
  const start = startOfWeekSunday(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

const STATUS_OPTIONS = ['All', 'Posted', 'Unposted'] as const;

/** Map legacy Open/Draft route params (and filter) to Unposted. */
function normalizeSalesStatusParam(
  status?: string,
): (typeof STATUS_OPTIONS)[number] | undefined {
  if (!status) return undefined;
  if (status === 'Open' || status === 'Draft' || status === 'Unposted') {
    return 'Unposted';
  }
  if ((STATUS_OPTIONS as readonly string[]).includes(status)) {
    return status as (typeof STATUS_OPTIONS)[number];
  }
  return undefined;
}
const PAYMENT_STATUS_OPTIONS = [
  {id: 'all' as const, label: 'All'},
  {id: 'paid' as const, label: 'Paid'},
  {id: 'unpaid' as const, label: 'Unpaid'},
];

type SalesLine = {
  id: number;
  item_name: string;
  item_no: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  unit_of_measure?: string;
};

type SalesInvoice = SalesHistoryListItemData & {
  user_name?: string;
  lines?: SalesLine[];
  created_at?: string;
  amount_received?: number | string;
  change_amount?: number | string;
};

function isPostedSale(status?: string) {
  return String(status || '').toLowerCase() === 'posted';
}

function isUnpostedSale(status?: string) {
  const s = String(status || '').toLowerCase();
  return s === 'open' || s === 'draft';
}

function mapSalesInvoiceToReceiptData(
  invoice: SalesInvoice,
  companyInfo: CompanyInfo | undefined,
  username: string,
): PrintReceiptData {
  const lines = invoice.lines || [];
  let cartItems = lines.map(line => {
    const quantity = Number.parseFloat(String(line.quantity)) || 0;
    const unit_price = Number.parseFloat(String(line.unit_price)) || 0;
    const ta = Number.parseFloat(String(line.total_amount));
    return {
      item_name: line.item_name || 'Item',
      quantity,
      unit_price,
      line_total: Number.isFinite(ta) ? ta : undefined,
    };
  });
  const subFromLines = cartItems.reduce(
    (s, i) => s + i.quantity * i.unit_price,
    0,
  );
  const totalRaw = Number(invoice.total_amount);
  const total = Number.isFinite(totalRaw) ? totalRaw : subFromLines;
  if (cartItems.length === 0 && total > 0) {
    cartItems = [
      {
        item_name: 'Invoice total',
        quantity: 1,
        unit_price: total,
        line_total: total,
      },
    ];
  }
  const rawDate =
    invoice.document_date ||
    invoice.created_at ||
    new Date().toISOString();
  const saleDate =
    typeof rawDate === 'string'
      ? rawDate
      : new Date(rawDate).toISOString();

  const cn = invoice.customer_name?.trim();
  const customerName =
    cn && cn.toLowerCase() !== 'general' ? cn : undefined;

  const ar = Number(invoice.amount_received);
  const ch = Number(invoice.change_amount);

  return {
    receiptId: invoice.invoice_no || String(invoice.id ?? ''),
    username,
    customerName,
    cartItems,
    subtotal: total,
    total,
    tax: 0,
    discount: 0,
    paymentMethod: invoice.payment_method_name || '—',
    amountReceived: Number.isFinite(ar) && ar > 0 ? ar : undefined,
    change: Number.isFinite(ch) && ch > 0 ? ch : undefined,
    saleDate,
    companyInfo,
    compactReceipt: true,
  };
}

const SalesHistory = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {auth} = useAuth();
  const {setSelectedTab} = useTabContext();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.SALES_HISTORY;
  const hasAccess = canRead(PAGE_NAME);
  const canEditInPos =
    canCreate(PAGE_NAMES.SALES) || canEdit(PAGE_NAMES.SALES);
  const {colors, isDark} = useTheme();
  const initialStatusParam = route?.params?.status as string | undefined;
  const initialStatus =
    normalizeSalesStatusParam(initialStatusParam) ?? 'Posted';
  const initialDateFilterParam = route?.params?.dateFilter as
    | DateFilter
    | undefined;
  const initialDateFilter: DateFilter =
    initialDateFilterParam &&
    (DATE_FILTERS.some(f => f.id === initialDateFilterParam) ||
      initialDateFilterParam === 'custom')
      ? initialDateFilterParam
      : initialStatus === 'Unposted'
        ? 'alltime'
        : 'this_month';

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
      userChip: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      userChipName: {color: colors.textPrimary},
      userChipMeta: {color: colors.textSecondary},
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
      detailBackdrop: {backgroundColor: colors.background},
      detailCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      detailTitle: {color: colors.textPrimary},
      detailLabel: {color: colors.textSecondary},
      detailValue: {color: colors.textPrimary},
      lineRowBorder: {borderBottomColor: colors.border},
    }),
    [colors, isDark],
  );

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(initialDateFilter);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>(initialStatus);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    'all' | 'paid' | 'unpaid'
  >('all');

  // Home shortcuts pass { status: 'Unposted', dateFilter: 'alltime' }.
  useEffect(() => {
    const nextStatus = normalizeSalesStatusParam(
      route?.params?.status as string | undefined,
    );
    if (nextStatus && nextStatus !== statusFilter) {
      setStatusFilter(nextStatus);
    }
    const nextDate = route?.params?.dateFilter as DateFilter | undefined;
    if (
      nextDate &&
      (DATE_FILTERS.some(f => f.id === nextDate) || nextDate === 'custom') &&
      nextDate !== dateFilter
    ) {
      setDateFilter(nextDate);
    }
  }, [route?.params?.status, route?.params?.dateFilter]);
  const [paymentMethodIdFilter, setPaymentMethodIdFilter] = useState('');
  const [reversing, setReversing] = useState(false);
  const [postingId, setPostingId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalesInvoice | null>(null);
  const [detailForModal, setDetailForModal] = useState<SalesInvoice | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'from' | 'to' | null>(
    null,
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const invalidateSales = useInvalidateSales();
  const {data: paymentMethods = []} = usePaymentMethodsQuery(hasAccess);
  const {data: userSetup} = useUserSetupQuery(hasAccess);
  const restrictToOwnSales = userSetup?.canViewOnlyTheirSales ?? true;
  const canReverseSalesInvoice = userSetup?.canReverseSalesInvoice === true;

  const ownUserId = useMemo(() => {
    if (!restrictToOwnSales) {
      return null;
    }
    // Unposted (Open/Draft) have no CLE owner yet — ?user= hides them all.
    if (statusFilter === 'Unposted') {
      return null;
    }
    const uid = Number.parseInt(String(auth.user_id || ''), 10);
    return Number.isFinite(uid) ? uid : null;
  }, [restrictToOwnSales, auth.user_id, statusFilter]);

  /** Preset → YYYY-MM-DD (null for alltime/custom; custom uses dateFrom/dateTo). */
  const {startDate: presetStart, endDate: presetEnd} = useMemo(() => {
    const today = startOfLocalDay(new Date());

    if (dateFilter === 'today') {
      return {
        startDate: formatDateYmdLocal(today),
        endDate: formatDateYmdLocal(today),
      };
    }
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return {
        startDate: formatDateYmdLocal(yesterday),
        endDate: formatDateYmdLocal(yesterday),
      };
    }
    if (dateFilter === 'this_week') {
      return {
        startDate: formatDateYmdLocal(startOfWeekSunday(today)),
        endDate: formatDateYmdLocal(endOfWeekSaturday(today)),
      };
    }
    if (dateFilter === 'this_month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        startDate: formatDateYmdLocal(monthStart),
        endDate: formatDateYmdLocal(monthEnd),
      };
    }
    if (dateFilter === 'last30days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      return {
        startDate: formatDateYmdLocal(start),
        endDate: formatDateYmdLocal(today),
      };
    }

    return {startDate: null, endDate: null};
  }, [dateFilter]);

  const effectiveStartDate =
    dateFilter === 'alltime'
      ? null
      : dateFilter === 'custom'
        ? dateFrom
        : presetStart;
  const effectiveEndDate =
    dateFilter === 'alltime'
      ? null
      : dateFilter === 'custom'
        ? dateTo
        : presetEnd;

  const salesFilters = useMemo(() => {
    let paymentMethod: string | undefined;
    if (paymentStatusFilter === 'unpaid') {
      paymentMethod = 'not_paid';
    } else if (paymentMethodIdFilter) {
      paymentMethod = paymentMethodIdFilter;
    }
    return {
      search: debouncedSearchQuery.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      status: statusFilter,
      paymentMethod,
      user: ownUserId,
    };
  }, [
    debouncedSearchQuery,
    effectiveStartDate,
    effectiveEndDate,
    statusFilter,
    paymentStatusFilter,
    paymentMethodIdFilter,
    ownUserId,
  ]);

  const {
    sales: salesRaw,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage: hasMore,
    refetch: refetchSales,
    fetchNextPage,
    error: salesQueryError,
  } = useSalesQuery({
    ...salesFilters,
    enabled: hasAccess,
  });
  const sales = salesRaw as SalesInvoice[];
  const {data: summaryFromApi = null} = useSalesSummaryQuery({
    ...salesFilters,
    enabled: hasAccess && statusFilter !== 'Unposted',
  });
  const {data: userSummaries = []} = useSalesUserSummaryQuery({
    ...salesFilters,
    enabled: hasAccess && statusFilter !== 'Unposted',
  });
  const error = salesQueryError
    ? 'Unable to load sales history. Please try again.'
    : null;
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
      await invalidateSales();
      await refetchSales();
    } finally {
      setRefreshing(false);
    }
  }, [invalidateSales, refetchSales]);

  const handleLoadMore = () => {
    if (!loading && !isFetchingNextPage && hasMore) {
      fetchNextPage();
    }
  };

  const pageRevenueFallback = useMemo(
    () =>
      sales.reduce((sum, inv) => {
        const n = Number(inv?.total_amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [sales],
  );

  const pageProductsFallback = useMemo(
    () =>
      sales.reduce((sum, inv) => {
        const lineQty = (inv.lines || []).reduce(
          (ls, line) => ls + (parseInt(String(line.quantity), 10) || 0),
          0,
        );
        return sum + lineQty;
      }, 0),
    [sales],
  );

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    let dateLabel = 'All time';
    if (dateFilter === 'custom' && dateFrom && dateTo) {
      dateLabel = `${dateFrom} → ${dateTo}`;
    } else if (dateFilter !== 'alltime' && dateFilter !== 'custom') {
      const match = DATE_FILTERS.find(f => f.id === dateFilter);
      dateLabel = match ? match.label : 'Custom range';
    } else if (dateFrom && dateTo) {
      dateLabel = `${dateFrom} → ${dateTo}`;
    }
    parts.push(dateLabel);

    const statusLabel =
      statusFilter === 'All' ? 'All statuses' : `${statusFilter} only`;
    parts.push(statusLabel);

    const pay =
      paymentStatusFilter === 'all'
        ? 'Any payment'
        : paymentStatusFilter === 'paid'
          ? 'Paid'
          : 'Unpaid';
    parts.push(pay);

    if (paymentMethodIdFilter && paymentStatusFilter !== 'unpaid') {
      const pm = paymentMethods.find(
        m => String(m.id) === paymentMethodIdFilter,
      );
      parts.push(pm ? pm.code || pm.description : 'Method');
    }

    if (debouncedSearchQuery.trim()) {
      parts.push(`Search: "${debouncedSearchQuery.trim()}"`);
    }

    return parts.join(' · ');
  }, [
    dateFilter,
    dateFrom,
    dateTo,
    statusFilter,
    paymentStatusFilter,
    paymentMethodIdFilter,
    paymentMethods,
    debouncedSearchQuery,
  ]);

  const openSaleDetail = async (item: SalesInvoice) => {
    setSelectedItem(item);
    setDetailForModal(null);
    setShowDetail(true);
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

  const closeDetail = () => {
    setShowDetail(false);
    setDetailForModal(null);
    setSelectedItem(null);
    setDetailLoading(false);
  };

  const prepareInvoiceForPrint = useCallback(async (base: SalesInvoice) => {
    if (base.id == null) {
      return base;
    }
    if (base.lines && base.lines.length > 0) {
      return base;
    }
    try {
      const full = await getSalesInvoice(base.id);
      return {
        ...base,
        ...full,
        lines: full?.lines ?? base.lines,
      } as SalesInvoice;
    } catch {
      return base;
    }
  }, []);

  const handlePrintReceipt = useCallback(
    async (invoice: SalesInvoice) => {
      if (!isPostedSale(invoice.status)) {
        Toast.show({
          type: 'info',
          text1: 'Not available',
          text2: 'Only posted sales can be printed.',
        });
        return;
      }
      if (Platform.OS !== 'android') {
        Toast.show({
          type: 'info',
          text1: 'Printing',
          text2: 'Receipt printing is available on Android.',
        });
        return;
      }
      setPrintingReceipt(true);
      try {
        const prepared = await prepareInvoiceForPrint(invoice);
        let companyInfo: CompanyInfo | undefined;
        try {
          const companyResponse = await getCompanyInfo();
          const c = companyResponse.data?.company;
          if (c) {
            companyInfo = {
              name: c.name || 'ZENTRO APP',
              logo: c.logo || '',
              address: c.address || '',
              phone: c.phone || '',
              email: c.email || '',
              tin: c.tin || '',
            };
          }
        } catch {
          /* optional */
        }
        const printService = PrintService.getInstance();
        const connected = await printService.checkConnection();
        if (!connected) {
          Toast.show({
            type: 'info',
            text1: 'No printer',
            text2: 'Connect a printer in Settings to print receipts.',
          });
          return;
        }
        const cashier =
          auth.username?.trim() ||
          auth.full_name?.trim() ||
          'Cashier';
        const receiptData = mapSalesInvoiceToReceiptData(
          prepared,
          companyInfo,
          cashier,
        );
        const result = await printService.printReceipt(receiptData);
        if (result) {
          Toast.show({
            type: 'success',
            text1: 'Receipt printed',
            text2: 'Sent to printer',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Print failed',
            text2: 'Could not print. Check the printer connection.',
          });
        }
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Print error',
          text2: 'Something went wrong.',
        });
      } finally {
        setPrintingReceipt(false);
      }
    },
    [auth.full_name, auth.username, prepareInvoiceForPrint],
  );

  const runReverseSales = useCallback(
    async (invoice: SalesInvoice) => {
      if (invoice.id == null) {
        return;
      }
      setReversing(true);
      try {
        const result = await reverseSalesInvoice(
          invoice.id,
          'Reversed from Sales History (mobile app)',
        );
        Toast.show({
          type: 'success',
          text1: 'Invoice reversed',
          text2: `${result.sales_invoice_no} → Credit memo ${result.credit_memo_no}`,
        });
        closeDetail();
        await invalidateSales();
        await refetchSales();
      } catch (error: any) {
        const detail =
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          error?.message ||
          'Failed to reverse sales invoice';
        showUserError('Reverse failed', String(detail));
      } finally {
        setReversing(false);
      }
    },
    [invalidateSales, refetchSales],
  );

  const promptReverseSales = useCallback(
    (invoice: SalesInvoice) => {
      if (!canReverseSalesInvoice) {
        return;
      }
      if (!isPostedSale(invoice.status) || invoice.reversed) {
        Toast.show({
          type: 'info',
          text1: 'Not available',
          text2: 'Only posted, non-reversed invoices can be reversed.',
        });
        return;
      }
      const amount = formatCurrencyCompact(
        Number(invoice.total_amount) || 0,
      );
      Alert.alert(
        'Reverse sales invoice',
        `Reverse invoice ${invoice.invoice_no || '—'} for ${invoice.customer_name || 'Walk-in customer'} (${amount})?\n\nThis creates a credit memo, reverses ledger entries, restores inventory, and marks the invoice as reversed. This cannot be undone.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Reverse',
            style: 'destructive',
            onPress: () => runReverseSales(invoice),
          },
        ],
      );
    },
    [canReverseSalesInvoice, runReverseSales],
  );

  const runPostSales = useCallback(
    async (invoice: SalesInvoice) => {
      if (invoice.id == null) {
        return;
      }
      setPostingId(invoice.id);
      try {
        await postSalesInvoice(invoice.id);
        const confirmed = await getSalesInvoice(invoice.id);
        const status = String(confirmed?.status || '').toLowerCase();
        if (status !== 'posted') {
          showUserError(
            'Post incomplete',
            `Invoice ${invoice.invoice_no || ''} is still ${
              confirmed?.status || 'unposted'
            }. Check stock or try again.`,
          );
          return;
        }
        showUserSuccess(
          'Sale posted',
          `${invoice.invoice_no || 'Invoice'} is now posted.`,
        );
        closeDetail();
        await invalidateSales();
        await refetchSales();
      } catch (error: any) {
        if (isAlreadyPostedSalesError(error)) {
          showUserSuccess(
            'Already posted',
            `${invoice.invoice_no || 'Invoice'} was already posted.`,
          );
          closeDetail();
          await invalidateSales();
          await refetchSales();
          return;
        }
        showUserError(
          'Could not post sale',
          getSalesApiErrorMessage(error, 'Could not post this sale.'),
        );
      } finally {
        setPostingId(null);
      }
    },
    [invalidateSales, refetchSales],
  );

  const promptPostSales = useCallback(
    (invoice: SalesInvoice) => {
      if (!isUnpostedSale(invoice.status) || invoice.reversed) {
        return;
      }
      const amount = formatCurrencyCompact(
        Number(invoice.total_amount) || 0,
      );
      Alert.alert(
        'Post sale',
        `Post invoice ${invoice.invoice_no || '—'} for ${
          invoice.customer_name || 'Walk-in customer'
        } (${amount})?\n\nThis finalizes the sale, updates inventory, and posts customer ledger entries.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Post',
            onPress: () => runPostSales(invoice),
          },
        ],
      );
    },
    [runPostSales],
  );

  const promptEditInPos = useCallback(
    (invoice: SalesInvoice) => {
      if (!canEditInPos) {
        showUserError(
          'Permission denied',
          'You need Sales create/edit permission to load this into POS.',
        );
        return;
      }
      if (invoice.id == null || !isUnpostedSale(invoice.status)) {
        return;
      }
      const willDelete = canDelete(PAGE_NAMES.SALES);
      Alert.alert(
        'Edit in POS',
        `Load ${invoice.invoice_no || 'this sale'} into Make Sale so you can change lot, quantity, or lines?\n\n${
          willDelete
            ? 'The unposted invoice will be removed after loading. Complete the sale from POS when ready.'
            : 'The sale will load into POS. You may need permission to delete the original unposted invoice.'
        }\n\nAny items currently in the cart will be replaced.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Load to POS',
            onPress: () => {
              closeDetail();
              requestLoadUnpostedIntoPos({
                invoiceId: invoice.id as number,
                deleteAfterLoad: willDelete,
              });
              setSelectedTab(constants.screens.makeSale);
              safeGoBack(navigation, 'Home');
            },
          },
        ],
      );
    },
    [canDelete, canEditInPos, navigation, setSelectedTab],
  );

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
        style={[
          styles.customDateButton,
          t.customDateBtn,
          dateFilter === 'custom' && styles.dateFilterChipActive,
        ]}
        onPress={() => {
          setDatePickerMode('from');
          setIsDatePickerVisible(true);
        }}>
        <Text
          style={[
            styles.customDateButtonText,
            dateFilter === 'custom' && styles.dateFilterChipTextActive,
          ]}>
          {dateFilter === 'custom' && dateFrom && dateTo
            ? `${dateFrom} → ${dateTo}`
            : 'Custom range'}
        </Text>
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
      useNativeDriver
      backdropOpacity={0.5}>
      <View style={[styles.bottomSheetContent, t.bottomSheetContent]}>
        <View style={[styles.bottomSheetHandle, t.sheetHandle]} />
        <View style={[styles.bottomSheetHeader, t.sheetHeader]}>
          <Text style={[styles.bottomSheetTitle, t.sheetTitle]}>Filters</Text>
          <View style={styles.bottomSheetHeaderActions}>
            <TouchableOpacity
              onPress={() => {
                setDateFilter('this_month');
                setStatusFilter('Posted');
                setPaymentStatusFilter('all');
                setPaymentMethodIdFilter('');
              }}
              style={[styles.clearFiltersButton, t.clearFiltersBtn]}>
              <Text style={styles.clearFiltersButtonText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilters(false)}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              style={[styles.bottomSheetCloseButton, t.sheetCloseBtn]}>
              <Text style={[styles.bottomSheetCloseText, t.sheetCloseText]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.bottomSheetScrollView}
          contentContainerStyle={styles.bottomSheetScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator>
          <View style={[styles.bottomSheetSection, t.sheetSection]}>
            <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>
              Date range
            </Text>
            {renderDateFilters()}
          </View>

          <View style={[styles.bottomSheetSection, t.sheetSection]}>
            <Text style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>
              Status
            </Text>
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
              Payment status
            </Text>
            <View style={styles.filterChipsContainer}>
              {PAYMENT_STATUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    paymentStatusFilter === opt.id && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setPaymentStatusFilter(opt.id);
                    if (opt.id === 'unpaid') {
                      setPaymentMethodIdFilter('');
                    }
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
                      paymentStatusFilter === opt.id &&
                        styles.filterChipTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {paymentStatusFilter !== 'unpaid' ? (
            <View style={[styles.bottomSheetSection, t.sheetSection]}>
              <Text
                style={[styles.bottomSheetSectionTitle, t.sheetSectionTitle]}>
                Payment method
              </Text>
              <View style={styles.filterChipsContainer}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    t.filterChip,
                    paymentMethodIdFilter === '' && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setPaymentMethodIdFilter('');
                  }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      t.filterChipText,
                      paymentMethodIdFilter === '' &&
                        styles.filterChipTextActive,
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
                      paymentMethodIdFilter === String(pm.id) &&
                        styles.filterChipActive,
                    ]}
                    onPress={() => {
                      setPaymentMethodIdFilter(String(pm.id));
                    }}>
                    <Text
                      style={[
                        styles.filterChipText,
                        t.filterChipText,
                        paymentMethodIdFilter === String(pm.id) &&
                          styles.filterChipTextActive,
                      ]}
                      numberOfLines={1}>
                      {pm.code || pm.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </ReactNativeModal>
  );

  const renderFilters = () => (
    <View style={[styles.filterSection, t.filterSection]}>
      <View style={styles.searchContainer}>
        <View style={[styles.searchPill, t.searchPill]}>
          <Image
            source={icons.search as any}
            style={[styles.searchIcon, t.searchIcon]}
          />
          <TextInput
            style={[styles.searchInput, t.searchInput]}
            placeholder="Search customer or invoice"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.filterInlineButton}
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}>
            <Image
              source={icons.filter as any}
              style={[styles.filterInlineIcon, t.filterInlineIcon]}
            />
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
        <Image
          source={icons.back as any}
          style={[styles.headerRoundIcon, t.headerRoundIcon]}
        />
      </QuickIconPressable>
      <Text style={[styles.topTitle, t.topTitle]} numberOfLines={1}>
        {statusFilter === 'Unposted' ? 'Unposted Sales' : 'Sales History'}
      </Text>
      <View style={styles.headerTrailingSpacer} />
    </View>
  );

  const invoiceCount =
    summaryFromApi?.total_invoices ?? sales.length;
  const revenue = summaryFromApi?.total_sales ?? pageRevenueFallback;
  const productsSold =
    summaryFromApi?.total_products ?? pageProductsFallback;

  const renderSummary = () => {
    if (statusFilter === 'Unposted') {
      return (
        <View style={[styles.summaryContainer, t.summaryContainer]}>
          <View
            style={[
              styles.unpostedCountCard,
              {
                backgroundColor: colors.screenMuted,
                borderColor: colors.border,
              },
            ]}>
            <Text style={[styles.summaryLabel, t.summaryLabel]}>
              Waiting to post
            </Text>
            <Text style={[styles.summaryValueSecondary, t.summaryValueSecondary]}>
              {sales.length}
              {hasMore ? '+' : ''}
            </Text>
            <Text style={[styles.summarySubtext, t.summarySubtext]}>
              Open and draft invoices
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.summaryContainer, t.summaryContainer]}>
        <View
          style={[
            styles.summaryCard,
            t.summaryPrimary,
            {borderWidth: 1},
          ]}>
          <Text style={[styles.summaryLabel, t.summaryLabel]}>Revenue</Text>
          <Text style={[styles.summaryValuePrimary, t.summaryValuePrimary]}>
            {formatCurrencyCompact(revenue)}
          </Text>
          <Text style={[styles.summarySubtext, t.summarySubtext]}>
            {invoiceCount} invoices
          </Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            t.summarySecondary,
            {borderWidth: 1},
          ]}>
          <Text style={[styles.summaryLabel, t.summaryLabel]}>Qty sold</Text>
          <Text style={[styles.summaryValueSecondary, t.summaryValueSecondary]}>
            {Math.round(productsSold).toLocaleString()}
          </Text>
          <Text style={[styles.summarySubtext, t.summarySubtext]}>
            Units (summary)
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
      <View style={styles.userSection}>
        <Text style={[styles.userSectionTitle, t.summaryLabel]}>
          {restrictToOwnSales ? 'Your sales' : 'Sales by user'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.userChipsRow}>
          {userSummaries.map((u, idx) => (
            <View
              key={`${u.user_id ?? 'u'}-${idx}`}
              style={[styles.userChip, t.userChip, {borderWidth: 1}]}>
              <Text style={[styles.userChipName, t.userChipName]} numberOfLines={1}>
                {u.user_name || 'Unknown'}
              </Text>
              <Text style={[styles.userChipMeta, t.userChipMeta]}>
                {formatCurrencyCompact(u.total_sales)} ·{' '}
                {u.total_invoices} inv.
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderDetailModal = () => {
    const displayItem = detailForModal ?? selectedItem;
    if (!displayItem) {
      return null;
    }

    return (
      <ReactNativeModal
        isVisible={showDetail}
        onBackdropPress={closeDetail}
        onBackButtonPress={closeDetail}
        style={styles.detailModal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        useNativeDriver
        backdropOpacity={0.5}>
        <View style={[styles.detailSheet, t.bottomSheetContent]}>
          <View style={[styles.bottomSheetHandle, t.sheetHandle]} />
          <View style={[styles.detailHeader, t.sheetHeader]}>
            <Text style={[styles.detailHeaderTitle, t.sheetTitle]} numberOfLines={1}>
              Invoice {displayItem.invoice_no || '—'}
            </Text>
            <TouchableOpacity
              onPress={closeDetail}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close invoice detail"
              style={[styles.bottomSheetCloseButton, t.sheetCloseBtn]}>
              <Text style={[styles.bottomSheetCloseText, t.sheetCloseText]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={false}>
            {detailLoading ? (
              <View style={styles.detailLoadingRow}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={[styles.loadingText, t.loadingText]}>
                  Loading line items…
                </Text>
              </View>
            ) : null}
            <View style={styles.detailBlock}>
              <Row
                label="Customer"
                value={displayItem.customer_name || 'Walk-in customer'}
                t={t}
              />
              <Row
                label="Date"
                value={
                  displayItem.document_date
                    ? new Date(displayItem.document_date).toLocaleDateString()
                    : '—'
                }
                t={t}
              />
              {displayItem.status ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailRowLabel, t.detailLabel]}>
                    Status
                  </Text>
                  {displayItem.reversed ? (
                    <SalesInvoiceStatusBadge status="Reversed" />
                  ) : (
                    <SalesInvoiceStatusBadge status={displayItem.status} />
                  )}
                </View>
              ) : null}
              {displayItem.reversed ? (
                <>
                  {displayItem.reversed_by_user ? (
                    <Row
                      label="Reversed by"
                      value={displayItem.reversed_by_user}
                      t={t}
                    />
                  ) : null}
                  {displayItem.reversed_date ? (
                    <Row
                      label="Reversed on"
                      value={new Date(
                        displayItem.reversed_date,
                      ).toLocaleString()}
                      t={t}
                    />
                  ) : null}
                </>
              ) : null}
              <Row
                label="Payment"
                value={salesHistoryPaymentLabel(displayItem)}
                t={t}
              />
              {displayItem.user_name ? (
                <Row label="Sold by" value={displayItem.user_name} t={t} />
              ) : null}
              <Row
                label="Total"
                value={formatCurrencyCompact(
                  Number(displayItem.total_amount) || 0,
                )}
                emphasize
                t={t}
              />
            </View>
            {displayItem.lines && displayItem.lines.length > 0 ? (
              <View style={styles.linesBlock}>
                <Text style={[styles.linesTitle, t.sheetSectionTitle]}>
                  Line items
                </Text>
                {displayItem.lines.map((line, index) => (
                  <View
                    key={line.id || index}
                    style={[styles.lineItem, t.lineRowBorder]}>
                    <View style={styles.lineItemHeader}>
                      <Text style={[styles.lineName, t.detailValue]} numberOfLines={2}>
                        {line.item_name}
                      </Text>
                      <Text style={[styles.lineCode, t.detailLabel]}>
                        {line.item_no}
                      </Text>
                    </View>
                    <Text style={[styles.lineMeta, t.detailLabel]}>
                      Qty {line.quantity} {line.unit_of_measure || 'PCS'} · Unit {getLocalCurrencyCode()}{' '}
                      {parseFloat(line.unit_price || '0').toLocaleString()}
                    </Text>
                    <Text style={[styles.lineTotal, t.summaryValuePrimary]}>
                      {formatCurrencyCompact(parseFloat(line.total_amount || '0'))}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
          {!detailLoading &&
          isUnpostedSale(displayItem.status) &&
          !displayItem.reversed ? (
            <View
              style={[
                styles.detailPrintBar,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}>
              <View style={styles.detailActionRow}>
                {canEditInPos ? (
                  <TouchableOpacity
                    style={[
                      styles.reverseInvoiceBtn,
                      postingId != null && styles.detailActionBtnDisabled,
                    ]}
                    onPress={() => promptEditInPos(displayItem)}
                    disabled={postingId != null}
                    activeOpacity={0.85}>
                    <Image
                      source={icons.cart as any}
                      style={styles.reverseInvoiceBtnIcon}
                    />
                    <Text style={styles.reverseInvoiceBtnText}>
                      Edit in POS
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.printReceiptBtn,
                    styles.printReceiptBtnFlex,
                    postingId != null && styles.detailActionBtnDisabled,
                  ]}
                  onPress={() => promptPostSales(displayItem)}
                  disabled={postingId != null}
                  activeOpacity={0.85}>
                  {postingId === displayItem.id ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <>
                      <Image
                        source={icons.check_circle as any}
                        style={styles.printReceiptBtnIcon}
                      />
                      <Text style={styles.printReceiptBtnText}>Post sale</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {isPostedSale(displayItem.status) && !detailLoading ? (
            <View
              style={[
                styles.detailPrintBar,
                {borderTopColor: colors.border, backgroundColor: colors.surface},
              ]}>
              <View style={styles.detailActionRow}>
                {canReverseSalesInvoice && !displayItem.reversed ? (
                  <TouchableOpacity
                    style={[
                      styles.reverseInvoiceBtn,
                      (reversing || printingReceipt) && styles.detailActionBtnDisabled,
                    ]}
                    onPress={() => promptReverseSales(displayItem)}
                    disabled={reversing || printingReceipt}
                    activeOpacity={0.85}>
                    {reversing ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <>
                        <Image
                          source={icons.update as any}
                          style={styles.reverseInvoiceBtnIcon}
                        />
                        <Text style={styles.reverseInvoiceBtnText}>
                          Reverse
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
                {!displayItem.reversed ? (
                  <TouchableOpacity
                    style={[
                      styles.printReceiptBtn,
                      styles.printReceiptBtnFlex,
                      (reversing || printingReceipt) && styles.detailActionBtnDisabled,
                    ]}
                    onPress={() => handlePrintReceipt(displayItem)}
                    disabled={printingReceipt || reversing}
                    activeOpacity={0.85}>
                    {printingReceipt ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <>
                        <Image
                          source={icons.printer as any}
                          style={styles.printReceiptBtnIcon}
                        />
                        <Text style={styles.printReceiptBtnText}>
                          Print receipt
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ReactNativeModal>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrap, t.searchPill]}>
        <Image
          source={icons.reports as any}
          style={[styles.emptyIcon, t.searchIcon]}
        />
      </View>
      <Text style={[styles.emptyTitle, t.emptyTitle]}>
        {error
          ? 'Something went wrong'
          : statusFilter === 'Unposted'
            ? 'No unposted sales'
            : 'No sales found'}
      </Text>
      <Text style={[styles.emptyBody, t.emptyBody]}>
        {error ||
          (statusFilter === 'Unposted'
            ? 'Open and draft invoices will show up here until they are posted.'
            : 'Adjust search or filters, or pull to refresh.')}
      </Text>
      {error ? (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            refetchSales();
          }}
          activeOpacity={0.7}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!hasAccess) {
    return (
      <View style={[styles.accessDeniedContainer, t.accessContainer]}>
        <Text style={styles.accessDeniedTitle}>Access denied</Text>
        <Text style={[styles.accessDeniedMessage, t.accessMessage]}>
          {"You don't have permission to view sales history."}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, t.container]}
      edges={['left', 'right', 'bottom']}>
      {renderTopBar()}
      {renderFilters()}
      {renderSummary()}
      {statusFilter !== 'Unposted' ? renderUserSummaries() : null}

      {loading && sales.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, t.loadingText]}>
            Loading sales…
          </Text>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item, index) =>
            item.id != null
              ? String(item.id)
              : `${item.invoice_no ?? 'sale'}-${index}`
          }
          renderItem={({item}) => (
            <SalesHistoryListItem
              item={item}
              onPress={() => openSaleDetail(item)}
              onPrintPress={
                isPostedSale(item.status) && !item.reversed
                  ? () => handlePrintReceipt(item)
                  : undefined
              }
              onPostPress={
                isUnpostedSale(item.status) && !item.reversed
                  ? () => promptPostSales(item)
                  : undefined
              }
              onEditInPosPress={
                canEditInPos &&
                isUnpostedSale(item.status) &&
                !item.reversed
                  ? () => promptEditInPos(item)
                  : undefined
              }
              posting={item.id != null && postingId === item.id}
            />
          )}
          ListEmptyComponent={!loading ? renderEmpty : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.45}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          contentContainerStyle={
            sales.length === 0 ? styles.emptyContentPadding : undefined
          }
        />
      )}

      {isDatePickerVisible ? (
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
      ) : null}

      {renderFilterBottomSheet()}
      {renderDetailModal()}
    </SafeAreaView>
  );
};

function Row({
  label,
  value,
  emphasize,
  t,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  t: {
    detailLabel: {color: string};
    detailValue: {color: string};
    summaryValuePrimary: {color: string};
  };
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailRowLabel, t.detailLabel]}>{label}</Text>
      <Text
        style={[
          emphasize ? styles.detailRowValueEmphasis : styles.detailRowValue,
          emphasize ? t.summaryValuePrimary : t.detailValue,
        ]}
        numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

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
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  filterSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: SIZES.base,
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
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
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
  },
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    marginTop: SIZES.base / 2,
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
    marginRight: SIZES.base,
    marginBottom: SIZES.base / 2,
  },
  dateFilterChipActive: {
    backgroundColor: COLORS.primary,
  },
  dateFilterChipText: {
    ...FONTS.body4,
  },
  dateFilterChipTextActive: {
    color: COLORS.white,
  },
  customDateButton: {
    paddingVertical: SIZES.base / 2,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.radius,
    alignSelf: 'flex-start',
  },
  customDateButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    marginRight: SIZES.base,
    marginBottom: SIZES.base / 2,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    ...FONTS.body4,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  unpostedCountCard: {
    flex: 1,
    padding: SIZES.base,
    marginHorizontal: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
  },
  summaryCard: {
    flex: 1,
    padding: SIZES.base,
    marginHorizontal: SIZES.base / 2,
    borderRadius: SIZES.radius,
  },
  summaryLabel: {
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
  userSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  userSectionTitle: {
    ...FONTS.body4,
    fontWeight: '600',
    marginBottom: SIZES.base,
  },
  userChipsRow: {
    flexDirection: 'row',
    gap: SIZES.base,
    paddingRight: SIZES.padding,
  },
  userChip: {
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base * 1.5,
    minWidth: 140,
  },
  userChipName: {
    ...FONTS.body4,
    fontWeight: '600',
    marginBottom: 4,
  },
  userChipMeta: {
    ...FONTS.body5,
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    marginTop: SIZES.base,
  },
  footerLoader: {
    paddingVertical: SIZES.base,
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
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyIcon: {
    width: 32,
    height: 32,
  },
  emptyTitle: {
    ...FONTS.h3,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptyBody: {
    ...FONTS.body4,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SIZES.padding,
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
  },
  retryBtnText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    textAlign: 'center',
  },
  bottomSheet: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  bottomSheetContent: {
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: Dimensions.get('window').height * 0.88,
    minHeight: Dimensions.get('window').height * 0.45,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
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
  },
  clearFiltersButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontSize: 12,
  },
  bottomSheetTitle: {
    ...FONTS.h3,
    fontWeight: '600',
  },
  bottomSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetCloseText: {
    ...FONTS.h3,
  },
  bottomSheetScrollView: {
    flexGrow: 0,
    maxHeight: Dimensions.get('window').height * 0.62,
  },
  bottomSheetScrollContent: {
    paddingBottom: SIZES.padding * 2,
  },
  bottomSheetSection: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
  },
  bottomSheetSectionTitle: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: SIZES.base,
  },
  detailModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  detailSheet: {
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: Dimensions.get('window').height * 0.92,
    paddingBottom: SIZES.padding,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
  },
  detailHeaderTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    flex: 1,
    marginRight: SIZES.base,
  },
  detailScroll: {
    maxHeight: Dimensions.get('window').height * 0.72,
  },
  detailScrollContent: {
    paddingBottom: SIZES.padding * 2,
  },
  detailLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
    padding: SIZES.padding,
  },
  detailBlock: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 1.25,
    gap: SIZES.base,
  },
  detailRowLabel: {
    ...FONTS.body4,
    fontWeight: '500',
  },
  detailRowValue: {
    ...FONTS.body3,
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  detailRowValueEmphasis: {
    ...FONTS.h3,
    flex: 1,
    textAlign: 'right',
    fontWeight: '700',
  },
  linesBlock: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
  },
  linesTitle: {
    marginBottom: SIZES.base,
  },
  lineItem: {
    paddingVertical: SIZES.base * 1.25,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: SIZES.base,
  },
  lineName: {
    ...FONTS.body3,
    fontWeight: '600',
    flex: 1,
  },
  lineCode: {
    ...FONTS.body5,
    fontSize: 11,
  },
  lineMeta: {
    ...FONTS.body5,
    marginBottom: 4,
  },
  lineTotal: {
    ...FONTS.body3,
    fontWeight: '700',
    textAlign: 'right',
  },
  detailPrintBar: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
    paddingBottom: SIZES.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: SIZES.base,
  },
  detailActionBtnDisabled: {
    opacity: 0.65,
  },
  reverseInvoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
  },
  reverseInvoiceBtnIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.white,
    marginRight: 10,
  },
  reverseInvoiceBtnText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
  printReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
  },
  printReceiptBtnFlex: {
    flex: 1,
  },
  printReceiptBtnIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.white,
    marginRight: 10,
  },
  printReceiptBtnText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default SalesHistory;
