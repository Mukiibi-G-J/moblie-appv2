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
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, SIZES, COLORS, icons } from '../../constants';
import Options from './Options';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useAuth } from '../../context/Store';
import { useTenantContext } from '../../context/TenantContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../context/ThemeContext';
import { navigate } from '../../hooks/NavigationService';
import {
  fetchKPIMetrics,
  fetchRecentTransactions,
  fetchLowStockItems,
  fetchDraftSales,
  fetchOutstandingReceivables,
  fetchTopSellingItems,
  getCompanyInfo,
  KPIMetrics,
} from '../../services/app.services';

interface SalesInvoice {
  id: number;
  customer_invoice_no: string;
  customer?: { name: string };
  total_amount: number;
  created_at: string;
  status: string;
}

function formatTenantLabel(slug: string | null): string {
  if (!slug?.trim()) {
    return 'Your business';
  }
  return slug
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function Home() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth, accessToken } = useAuth();
  const { currentTenant } = useTenantContext();
  const { isModuleVisible, hasAnyPageAccess, canCreate } = usePermissions();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await getCompanyInfo();
          const name = res?.data?.company?.name?.trim?.();
          if (!cancelled && name) {
            setCompanyName(name);
          }
        } catch {
          /* keep previous */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const storeLabel = useMemo(() => {
    if (companyName?.trim()) {
      return companyName.trim();
    }
    return formatTenantLabel(currentTenant);
  }, [companyName, currentTenant]);

  /** Greeting uses a single given name (first word of full name, else username). */
  const displayName =
    auth.full_name?.trim()?.split(/\s+/).filter(Boolean)[0] ||
    auth.username?.trim() ||
    '';

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

  // Permission checks
  const canViewKPIs =
    isModuleVisible('sales') &&
    (hasAnyPageAccess('Sales Dashboard') || hasAnyPageAccess('Sales'));

  const canViewTransactions =
    isModuleVisible('sales') &&
    (hasAnyPageAccess('Sales History') || hasAnyPageAccess('Sales'));

  const canViewItems =
    isModuleVisible('items') && hasAnyPageAccess('Items');

  const canViewDrafts =
    isModuleVisible('sales') && canCreate('Sales');

  const canViewReceivables =
    (isModuleVisible('payments') || isModuleVisible('customers')) &&
    (hasAnyPageAccess('Payments') || hasAnyPageAccess('Customer Management'));

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

  // Update date at midnight
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 86400000);
    return () => clearInterval(timer);
  }, []);

  // Fetch KPI Metrics
  const loadKPIMetrics = async () => {
    if (!canViewKPIs) return;

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

  // Fetch Recent Transactions
  const loadRecentTransactions = async () => {
    if (!canViewTransactions) return;

    setTransactionsLoading(true);
    try {
      const transactions = await fetchRecentTransactions(10);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

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
    if (!canViewKPIs) return;

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
    canViewKPIs,
    canViewTransactions,
    canViewItems,
    canViewDrafts,
    canViewReceivables,
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
    canViewKPIs,
    canViewTransactions,
    canViewItems,
    canViewDrafts,
    canViewReceivables,
  ]);

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const renderHomeTopBar = () => (
    <View style={styles.homeTopBar}>
      <TouchableOpacity
        onPress={openDrawer}
        style={[
          styles.homeCircleBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
        hitSlop={12}
        accessibilityLabel="Open menu">
        <Image
          source={icons.menu}
          style={[styles.homeTopBarIcon, { tintColor: colors.textPrimary }]}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigate('Subscription', undefined)}
        style={[
          styles.homeCircleBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
        hitSlop={12}
        accessibilityLabel="Subscription and perks">
        <Image
          source={icons.coupon}
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Render KPI Cards
  const renderQuickStats = () => {
    if (!canViewKPIs) return null;

    if (kpiLoading) {
      return (
        <View style={styles.statsSection}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading metrics...
            </Text>
          </View>
        </View>
      );
    }

    if (!kpiMetrics) {
      return null;
    }

    const salesChange = kpiMetrics.revenue_growth;
    const hasPositiveTrend = salesChange >= 0;

    return (
      <View style={styles.statsSection}>
        <Text style={[styles.kpiSectionTitle, t.sectionTitle, FONTS.h3]}>
          {"Today's snapshot"}
        </Text>
        {/* Main Sales Card */}
        <View style={[styles.mainStatsCard, t.card]}>
          <View style={styles.salesHeader}>
            <View>
              <Text style={[styles.salesLabel, t.salesLabel]}>Today's Revenue</Text>
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
                  {hasPositiveTrend ? '↑' : '↓'} {Math.abs(salesChange).toFixed(1)}%
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
            <Text style={[styles.statItemLabel, t.statItemLabel]}>Orders Today</Text>
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
            <Text style={[styles.statItemLabel, t.statItemLabel]}>Products Sold</Text>
            {kpiMetrics.total_products > 0 && (
              <View style={[styles.progressBar, t.progressTrack]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        (kpiMetrics.today_products_sold / kpiMetrics.total_products) *
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

        {canViewReceivables &&
          outstandingReceivables &&
          outstandingReceivables.total_amount > 0 && (
            <TouchableOpacity
              style={[
                styles.alertCard,
                t.card,
                { borderLeftColor: COLORS.warning },
              ]}
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
                    {formatCurrency(outstandingReceivables.total_amount)} from{' '}
                    {outstandingReceivables.count} customer
                    {outstandingReceivables.count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={[styles.alertArrow, t.alertArrow]}>→</Text>
              </View>
            </TouchableOpacity>
          )}

        {canViewItems && lowStockItems.length > 0 && (
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
          <Text style={[styles.sectionTitle, t.sectionTitle]}>Draft Sales</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Cart' as never)}>
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
    if (!canViewKPIs || topSellingItems.length === 0) return null;

    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, t.sectionTitle]}>
            Top Selling Items Today
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Items' as never)}>
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
          <Text style={[styles.sectionTitle, t.sectionTitle]}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SalesHistory' as never)}>
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
                        {item.customer_invoice_no || `#${item.id}`}
                      </Text>
                      <Text style={[styles.transactionCustomer, t.transactionCustomer]}>
                        {item.customer?.name || 'Walk-in Customer'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={[styles.transactionAmount, { color: COLORS.primary2 }]}>
                      {formatCurrency(item.total_amount || 0)}
                    </Text>
                    <Text style={[styles.transactionTime, t.transactionTime]}>
                      {formatDate(item.created_at)}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
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
