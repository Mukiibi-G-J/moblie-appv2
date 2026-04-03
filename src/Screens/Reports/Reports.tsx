import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {usePermissions} from '../../hooks/usePermissions';
import {REPORT_PAGE_MAPPING} from '../../constants/permissions';
import Toast from 'react-native-toast-message';
import {
  exportReportPdfFromApi,
  fetchDailyProfitReport,
  fetchExpenseBreakdownReport,
  fetchMonthlySummaryReport,
  fetchProductProfitabilityReport,
  fetchSalesData,
  fetchWeeklySummaryReport,
} from '../../services/app.services';
import {savePdfBufferAndShare} from '../../utils/reportPdfDownload';

type DateFilter = 'today' | 'last7days' | 'last30days';

type SalesInvoice = {
  id?: number;
  invoice_no?: string;
  customer_name?: string;
  document_date?: string;
  total_amount?: number;
};

type ReportId =
  | 'overview'
  | 'daily-profit'
  | 'weekly-summary'
  | 'monthly-summary'
  | 'product-profitability'
  | 'expense-breakdown';

type DailyProfitData = {
  report_type?: string;
  period?: {date?: string};
  data?: {
    report_date?: string;
    total_sales?: number;
    sales_count?: number;
    avg_transaction?: number;
    total_expenses?: number;
    expense_count?: number;
    total_cogs?: number;
    gross_profit?: number;
    net_profit?: number;
    profit_margin?: number;
    comparison?: {
      previous_day_date?: string;
      previous_day_profit?: number;
      change_amount?: number;
      change_percentage?: number;
    };
  };
};

type WeeklySummaryData = {
  data?: {
    financial_overview?: {
      total_revenue?: number;
      total_expenses?: number;
      net_profit?: number;
      profit_margin?: number;
      transaction_count?: number;
    };
    top_products?: Array<{
      item_name?: string;
      revenue?: number;
      percentage?: number;
    }>;
    expense_breakdown?: Array<{
      expense_type_name?: string;
      total_amount?: number;
      percentage?: number;
    }>;
  };
};

type MonthlySummaryData = {
  data?: {
    financial_overview?: {
      total_revenue?: number;
      total_expenses?: number;
      net_profit?: number;
      profit_margin?: number;
    };
    kpis?: {
      avg_daily_sales?: number;
      avg_profit_margin?: number;
      total_transactions?: number;
    };
    top_products?: Array<{
      item_name?: string;
      revenue?: number;
      percentage?: number;
    }>;
    top_customers?: Array<{
      customer_name?: string;
      total_purchases?: number;
      percentage?: number;
    }>;
  };
};

type ProductProfitabilityData = {
  data?: {
    summary?: {
      total_products?: number;
      profitable_products?: number;
      loss_making_products?: number;
      avg_profit_margin?: number;
    };
    products?: Array<{
      item_name?: string;
      profit?: number;
      profit_margin?: number;
      total_revenue?: number;
    }>;
  };
};

type ExpenseBreakdownData = {
  data?: {
    summary?: {
      total_expenses?: number;
      total_count?: number;
      avg_daily_expense?: number;
      period_comparison?: {
        previous_total?: number;
        change_percentage?: number;
      };
    };
    breakdown?: Array<{
      expense_type_name?: string;
      total_amount?: number;
      percentage?: number;
    }>;
  };
};

type ReportState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

const FILTERS: {id: DateFilter; label: string}[] = [
  {id: 'today', label: 'Today'},
  {id: 'last7days', label: 'Last 7 days'},
  {id: 'last30days', label: 'Last 30 days'},
];

const REPORT_SECTIONS = [
  {
    id: 'daily-profit',
    title: 'Daily Profit',
    description: 'Sales, expenses, and net profit with day-over-day change.',
    icon: icons.calender,
    category: 'time-based',
  },
  {
    id: 'weekly-summary',
    title: 'Weekly Summary',
    description: '7-day performance with top products and expense mix.',
    icon: icons.menu,
    category: 'time-based',
  },
  {
    id: 'monthly-summary',
    title: 'Monthly Summary',
    description: '30-day insights, YTD benchmarks, and customer trends.',
    icon: icons.bar,
    category: 'time-based',
  },
  {
    id: 'product-profitability',
    title: 'Product Profitability',
    description: 'Revenue, margin, and unit economics for each product.',
    icon: icons.product,
    category: 'analytical',
  },
  {
    id: 'expense-breakdown',
    title: 'Expense Breakdown',
    description: 'Category drill-down with comparisons to prior periods.',
    icon: icons.coupon,
    category: 'analytical',
  },
];

const Reports = () => {
  const {canRead} = usePermissions();
  const [activeFilter, setActiveFilter] = useState<DateFilter>('today');
  const [sales, setSales] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportId | null>(null);
  const [dailyProfit, setDailyProfit] = useState<ReportState<DailyProfitData>>({
    loading: false,
    error: null,
    data: null,
  });
  const [weeklySummary, setWeeklySummary] =
    useState<ReportState<WeeklySummaryData>>({
      loading: false,
      error: null,
      data: null,
    });
  const [monthlySummary, setMonthlySummary] =
    useState<ReportState<MonthlySummaryData>>({
      loading: false,
      error: null,
      data: null,
    });
  const [productProfitability, setProductProfitability] =
    useState<ReportState<ProductProfitabilityData>>({
      loading: false,
      error: null,
      data: null,
    });
  const [expenseBreakdown, setExpenseBreakdown] =
    useState<ReportState<ExpenseBreakdownData>>({
      loading: false,
      error: null,
      data: null,
    });
  const [exportingAnalyticsPdf, setExportingAnalyticsPdf] = useState(false);

  const {startDate, endDate} = useMemo(() => {
    const today = new Date();
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const start = new Date(end);

    if (activeFilter === 'last7days') {
      start.setDate(end.getDate() - 6);
    } else if (activeFilter === 'last30days') {
      start.setDate(end.getDate() - 29);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [activeFilter]);

  useEffect(() => {
    loadSalesSummary();
  }, [startDate, endDate]);

  useEffect(() => {
    if (activeReport && activeReport !== 'overview') {
      fetchReportData(activeReport);
    }
  }, [activeReport, fetchReportData, startDate, endDate]);

  const loadSalesSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchSalesData({
        startDate,
        endDate,
      });

      if (response && Array.isArray(response)) {
        setSales(response);
      } else {
        setSales([]);
      }
    } catch (err) {
      setError('Unable to load summary data. Please try again.');
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRevenue = useMemo(() => {
    return sales.reduce((sum, invoice) => sum + (invoice?.total_amount || 0), 0);
  }, [sales]);

  const transactionCount = sales.length;
  const averageTicket = transactionCount ? totalRevenue / transactionCount : 0;

  // Calculate additional metrics for overview
  const totalExpenses = useMemo(() => {
    // This would come from expense data if available
    return 0;
  }, []);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const formatCurrency = useCallback((amount?: number) => {
    if (typeof amount !== 'number') {
      return 'UGX 0';
    }
    return `UGX ${Math.round(amount).toLocaleString()}`;
  }, []);

  const handleReportPress = (reportId: ReportId) => {
    // Check permission before allowing access
    const pageName = REPORT_PAGE_MAPPING[reportId];
    if (pageName && !canRead(pageName)) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'You do not have permission to view this report.',
      });
      return;
    }
    setActiveReport(prev => (prev === reportId ? null : reportId));
  };

  const fetchReportData = useCallback(
    async (reportId: ReportId) => {
      try {
        if (reportId === 'daily-profit') {
          setDailyProfit(prev => ({...prev, loading: true, error: null}));
          const response = await fetchDailyProfitReport(endDate);
          setDailyProfit({loading: false, error: null, data: response});
          return;
        }

        if (reportId === 'weekly-summary') {
          setWeeklySummary(prev => ({...prev, loading: true, error: null}));
          const response = await fetchWeeklySummaryReport({
            startDate,
            endDate,
          });
          setWeeklySummary({loading: false, error: null, data: response});
          return;
        }

        if (reportId === 'monthly-summary') {
          setMonthlySummary(prev => ({...prev, loading: true, error: null}));
          const monthValue = endDate?.slice(0, 7);
          const response = await fetchMonthlySummaryReport(monthValue);
          setMonthlySummary({loading: false, error: null, data: response});
          return;
        }

        if (reportId === 'product-profitability') {
          setProductProfitability(prev => ({
            ...prev,
            loading: true,
            error: null,
          }));
          const response = await fetchProductProfitabilityReport({
            startDate,
            endDate,
          });
          setProductProfitability({
            loading: false,
            error: null,
            data: response,
          });
          return;
        }

        if (reportId === 'expense-breakdown') {
          setExpenseBreakdown(prev => ({
            ...prev,
            loading: true,
            error: null,
          }));
          const response = await fetchExpenseBreakdownReport({
            startDate,
            endDate,
          });
          setExpenseBreakdown({
            loading: false,
            error: null,
            data: response,
          });
        }
      } catch (fetchError: any) {
        const message =
          fetchError?.response?.data?.error ||
          fetchError?.message ||
          'Unable to load report. Please try again.';

        if (reportId === 'daily-profit') {
          setDailyProfit({loading: false, error: message, data: null});
        } else if (reportId === 'weekly-summary') {
          setWeeklySummary({loading: false, error: message, data: null});
        } else if (reportId === 'monthly-summary') {
          setMonthlySummary({loading: false, error: message, data: null});
        } else if (reportId === 'product-profitability') {
          setProductProfitability({
            loading: false,
            error: message,
            data: null,
          });
        } else if (reportId === 'expense-breakdown') {
          setExpenseBreakdown({loading: false, error: message, data: null});
        }
      }
    },
    [endDate, startDate],
  );

  const handleExportAnalyticsPdf = useCallback(async () => {
    if (!activeReport || activeReport === 'overview') {
      Toast.show({
        type: 'info',
        text1: 'Select a report',
        text2: 'Expand a report below to export PDF.',
      });
      return;
    }
    if (exportingAnalyticsPdf) {
      return;
    }

    const monthValue = endDate?.slice(0, 7);
    let reportTypeApi: string;
    let filters: Record<string, unknown>;

    switch (activeReport) {
      case 'daily-profit':
        reportTypeApi = 'daily_profit';
        filters = {date: endDate};
        break;
      case 'weekly-summary':
        reportTypeApi = 'weekly_summary';
        filters = {start_date: startDate, end_date: endDate};
        break;
      case 'monthly-summary':
        reportTypeApi = 'monthly_summary';
        filters = {month: monthValue};
        break;
      case 'product-profitability':
        reportTypeApi = 'product_profitability';
        filters = {start_date: startDate, end_date: endDate};
        break;
      case 'expense-breakdown':
        reportTypeApi = 'expense_breakdown';
        filters = {start_date: startDate, end_date: endDate};
        break;
      default:
        return;
    }

    setExportingAnalyticsPdf(true);
    try {
      const buf = await exportReportPdfFromApi(reportTypeApi, filters);
      const baseName = `zentro_${reportTypeApi}_${endDate}`;
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
            'File path copied. Paste in a file manager to open or share the PDF.',
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
      setExportingAnalyticsPdf(false);
    }
  }, [activeReport, endDate, exportingAnalyticsPdf, startDate]);

  const renderFilterRow = () => (
    <View style={styles.filterRow}>
      {FILTERS.map(filter => {
        const isActive = activeFilter === filter.id;
        return (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterPill, isActive && styles.filterPillActive]}
            onPress={() => setActiveFilter(filter.id)}>
            <Text
              style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
        <View style={styles.summaryCardHeader}>
          <View style={[styles.iconContainer, styles.iconContainerPrimary]}>
            <Image source={icons.cart} style={styles.summaryIcon} />
          </View>
          <Text style={styles.summaryLabel}>Revenue</Text>
        </View>
        <Text style={styles.summaryValue}>
          {formatCurrency(totalRevenue)}
        </Text>
        <Text style={styles.summarySubLabel}>
          {transactionCount} {transactionCount === 1 ? 'sale' : 'sales'} recorded
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryCardHeader}>
          <View style={styles.iconContainer}>
            <Image source={icons.reports} style={styles.summaryIcon} />
          </View>
          <Text style={styles.summaryLabel}>Average Ticket</Text>
        </View>
        <Text style={styles.summaryValue}>
          {formatCurrency(averageTicket)}
        </Text>
        <Text style={styles.summarySubLabel}>Revenue per transaction</Text>
      </View>

      {transactionCount > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryCardHeader}>
            <View style={styles.iconContainer}>
              <Image source={icons.wallet} style={styles.summaryIcon} />
            </View>
            <Text style={styles.summaryLabel}>Profit Margin</Text>
          </View>
          <Text
            style={[
              styles.summaryValue,
              profitMargin >= 0 ? styles.positiveValue : styles.negativeValue,
            ]}>
            {profitMargin.toFixed(1)}%
          </Text>
          <Text style={styles.summarySubLabel}>Net profit percentage</Text>
        </View>
      )}
    </View>
  );

  const renderReportList = () => {
    // Filter reports based on permissions
    const availableReports = REPORT_SECTIONS.filter(section => {
      const pageName = REPORT_PAGE_MAPPING[section.id];
      if (!pageName) return true; // Show if no page name mapping
      return canRead(pageName); // Check if user has read permission
    });

    const timeBasedReports = availableReports.filter(
      r => r.category === 'time-based',
    );
    const analyticalReports = availableReports.filter(
      r => r.category === 'analytical',
    );

    // Don't show sections if no reports are available
    if (availableReports.length === 0) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.stateLabel}>
            No reports available. Contact your administrator for access.
          </Text>
        </View>
      );
    }

    return (
      <View>
        {/* Time-Based Reports Section */}
        {timeBasedReports.length > 0 && (
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>Time-Based Reports</Text>
            <Text style={styles.reportSectionDescription}>
              Performance metrics over daily, weekly, and monthly periods
            </Text>
            <View style={styles.reportList}>
              {timeBasedReports.map((section, index) => (
              <TouchableOpacity
                key={section.id}
                style={styles.reportRow}
                onPress={() => handleReportPress(section.id as ReportId)}>
                <View style={styles.reportRowContent}>
                  <View style={styles.reportIconWrapper}>
                    <Image source={section.icon} style={styles.reportIcon} />
                  </View>
                  <View style={styles.reportContent}>
                    <Text style={styles.reportTitle}>{section.title}</Text>
                    <Text style={styles.reportDescription}>
                      {section.description}
                    </Text>
                  </View>
                </View>
                <Image
                  source={icons.next}
                  style={[
                    styles.chevron,
                    activeReport === (section.id as ReportId) &&
                      styles.chevronActive,
                  ]}
                />
                {index < timeBasedReports.length - 1 && (
                  <View style={styles.reportDivider} />
                )}
              </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Analytical Reports Section */}
        {analyticalReports.length > 0 && (
          <View style={styles.reportSection}>
            <Text style={styles.reportSectionTitle}>Analytical Reports</Text>
            <Text style={styles.reportSectionDescription}>
              Deep insights into products and expenses
            </Text>
            <View style={styles.reportList}>
              {analyticalReports.map((section, index) => (
              <TouchableOpacity
                key={section.id}
                style={styles.reportRow}
                onPress={() => handleReportPress(section.id as ReportId)}>
                <View style={styles.reportRowContent}>
                  <View style={styles.reportIconWrapper}>
                    <Image source={section.icon} style={styles.reportIcon} />
                  </View>
                  <View style={styles.reportContent}>
                    <Text style={styles.reportTitle}>{section.title}</Text>
                    <Text style={styles.reportDescription}>
                      {section.description}
                    </Text>
                  </View>
                </View>
                <Image
                  source={icons.next}
                  style={[
                    styles.chevron,
                    activeReport === (section.id as ReportId) &&
                      styles.chevronActive,
                  ]}
                />
                {index < analyticalReports.length - 1 && (
                  <View style={styles.reportDivider} />
                )}
              </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderState = () => {
    if (isLoading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.stateLabel}>Fetching latest performance…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Image source={icons.cross} style={styles.stateIcon} />
          <Text style={styles.stateLabel}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSalesSummary}>
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (transactionCount === 0 && !isLoading) {
      return (
        <View style={styles.stateContainer}>
          <Image source={icons.reports} style={styles.stateIcon} />
          <Text style={styles.stateLabel}>
            No sales data available for the selected period
          </Text>
          <Text style={styles.stateSubLabel}>
            Try selecting a different time range
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderDailyProfitDetails = () => {
    const state = dailyProfit;
    if (state.loading) {
      return (
        <DetailCard title="Daily Profit">
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={styles.inlineStateLabel}>Loading daily profit…</Text>
          </View>
        </DetailCard>
      );
    }

    if (state.error) {
      return (
        <DetailCard title="Daily Profit">
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryLink}
            onPress={() => fetchReportData('daily-profit')}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </DetailCard>
      );
    }

    const metrics = state.data?.data;
    if (!metrics) {
      return (
        <DetailCard title="Daily Profit">
          <Text style={styles.emptyStateText}>
            No daily profit data available for this date
          </Text>
        </DetailCard>
      );
    }

    return (
      <DetailCard title="Daily Profit Snapshot">
        <MetricRow
          label="Sales"
          value={formatCurrency(metrics.total_sales)}
        />
        <MetricRow
          label="Expenses"
          value={formatCurrency(metrics.total_expenses)}
        />
        <MetricRow
          label="Net Profit"
          value={formatCurrency(metrics.net_profit)}
          accent={metrics.net_profit && metrics.net_profit >= 0 ? 'positive' : 'negative'}
        />
        <MetricRow
          label="Profit Margin"
          value={`${metrics.profit_margin?.toFixed(2) ?? '0.00'}%`}
        />
        {metrics.comparison && (
          <>
            <View style={styles.dividerLine} />
            <Text style={styles.detailSubtitle}>Day-over-day Comparison</Text>
            <MetricRow
              label="Previous Day Profit"
              value={formatCurrency(metrics.comparison?.previous_day_profit)}
            />
            <MetricRow
              label="Change"
              value={formatCurrency(metrics.comparison?.change_amount)}
              accent={
                metrics.comparison?.change_amount &&
                metrics.comparison?.change_amount >= 0
                  ? 'positive'
                  : 'negative'
              }
            />
            <MetricRow
              label="Change %"
              value={`${metrics.comparison?.change_percentage?.toFixed(2) ?? '0.00'}%`}
              accent={
                metrics.comparison?.change_percentage &&
                metrics.comparison?.change_percentage >= 0
                  ? 'positive'
                  : 'negative'
              }
            />
          </>
        )}
      </DetailCard>
    );
  };

  const renderWeeklySummaryDetails = () => {
    const state = weeklySummary;
    if (state.loading) {
      return (
        <DetailCard title="Weekly Summary">
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={styles.inlineStateLabel}>Loading weekly summary…</Text>
          </View>
        </DetailCard>
      );
    }

    if (state.error) {
      return (
        <DetailCard title="Weekly Summary">
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryLink}
            onPress={() => fetchReportData('weekly-summary')}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </DetailCard>
      );
    }

    const overview = state.data?.data?.financial_overview;
    const topProducts = state.data?.data?.top_products?.slice(0, 3) ?? [];
    const expenseMix = state.data?.data?.expense_breakdown?.slice(0, 3) ?? [];

    if (!overview) {
      return (
        <DetailCard title="Weekly Summary">
          <Text style={styles.emptyStateText}>
            No weekly summary data available for this period
          </Text>
        </DetailCard>
      );
    }

    return (
      <DetailCard title="Weekly Summary">
        <Text style={styles.detailSubtitle}>Financial Overview</Text>
        <MetricRow
          label="Revenue"
          value={formatCurrency(overview.total_revenue)}
        />
        <MetricRow
          label="Expenses"
          value={formatCurrency(overview.total_expenses)}
        />
        <MetricRow
          label="Net Profit"
          value={formatCurrency(overview.net_profit)}
          accent={
            overview.net_profit && overview.net_profit >= 0
              ? 'positive'
              : 'negative'
          }
        />
        <MetricRow
          label="Profit Margin"
          value={`${overview.profit_margin?.toFixed(2) ?? '0.00'}%`}
        />
        <MetricRow
          label="Transactions"
          value={`${overview.transaction_count ?? 0}`}
        />
        {topProducts.length > 0 && (
          <>
            <View style={styles.dividerLine} />
            <Text style={styles.detailSubtitle}>Top Products</Text>
            <View style={styles.tagRow}>
              {topProducts.map(product => (
                <Pill
                  key={`${product?.item_name}`}
                  label={`${product?.item_name ?? 'Product'} • ${(
                    product?.percentage ?? 0
                  ).toFixed(1)}%`}
                />
              ))}
            </View>
          </>
        )}
        {expenseMix.length > 0 && (
          <>
            <Text style={styles.detailSubtitle}>Expense Mix</Text>
            <View style={styles.tagRow}>
              {expenseMix.map(expense => (
                <Pill
                  key={`${expense?.expense_type_name}`}
                  label={`${expense?.expense_type_name ?? 'Expense'} • ${(
                    expense?.percentage ?? 0
                  ).toFixed(1)}%`}
                />
              ))}
            </View>
          </>
        )}
      </DetailCard>
    );
  };

  const renderMonthlySummaryDetails = () => {
    const state = monthlySummary;
    if (state.loading) {
      return (
        <DetailCard title="Monthly Summary">
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={styles.inlineStateLabel}>Loading monthly summary…</Text>
          </View>
        </DetailCard>
      );
    }

    if (state.error) {
      return (
        <DetailCard title="Monthly Summary">
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryLink}
            onPress={() => fetchReportData('monthly-summary')}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </DetailCard>
      );
    }

    const overview = state.data?.data?.financial_overview;
    const kpis = state.data?.data?.kpis;
    const topProducts = state.data?.data?.top_products?.slice(0, 3) ?? [];
    const topCustomers = state.data?.data?.top_customers?.slice(0, 3) ?? [];

    if (!overview) {
      return (
        <DetailCard title="Monthly Summary">
          <Text style={styles.emptyStateText}>
            No monthly summary data available for this period
          </Text>
        </DetailCard>
      );
    }

    return (
      <DetailCard title="Monthly Summary">
        <Text style={styles.detailSubtitle}>Financial Overview</Text>
        <MetricRow
          label="Revenue"
          value={formatCurrency(overview.total_revenue)}
        />
        <MetricRow
          label="Expenses"
          value={formatCurrency(overview.total_expenses)}
        />
        <MetricRow
          label="Net Profit"
          value={formatCurrency(overview.net_profit)}
          accent={
            overview.net_profit && overview.net_profit >= 0
              ? 'positive'
              : 'negative'
          }
        />
        <MetricRow
          label="Profit Margin"
          value={`${overview.profit_margin?.toFixed(2) ?? '0.00'}%`}
        />
        {kpis && (
          <>
            <View style={styles.dividerLine} />
            <Text style={styles.detailSubtitle}>Key Performance Indicators</Text>
            <MetricRow
              label="Avg Daily Sales"
              value={formatCurrency(kpis.avg_daily_sales)}
            />
            <MetricRow
              label="Avg Profit Margin"
              value={`${kpis.avg_profit_margin?.toFixed(2) ?? '0.00'}%`}
            />
            <MetricRow
              label="Total Transactions"
              value={`${kpis.total_transactions ?? 0}`}
            />
          </>
        )}
        {topProducts.length > 0 && (
          <>
            <View style={styles.dividerLine} />
            <Text style={styles.detailSubtitle}>Top Products</Text>
            <View style={styles.tagRow}>
              {topProducts.map(product => (
                <Pill
                  key={`${product?.item_name}`}
                  label={`${product?.item_name ?? 'Product'} • ${(
                    product?.percentage ?? 0
                  ).toFixed(1)}%`}
                />
              ))}
            </View>
          </>
        )}
        {topCustomers.length > 0 && (
          <>
            <Text style={styles.detailSubtitle}>Top Customers</Text>
            <View style={styles.tagRow}>
              {topCustomers.map(customer => (
                <Pill
                  key={`${customer?.customer_name}`}
                  label={`${customer?.customer_name ?? 'Customer'} • ${(
                    customer?.percentage ?? 0
                  ).toFixed(1)}%`}
                />
              ))}
            </View>
          </>
        )}
      </DetailCard>
    );
  };

  const renderProductProfitabilityDetails = () => {
    const state = productProfitability;
    if (state.loading) {
      return (
        <DetailCard title="Product Profitability">
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={styles.inlineStateLabel}>
              Loading product profitability…
            </Text>
          </View>
        </DetailCard>
      );
    }

    if (state.error) {
      return (
        <DetailCard title="Product Profitability">
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryLink}
            onPress={() => fetchReportData('product-profitability')}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </DetailCard>
      );
    }

    const summary = state.data?.data?.summary;
    const topProducts = state.data?.data?.products?.slice(0, 5) ?? [];

    if (!summary) {
      return (
        <DetailCard title="Product Profitability">
          <Text style={styles.emptyStateText}>
            No product profitability data available for this period
          </Text>
        </DetailCard>
      );
    }

    return (
      <DetailCard title="Product Profitability">
        <MetricRow
          label="Total Products"
          value={`${summary.total_products ?? 0}`}
        />
        <MetricRow
          label="Profitable"
          value={`${summary.profitable_products ?? 0}`}
          accent="positive"
        />
        <MetricRow
          label="Loss Making"
          value={`${summary.loss_making_products ?? 0}`}
          accent="negative"
        />
        <MetricRow
          label="Avg Profit Margin"
          value={`${summary.avg_profit_margin?.toFixed(2) ?? '0.00'}%`}
        />
        {topProducts.length > 0 && (
          <>
            <View style={styles.dividerLine} />
            <Text style={styles.detailSubtitle}>Top Performers</Text>
            {topProducts.map(product => (
              <View key={`${product?.item_name}`} style={styles.productRow}>
                <Text style={styles.productName}>
                  {product?.item_name ?? 'Product'}
                </Text>
                <Text style={styles.productMeta}>
                  {formatCurrency(product?.profit)} ·{' '}
                  {(product?.profit_margin ?? 0).toFixed(1)}%
                </Text>
              </View>
            ))}
          </>
        )}
      </DetailCard>
    );
  };

  const renderExpenseBreakdownDetails = () => {
    const state = expenseBreakdown;
    if (state.loading) {
      return (
        <DetailCard title="Expense Breakdown">
          <View style={styles.inlineState}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={styles.inlineStateLabel}>
              Loading expense breakdown…
            </Text>
          </View>
        </DetailCard>
      );
    }

    if (state.error) {
      return (
        <DetailCard title="Expense Breakdown">
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryLink}
            onPress={() => fetchReportData('expense-breakdown')}>
            <Text style={styles.retryLinkText}>Retry</Text>
          </TouchableOpacity>
        </DetailCard>
      );
    }

    const summary = state.data?.data?.summary;
    const categories = state.data?.data?.breakdown?.slice(0, 5) ?? [];

    if (!summary) {
      return (
        <DetailCard title="Expense Breakdown">
          <Text style={styles.emptyStateText}>
            No expense breakdown data available for this period
          </Text>
        </DetailCard>
      );
    }

    return (
      <DetailCard title="Expense Breakdown">
        <MetricRow
          label="Total Expenses"
          value={formatCurrency(summary.total_expenses)}
        />
        <MetricRow
          label="Transactions"
          value={`${summary.total_count ?? 0}`}
        />
        <MetricRow
          label="Avg Daily"
          value={formatCurrency(summary.avg_daily_expense)}
        />
        {summary.period_comparison && (
          <MetricRow
            label="Change %"
            value={`${summary.period_comparison.change_percentage?.toFixed(2) ?? '0.00'}%`}
            accent={
              summary.period_comparison.change_percentage &&
              summary.period_comparison.change_percentage <= 0
                ? 'positive'
                : 'negative'
            }
          />
        )}
        {categories.length > 0 && (
          <>
            <View style={styles.dividerLine} />
            <Text style={styles.detailSubtitle}>Top Categories</Text>
            {categories.map(category => (
              <View key={`${category?.expense_type_name}`} style={styles.productRow}>
                <Text style={styles.productName}>
                  {category?.expense_type_name ?? 'Category'}
                </Text>
                <Text style={styles.productMeta}>
                  {formatCurrency(category?.total_amount)} ·{' '}
                  {(category?.percentage ?? 0).toFixed(1)}%
                </Text>
              </View>
            ))}
          </>
        )}
      </DetailCard>
    );
  };

  const renderReportDetails = () => {
    if (!activeReport || activeReport === 'overview') {
      return null;
    }

    if (activeReport === 'daily-profit') {
      return renderDailyProfitDetails();
    }
    if (activeReport === 'weekly-summary') {
      return renderWeeklySummaryDetails();
    }
    if (activeReport === 'monthly-summary') {
      return renderMonthlySummaryDetails();
    }
    if (activeReport === 'product-profitability') {
      return renderProductProfitabilityDetails();
    }
    if (activeReport === 'expense-breakdown') {
      return renderExpenseBreakdownDetails();
    }
    return null;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Reports</Text>
      <Text style={styles.subHeading}>
        Track your business performance with comprehensive analytics and insights.
      </Text>
      {renderFilterRow()}
      {renderSummaryCards()}
      {renderState()}
      {renderReportList()}
      {renderReportDetails()}
      {activeReport && activeReport !== 'overview' ? (
        <TouchableOpacity
          style={[
            styles.pdfExportButton,
            exportingAnalyticsPdf && styles.pdfExportButtonDisabled,
          ]}
          onPress={handleExportAnalyticsPdf}
          disabled={exportingAnalyticsPdf}
          activeOpacity={0.85}>
          {exportingAnalyticsPdf ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.pdfExportButtonText}>Download PDF</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

export default Reports;

const DetailCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.detailCard}>
    <Text style={styles.detailTitle}>{title}</Text>
    {children}
  </View>
);

const MetricRow = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'positive' | 'negative';
}) => (
  <View style={styles.metricRowItem}>
    <Text style={styles.metricRowLabel}>{label}</Text>
    <Text
      style={[
        styles.metricRowValue,
        accent === 'positive' && styles.positiveAccent,
        accent === 'negative' && styles.negativeAccent,
      ]}>
      {value}
    </Text>
  </View>
);

const Pill = ({label}: {label: string}) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  heading: {
    ...FONTS.h2,
    color: COLORS.black,
    marginTop: SIZES.padding,
    marginBottom: SIZES.base / 2,
    fontWeight: '700',
  },
  subHeading: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: SIZES.padding,
    lineHeight: 20,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: SIZES.padding,
  },
  filterPill: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.base - 2,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: SIZES.base,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary2,
    borderColor: COLORS.primary2,
  },
  filterLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SIZES.padding,
    marginHorizontal: -SIZES.base / 2,
  },
  summaryCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SIZES.padding,
    marginHorizontal: SIZES.base / 2,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryCardPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary2,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.base / 2,
  },
  iconContainerPrimary: {
    backgroundColor: COLORS.primary2 + '20',
  },
  summaryIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary2,
  },
  summaryLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 12,
  },
  summaryValue: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base / 2,
    fontWeight: '700',
  },
  summarySubLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 11,
  },
  positiveValue: {
    color: '#2e7d32',
  },
  negativeValue: {
    color: '#c62828',
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 2,
    paddingHorizontal: SIZES.padding,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: SIZES.padding,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stateLabel: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
  stateSubLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginTop: SIZES.base / 2,
    textAlign: 'center',
    fontSize: 12,
  },
  stateIcon: {
    width: 48,
    height: 48,
    tintColor: COLORS.lightGray2,
  },
  retryButton: {
    marginTop: SIZES.base,
    backgroundColor: COLORS.primary2,
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
  },
  retryLabel: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  reportSection: {
    marginTop: SIZES.padding * 1.5,
  },
  reportSectionTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base / 2,
    fontWeight: '700',
  },
  reportSectionDescription: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: SIZES.base,
    fontSize: 12,
  },
  reportList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: SIZES.base / 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  reportRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.base,
  },
  reportIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.primary2,
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    ...FONTS.body2,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: 2,
  },
  reportDescription: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 12,
    lineHeight: 16,
  },
  chevron: {
    width: 18,
    height: 18,
    tintColor: COLORS.gray,
  },
  chevronActive: {
    tintColor: COLORS.primary2,
    transform: [{rotate: '90deg'}],
  },
  reportDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginLeft: SIZES.padding + 44 + SIZES.base,
    marginRight: SIZES.padding,
  },
  detailCard: {
    marginTop: SIZES.padding,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SIZES.padding,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  detailTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    fontWeight: '700',
  },
  detailSubtitle: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    marginBottom: SIZES.base,
    marginTop: SIZES.base,
    fontWeight: '600',
  },
  metricRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
    paddingVertical: 4,
  },
  metricRowLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  metricRowValue: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
  },
  positiveAccent: {
    color: '#2e7d32',
  },
  negativeAccent: {
    color: '#c62828',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: SIZES.base,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SIZES.base / 4,
    marginBottom: SIZES.base,
  },
  pill: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginHorizontal: SIZES.base / 4,
    marginVertical: SIZES.base / 4,
  },
  pillText: {
    ...FONTS.body4,
    color: COLORS.darkGray,
    fontSize: 12,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
  },
  inlineStateLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginLeft: SIZES.base / 2,
  },
  errorText: {
    ...FONTS.body4,
    color: '#c62828',
    marginBottom: SIZES.base / 2,
  },
  emptyStateText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: SIZES.padding,
  },
  retryLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  retryLinkText: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  productRow: {
    marginBottom: SIZES.base,
    paddingVertical: 4,
  },
  productName: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '500',
  },
  productMeta: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginTop: 2,
    fontSize: 12,
  },
  pdfExportButton: {
    marginTop: SIZES.padding,
    marginBottom: SIZES.base,
    backgroundColor: COLORS.primary2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  pdfExportButtonDisabled: {
    opacity: 0.7,
  },
  pdfExportButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
});
