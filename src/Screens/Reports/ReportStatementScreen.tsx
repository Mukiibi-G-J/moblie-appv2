import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {formatCurrencyCompact} from '../../utils/currency';
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
import {safeGoBack} from '../../hooks/NavigationService';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {QuickIconPressable} from '../../Components';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {
  downloadBalanceSheetPdf,
  downloadProfitLossPdf,
  fetchBalanceSheetReport,
  fetchProfitLossStatement,
  type FinancialReportData,
  type FinancialReportRow,
} from '../../services/app.services';
import {
  savePdfBase64AndShare,
  savePdfBufferAndShare,
} from '../../utils/reportPdfDownload';
import {BranchFilterSelect} from '../../Components/BranchFilterSelect';

type ReportVariant = 'profit-loss' | 'balance-sheet';

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
      return {
        startDate: toYmd(new Date(y, m, 1)),
        endDate: toYmd(new Date(y, m + 1, 0)),
      };
    case 'this_month_to_date':
      return {startDate: toYmd(new Date(y, m, 1)), endDate: todayStr};
    case 'this_quarter': {
      const start = startOfQuarter(today);
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
      return {startDate: toYmd(start), endDate: toYmd(end)};
    }
    case 'this_quarter_to_date':
      return {startDate: toYmd(startOfQuarter(today)), endDate: todayStr};
    case 'this_year':
      return {
        startDate: toYmd(new Date(y, 0, 1)),
        endDate: toYmd(new Date(y, 11, 31)),
      };
    case 'this_year_to_date':
      return {startDate: toYmd(new Date(y, 0, 1)), endDate: todayStr};
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
  const app = useAppContext();
  const pendingCustomPlFrom = useRef<string | null>(null);
  const latestFetchId = useRef(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profitLossData, setProfitLossData] = useState<FinancialReportData | null>(
    null,
  );
  const [balanceSheetData, setBalanceSheetData] =
    useState<BalanceSheetResponse | null>(null);

  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(() =>
    reportType === 'profit-loss' ? 'This Year to Date' : 'As of Today',
  );
  const [activeFilterKey, setActiveFilterKey] = useState(() =>
    reportType === 'profit-loss' ? 'this_year_to_date' : 'as_of_today',
  );
  const [plRange, setPlRange] = useState<DateRange>(() =>
    profitLossRangeForPreset('this_year_to_date', getTodayDate())!,
  );
  const [bsAsOf, setBsAsOf] = useState(() =>
    balanceSheetAsOfForPreset('as_of_today', getTodayDate())!,
  );
  const [branchFilter, setBranchFilter] = useState<number | null | undefined>(
    undefined,
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

  // Default report branch to the global working branch once known.
  useEffect(() => {
    if (branchFilter !== undefined) return;
    setBranchFilter(app?.branchSession?.active_branch_id ?? null);
  }, [app?.branchSession?.active_branch_id, branchFilter]);

  const branchRequestConfig = useMemo(() => {
    if (branchFilter === null) return {headers: {'X-Branch-Scope': 'all'}};
    if (typeof branchFilter === 'number')
      return {headers: {'X-Branch-Id': String(branchFilter)}};
    return undefined;
  }, [branchFilter]);

  const performFetch = useCallback(
    async (mode: 'full' | 'refresh') => {
      if (branchFilter === undefined) {
        return;
      }
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
                branch: branchFilter === undefined ? undefined : branchFilter,
                requestConfig: branchRequestConfig,
              })
            : await fetchBalanceSheetReport(
                bsAsOf,
                branchFilter === undefined ? undefined : branchFilter,
                branchRequestConfig,
              );
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
          fetchError?.response?.data?.error ||
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
    [
      reportType,
      plRange.startDate,
      plRange.endDate,
      bsAsOf,
      branchFilter,
      branchRequestConfig,
    ],
  );

  useEffect(() => {
    if (branchFilter === undefined) {
      setLoading(true);
      return;
    }
    performFetch('full');
  }, [performFetch, branchFilter]);

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
      if (reportType === 'profit-loss') {
        const pdf = await downloadProfitLossPdf({
          startDate: plRange.startDate,
          endDate: plRange.endDate,
          branch: branchFilter,
          requestConfig: branchRequestConfig,
        });
        const baseName =
          pdf.fileName.replace(/\.pdf$/i, '') ||
          `zentro_profit_loss_${plRange.endDate}`;
        const {sharedOnIos, displayPath, openedViewer} =
          await savePdfBase64AndShare(pdf.base64, baseName);
        if (sharedOnIos) {
          Toast.show({
            type: 'success',
            text1: 'PDF ready',
            text2: 'Use the share sheet to save or send.',
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'PDF downloaded',
            text2: openedViewer
              ? `Saved to ${displayPath}`
              : `Saved to ${displayPath}. Open Downloads or Files to view it.`,
          });
        }
        return;
      }

      const buf = await downloadBalanceSheetPdf({
        asOfDate: bsAsOf,
        branch: branchFilter,
        requestConfig: branchRequestConfig,
      });
      const baseName = `zentro_balance_sheet_${bsAsOf}`;
      const {sharedOnIos, displayPath, openedViewer} = await savePdfBufferAndShare(
        buf,
        baseName,
      );
      if (sharedOnIos) {
        Toast.show({
          type: 'success',
          text1: 'PDF ready',
          text2: 'Use the share sheet to save or send.',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'PDF downloaded',
          text2: openedViewer
            ? `Saved to ${displayPath}`
            : `Saved to ${displayPath}. Open Downloads or Files to view it.`,
        });
      }
    } catch (e: unknown) {
      const err = e as {message?: string; response?: {data?: {error?: string}}};
      Toast.show({
        type: 'error',
        text1: 'PDF export failed',
        text2:
          err?.response?.data?.error ||
          err?.message ||
          'Could not export PDF.',
      });
    } finally {
      setExportingPdf(false);
    }
  }, [
    branchFilter,
    branchRequestConfig,
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
    return formatCurrencyCompact(amount);
  };

  const primaryPlColumnKey = useMemo(() => {
    if (!profitLossData?.columns?.length) {
      return null;
    }
    const current =
      profitLossData.columns.find(
        col =>
          String(col.comparison_period_formula || '').toUpperCase() === '0M',
      ) || profitLossData.columns[0];
    return current?.key ?? null;
  }, [profitLossData]);

  const findPlRowAmount = useCallback(
    (matchers: string[]) => {
      if (!profitLossData?.rows?.length || !primaryPlColumnKey) {
        return undefined;
      }
      const row = profitLossData.rows.find(item => {
        const description = (item.description || '').toLowerCase();
        return matchers.some(matcher =>
          description.includes(matcher.toLowerCase()),
        );
      });
      if (!row) {
        return undefined;
      }
      const amount = row.amounts?.[primaryPlColumnKey];
      return typeof amount === 'number' ? amount : undefined;
    },
    [primaryPlColumnKey, profitLossData],
  );

  const renderSummaryCard = (
    label: string,
    value: string,
    _tone: 'default' | 'positive' | 'negative' = 'default',
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
      <Text style={[styles.summaryValue, {color: colors.textPrimary}]}>
        {value}
      </Text>
    </View>
  );

  const renderFinancialReportRows = (
    report: FinancialReportData,
    columns = report.columns,
  ) => {
    const visibleRows = (report.rows || []).filter(
      row => row.visible !== false,
    );
    if (!visibleRows.length) {
      return (
        <View style={styles.plStatement}>
          <Text style={[styles.emptySectionText, {color: colors.textSecondary}]}>
            No report lines available.
          </Text>
        </View>
      );
    }

    const amountColumns = columns?.length ? columns : [];
    const displayColumns = amountColumns.length
      ? amountColumns
      : primaryPlColumnKey
        ? [{key: primaryPlColumnKey, header: '', line_no: 0}]
        : [];

    return (
      <View style={styles.plStatement}>
        {displayColumns.length > 1 ? (
          <View
            style={[
              styles.plColumnHeaderRow,
              {borderBottomColor: colors.border},
            ]}>
            <Text
              style={[
                styles.plColumnHeaderLabel,
                {color: colors.textSecondary},
              ]}>
              Line
            </Text>
            {displayColumns.map(col => (
              <Text
                key={col.key}
                style={[
                  styles.plColumnHeaderAmount,
                  {color: colors.textSecondary},
                ]}
                numberOfLines={1}>
                {col.header}
              </Text>
            ))}
          </View>
        ) : null}

        {visibleRows.map((row: FinancialReportRow, index: number) => {
          const rowType = (row.row_type || '').toLowerCase();
          const isHeader = rowType === 'header';
          const isBeginTotal = rowType === 'begin-total';
          const isEndTotal = rowType === 'end-total' || rowType === 'total';
          const isSectionBreak = isHeader || isBeginTotal;
          const isEmphasis =
            row.bold ||
            isHeader ||
            isEndTotal ||
            /money made|profit before|total /i.test(row.description || '');
          const indent = Math.max(0, row.indentation ?? 0);
          const showTopGap = isSectionBreak && index > 0;

          return (
            <View
              key={`${row.line_no}-${row.row_no}`}
              style={[
                styles.plRow,
                showTopGap && styles.plRowSectionGap,
                isEndTotal && [
                  styles.plRowTotal,
                  {borderTopColor: colors.border},
                ],
              ]}>
              <Text
                style={[
                  styles.plRowDescription,
                  {
                    color: isHeader
                      ? colors.textSecondary
                      : colors.textPrimary,
                    fontWeight: isEmphasis ? '600' : '400',
                    fontStyle: row.italic ? 'italic' : 'normal',
                    paddingLeft: indent * 12,
                    textTransform: isHeader ? 'uppercase' : 'none',
                    letterSpacing: isHeader ? 0.4 : 0,
                    fontSize: isHeader ? 12 : 15,
                  },
                ]}
                numberOfLines={2}>
                {row.description || '—'}
              </Text>
              <View style={styles.plRowAmounts}>
                {displayColumns.map(col => {
                  const amount =
                    typeof row.amounts?.[col.key] === 'number'
                      ? row.amounts[col.key]
                      : null;
                  if (isHeader || amount == null) {
                    return (
                      <View
                        key={col.key || 'empty'}
                        style={styles.plRowAmountSlot}
                      />
                    );
                  }
                  return (
                    <Text
                      key={col.key || 'amount'}
                      style={[
                        styles.plRowAmount,
                        {
                          color: colors.textPrimary,
                          fontWeight: isEmphasis ? '600' : '400',
                        },
                      ]}>
                      {formatCurrency(amount)}
                    </Text>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderBalanceSheetAccounts = (
    heading: string,
    section: BalanceSheetSection | undefined,
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
        <Text style={[styles.sectionTotal, {color: colors.textPrimary}]}>
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
      const netProfit = findPlRowAmount([
        'money made',
        'profit or loss',
        'net income',
        'net profit',
      ]);
      const periodText =
        profitLossData.period_label ||
        `${profitLossData.start_date || plRange.startDate} – ${
          profitLossData.end_date || plRange.endDate
        }`;

      return (
        <>
          <View style={styles.plPeriodBlock}>
            <Text style={[styles.plPeriodLabel, {color: colors.textSecondary}]}>
              {periodText}
              {profitLossData.branch_name
                ? ` · ${profitLossData.branch_name}`
                : ''}
            </Text>
            {typeof netProfit === 'number' ? (
              <View style={styles.plNetBlock}>
                <Text
                  style={[styles.plNetLabel, {color: colors.textSecondary}]}>
                  Profit / Loss
                </Text>
                <Text style={[styles.plNetValue, {color: colors.textPrimary}]}>
                  {formatCurrency(netProfit)}
                </Text>
              </View>
            ) : null}
          </View>

          {renderFinancialReportRows(profitLossData)}
        </>
      );
    }

    if (reportType === 'balance-sheet' && balanceSheetData) {
      return (
        <>
          <View style={styles.plPeriodBlock}>
            <Text style={[styles.plPeriodLabel, {color: colors.textSecondary}]}>
              As of {balanceSheetData.as_of_date}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            {renderSummaryCard(
              'Total Assets',
              formatCurrency(balanceSheetData.assets?.total),
            )}
            {renderSummaryCard(
              'Liabilities',
              formatCurrency(balanceSheetData.liabilities?.total),
            )}
            {renderSummaryCard(
              'Equity',
              formatCurrency(balanceSheetData.equity?.total),
            )}
            {renderSummaryCard(
              'Difference',
              formatCurrency(balanceSheetData.balance_check?.difference),
            )}
          </View>

          {renderBalanceSheetAccounts('Assets', balanceSheetData.assets)}
          {renderBalanceSheetAccounts(
            'Liabilities',
            balanceSheetData.liabilities,
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
        <QuickIconPressable
          style={[styles.backButton, {backgroundColor: colors.card, borderColor: colors.border}]}
          onPress={() => safeGoBack(navigation, 'Home')}
          accessibilityLabel="Go back">
          <Image source={icons.back} style={styles.backIcon} />
        </QuickIconPressable>

        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
            {pageTitle}
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {periodLabel}
          </Text>
        </View>

        <BranchFilterSelect
          value={branchFilter}
          onChange={(v) => setBranchFilter(v)}
        />

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
    paddingHorizontal: SIZES.padding,
    paddingTop: 8,
    paddingBottom: SIZES.padding * 2,
  },
  plPeriodBlock: {
    marginBottom: 18,
    paddingTop: 4,
  },
  plPeriodLabel: {
    ...FONTS.body4,
    lineHeight: 20,
  },
  plNetBlock: {
    marginTop: 14,
  },
  plNetLabel: {
    ...FONTS.body5,
    fontWeight: '500',
  },
  plNetValue: {
    ...FONTS.h2,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  plStatement: {
    paddingTop: 4,
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 84,
  },
  summaryLabel: {
    ...FONTS.body5,
  },
  summaryValue: {
    ...FONTS.h3,
    marginTop: 8,
    fontWeight: '600',
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
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
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  sectionTotal: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  plColumnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  plColumnHeaderLabel: {
    ...FONTS.body5,
    fontWeight: '500',
    flex: 1,
    paddingRight: 8,
  },
  plColumnHeaderAmount: {
    ...FONTS.body5,
    fontWeight: '500',
    minWidth: 78,
    textAlign: 'right',
    marginLeft: 8,
  },
  plRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  plRowSectionGap: {
    marginTop: 14,
    paddingTop: 4,
  },
  plRowTotal: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  plRowDescription: {
    ...FONTS.body4,
    flex: 1,
    lineHeight: 21,
    paddingRight: 12,
  },
  plRowAmounts: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  plRowAmountSlot: {
    minWidth: 78,
    marginLeft: 8,
  },
  plRowAmount: {
    ...FONTS.body4,
    minWidth: 78,
    textAlign: 'right',
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
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
    fontWeight: '500',
    textAlign: 'right',
  },
  accountHeading: {
    fontWeight: '600',
  },
  emptySectionText: {
    ...FONTS.body4,
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
