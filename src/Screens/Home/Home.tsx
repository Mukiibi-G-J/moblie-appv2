import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  constants,
  SIZES,
  COLORS,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import Options from './Options';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppContext, useAuth, useTabContext} from '../../context/Store';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {useCompanyInfo} from '../../hooks/useCompanyInfo';
import {useTheme} from '../../context/ThemeContext';
import {navigate} from '../../hooks/NavigationService';
import {
  fetchHomeKpisFromSalesSummary,
  fetchHomeSnapshot,
  fetchMyUserSetup,
  fetchRecentTransactions,
  fetchLowStockItems,
  fetchOutstandingReceivables,
  KPIMetrics,
} from '../../services/app.services';
import TodayMySalesBar from '../../Components/TodayMySalesBar';
import SalesCategoryHomeReport from '../../Components/SalesCategoryHomeReport';
import {formatCurrency} from '../../utils/currency';
import {constrainedWidthStyle, isWideLayout, SHEET_MAX_WIDTH} from '../../utils/layout';

interface SalesInvoice {
  id: number;
  invoice_no?: string;
  customer_invoice_no?: string;
  customer?: {name: string};
  customer_name?: string;
  document_date?: string;
  total_amount?: number | string;
  created_at?: string;
  status: string;
}

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

type QuickCreateAction = {
  key: string;
  label: string;
  icon: number;
  onPress: () => void;
};

export default function Home() {
  const {colors, isDark} = useTheme();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const isWide = isWideLayout(windowWidth, windowHeight);
  const sheetWidthStyle = constrainedWidthStyle(
    windowWidth,
    SHEET_MAX_WIDTH,
    windowHeight,
  );
  const insets = useSafeAreaInsets();
  const {auth, accessToken} = useAuth();
  const app = useAppContext();
  const {isModuleVisible, hasAnyPageAccess, canCreate, canAccessMobileNav} =
    usePermissions();
  const {storeLabel} = useCompanyInfo();
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const navigation = useNavigation();
  const {setSelectedTab} = useTabContext();

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

  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<SalesInvoice[]>(
    [],
  );
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [outstandingReceivables, setOutstandingReceivables] = useState<{
    total_amount: number;
    count: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restrictSalesToSelf, setRestrictSalesToSelf] = useState(true);
  const [mySalesRefreshKey, setMySalesRefreshKey] = useState(0);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const canMakeSale =
    isModuleVisible('sales') &&
    canAccessMobileNav('makeSale', PAGE_NAMES.SALES);

  const canViewTransactions =
    isModuleVisible('sales') &&
    canAccessMobileNav('salesHistory', [
      PAGE_NAMES.SALES_HISTORY,
      PAGE_NAMES.SALES,
    ]);

  const canViewSalesDashboard =
    isModuleVisible('sales') &&
    (canMakeSale || canViewTransactions) &&
    hasAnyPageAccess(PAGE_NAMES.SALES_DASHBOARD);

  const canViewItems =
    isModuleVisible('items') &&
    canAccessMobileNav('items', PAGE_NAMES.ITEMS);

  const canViewReceivables =
    (isModuleVisible('payments') || isModuleVisible('customers')) &&
    (canAccessMobileNav('payments', PAGE_NAMES.PAYMENTS) ||
      canAccessMobileNav('customers', PAGE_NAMES.CUSTOMER_MANAGEMENT));

  const canViewMySalesToday =
    isModuleVisible('sales') &&
    (canMakeSale || canViewTransactions) &&
    !canViewSalesDashboard;

  const canViewProfitLoss =
    isModuleVisible('reports') &&
    canAccessMobileNav('reports', PAGE_NAMES.PROFIT_AND_LOSS);
  const canViewBalanceSheet =
    isModuleVisible('reports') &&
    canAccessMobileNav('reports', PAGE_NAMES.BALANCE_SHEET);
  const canOpenReportsMenu =
    isModuleVisible('reports') &&
    canAccessMobileNav('reports', PAGE_NAMES.REPORTS);
  const canViewFinancialReports =
    canViewProfitLoss || canViewBalanceSheet || canOpenReportsMenu;

  const canSwitchBranch =
    app?.branchSession?.enable_multiple_branches === true &&
    app?.branchSession?.can_switch_branch !== false;

  const openBranchSwitcher = useCallback(() => {
    if (!canSwitchBranch || !app?.setBranchSelectionPending) {
      return;
    }
    void app.setBranchSelectionPending(true);
  }, [app, canSwitchBranch]);

  const softCardShadow = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: isDark ? 0.28 : 0.07,
          shadowRadius: 10,
        },
        android: {elevation: isDark ? 0 : 2},
        default: {},
      }),
    [isDark],
  );

  const cardSurface = useMemo(
    () => ({
      backgroundColor: colors.card,
      borderColor: isDark ? colors.border : 'transparent',
      ...softCardShadow,
    }),
    [colors.card, colors.border, isDark, softCardShadow],
  );

  React.useEffect(() => {
    if (auth.username && auth.user_id) {
      setIsAuthLoading(false);
    } else if (!accessToken) {
      setIsAuthLoading(false);
    }
  }, [auth, accessToken]);

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
        if (cancelled) return;
        setRestrictSalesToSelf(setup?.canViewOnlyTheirSales ?? true);
      } catch {
        if (!cancelled) setRestrictSalesToSelf(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHomeSnapshot = useCallback(async () => {
    if (!canViewSalesDashboard) return;
    setKpiLoading(true);
    try {
      const [kpi] = await Promise.all([
        fetchHomeKpisFromSalesSummary(),
        fetchHomeSnapshot(5),
      ]);
      setKpiMetrics(kpi);
    } catch (error) {
      console.error('Error loading home sales KPIs:', error);
      setKpiMetrics(null);
    } finally {
      setKpiLoading(false);
    }
  }, [canViewSalesDashboard]);

  const loadRecentTransactions = useCallback(async () => {
    if (!canViewTransactions) return;
    setTransactionsLoading(true);
    try {
      const uid = Number.parseInt(String(auth.user_id || ''), 10);
      const opts =
        restrictSalesToSelf && Number.isFinite(uid) ? {userId: uid} : undefined;
      const transactions = await fetchRecentTransactions(10, opts);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [canViewTransactions, restrictSalesToSelf, auth.user_id]);

  const loadLowStockItems = useCallback(async () => {
    if (!canViewItems) return;
    try {
      const items = await fetchLowStockItems();
      setLowStockItems(items);
    } catch (error) {
      console.error('Error loading low stock items:', error);
    }
  }, [canViewItems]);

  const loadOutstandingReceivables = useCallback(async () => {
    if (!canViewReceivables) return;
    try {
      const receivables = await fetchOutstandingReceivables();
      setOutstandingReceivables(receivables);
    } catch (error) {
      console.error('Error loading outstanding receivables:', error);
    }
  }, [canViewReceivables]);

  useEffect(() => {
    if (!isAuthLoading) {
      loadHomeSnapshot();
      loadRecentTransactions();
      loadLowStockItems();
      loadOutstandingReceivables();
    }
  }, [
    isAuthLoading,
    app?.branchSession?.active_branch_id,
    loadHomeSnapshot,
    loadRecentTransactions,
    loadLowStockItems,
    loadOutstandingReceivables,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setMySalesRefreshKey(k => k + 1);
    try {
      await Promise.all([
        loadHomeSnapshot(),
        loadRecentTransactions(),
        loadLowStockItems(),
        loadOutstandingReceivables(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [
    loadHomeSnapshot,
    loadRecentTransactions,
    loadLowStockItems,
    loadOutstandingReceivables,
  ]);

  const quickCreateActions = useMemo((): QuickCreateAction[] => {
    const actions: QuickCreateAction[] = [];
    if (canMakeSale) {
      actions.push({
        key: 'sale',
        label: 'Sale',
        icon: icons.cart,
        onPress: () => setSelectedTab(constants.screens.makeSale),
      });
    }
    if (
      isModuleVisible('customers') &&
      canAccessMobileNav('customers', PAGE_NAMES.CUSTOMER_MANAGEMENT)
    ) {
      actions.push({
        key: 'customer',
        label: 'Customer',
        icon: icons.profile,
        onPress: () => navigate('Customers', undefined),
      });
    }
    if (
      isModuleVisible('expenses') &&
      canAccessMobileNav('expenses', PAGE_NAMES.EXPENSES)
    ) {
      actions.push({
        key: 'expense',
        label: 'Expense',
        icon: icons.coupon,
        onPress: () => navigation.navigate('Expenses' as never),
      });
    }
    if (isModuleVisible('items') && canAccessMobileNav('items', PAGE_NAMES.ITEMS)) {
      actions.push({
        key: 'item',
        label: 'Item',
        icon: icons.product,
        onPress: () => navigation.navigate('Items' as never),
      });
    }
    if (
      isModuleVisible('suppliers') &&
      canAccessMobileNav('suppliers', PAGE_NAMES.SUPPLIERS)
    ) {
      actions.push({
        key: 'vendor',
        label: 'Vendor',
        icon: icons.company,
        onPress: () => navigate('Suppliers', undefined),
      });
    }
    if (
      isModuleVisible('payments') &&
      (canCreate(PAGE_NAMES.QUICK_PAYMENT) ||
        canCreate(PAGE_NAMES.PAYMENTS) ||
        hasAnyPageAccess(PAGE_NAMES.QUICK_PAYMENT)) &&
      canAccessMobileNav('payments')
    ) {
      actions.push({
        key: 'quick-payment',
        label: 'Payment',
        icon: icons.wallet,
        onPress: () => navigation.navigate('Payments' as never),
      });
    }
    return actions;
  }, [
    canMakeSale,
    isModuleVisible,
    hasAnyPageAccess,
    canAccessMobileNav,
    canCreate,
    navigation,
    setSelectedTab,
  ]);

  const showFab = quickCreateActions.length > 0;

  const runQuickAction = (action: QuickCreateAction) => {
    setQuickCreateOpen(false);
    // Let modal dismiss before navigating
    requestAnimationFrame(() => action.onPress());
  };

  const renderHomeTopBar = () => (
    <View style={styles.homeTopBar}>
      <TouchableOpacity
        style={styles.homeTitleBlock}
        onPress={canSwitchBranch ? openBranchSwitcher : undefined}
        disabled={!canSwitchBranch}
        activeOpacity={canSwitchBranch ? 0.7 : 1}
        accessibilityRole={canSwitchBranch ? 'button' : undefined}
        accessibilityLabel={
          canSwitchBranch ? 'Switch branch' : undefined
        }>
        <View style={styles.homeStoreTitleRow}>
          <Text
            style={[styles.homeStoreTitle, {color: colors.textPrimary}]}
            numberOfLines={1}>
            {storeLabel || 'Zentro'}
          </Text>
          {canSwitchBranch ? (
            <Image
              source={icons.down_arrow}
              style={[styles.homeChevron, {tintColor: colors.textSecondary}]}
            />
          ) : null}
        </View>
        <Text
          style={[styles.homeStoreSubtitle, {color: colors.textSecondary}]}
          numberOfLines={1}>
          {activeBranchLabel
            ? activeBranchLabel
            : !isAuthLoading && displayName
              ? `Hi, ${displayName}`
              : 'Updated just now'}
        </Text>
      </TouchableOpacity>

      <View style={styles.homeTopActions}>
        {canViewTransactions ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('SalesHistory' as never)}
            style={[styles.homeCircleBtn, {backgroundColor: colors.card}, softCardShadow]}
            activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
            hitSlop={ICON_BUTTON_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Sales history">
            <Image
              source={icons.clock}
              style={[styles.homeTopBarIcon, {tintColor: colors.textPrimary}]}
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => navigate('SearchPage', undefined)}
          style={[styles.homeCircleBtn, {backgroundColor: colors.card}, softCardShadow]}
          activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
          hitSlop={ICON_BUTTON_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Search">
          <Image
            source={icons.search}
            style={[styles.homeTopBarIcon, {tintColor: colors.textPrimary}]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutlineCta = (
    label: string,
    onPress: () => void,
    accent: string = COLORS.primary,
  ) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.outlineCta,
        isWide ? styles.outlineCtaWide : null,
        {borderColor: accent},
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={[styles.outlineCtaLabel, {color: accent}]}>{label}</Text>
    </TouchableOpacity>
  );

  /** One metric per card — QuickBooks density. */
  const renderMetricCards = () => {
    const unpaidAmount = outstandingReceivables?.total_amount ?? 0;
    const unpaidCount = outstandingReceivables?.count ?? 0;
    const todayRevenue = kpiMetrics?.today_revenue ?? 0;
    const salesChange = kpiMetrics?.revenue_growth ?? 0;
    const hasPositiveTrend = salesChange >= 0;

    if (!canViewSalesDashboard && !canViewReceivables && !canViewMySalesToday) {
      return null;
    }

    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionEyebrow, {color: colors.textPrimary}]}>
            Today
          </Text>
        </View>

        <View style={isWide ? styles.bannerGrid : styles.bannerStack}>
          {canViewSalesDashboard ? (
          <View style={[styles.metricCard, isWide && styles.bannerCell, cardSurface]}>
            {kpiLoading ? (
              <View style={styles.metricLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <>
                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>
                  Sales
                </Text>
                <Text style={[styles.metricPeriod, {color: colors.textTertiary}]}>
                  This day
                </Text>
                <Text style={[styles.metricValue, {color: colors.textPrimary}]}>
                  {formatCurrency(todayRevenue)}
                </Text>
                {kpiMetrics ? (
                  <Text style={[styles.metricTrend, {color: colors.textSecondary}]}>
                    {salesChange === 0 ? (
                      'No change vs yesterday'
                    ) : (
                      <>
                        <Text
                          style={{
                            color: hasPositiveTrend
                              ? COLORS.success
                              : COLORS.error,
                            fontWeight: '700',
                          }}>
                          {hasPositiveTrend ? '↑ Up' : '↓ Down'}{' '}
                          {Math.abs(salesChange).toFixed(0)}%
                        </Text>
                        {' vs yesterday'}
                      </>
                    )}
                  </Text>
                ) : null}
                {kpiMetrics ? (
                  <Text style={[styles.metricMeta, {color: colors.textTertiary}]}>
                    {kpiMetrics.today_orders} orders ·{' '}
                    {kpiMetrics.today_products_sold} products
                  </Text>
                ) : null}
                {canViewTransactions
                  ? renderOutlineCta('View sales', () =>
                      navigation.navigate('SalesHistory' as never),
                    )
                  : null}
              </>
            )}
          </View>
        ) : null}

        {canViewReceivables ? (
          <View style={[styles.metricCard, isWide && styles.bannerCell, cardSurface]}>
            <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>
              Unpaid invoices
            </Text>
            <Text style={[styles.metricPeriod, {color: colors.textTertiary}]}>
              {unpaidCount > 0
                ? `${unpaidCount} outstanding`
                : 'Get paid faster'}
            </Text>
            <Text style={[styles.metricValue, {color: colors.textPrimary}]}>
              {formatCurrency(unpaidAmount)}
            </Text>
            <View
              style={[
                styles.softBar,
                {backgroundColor: isDark ? colors.border : '#EEF2F1'},
              ]}>
              <View
                style={[
                  styles.softBarFill,
                  {
                    width: unpaidAmount > 0 ? '42%' : '0%',
                    backgroundColor: COLORS.warning,
                  },
                ]}
              />
            </View>
            {renderOutlineCta(
              unpaidAmount > 0 ? 'Collect payment' : 'View payments',
              () => navigation.navigate('Payments' as never),
            )}
          </View>
        ) : null}
          {renderMySalesTodayCard()}
        </View>
      </View>
    );
  };

  const renderFinancialReports = () => {
    if (!canViewFinancialReports) return null;

    const rows: Array<{
      key: string;
      title: string;
      subtitle: string;
      onPress: () => void;
    }> = [];

    if (canViewProfitLoss) {
      rows.push({
        key: 'profit-loss',
        title: 'Profit & Loss',
        subtitle: 'Income, costs, and net profit',
        onPress: () => navigation.navigate('ProfitLossReport' as never),
      });
    }
    if (canViewBalanceSheet) {
      rows.push({
        key: 'balance-sheet',
        title: 'Balance Sheet',
        subtitle: 'Assets, liabilities, and equity',
        onPress: () => navigation.navigate('BalanceSheetReport' as never),
      });
    }
    if (rows.length === 0 && canOpenReportsMenu) {
      rows.push({
        key: 'reports-menu',
        title: 'Financial reports',
        subtitle: 'Open statements and run a report',
        onPress: () => navigation.navigate('Reports' as never),
      });
    }

    if (rows.length === 0) return null;

    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionEyebrow, {color: colors.textPrimary}]}>
            Financial reports
          </Text>
          {canOpenReportsMenu && rows[0]?.key !== 'reports-menu' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Reports' as never)}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="See all financial reports">
              <Text style={[styles.seeAllText, {color: COLORS.primary}]}>
                See all
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.listCard, cardSurface]}>
          {rows.map((row, index) => (
            <TouchableOpacity
              key={row.key}
              style={[
                styles.transactionItem,
                {borderBottomColor: colors.border},
                index === rows.length - 1 ? styles.transactionItemLast : null,
              ]}
              onPress={row.onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={row.title}>
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.transactionIconContainer,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#eafaf8',
                    },
                  ]}>
                  <Image
                    source={icons.reports}
                    style={[
                      styles.transactionIcon,
                      {tintColor: COLORS.primary},
                    ]}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text
                    style={[
                      styles.transactionNumber,
                      {color: colors.textPrimary},
                    ]}
                    numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text
                    style={[
                      styles.transactionCustomer,
                      {color: colors.textSecondary},
                    ]}
                    numberOfLines={1}>
                    {row.subtitle}
                  </Text>
                </View>
              </View>
              <Image
                source={icons.down_arrow}
                style={[
                  styles.reportChevron,
                  {tintColor: colors.textTertiary},
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderMySalesTodayCard = () => {
    if (!canViewMySalesToday) return null;
    const uid = Number.parseInt(String(auth.user_id || ''), 10);
    if (!Number.isFinite(uid)) return null;
    const canOpenHistory = hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY);
    return (
      <View style={isWide ? styles.bannerCell : undefined}>
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

  const renderRecentTransactions = () => {
    if (!canViewTransactions) return null;
    const txPreview = recentTransactions.slice(0, 3);

    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionEyebrow, {color: colors.textPrimary}]}>
            Recent activity
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('SalesHistory' as never)}
            hitSlop={ICON_BUTTON_HIT_SLOP}>
            <Text style={[styles.seeAllText, {color: COLORS.primary}]}>
              See all
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listCard, cardSurface]}>
          {transactionsLoading ? (
            <View style={styles.metricLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : txPreview.length > 0 ? (
            <FlatList
              data={txPreview}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              renderItem={({item, index}) => (
                <TouchableOpacity
                  style={[
                    styles.transactionItem,
                    {borderBottomColor: colors.border},
                    index === txPreview.length - 1
                      ? styles.transactionItemLast
                      : null,
                  ]}
                  onPress={() =>
                    navigation.navigate('SalesHistory' as never)
                  }>
                  <View style={styles.transactionLeft}>
                    <View
                      style={[
                        styles.transactionIconContainer,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : '#eafaf8',
                        },
                      ]}>
                      <Image
                        source={icons.cart}
                        style={[
                          styles.transactionIcon,
                          {tintColor: COLORS.primary},
                        ]}
                      />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text
                        style={[
                          styles.transactionNumber,
                          {color: colors.textPrimary},
                        ]}
                        numberOfLines={1}>
                        {item.customer_invoice_no ||
                          item.invoice_no ||
                          `#${item.id}`}
                      </Text>
                      <Text
                        style={[
                          styles.transactionCustomer,
                          {color: colors.textSecondary},
                        ]}
                        numberOfLines={1}>
                        {item.customer?.name?.trim() ||
                          item.customer_name?.trim() ||
                          'Walk-in Customer'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        {color: colors.textPrimary},
                      ]}>
                      {formatCurrency(item.total_amount || 0)}
                    </Text>
                    <Text
                      style={[
                        styles.transactionTime,
                        {color: colors.textTertiary},
                      ]}>
                      {formatSalesTransactionListSubtitle(
                        item.document_date,
                        item.created_at,
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyActivity}>
              <Text
                style={[styles.emptyTitle, {color: colors.textPrimary}]}>
                No sales yet today
              </Text>
              <Text
                style={[styles.emptyBody, {color: colors.textSecondary}]}>
                Your latest transactions will show up here.
              </Text>
              {canMakeSale
                ? renderOutlineCta('Make sale', () =>
                    setSelectedTab(constants.screens.makeSale),
                  )
                : null}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: showFab ? 108 : 28,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
            title="Pull to refresh"
            titleColor={colors.textSecondary}
            progressBackgroundColor={colors.surface}
          />
        }>
        {renderHomeTopBar()}

        {renderMetricCards()}
        {renderFinancialReports()}
        <SalesCategoryHomeReport
          pageId={auth.roleCentrePageId ?? null}
          refreshKey={mySalesRefreshKey}
        />

        <View style={styles.sectionBlock}>
          <Options wide={isWide} lowStockCount={lowStockItems.length} />
        </View>

        {renderRecentTransactions()}
      </ScrollView>

      {showFab ? (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: COLORS.primary,
              bottom: 20,
            },
            softCardShadow,
          ]}
          activeOpacity={0.9}
          onPress={() => setQuickCreateOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Create new">
          <Image
            source={icons.plus}
            style={styles.fabIcon}
          />
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={quickCreateOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickCreateOpen(false)}>
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setQuickCreateOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              sheetWidthStyle,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
            onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandleWrap}>
              <View
                style={[
                  styles.sheetHandle,
                  {backgroundColor: colors.border},
                ]}
              />
            </View>
            <Text style={[styles.sheetTitle, {color: colors.textPrimary}]}>
              Create
            </Text>
            {quickCreateActions.map((action, index) => (
              <TouchableOpacity
                key={action.key}
                style={[
                  styles.sheetRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth:
                      index === quickCreateActions.length - 1
                        ? 0
                        : StyleSheet.hairlineWidth,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => runQuickAction(action)}>
                <View
                  style={[
                    styles.sheetIconWell,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#eafaf8',
                    },
                  ]}>
                  <Image
                    source={action.icon}
                    style={[styles.sheetIcon, {tintColor: COLORS.primary}]}
                  />
                </View>
                <Text
                  style={[styles.sheetRowLabel, {color: colors.textPrimary}]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  homeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    marginBottom: 20,
    gap: 12,
  },
  homeTitleBlock: {
    flex: 1,
    paddingRight: 8,
  },
  homeStoreTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homeStoreTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  homeChevron: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    marginTop: 2,
  },
  homeStoreSubtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '500',
  },
  homeTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeTopBarIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  sectionBlock: {
    paddingHorizontal: SIZES.padding,
    marginBottom: 16,
    gap: 14,
  },
  bannerStack: {
    gap: 14,
  },
  bannerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'stretch',
  },
  bannerCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '47%',
    minWidth: 280,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionEyebrow: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  metricLoading: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricPeriod: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  metricTrend: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricMeta: {
    fontSize: 13,
    marginBottom: 14,
  },
  softBar: {
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 4,
  },
  softBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  outlineCta: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  outlineCtaWide: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    minWidth: 160,
  },
  outlineCtaLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  listCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionItemLast: {
    borderBottomWidth: 0,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  transactionIcon: {
    width: 18,
    height: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionCustomer: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  transactionTime: {
    fontSize: 11,
    marginTop: 2,
  },
  reportChevron: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    transform: [{rotate: '-90deg'}],
  },
  emptyActivity: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fabIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.white,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  sheetIconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIcon: {
    width: 20,
    height: 20,
  },
  sheetRowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
