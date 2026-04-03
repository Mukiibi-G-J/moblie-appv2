import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {
  exportReportPdfFromApi,
  fetchBalanceSheetReport,
  fetchProfitLossStatement,
} from '../../services/app.services';
import {savePdfBufferAndShare} from '../../utils/reportPdfDownload';

type ReportVariant = 'profit-loss' | 'balance-sheet';

type ProfitLossAccount = {
  gl_account__name?: string;
  gl_account__no?: string;
  gl_account__indentation?: number;
  amount?: number;
};

type ProfitLossResponse = {
  period?: {
    start_date?: string;
    end_date?: string;
  };
  revenue?: {
    total?: number;
    accounts?: ProfitLossAccount[];
  };
  cost_of_goods_sold?: {
    total?: number;
    accounts?: ProfitLossAccount[];
  };
  gross_profit?: number;
  operating_expenses?: {
    total?: number;
    accounts?: ProfitLossAccount[];
  };
  net_income?: number;
};

type BalanceSheetAccount = {
  no?: string;
  name?: string;
  indentation?: number;
  accountType?: string;
  balance?: number;
};

type BalanceSheetSection = {
  total?: number;
  accounts?: BalanceSheetAccount[];
};

type BalanceSheetResponse = {
  as_of_date?: string;
  assets?: BalanceSheetSection;
  liabilities?: BalanceSheetSection;
  equity?: BalanceSheetSection;
  balance_check?: {
    assets?: number;
    liabilities_plus_equity?: number;
    difference?: number;
  };
};

type Props = {
  reportType: ReportVariant;
  navigation?: any;
  route?: any;
};

/** Calendar date in local timezone (avoid UTC shift from toISOString). */
const toYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseYmdLocal = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getTodayDate = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

const startOfQuarter = (d: Date) => {
  const m = d.getMonth();
  const startMonth = Math.floor(m / 3) * 3;
  return new Date(d.getFullYear(), startMonth, 1);
};

const endOfPrevQuarter = (d: Date) => {
  const qStart = startOfQuarter(d);
  return new Date(qStart.getFullYear(), qStart.getMonth(), 0);
};

const startOfPrevQuarter = (d: Date) => {
  const qStart = startOfQuarter(d);
  return new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1);
};

type DateRange = {startDate: string; endDate: string};

type FilterMenuItem = {key: string; label: string};

const PROFIT_LOSS_MENU: FilterMenuItem[] = [
  {key: 'as_of_today', label: 'As of Today'},
  {key: 'this_month', label: 'This Month'},
  {key: 'this_month_to_date', label: 'This Month to Date'},
  {key: 'this_quarter', label: 'This Quarter'},
  {key: 'this_quarter_to_date', label: 'This Quarter to Date'},
  {key: 'this_year', label: 'This Year'},
  {key: 'this_year_to_date', label: 'This Year to Date'},
  {key: 'last_month', label: 'Last Month'},
  {key: 'last_quarter', label: 'Last Quarter'},
  {key: 'last_year', label: 'Last Year'},
  {key: 'custom', label: 'Custom'},
];

const BALANCE_SHEET_MENU: FilterMenuItem[] = [
  {key: 'as_of_today', label: 'As of Today'},
  {key: 'this_month', label: 'This Month'},
  {key: 'this_month_to_date', label: 'This Month to Date'},
  {key: 'this_quarter', label: 'This Quarter'},
  {key: 'this_quarter_to_date', label: 'This Quarter to Date'},
  {key: 'this_year', label: 'This Year'},
  {key: 'this_year_to_date', label: 'This Year to Date'},
  {key: 'last_month', label: 'Last Month'},
  {key: 'last_quarter', label: 'Last Quarter'},
  {key: 'last_year', label: 'Last Year'},
  {key: 'custom', label: 'Custom'},
];

function profitLossRangeForPreset(key: string, today: Date): DateRange | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  const todayStr = toYmd(today);

  switch (key) {
    case 'as_of_today':
      return {startDate: todayStr, endDate: todayStr};
    case 'this_month':
    case 'this_month_to_date': {
      const start = new Date(y, m, 1);
      return {startDate: toYmd(start), endDate: todayStr};
    }
    case 'this_quarter':
    case 'this_quarter_to_date': {
      const start = startOfQuarter(today);
      return {startDate: toYmd(start), endDate: todayStr};
    }
    case 'this_year':
    case 'this_year_to_date': {
      const start = new Date(y, 0, 1);
      return {startDate: toYmd(start), endDate: todayStr};
    }
    case 'last_month': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return {startDate: toYmd(start), endDate: toYmd(end)};
    }
    case 'last_quarter': {
      const start = startOfPrevQuarter(today);
      const end = endOfPrevQuarter(today);
      return {startDate: toYmd(start), endDate: toYmd(end)};
    }
    case 'last_year': {
      const start = new Date(y - 1, 0, 1);
      const end = new Date(y - 1, 11, 31);
      return {startDate: toYmd(start), endDate: toYmd(end)};
    }
    default:
      return null;
  }
}

/** Balance sheet is a point in time: one as-of date per preset. */
function balanceSheetAsOfForPreset(key: string, today: Date): string | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  const todayStr = toYmd(today);

  switch (key) {
    case 'as_of_today':
    case 'this_month':
    case 'this_month_to_date':
    case 'this_quarter':
    case 'this_quarter_to_date':
    case 'this_year':
    case 'this_year_to_date':
      return todayStr;
    case 'last_month':
      return toYmd(new Date(y, m, 0));
    case 'last_quarter':
      return toYmd(endOfPrevQuarter(today));
    case 'last_year':
      return toYmd(new Date(y - 1, 11, 31));
    default:
      return null;
  }
}

const ReportStatementScreen: React.FC<Props> = ({reportType}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const pendingCustomPlFrom = useRef<string | null>(null);
  const latestFetchId = useRef(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profitLossData, setProfitLossData] = useState<ProfitLossResponse | null>(
    null,
  );
  const [balanceSheetData, setBalanceSheetData] =
    useState<BalanceSheetResponse | null>(null);

  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(() =>
    reportType === 'profit-loss' ? 'This Month to Date' : 'As of Today',
  );
  const [activeFilterKey, setActiveFilterKey] = useState(() =>
    reportType === 'profit-loss' ? 'this_month_to_date' : 'as_of_today',
  );
  const [plRange, setPlRange] = useState<DateRange>(() =>
    profitLossRangeForPreset('this_month_to_date', getTodayDate())!,
  );
  const [bsAsOf, setBsAsOf] = useState(() =>
    balanceSheetAsOfForPreset('as_of_today', getTodayDate())!,
  );

  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<
    null | 'pl_from' | 'pl_to' | 'bs'
  >(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const pageTitle =
    reportType === 'profit-loss' ? 'Profit & Loss' : 'Balance Sheet';

  const filterMenuItems = useMemo(
    () =>
      reportType === 'profit-loss' ? PROFIT_LOSS_MENU : BALANCE_SHEET_MENU,
    [reportType],
  );

  const performFetch = useCallback(
    async (mode: 'full' | 'refresh') => {
      const fetchId = ++latestFetchId.current;
      const showFullSpinner = mode === 'full';
      if (showFullSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const response =
          reportType === 'profit-loss'
            ? await fetchProfitLossStatement({
                startDate: plRange.startDate,
                endDate: plRange.endDate,
              })
            : await fetchBalanceSheetReport(bsAsOf);
        if (fetchId !== latestFetchId.current) {
          return;
        }
        if (reportType === 'profit-loss') {
          setProfitLossData(response);
          setBalanceSheetData(null);
        } else {
          setBalanceSheetData(response);
          setProfitLossData(null);
        }
      } catch (fetchError: any) {
        if (fetchId !== latestFetchId.current) {
          return;
        }
        setError(
          fetchError?.response?.data?.detail ||
            fetchError?.message ||
            'Unable to load this report right now.',
        );
      } finally {
        if (fetchId !== latestFetchId.current) {
          return;
        }
        if (showFullSpinner) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [reportType, plRange.startDate, plRange.endDate, bsAsOf],
  );

  useEffect(() => {
    performFetch('full');
  }, [performFetch]);

  const loadReport = useCallback(() => performFetch('full'), [performFetch]);

  const onPullRefresh = useCallback(
    () => performFetch('refresh'),
    [performFetch],
  );

  const canExportPdf =
    !loading &&
    !error &&
    (reportType === 'profit-loss'
      ? !!profitLossData
      : !!balanceSheetData);

  const handleExportPdf = useCallback(async () => {
    if (!canExportPdf || exportingPdf) {
      return;
    }
    setExportingPdf(true);
    try {
      const apiType =
        reportType === 'profit-loss' ? 'profit_loss' : 'balance_sheet';
      const filters: Record<string, unknown> =
        reportType === 'profit-loss'
          ? {start_date: plRange.startDate, end_date: plRange.endDate}
          : {as_of_date: bsAsOf};
      const buf = await exportReportPdfFromApi(apiType, filters);
      const baseName = `zentro_${apiType}_${
        reportType === 'profit-loss' ? plRange.endDate : bsAsOf
      }`;
      const {sharedOnIos} = await savePdfBufferAndShare(buf, baseName);
      if (sharedOnIos) {
        Toast.show({
          type: 'success',
          text1: 'PDF ready',
          text2: 'Use the share sheet to save or send.',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'PDF saved',
          text2:
            'File path copied. Paste in a file manager to open the PDF in Downloads or share it.',
        });
      }
    } catch (e: unknown) {
      const err = e as {message?: string};
      Toast.show({
        type: 'error',
        text1: 'PDF export failed',
        text2: err?.message || 'Could not export PDF.',
      });
    } finally {
      setExportingPdf(false);
    }
  }, [
    bsAsOf,
    canExportPdf,
    exportingPdf,
    plRange.endDate,
    plRange.startDate,
    reportType,
  ]);

  const handleSelectFilter = useCallback(
    (item: FilterMenuItem) => {
      if (item.key === 'custom') {
        setFilterMenuVisible(false);
        pendingCustomPlFrom.current = null;
        if (reportType === 'profit-loss') {
          setDatePickerMode('pl_from');
          setIsDatePickerVisible(true);
        } else {
          setDatePickerMode('bs');
          setIsDatePickerVisible(true);
        }
        return;
      }

      const today = getTodayDate();
      if (reportType === 'profit-loss') {
        const range = profitLossRangeForPreset(item.key, today);
        if (!range) {
          return;
        }
        setPlRange(range);
        setPeriodLabel(item.label);
        setActiveFilterKey(item.key);
      } else {
        const asOf = balanceSheetAsOfForPreset(item.key, today);
        if (!asOf) {
          return;
        }
        setBsAsOf(asOf);
        setPeriodLabel(item.label);
        setActiveFilterKey(item.key);
      }
      setFilterMenuVisible(false);
    },
    [reportType],
  );

  const handleDatePickerChange = useCallback(
    (event: {type?: string}, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setIsDatePickerVisible(false);
      }
      if (event.type === 'dismissed') {
        setIsDatePickerVisible(false);
        /*
         * Android often emits `dismissed` immediately after a successful `set`
         * when closing the first dialog. Do not reset the flow if we already
         * stored the start date and are about to open the end-date picker.
         */
        if (
          Platform.OS === 'android' &&
          datePickerMode === 'pl_from' &&
          pendingCustomPlFrom.current
        ) {
          return;
        }
        setDatePickerMode(null);
        pendingCustomPlFrom.current = null;
        return;
      }
      if (!selectedDate || !datePickerMode) {
        return;
      }

      const dateStr = toYmd(selectedDate);

      if (datePickerMode === 'pl_from') {
        pendingCustomPlFrom.current = dateStr;
        if (Platform.OS === 'ios') {
          setDatePickerMode('pl_to');
        } else {
          setTimeout(() => {
            setIsDatePickerVisible(true);
            setDatePickerMode('pl_to');
          }, 100);
        }
        return;
      }

      if (datePickerMode === 'pl_to') {
        const from = pendingCustomPlFrom.current ?? dateStr;
        let start = from;
        let end = dateStr;
        if (start > end) {
          const t = start;
          start = end;
          end = t;
        }
        setPlRange({startDate: start, endDate: end});
        setPeriodLabel(`Custom (${start} – ${end})`);
        setActiveFilterKey('custom');
        pendingCustomPlFrom.current = null;
        setDatePickerMode(null);
        setIsDatePickerVisible(false);
        return;
      }

      if (datePickerMode === 'bs') {
        setBsAsOf(dateStr);
        setPeriodLabel(`Custom (${dateStr})`);
        setActiveFilterKey('custom');
        setDatePickerMode(null);
        setIsDatePickerVisible(false);
      }
    },
    [datePickerMode],
  );

  const formatCurrency = (value?: number) => {
    const amount = typeof value === 'number' ? value : 0;
    return `UGX ${Math.round(amount).toLocaleString()}`;
  };

  const renderSummaryCard = (
    label: string,
    value: string,
    tone: 'default' | 'positive' | 'negative' = 'default',
  ) => (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}>
      <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'positive' && styles.positiveValue,
          tone === 'negative' && styles.negativeValue,
          tone === 'default' && {color: colors.textPrimary},
        ]}>
        {value}
      </Text>
    </View>
  );

  const renderProfitLossAccounts = (
    heading: string,
    total: number | undefined,
    accounts: ProfitLossAccount[] | undefined,
  ) => (
    <View
      style={[
        styles.sectionCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
          {heading}
        </Text>
        <Text style={styles.sectionTotal}>{formatCurrency(total)}</Text>
      </View>

      {accounts?.length ? (
        accounts.map(account => (
          <View
            key={`${account.gl_account__no ?? account.gl_account__name}`}
            style={[
              styles.accountRow,
              {marginLeft: (account.gl_account__indentation ?? 0) * 10},
            ]}>
            <Text
              style={[styles.accountName, {color: colors.textSecondary}]}
              numberOfLines={2}>
              {account.gl_account__name ?? 'Account'}
            </Text>
            <Text style={[styles.accountAmount, {color: colors.textPrimary}]}>
              {formatCurrency(account.amount)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[styles.emptySectionText, {color: colors.textSecondary}]}>
          No account lines available.
        </Text>
      )}
    </View>
  );

  const renderBalanceSheetAccounts = (
    heading: string,
    section: BalanceSheetSection | undefined,
    tone: 'positive' | 'negative' | 'default' = 'default',
  ) => (
    <View
      style={[
        styles.sectionCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
          {heading}
        </Text>
        <Text
          style={[
            styles.sectionTotal,
            tone === 'positive' && styles.positiveValue,
            tone === 'negative' && styles.negativeValue,
            tone === 'default' && {color: colors.textPrimary},
          ]}>
          {formatCurrency(section?.total)}
        </Text>
      </View>

      {section?.accounts?.length ? (
        section.accounts.map(account => (
          <View
            key={`${account.no ?? account.name}`}
            style={[
              styles.accountRow,
              {marginLeft: (account.indentation ?? 0) * 10},
            ]}>
            <Text
              style={[
                styles.accountName,
                {color: colors.textSecondary},
                account.accountType === 'Heading' && styles.accountHeading,
                account.accountType === 'Total' && styles.accountHeading,
              ]}
              numberOfLines={2}>
              {account.name ?? 'Account'}
            </Text>
            <Text style={[styles.accountAmount, {color: colors.textPrimary}]}>
              {formatCurrency(account.balance)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[styles.emptySectionText, {color: colors.textSecondary}]}>
          No account lines available.
        </Text>
      )}
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.stateText, {color: colors.textSecondary}]}>
            Loading {pageTitle.toLowerCase()}...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateWrap}>
          <Image source={icons.cross} style={styles.stateIcon} />
          <Text style={[styles.stateText, {color: colors.textPrimary}]}>
            {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadReport}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (reportType === 'profit-loss' && profitLossData) {
      return (
        <>
          <View
            style={[
              styles.heroCard,
              {backgroundColor: colors.card, borderColor: colors.border},
            ]}>
            <Text style={[styles.heroEyebrow, {color: COLORS.primary2}]}>
              CURRENT PERIOD
            </Text>
            <Text style={[styles.heroTitle, {color: colors.textPrimary}]}>
              {profitLossData.period?.start_date} to {profitLossData.period?.end_date}
            </Text>
            <Text style={[styles.heroSubtitle, {color: colors.textSecondary}]}>
              Review revenue, direct costs, and operating expenses in one place.
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            {renderSummaryCard(
              'Revenue',
              formatCurrency(profitLossData.revenue?.total),
              'positive',
            )}
            {renderSummaryCard(
              'Gross Profit',
              formatCurrency(profitLossData.gross_profit),
              (profitLossData.gross_profit ?? 0) >= 0 ? 'positive' : 'negative',
            )}
            {renderSummaryCard(
              'Net Income',
              formatCurrency(profitLossData.net_income),
              (profitLossData.net_income ?? 0) >= 0 ? 'positive' : 'negative',
            )}
          </View>

          {renderProfitLossAccounts(
            'Revenue',
            profitLossData.revenue?.total,
            profitLossData.revenue?.accounts,
          )}
          {renderProfitLossAccounts(
            'Cost of Goods Sold',
            profitLossData.cost_of_goods_sold?.total,
            profitLossData.cost_of_goods_sold?.accounts,
          )}
          <View
            style={[
              styles.highlightCard,
              {backgroundColor: COLORS.primary2 + '12', borderColor: COLORS.primary2 + '30'},
            ]}>
            <Text style={styles.highlightLabel}>Gross Profit</Text>
            <Text
              style={[
                styles.highlightValue,
                (profitLossData.gross_profit ?? 0) >= 0
                  ? styles.positiveValue
                  : styles.negativeValue,
              ]}>
              {formatCurrency(profitLossData.gross_profit)}
            </Text>
          </View>
          {renderProfitLossAccounts(
            'Operating Expenses',
            profitLossData.operating_expenses?.total,
            profitLossData.operating_expenses?.accounts,
          )}
          <View
            style={[
              styles.highlightCard,
              {backgroundColor: COLORS.primary2 + '12', borderColor: COLORS.primary2 + '30'},
            ]}>
            <Text style={styles.highlightLabel}>Net Income</Text>
            <Text
              style={[
                styles.highlightValue,
                (profitLossData.net_income ?? 0) >= 0
                  ? styles.positiveValue
                  : styles.negativeValue,
              ]}>
              {formatCurrency(profitLossData.net_income)}
            </Text>
          </View>
        </>
      );
    }

    if (reportType === 'balance-sheet' && balanceSheetData) {
      return (
        <>
          <View
            style={[
              styles.heroCard,
              {backgroundColor: colors.card, borderColor: colors.border},
            ]}>
            <Text style={[styles.heroEyebrow, {color: COLORS.primary2}]}>
              AS OF
            </Text>
            <Text style={[styles.heroTitle, {color: colors.textPrimary}]}>
              {balanceSheetData.as_of_date}
            </Text>
            <Text style={[styles.heroSubtitle, {color: colors.textSecondary}]}>
              Check the business position across assets, liabilities, and equity.
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            {renderSummaryCard(
              'Total Assets',
              formatCurrency(balanceSheetData.assets?.total),
              'positive',
            )}
            {renderSummaryCard(
              'Liabilities',
              formatCurrency(balanceSheetData.liabilities?.total),
              'negative',
            )}
            {renderSummaryCard(
              'Equity',
              formatCurrency(balanceSheetData.equity?.total),
            )}
            {renderSummaryCard(
              'Difference',
              formatCurrency(balanceSheetData.balance_check?.difference),
              (balanceSheetData.balance_check?.difference ?? 0) === 0
                ? 'positive'
                : 'negative',
            )}
          </View>

          {renderBalanceSheetAccounts('Assets', balanceSheetData.assets, 'positive')}
          {renderBalanceSheetAccounts(
            'Liabilities',
            balanceSheetData.liabilities,
            'negative',
          )}
          {renderBalanceSheetAccounts('Equity', balanceSheetData.equity)}
        </>
      );
    }

    return (
      <View style={styles.stateWrap}>
        <Text style={[styles.stateText, {color: colors.textSecondary}]}>
          No report data available.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            borderBottomColor: colors.border,
          },
        ]}>
        <TouchableOpacity
          style={[styles.backButton, {backgroundColor: colors.card, borderColor: colors.border}]}
          onPress={() => navigation.goBack()}>
          <Image source={icons.back} style={styles.backIcon} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            {pageTitle}
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {periodLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.pdfHeaderButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: canExportPdf && !exportingPdf ? 1 : 0.45,
            },
          ]}
          onPress={handleExportPdf}
          disabled={!canExportPdf || exportingPdf}
          accessibilityLabel="Export report as PDF">
          {exportingPdf ? (
            <ActivityIndicator size="small" color={COLORS.primary2} />
          ) : (
            <Text style={[styles.pdfHeaderButtonText, {color: COLORS.primary2}]}>
              PDF
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterHeaderButton,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}
          onPress={() => setFilterMenuVisible(true)}
          accessibilityLabel="Filter report period">
          <Image source={icons.filter} style={styles.filterHeaderIcon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            colors={[COLORS.primary2]}
            tintColor={COLORS.primary2}
          />
        }>
        {renderBody()}
      </ScrollView>

      <Modal
        visible={filterMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterMenuVisible(false)}>
        <View style={styles.filterModalRoot}>
          <Pressable
            style={[styles.filterBackdrop, {backgroundColor: 'rgba(0,0,0,0.35)'}]}
            onPress={() => setFilterMenuVisible(false)}
          />
          <View
            style={[
              styles.filterDropdown,
              {
                top: Math.max(insets.top, 12) + 48,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}>
            <Text style={[styles.filterDropdownTitle, {color: colors.textPrimary}]}>
              {reportType === 'profit-loss' ? 'Report period' : 'As of date'}
            </Text>
            <FlatList
              data={filterMenuItems}
              keyExtractor={i => i.key}
              keyboardShouldPersistTaps="handled"
              style={styles.filterMenuList}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.filterMenuRow,
                    activeFilterKey === item.key && styles.filterMenuRowActive,
                  ]}
                  onPress={() => handleSelectFilter(item)}>
                  <Text
                    style={[
                      styles.filterMenuRowText,
                      {
                        color:
                          activeFilterKey === item.key
                            ? COLORS.primary2
                            : colors.textPrimary,
                        fontWeight: activeFilterKey === item.key ? '700' : '500',
                      },
                    ]}>
                    {item.label}
                  </Text>
                  {activeFilterKey === item.key ? (
                    <Text style={styles.filterMenuCheck}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {isDatePickerVisible && datePickerMode ? (
        <DateTimePicker
          key={datePickerMode}
          value={
            datePickerMode === 'pl_from'
              ? getTodayDate()
              : datePickerMode === 'pl_to'
                ? parseYmdLocal(
                    pendingCustomPlFrom.current ?? toYmd(getTodayDate()),
                  )
                : parseYmdLocal(bsAsOf)
          }
          mode="date"
          display="default"
          onChange={handleDatePickerChange}
          maximumDate={getTodayDate()}
          minimumDate={
            datePickerMode === 'pl_to' && pendingCustomPlFrom.current
              ? parseYmdLocal(pendingCustomPlFrom.current)
              : undefined
          }
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary2,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  headerTitle: {
    ...FONTS.h3,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...FONTS.body5,
    marginTop: 4,
    lineHeight: 18,
  },
  pdfHeaderButton: {
    minWidth: 44,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  pdfHeaderButtonText: {
    ...FONTS.body5,
    fontWeight: '700',
  },
  filterHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterHeaderIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary2,
  },
  filterModalRoot: {
    flex: 1,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  filterDropdown: {
    position: 'absolute',
    right: SIZES.padding,
    width: 288,
    maxHeight: '75%',
    borderRadius: 16,
    borderWidth: 1,
    paddingBottom: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  filterDropdownTitle: {
    ...FONTS.body5,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  filterMenuList: {
    maxHeight: 400,
  },
  filterMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterMenuRowActive: {
    backgroundColor: COLORS.primary2 + '10',
  },
  filterMenuRowText: {
    ...FONTS.body4,
    flex: 1,
    paddingRight: 12,
  },
  filterMenuCheck: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  heroEyebrow: {
    ...FONTS.body5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTitle: {
    ...FONTS.h3,
    marginTop: 8,
    fontWeight: '700',
  },
  heroSubtitle: {
    ...FONTS.body4,
    marginTop: 8,
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 10,
  },
  summaryCard: {
    width: '50%',
    padding: 14,
    marginHorizontal: 6,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 94,
  },
  summaryLabel: {
    ...FONTS.body5,
  },
  summaryValue: {
    ...FONTS.h3,
    marginTop: 8,
    fontWeight: '700',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  sectionTotal: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  accountName: {
    ...FONTS.body4,
    flex: 1,
    lineHeight: 20,
  },
  accountAmount: {
    ...FONTS.body4,
    fontWeight: '600',
    textAlign: 'right',
  },
  accountHeading: {
    fontWeight: '700',
  },
  emptySectionText: {
    ...FONTS.body4,
  },
  highlightCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  highlightLabel: {
    ...FONTS.body5,
    color: COLORS.primary2,
    fontWeight: '700',
    marginBottom: 8,
  },
  highlightValue: {
    ...FONTS.h2,
    fontWeight: '700',
  },
  positiveValue: {
    color: COLORS.success,
  },
  negativeValue: {
    color: COLORS.error,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  stateIcon: {
    width: 28,
    height: 28,
    tintColor: COLORS.error,
    marginBottom: 12,
  },
  stateText: {
    ...FONTS.body4,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary2,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...FONTS.body5,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default ReportStatementScreen;
