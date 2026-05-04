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
  fetchKPIMetrics,
  fetchMyUserSetup,
  fetchRecentTransactions,
  fetchLowStockItems,
  fetchDraftSales,
  fetchOutstandingReceivables,
  fetchTopSellingItems,
  KPIMetrics,
} from '../../services/app.services';

interface SalesInvoice {
  id: number;
  invoice_no?: string;
  customer_invoice_no?: string;
  customer?: { name: string };
  customer_name?: string;
  document_date?: string;
  total_amount: number;
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth, accessToken } = useAuth();
  const app = useAppContext();
  const { isModuleVisible, hasAnyPageAccess, canCreate } = usePermissions();
  const { storeLabel } = useCompanyInfo();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
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

  // Draft Sales
  const [draftSales, setDraftSales] = useState < any[] > ([]);
  const [draftLoading, setDraftLoading] = useState(false);

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

  const canViewReceivables =
    (isModuleVisible('payments') || isModuleVisible('customers')) &&
    (hasAnyPageAccess(PAGE_NAMES.PAYMENTS) ||
      hasAnyPageAccess(PAGE_NAMES.CUSTOMER_MANAGEMENT));

  const t = useMemo(
    () => ({
      root: { backgroundColor: colors.background },
      card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      sectionTitle: { color: colors.textPrimary },
      seeAll: { color: COLORS.primary2 },
      salesLabel: { color: colors.textSecondary },
      salesAmount: { color: COLORS.primary },
      comparedText: { color: colors.textSecondary },
      statValue: { color: colors.textPrimary },
      statItemLabel: { color: colors.textSecondary },
      progressTrack: { backgroundColor: colors.screenMuted },
      alertTitle: { color: colors.textPrimary },
      alertText: { color: colors.textSecondary },
      alertArrow: { color: colors.textSecondary },
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
      statusBadge: {
        backgroundColor: isDark
          ? 'rgba(52, 199, 89, 0.14)'
          : 'rgba(52, 199, 89, 0.12)',
        borderColor: isDark
          ? 'rgba(74, 222, 128, 0.35)'
          : 'rgba(52, 199, 89, 0.35)',
      },
    }),
    [colors, isDark],
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

  // Update date at midnight
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 86400000);
    return () => clearInterval(timer);
  }, []);

  // Fetch KPI Metrics
  const loadKPIMetrics = async () => {
    if (!canViewSalesDashboard) return;

    setKpiLoading(true);
    try {
      const metrics = await fetchKPIMetrics();
      setKpiMetrics(metrics);
    } catch (error) {
      console.error('Error loading KPI metrics:', error);
    } finally {
      setKpiLoading(false);
    }
  };

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

  // Fetch Draft Sales
  const loadDraftSales = async () => {
    if (!canViewDrafts) return;

    setDraftLoading(true);
    try {
      const drafts = await fetchDraftSales();
      setDraftSales(drafts);
    } catch (error) {
      console.error('Error loading draft sales:', error);
    } finally {
      setDraftLoading(false);
    }
  };

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

  // Fetch Top Selling Items
  const loadTopSellingItems = async () => {
    if (!canViewSalesDashboard) return;

    setTopItemsLoading(true);
    try {
      const items = await fetchTopSellingItems(5);
      setTopSellingItems(items);
    } catch (error) {
      console.error('Error loading top selling items:', error);
    } finally {
      setTopItemsLoading(false);
    }
  };

  // Load all data on mount
  useEffect(() => {
    if (!isAuthLoading) {
      loadKPIMetrics();
      loadRecentTransactions();
      loadLowStockItems();
      loadDraftSales();
      loadOutstandingReceivables();
      loadTopSellingItems();
    }
  }, [
    isAuthLoading,
    canViewSalesDashboard,
    canViewTransactions,
    canViewItems,
    canViewDrafts,
    canViewReceivables,
    restrictSalesToSelf,
    auth.user_id,
    loadRecentTransactions,
  ]);

  // Pull to refresh handler
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Load all data in parallel
      await Promise.all([
        loadKPIMetrics(),
        loadRecentTransactions(),
        loadLowStockItems(),
        loadDraftSales(),
        loadOutstandingReceivables(),
        loadTopSellingItems(),
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
    canViewDrafts,
    canViewReceivables,
    loadRecentTransactions,
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
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
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
      <TouchableOpacity
        onPress={() => navigate('PrinterConfig', undefined)}
        style={[
          styles.homeCircleBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
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

  const renderHomeHero = () => (
    <View style={styles.homeHero}>
      <Text style={[styles.homeWelcomeTitle, { color: colors.textPrimary }]}>
        {isAuthLoading
          ? 'Welcome back'
          : `Welcome back${displayName ? `, ${displayName}` : ''}`}
      </Text>
      <Text style={[styles.homeStoreName, { color: colors.textSecondary }]}>
        {storeLabel}
      </Text>
      {activeBranchLabel ? (
        <Text style={[styles.homeBranchName, { color: colors.textSecondary }]}>
          {activeBranchLabel}
        </Text>
      ) : null}
    </View>
  );

  const renderDateStatusRow = () => {
    const formattedDate = currentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return (
      <View style={styles.homeMetaRow}>
        <Text style={[styles.homeMetaDate, { color: colors.textSecondary }]}>
          {formattedDate}
        </Text>
        <View style={[styles.statusBadge, t.statusBadge]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Store Open</Text>
        </View>
      </View>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Render KPI Cards + optional alerts (receivables / low stock use their own permissions)
  const renderQuickStats = () => {
    const showReceivablesAlert =
      !!(
        canViewReceivables &&
        outstandingReceivables &&
        outstandingReceivables.total_amount > 0
      );
    const showLowStockAlert = canViewItems && lowStockItems.length > 0;
    const hasStatsSection =
      canViewSalesDashboard || showReceivablesAlert || showLowStockAlert;
    if (!hasStatsSection) {
      return null;
    }

    const salesChange = kpiMetrics?.revenue_growth ?? 0;
    const hasPositiveTrend = salesChange >= 0;

    return (
      <View style={styles.statsSection}>
        {canViewSalesDashboard &&
          (kpiLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary2} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading metrics...
              </Text>
            </View>
          ) : kpiMetrics ? (
            <>
              <Text style={[styles.kpiSectionTitle, t.sectionTitle, FONTS.h3]}>
                {"Today's snapshot"}
              </Text>
              {/* Main Sales Card */}
              <View style={[styles.mainStatsCard, t.card]}>
                <View style={styles.salesHeader}>
                  <View>
                    <Text style={[styles.salesLabel, t.salesLabel]}>
                      Today's Revenue
                    </Text>
                    <Text style={[styles.salesAmount, t.salesAmount]}>
                      {formatCurrency(kpiMetrics.today_revenue)}
                    </Text>
                  </View>
                  {salesChange !== 0 && (
                    <View
                      style={[
                        styles.trendBadge,
                        hasPositiveTrend ? styles.positiveTrend : styles.negativeTrend,
                      ]}>
                      <Text
                        style={[
                          styles.trendText,
                          hasPositiveTrend ? styles.positiveText : styles.negativeText,
                        ]}>
                        {hasPositiveTrend ? '↑' : '↓'}{' '}
                        {Math.abs(salesChange).toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.comparedText, t.comparedText]}>
                  Compared to yesterday
                </Text>
              </View>

              {/* Secondary Stats Row */}
              <View style={styles.secondaryStatsContainer}>
                <View style={[styles.statCard, t.card]}>
                  <View style={styles.statHeader}>
                    <Image
                      source={icons.cart}
                      style={[styles.statIcon, { tintColor: COLORS.primary2 }]}
                    />
                    <Text style={[styles.statValue, t.statValue]}>
                      {kpiMetrics.today_orders}
                    </Text>
                  </View>
                  <Text style={[styles.statItemLabel, t.statItemLabel]}>
                    Orders Today
                  </Text>
                </View>

                <View style={[styles.statCard, t.card]}>
                  <View style={styles.statHeader}>
                    <Image
                      source={icons.product}
                      style={[styles.statIcon, { tintColor: COLORS.success }]}
                    />
                    <Text style={[styles.statValue, t.statValue]}>
                      {kpiMetrics.today_products_sold}
                    </Text>
                  </View>
                  <Text style={[styles.statItemLabel, t.statItemLabel]}>
                    Products Sold
                  </Text>
                  {kpiMetrics.total_products > 0 && (
                    <View style={[styles.progressBar, t.progressTrack]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              (kpiMetrics.today_products_sold /
                                kpiMetrics.total_products) *
                                100,
                              100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
              </View>
            </>
          ) : null)}

        {showReceivablesAlert && (
          <TouchableOpacity
            style={[styles.alertCard, t.card, { borderLeftColor: COLORS.warning }]}
            onPress={() => navigation.navigate('Payments' as never)}>
            <View style={styles.alertContent}>
              <Image
                source={icons.wallet}
                style={[styles.alertIcon, { tintColor: COLORS.warning }]}
              />
              <View style={styles.alertTextContainer}>
                <Text style={[styles.alertTitle, t.alertTitle]}>
                  Outstanding Receivables
                </Text>
                <Text style={[styles.alertText, t.alertText]}>
                  {formatCurrency(outstandingReceivables!.total_amount)} from{' '}
                  {outstandingReceivables!.count} customer
                  {outstandingReceivables!.count !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={[styles.alertArrow, t.alertArrow]}>→</Text>
            </View>
          </TouchableOpacity>
        )}

        {showLowStockAlert && (
          <TouchableOpacity
            style={[styles.alertCard, t.card, styles.alertCardErrorAccent]}
            onPress={() => navigation.navigate('Items' as never)}>
            <View style={styles.alertContent}>
              <Image
                source={icons.notification}
                style={[styles.alertIcon, { tintColor: COLORS.error }]}
              />
              <View style={styles.alertTextContainer}>
                <Text style={[styles.alertTitle, t.alertTitle]}>Low Stock Alert</Text>
                <Text style={[styles.alertText, t.alertText]}>
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}{' '}
                  need attention
                </Text>
              </View>
              <Text style={[styles.alertArrow, t.alertArrow]}>→</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Draft Sales
  const renderDraftSales = () => {
    if (!canViewDrafts) return null;

    if (draftLoading) {
      return (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, t.sectionTitle]}>Draft Sales</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
          </View>
        </View>
      );
    }

    if (draftSales.length === 0) {
      return null;
    }

    const draftsPreview = draftSales.slice(0, 3);
    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text
            style={[styles.sectionTitle, t.sectionTitle]}
            numberOfLines={1}
            ellipsizeMode="tail">
            Draft Sales
          </Text>
          <TouchableOpacity
            style={styles.sectionHeaderAction}
            onPress={() => navigation.navigate('Cart' as never)}>
            <Text style={[styles.seeAllText, t.seeAll]}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.recentTransactions, t.listCard]}>
          {draftsPreview.map((draft: any, index: number) => (
            <TouchableOpacity
              key={draft.id}
              style={[
                styles.transactionItem,
                { borderBottomColor: colors.border },
                index === draftsPreview.length - 1 ? styles.transactionItemLast : null,
              ]}
              onPress={() => navigation.navigate('Cart' as never)}>
              <View style={styles.transactionLeft}>
                <View style={[styles.transactionIconContainer, t.iconWell]}>
                  <Image
                    source={icons.cart}
                    style={[styles.transactionIcon, { tintColor: COLORS.warning }]}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionNumber, t.transactionNumber]}>
                    {draft.invoice_no || `Draft #${draft.id}`}
                  </Text>
                  <Text style={[styles.transactionCustomer, t.transactionCustomer]}>
                    {draft.customer_name || 'Draft Sale'}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, { color: COLORS.warning }]}>
                  {formatCurrency(draft.total_amount || 0)}
                </Text>
                <Text style={[styles.transactionTime, t.transactionTime]}>
                  {new Date(draft.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
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
        {renderHomeHero()}
        {renderDateStatusRow()}
        <View style={styles.quickActionsSection}>
          <Options />
        </View>
        {renderQuickStats()}
        {renderDraftSales()}
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
    marginBottom: 8,
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
  homeHero: {
    paddingHorizontal: SIZES.padding,
    marginBottom: 16,
  },
  homeWelcomeTitle: {
    ...FONTS.h2,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  homeStoreName: {
    ...FONTS.body3,
    marginTop: 6,
    fontWeight: '600',
  },
  homeBranchName: {
    ...FONTS.body4,
    marginTop: 2,
    fontWeight: '500',
  },
  homeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    marginTop: 4,
    marginBottom: 16,
  },
  homeMetaDate: {
    ...FONTS.body4,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    ...FONTS.body4,
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionsSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 0,
  },
  kpiSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  statsSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 8,
    gap: 16,
  },
  mainStatsCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  salesLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  salesAmount: {
    fontSize: 28,
    fontWeight: '700',
  },
  comparedText: {
    fontSize: 12,
    marginTop: 8,
  },
  secondaryStatsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statIcon: {
    width: 24,
    height: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  statItemLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  positiveTrend: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  negativeTrend: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  trendText: {
    fontWeight: '600',
    fontSize: 12,
  },
  positiveText: {
    color: COLORS.success,
  },
  negativeText: {
    color: COLORS.error,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  alertCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  alertCardErrorAccent: {
    borderLeftColor: COLORS.error,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertText: {
    fontSize: 12,
  },
  alertArrow: {
    fontSize: 18,
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
