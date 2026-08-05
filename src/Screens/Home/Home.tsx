import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  constants,
  FONTS,
  SIZES,
  COLORS,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import Options from './Options';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useAppContext, useAuth, useTabContext } from '../../context/Store';
import { usePermissions } from '../../hooks/usePermissions';
import { PAGE_NAMES } from '../../constants/pageNames';
import { useCompanyInfo } from '../../hooks/useCompanyInfo';
import { useTheme } from '../../context/ThemeContext';
import { navigate } from '../../hooks/NavigationService';
import {
  fetchHomeKpisFromSalesSummary,
  fetchHomeSnapshot,
  fetchMyUserSetup,
  fetchRecentTransactions,
  fetchLowStockItems,
  fetchUnpostedSales,
  fetchOutstandingReceivables,
  KPIMetrics,
} from '../../services/app.services';
import TodayMySalesBar from '../../Components/TodayMySalesBar';
import {formatCurrency} from '../../utils/currency';

interface SalesInvoice {
  id: number;
  invoice_no?: string;
  customer_invoice_no?: string;
  customer?: { name: string };
  customer_name?: string;
  document_date?: string;
  /** DRF DecimalField is often serialized as a string */
  total_amount?: number | string;
  created_at?: string;
  status: string;
}

/** SalesHistoryListSerializer exposes document_date, not created_at — parse safely for subtitle. */
function formatSalesTransactionListSubtitle(
  documentDate?: string | null,
  createdAt?: string | null,
): string {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  if (documentDate != null && String(documentDate).trim() !== '') {
    const raw = String(documentDate).trim();
    const isoParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (isoParts) {
      const y = Number(isoParts[1]);
      const mo = Number(isoParts[2]) - 1;
      const day = Number(isoParts[3]);
      const d = new Date(y, mo, day);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return '—';
}

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth, accessToken } = useAuth();
  const app = useAppContext();
  const { isModuleVisible, hasAnyPageAccess, canCreate } = usePermissions();
  const { storeLabel } = useCompanyInfo();
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const navigation = useNavigation();
  const { setSelectedTab } = useTabContext();

  /** Greeting uses a single given name (first word of full name, else username). */
  const displayName =
    auth.full_name?.trim()?.split(/\s+/).filter(Boolean)[0] ||
    auth.username?.trim() ||
    '';

  const activeBranchLabel = useMemo(() => {
    const b = app?.branchSession?.active_branch;
    if (!b) return '';
    const description = b.description?.trim();
    const code = b.code?.trim();
    if (description && code && description !== code) {
      return `${description} (${code})`;
    }
    return description || code || '';
  }, [app?.branchSession?.active_branch]);

  // KPI Data
  const [kpiMetrics, setKpiMetrics] = useState < KPIMetrics | null > (null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Recent Transactions
  const [recentTransactions, setRecentTransactions] = useState < SalesInvoice[] > (
    [],
  );
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Low Stock
  const [lowStockItems, setLowStockItems] = useState < any[] > ([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  // Open + Draft together
  const [unpostedSales, setUnpostedSales] = useState<any[]>([]);
  const [unpostedLoading, setUnpostedLoading] = useState(false);

  // Outstanding Receivables
  const [outstandingReceivables, setOutstandingReceivables] = useState < {
    total_amount: number;
    count: number;
  } | null > (null);
  const [receivablesLoading, setReceivablesLoading] = useState(false);

  // Top Selling Items
  const [topSellingItems, setTopSellingItems] = useState < any[] > ([]);
  const [topItemsLoading, setTopItemsLoading] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  /** Matches Sales History: User Setup canViewOnlyTheirSales + ?user= on sales list */
  const [restrictSalesToSelf, setRestrictSalesToSelf] = useState(true);

  // Permission checks
  /** Web parity: Sales module entry uses "Sales Dashboard"; snapshot KPIs match that gate only. */
  const canViewSalesDashboard =
    isModuleVisible('sales') &&
    hasAnyPageAccess(PAGE_NAMES.SALES_DASHBOARD);

  const canViewTransactions =
    isModuleVisible('sales') &&
    (hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY) ||
      hasAnyPageAccess(PAGE_NAMES.SALES));

  const canViewItems =
    isModuleVisible('items') && hasAnyPageAccess(PAGE_NAMES.ITEMS);

  const canViewDrafts =
    isModuleVisible('sales') && canCreate(PAGE_NAMES.SALES);

  /** Open + Draft unposted sales — same visibility as recent / history. */
  const canViewUnpostedSales = canViewTransactions || canViewDrafts;

  const canViewReceivables =
    (isModuleVisible('payments') || isModuleVisible('customers')) &&
    (hasAnyPageAccess(PAGE_NAMES.PAYMENTS) ||
      hasAnyPageAccess(PAGE_NAMES.CUSTOMER_MANAGEMENT));

  /** Cashiers / sales staff without dashboard — web POS shows today totals instead. */
  const canViewMySalesToday =
    isModuleVisible('sales') &&
    (hasAnyPageAccess(PAGE_NAMES.SALES) ||
      hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY)) &&
    !canViewSalesDashboard;

  const [mySalesRefreshKey, setMySalesRefreshKey] = useState(0);

  const t = useMemo(
    () => ({
      root: { backgroundColor: colors.screenMuted },
      card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      sectionTitle: { color: colors.textPrimary },
      seeAll: { color: COLORS.primary2 },
      salesLabel: { color: colors.textSecondary },
      salesAmount: { color: colors.textPrimary },
      comparedText: { color: colors.textSecondary },
      statValue: { color: colors.textPrimary },
      statItemLabel: { color: colors.textSecondary },
      snapshotDivider: { backgroundColor: colors.border },
      alertTitle: { color: colors.textPrimary },
      alertText: { color: colors.textSecondary },
      listCard: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      transactionNumber: { color: colors.textPrimary },
      transactionCustomer: { color: colors.textSecondary },
      transactionTime: { color: colors.textSecondary },
      placeholderText: { color: colors.textSecondary },
      iconWell: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
    }),
    [colors],
  );

  const softCardShadow = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
        default: {},
      }),
    [],
  );

  // Debug auth state and handle loading
  React.useEffect(() => {
    if (auth.username && auth.user_id) {
      setIsAuthLoading(false);
    } else if (!accessToken) {
      setIsAuthLoading(false);
    }
  }, [auth, accessToken]);

  // Timeout to prevent infinite loading
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (isAuthLoading) {
        setIsAuthLoading(false);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isAuthLoading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const setup = await fetchMyUserSetup();
        if (cancelled) {
          return;
        }
        setRestrictSalesToSelf(setup?.canViewOnlyTheirSales ?? true);
      } catch {
        if (!cancelled) {
          setRestrictSalesToSelf(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHomeSnapshot = useCallback(async () => {
    if (!canViewSalesDashboard) return;

    setKpiLoading(true);
    setTopItemsLoading(true);
    try {
      // Same API as web POS / Sales History: GET /api/sales/summary/
      const [kpi, snapshot] = await Promise.all([
        fetchHomeKpisFromSalesSummary(),
        fetchHomeSnapshot(5), // top sellers only (optional)
      ]);
      setKpiMetrics(kpi);
      setTopSellingItems(snapshot?.top_selling_items ?? []);
    } catch (error) {
      console.error('Error loading home sales KPIs:', error);
      setKpiMetrics(null);
      setTopSellingItems([]);
    } finally {
      setKpiLoading(false);
      setTopItemsLoading(false);
    }
  }, [canViewSalesDashboard]);

  const loadRecentTransactions = useCallback(async () => {
    if (!canViewTransactions) return;

    setTransactionsLoading(true);
    try {
      const uid = Number.parseInt(String(auth.user_id || ''), 10);
      const opts =
        restrictSalesToSelf && Number.isFinite(uid) ? { userId: uid } : undefined;
      const transactions = await fetchRecentTransactions(10, opts);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [canViewTransactions, restrictSalesToSelf, auth.user_id]);

  // Fetch Low Stock Items
  const loadLowStockItems = async () => {
    if (!canViewItems) return;

    setLowStockLoading(true);
    try {
      const items = await fetchLowStockItems();
      setLowStockItems(items);
    } catch (error) {
      console.error('Error loading low stock items:', error);
    } finally {
      setLowStockLoading(false);
    }
  };

  const loadUnpostedSales = useCallback(async () => {
    if (!canViewUnpostedSales) return;

    setUnpostedLoading(true);
    try {
      const rows = await fetchUnpostedSales(15);
      setUnpostedSales(rows);
    } catch (error) {
      console.error('Error loading unposted sales:', error);
    } finally {
      setUnpostedLoading(false);
    }
  }, [canViewUnpostedSales]);

  // Fetch Outstanding Receivables
  const loadOutstandingReceivables = async () => {
    if (!canViewReceivables) return;

    setReceivablesLoading(true);
    try {
      const receivables = await fetchOutstandingReceivables();
      setOutstandingReceivables(receivables);
    } catch (error) {
      console.error('Error loading outstanding receivables:', error);
    } finally {
      setReceivablesLoading(false);
    }
  };

  // Load all data on mount
  useEffect(() => {
    if (!isAuthLoading) {
      loadHomeSnapshot();
      loadRecentTransactions();
      loadLowStockItems();
      loadUnpostedSales();
      loadOutstandingReceivables();
    }
  }, [
    isAuthLoading,
    canViewSalesDashboard,
    canViewTransactions,
    canViewItems,
    canViewUnpostedSales,
    canViewReceivables,
    restrictSalesToSelf,
    auth.user_id,
    loadRecentTransactions,
    loadHomeSnapshot,
    loadUnpostedSales,
  ]);

  // Pull to refresh handler
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setMySalesRefreshKey(k => k + 1);
    try {
      // Load all data in parallel
      await Promise.all([
        loadHomeSnapshot(),
        loadRecentTransactions(),
        loadLowStockItems(),
        loadUnpostedSales(),
        loadOutstandingReceivables(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [
    canViewSalesDashboard,
    canViewTransactions,
    canViewItems,
    canViewUnpostedSales,
    canViewReceivables,
    loadRecentTransactions,
    loadHomeSnapshot,
    loadUnpostedSales,
  ]);

  const openMoreTab = () => {
    setSelectedTab(constants.screens.more);
  };

  const renderHomeTopBar = () => (
    <View style={styles.homeTopBar}>
      <TouchableOpacity
        onPress={openMoreTab}
        style={[
          styles.homeCircleBtn,
          {
            backgroundColor: colors.card,
            ...softCardShadow,
          },
        ]}
        activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
        hitSlop={ICON_BUTTON_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Open More menu">
        <Image
          source={icons.menu}
          style={[styles.homeTopBarIcon, { tintColor: colors.textPrimary }]}
        />
      </TouchableOpacity>

      <View style={styles.homeTitleBlock} pointerEvents="none">
        <Text
          style={[styles.homeStoreTitle, { color: colors.textPrimary }]}
          numberOfLines={1}>
          {(storeLabel || 'Zentro').toUpperCase()}
        </Text>
        {activeBranchLabel || (!isAuthLoading && displayName) ? (
          <Text
            style={[styles.homeStoreSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}>
            {activeBranchLabel ||
              (displayName ? `Hi, ${displayName}` : '')}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => navigate('PrinterConfig', undefined)}
        style={[
          styles.homeCircleBtn,
          {
            backgroundColor: colors.card,
            ...softCardShadow,
          },
        ]}
        activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
        hitSlop={ICON_BUTTON_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Printer configuration">
        <Image
          source={icons.printer}
          style={[styles.homeTopBarIcon, { tintColor: colors.textPrimary }]}
        />
      </TouchableOpacity>
    </View>
  );

  /** QuickBooks-style Insights: large money figures + soft progress bars. */
  const renderQuickStats = () => {
    const unpaidAmount = outstandingReceivables?.total_amount ?? 0;
    const unpaidCount = outstandingReceivables?.count ?? 0;
    const todayRevenue = kpiMetrics?.today_revenue ?? 0;
    const salesChange = kpiMetrics?.revenue_growth ?? 0;
    const hasPositiveTrend = salesChange >= 0;

    const showUnpaid = canViewReceivables;

    if (!canViewSalesDashboard && !showUnpaid) {
      return null;
    }

    const barMax = Math.max(unpaidAmount, todayRevenue, 1);
    const unpaidFill = Math.min(1, unpaidAmount / barMax);
    const todayFill = Math.min(1, todayRevenue / barMax);

    return (
      <View style={styles.statsSection}>
        <View style={styles.statsSectionHeader}>
          <Text style={[styles.insightsSectionTitle, t.sectionTitle]}>
            Insights
          </Text>
        </View>

        {canViewSalesDashboard && kpiLoading ? (
          <View
            style={[
              styles.insightsCard,
              t.card,
              softCardShadow,
              styles.snapshotLoadingCard,
            ]}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading insights...
            </Text>
          </View>
        ) : (
          <View style={[styles.insightsCard, t.card, softCardShadow]}>
            {showUnpaid ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => navigation.navigate('Payments' as never)}
                accessibilityRole="button"
                accessibilityLabel={`Unpaid ${formatCurrency(unpaidAmount)}`}>
                <Text style={[styles.insightMetricLabel, t.salesLabel]}>
                  Unpaid
                  {unpaidCount > 0 ? ` · ${unpaidCount}` : ''}
                </Text>
                <Text style={[styles.insightMetricValue, t.salesAmount]}>
                  {formatCurrency(unpaidAmount)}
                </Text>
                <View
                  style={[
                    styles.insightBarTrack,
                    { backgroundColor: colors.screenMuted },
                  ]}>
                  <View
                    style={[
                      styles.insightBarFill,
                      {
                        width: `${Math.max(unpaidFill * 100, unpaidAmount > 0 ? 4 : 0)}%`,
                        backgroundColor: COLORS.warning,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ) : null}

            {showUnpaid && canViewSalesDashboard ? (
              <View style={styles.insightMetricGap} />
            ) : null}

            {canViewSalesDashboard ? (
              <View>
                <Text style={[styles.insightMetricLabel, t.salesLabel]}>
                  Today's sales
                </Text>
                <Text style={[styles.insightMetricValue, t.salesAmount]}>
                  {formatCurrency(todayRevenue)}
                </Text>
                <View
                  style={[
                    styles.insightBarTrack,
                    { backgroundColor: colors.screenMuted },
                  ]}>
                  <View
                    style={[
                      styles.insightBarFill,
                      {
                        width: `${Math.max(todayFill * 100, todayRevenue > 0 ? 4 : 0)}%`,
                        backgroundColor: COLORS.primary2,
                      },
                    ]}
                  />
                </View>
                {kpiMetrics ? (
                  <Text style={[styles.comparedText, t.comparedText, styles.insightTrend]}>
                    {salesChange !== 0 ? (
                      <>
                        <Text
                          style={{
                            color: hasPositiveTrend ? COLORS.success : COLORS.error,
                            fontWeight: '600',
                          }}>
                          {hasPositiveTrend ? 'Up' : 'Down'}{' '}
                          {Math.abs(salesChange).toFixed(1)}%
                        </Text>
                        <Text style={t.comparedText}> vs yesterday</Text>
                      </>
                    ) : (
                      'No change vs yesterday'
                    )}
                  </Text>
                ) : null}
                {kpiMetrics ? (
                  <View style={styles.insightMetaRow}>
                    <Text style={[styles.insightMetaText, t.statItemLabel]}>
                      {kpiMetrics.today_orders} orders
                    </Text>
                    <Text style={[styles.insightMetaDot, t.statItemLabel]}>·</Text>
                    <Text style={[styles.insightMetaText, t.statItemLabel]}>
                      {kpiMetrics.today_products_sold} products
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  // Open + Draft together (not yet posted)
  const renderUnpostedSales = () => {
    if (!canViewUnpostedSales) return null;

    if (unpostedLoading) {
      return (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, t.sectionTitle]}>
            Unposted Sales
          </Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
          </View>
        </View>
      );
    }

    if (unpostedSales.length === 0) {
      return null;
    }

    const preview = unpostedSales.slice(0, 5);
    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text
            style={[styles.sectionTitle, t.sectionTitle]}
            numberOfLines={1}
            ellipsizeMode="tail">
            Unposted Sales
          </Text>
          <TouchableOpacity
            style={styles.sectionHeaderAction}
            onPress={() =>
              navigation.navigate(
                'SalesHistory' as never,
                {status: 'Unposted', dateFilter: 'alltime'} as never,
              )
            }>
            <Text style={[styles.seeAllText, t.seeAll]}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.recentTransactions, t.listCard]}>
          {preview.map((sale: any, index: number) => {
            const statusLabel =
              String(sale.status || '').toLowerCase() === 'draft'
                ? 'Draft'
                : 'Open';
            return (
              <TouchableOpacity
                key={sale.id}
                style={[
                  styles.transactionItem,
                  {borderBottomColor: colors.border},
                  index === preview.length - 1
                    ? styles.transactionItemLast
                    : null,
                ]}
                onPress={() =>
                  navigation.navigate(
                    'SalesHistory' as never,
                    {status: 'Unposted', dateFilter: 'alltime'} as never,
                  )
                }>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionIconContainer, t.iconWell]}>
                    <Image
                      source={icons.cart}
                      style={[
                        styles.transactionIcon,
                        {tintColor: COLORS.warning},
                      ]}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text
                      style={[styles.transactionNumber, t.transactionNumber]}>
                      {sale.customer_invoice_no ||
                        sale.invoice_no ||
                        `Sale #${sale.id}`}
                    </Text>
                    <Text
                      style={[
                        styles.transactionCustomer,
                        t.transactionCustomer,
                      ]}>
                      {sale.customer?.name?.trim() ||
                        sale.customer_name?.trim() ||
                        'Unposted sale'}
                    </Text>
                  </View>
                </View>
                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      {color: COLORS.warning},
                    ]}>
                    {formatCurrency(sale.total_amount || 0)}
                  </Text>
                  <Text style={[styles.transactionTime, t.transactionTime]}>
                    {statusLabel} ·{' '}
                    {formatSalesTransactionListSubtitle(
                      sale.document_date,
                      sale.created_at,
                    )}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Render Top Selling Items
  const renderTopSellingItems = () => {
    if (!canViewSalesDashboard || topSellingItems.length === 0) return null;

    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text
            style={[styles.sectionTitle, t.sectionTitle]}
            numberOfLines={1}
            ellipsizeMode="tail">
            Top Selling Items Today
          </Text>
          <TouchableOpacity
            style={styles.sectionHeaderAction}
            onPress={() => navigation.navigate('Items' as never)}>
            <Text style={[styles.seeAllText, t.seeAll]}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.recentTransactions, t.listCard]}>
          {topSellingItems.map((item: any, index: number) => (
            <View
              key={item.item_no || index}
              style={[
                styles.transactionItem,
                { borderBottomColor: colors.border },
                index === topSellingItems.length - 1 ? styles.transactionItemLast : null,
              ]}>
              <View style={styles.transactionLeft}>
                <View style={[styles.transactionIconContainer, t.iconWell]}>
                  <Text style={[styles.rankBadge, { color: COLORS.success }]}>
                    #{index + 1}
                  </Text>
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionNumber, t.transactionNumber]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.transactionCustomer, t.transactionCustomer]}>
                    {item.quantity} sold • {formatCurrency(item.total)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMySalesToday = () => {
    if (!canViewMySalesToday) {
      return null;
    }
    const uid = Number.parseInt(String(auth.user_id || ''), 10);
    if (!Number.isFinite(uid)) {
      return null;
    }
    const canOpenHistory = hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY);
    return (
      <View style={styles.mySalesSection}>
        <TodayMySalesBar
          variant="card"
          userId={uid}
          refreshKey={mySalesRefreshKey}
          onOpenHistory={
            canOpenHistory
              ? () => navigation.navigate('SalesHistory' as never)
              : undefined
          }
        />
      </View>
    );
  };

  // Render Recent Transactions
  const renderRecentTransactions = () => {
    if (!canViewTransactions) return null;

    const txPreview = recentTransactions.slice(0, 5);
    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text
            style={[styles.sectionTitle, t.sectionTitle]}
            numberOfLines={1}
            ellipsizeMode="tail">
            Recent Transactions
          </Text>
          <TouchableOpacity
            style={styles.sectionHeaderAction}
            onPress={() => navigation.navigate('SalesHistory' as never)}>
            <Text style={[styles.seeAllText, t.seeAll]}>See All</Text>
          </TouchableOpacity>
        </View>

        {transactionsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading transactions...
            </Text>
          </View>
        ) : recentTransactions.length > 0 ? (
          <View style={[styles.recentTransactions, t.listCard]}>
            <FlatList
              data={txPreview}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.transactionItem,
                    { borderBottomColor: colors.border },
                    index === txPreview.length - 1 ? styles.transactionItemLast : null,
                  ]}
                  onPress={() => {
                    navigation.navigate('SalesHistory' as never);
                  }}>
                  <View style={styles.transactionLeft}>
                    <View style={[styles.transactionIconContainer, t.iconWell]}>
                      <Image
                        source={icons.cart}
                        style={[styles.transactionIcon, { tintColor: COLORS.primary2 }]}
                      />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={[styles.transactionNumber, t.transactionNumber]}>
                        {item.customer_invoice_no ||
                          item.invoice_no ||
                          `#${item.id}`}
                      </Text>
                      <Text style={[styles.transactionCustomer, t.transactionCustomer]}>
                        {item.customer?.name?.trim() ||
                          item.customer_name?.trim() ||
                          'Walk-in Customer'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[styles.transactionAmount, { color: COLORS.primary2 }]}>
                      {formatCurrency(item.total_amount || 0)}
                    </Text>
                    <Text style={[styles.transactionTime, t.transactionTime]}>
                      {formatSalesTransactionListSubtitle(
                        item.document_date,
                        item.created_at,
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : (
          <View style={[styles.recentTransactions, t.listCard]}>
            <Text style={[styles.placeholderText, t.placeholderText]}>
              No recent transactions
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, t.root]}
      edges={['left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 12) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary2]}
            tintColor={COLORS.primary2}
            title="Pull to refresh"
            titleColor={colors.textSecondary}
            progressBackgroundColor={colors.surface}
          />
        }>
        {renderHomeTopBar()}
        <View style={styles.quickActionsSection}>
          <Options
            unpostedCount={unpostedSales.length}
            lowStockCount={lowStockItems.length}
          />
        </View>
        {renderQuickStats()}
        {renderMySalesToday()}
        {renderUnpostedSales()}
        {renderTopSellingItems()}
        {renderRecentTransactions()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  homeTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 18,
  },
  homeCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeTopBarIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  homeTitleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  homeStoreTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  homeStoreSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  quickActionsSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 0,
  },
  mySalesSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 16,
  },
  kpiSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  insightsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statsSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
  },
  statsSectionHeader: {
    marginBottom: 12,
  },
  insightsCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  insightMetricLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  insightMetricValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  insightBarTrack: {
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
  },
  insightBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  insightMetricGap: {
    height: 22,
  },
  insightTrend: {
    marginTop: 10,
  },
  insightMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  insightMetaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  insightMetaDot: {
    fontSize: 13,
  },
  snapshotCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  snapshotLoadingCard: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  salesLabel: {
    ...FONTS.body4,
    marginBottom: 4,
  },
  salesAmount: {
    ...FONTS.h2,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  comparedText: {
    ...FONTS.body5,
  },
  snapshotMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  snapshotMetric: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  snapshotMetricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  statValue: {
    ...FONTS.body2,
    fontWeight: '600',
    marginBottom: 2,
  },
  statItemLabel: {
    ...FONTS.body5,
    textAlign: 'center',
  },
  snapshotTintWell: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  snapshotTintWellRow: {
    marginBottom: 0,
  },
  snapshotTintWellImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  snapshotSectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  snapshotAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  snapshotAlertRowLast: {
    borderBottomWidth: 0,
  },
  snapshotAlertCopy: {
    flex: 1,
    minWidth: 0,
  },
  alertTitle: {
    ...FONTS.body4,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertText: {
    ...FONTS.body5,
  },
  recentSection: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  sectionHeaderAction: {
    flexShrink: 0,
  },
  seeAllText: {
    ...FONTS.body4,
    fontWeight: '500',
  },
  recentTransactions: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionItemLast: {
    borderBottomWidth: 0,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  transactionIcon: {
    width: 20,
    height: 20,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionNumber: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionCustomer: {
    ...FONTS.body4,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionTime: {
    ...FONTS.body5,
  },
  placeholderText: {
    ...FONTS.body4,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...FONTS.body4,
    marginTop: 8,
  },
  rankBadge: {
    ...FONTS.h3,
    fontWeight: '700',
    fontSize: 14,
  },
});
