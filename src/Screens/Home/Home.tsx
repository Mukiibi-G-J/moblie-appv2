import React, {useState, useEffect} from 'react';
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
import {useNavigation} from '@react-navigation/native';
import {FONTS, SIZES, COLORS, icons, constants} from '../../constants';
import Options from './Options';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScrollView} from 'react-native';
import {useAuth, useSetSelectedTab} from '../../context/Store';
import {getRoleDisplayName} from '../../utils/utils';
import {usePermissions} from '../../hooks/usePermissions';
import {useTheme} from '../../context/ThemeContext';
import {
  fetchKPIMetrics,
  fetchRecentTransactions,
  fetchLowStockItems,
  fetchDraftSales,
  fetchOutstandingReceivables,
  fetchTopSellingItems,
  KPIMetrics,
} from '../../services/app.services';

interface SalesInvoice {
  id: number;
  customer_invoice_no: string;
  customer?: {name: string};
  total_amount: number;
  created_at: string;
  status: string;
}

export default function Home() {
  const {colors} = useTheme();
  const {auth, accessToken} = useAuth();
  const setSelectedTab = useSetSelectedTab();
  const {isModuleVisible, hasAnyPageAccess, canRead, canCreate} = usePermissions();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const navigation = useNavigation();

  // KPI Data
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Recent Transactions
  const [recentTransactions, setRecentTransactions] = useState<SalesInvoice[]>(
    [],
  );
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Low Stock
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  // Draft Sales
  const [draftSales, setDraftSales] = useState<any[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);

  // Outstanding Receivables
  const [outstandingReceivables, setOutstandingReceivables] = useState<{
    total_amount: number;
    count: number;
  } | null>(null);
  const [receivablesLoading, setReceivablesLoading] = useState(false);

  // Top Selling Items
  const [topSellingItems, setTopSellingItems] = useState<any[]>([]);
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

  const renderHeader = () => {
    const formattedDate = currentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return (
      <View style={styles.headerSection}>
        <View style={[styles.headerCard, {backgroundColor: colors.card}]}>
          <View style={styles.headerMain}>
            <View style={styles.welcomeContainer}>
              <Text style={[styles.welcomeText, {color: colors.textSecondary}]}>
                Welcome back
              </Text>
              <Text style={[styles.nameText, {color: colors.textPrimary}]}>
                {isAuthLoading ? 'Loading...' : auth.username || 'User'}
              </Text>
              <View style={styles.roleContainer}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {isAuthLoading
                      ? 'Loading...'
                      : getRoleDisplayName(auth.authority || [])}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.quickInfo}>
              <Text style={[styles.dateText, {color: colors.textSecondary}]}>
                {formattedDate}
              </Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Store Open</Text>
              </View>
            </View>
          </View>
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
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
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
        {/* Main Sales Card */}
        <View style={[styles.mainStatsCard, {backgroundColor: colors.card}]}>
          <View style={styles.salesHeader}>
            <View>
              <Text style={styles.salesLabel}>Today's Revenue</Text>
              <Text style={styles.salesAmount}>
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
          <Text style={styles.comparedText}>Compared to yesterday</Text>
        </View>

        {/* Secondary Stats Row */}
          <View style={styles.secondaryStatsContainer}>
          {/* Orders Today */}
          <View style={[styles.statCard, {backgroundColor: colors.card}]}>
            <View style={styles.statHeader}>
              <Image
                source={icons.cart}
                style={[styles.statIcon, {tintColor: COLORS.primary}]}
              />
              <Text style={styles.statValue}>{kpiMetrics.today_orders}</Text>
            </View>
            <Text style={styles.statItemLabel}>Orders Today</Text>
          </View>

          {/* Products Sold */}
          <View style={[styles.statCard, {backgroundColor: colors.card}]}>
            <View style={styles.statHeader}>
              <Image
                source={icons.product}
                style={[styles.statIcon, {tintColor: COLORS.success}]}
              />
              <Text style={styles.statValue}>
                {kpiMetrics.today_products_sold}
              </Text>
            </View>
            <Text style={styles.statItemLabel}>Products Sold</Text>
            {kpiMetrics.total_products > 0 && (
              <View style={styles.progressBar}>
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

        {/* Outstanding Receivables Alert */}
        {canViewReceivables &&
          outstandingReceivables &&
          outstandingReceivables.total_amount > 0 && (
            <TouchableOpacity
              style={[styles.alertCard, {borderLeftColor: COLORS.warning}]}
              onPress={() => navigation.navigate('Payments' as never)}>
              <View style={styles.alertContent}>
                <Image
                  source={icons.wallet}
                  style={[styles.alertIcon, {tintColor: COLORS.warning}]}
                />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>Outstanding Receivables</Text>
                  <Text style={styles.alertText}>
                    {formatCurrency(outstandingReceivables.total_amount)} from{' '}
                    {outstandingReceivables.count} customer
                    {outstandingReceivables.count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.alertArrow}>→</Text>
              </View>
            </TouchableOpacity>
          )}

        {/* Low Stock Alert */}
        {canViewItems && lowStockItems.length > 0 && (
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => navigation.navigate('Items' as never)}>
            <View style={styles.alertContent}>
              <Image
                source={icons.notification}
                style={[styles.alertIcon, {tintColor: COLORS.error}]}
              />
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>Low Stock Alert</Text>
                <Text style={styles.alertText}>
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}{' '}
                  need attention
                </Text>
              </View>
              <Text style={styles.alertArrow}>→</Text>
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
          <Text style={styles.sectionTitle}>Draft Sales</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        </View>
      );
    }

    if (draftSales.length === 0) {
      return null;
    }

    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Draft Sales</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Cart' as never)}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentTransactions}>
          {draftSales.slice(0, 3).map((draft: any) => (
            <TouchableOpacity
              key={draft.id}
              style={styles.transactionItem}
              onPress={() => navigation.navigate('Cart' as never)}>
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.transactionIconContainer,
                    {backgroundColor: COLORS.warning + '15'},
                  ]}>
                  <Image
                    source={icons.cart}
                    style={[styles.transactionIcon, {tintColor: COLORS.warning}]}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionNumber}>
                    {draft.invoice_no || `Draft #${draft.id}`}
                  </Text>
                  <Text style={styles.transactionCustomer}>
                    {draft.customer_name || 'Draft Sale'}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, {color: COLORS.warning}]}>
                  {formatCurrency(draft.total_amount || 0)}
                </Text>
                <Text style={styles.transactionTime}>
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
          <Text style={styles.sectionTitle}>Top Selling Items Today</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Items' as never)}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentTransactions}>
          {topSellingItems.map((item: any, index: number) => (
            <View key={item.item_no || index} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.transactionIconContainer,
                    {backgroundColor: COLORS.success + '15'},
                  ]}>
                  <Text style={[styles.rankBadge, {color: COLORS.success}]}>
                    #{index + 1}
                  </Text>
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionNumber}>{item.name}</Text>
                  <Text style={styles.transactionCustomer}>
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

    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SalesHistory' as never)}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {transactionsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : recentTransactions.length > 0 ? (
          <View style={styles.recentTransactions}>
            <FlatList
              data={recentTransactions.slice(0, 5)}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.transactionItem}
                  onPress={() => {
                    // Navigate to sales history
                    navigation.navigate('SalesHistory' as never);
                  }}>
                  <View style={styles.transactionLeft}>
                    <View style={styles.transactionIconContainer}>
                      <Image
                        source={icons.cart}
                        style={[styles.transactionIcon, {tintColor: COLORS.primary}]}
                      />
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionNumber}>
                        {item.customer_invoice_no || `#${item.id}`}
                      </Text>
                      <Text style={styles.transactionCustomer}>
                        {item.customer?.name || 'Walk-in Customer'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={styles.transactionAmount}>
                      {formatCurrency(item.total_amount || 0)}
                    </Text>
                    <Text style={styles.transactionTime}>
                      {formatDate(item.created_at)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : (
          <View style={styles.recentTransactions}>
            <Text style={styles.placeholderText}>No recent transactions</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.screenMuted}]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
        {renderHeader()}
        {renderQuickStats()}

        <View style={styles.mainContent}>
          <Options />
        </View>

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
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: 4,
  },
  nameText: {
    ...FONTS.h2,
    color: COLORS.darkGray,
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  quickInfo: {
    alignItems: 'flex-end',
  },
  dateText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
  mainContent: {
    padding: 16,
  },
  statsSection: {
    padding: 16,
    gap: 16,
  },
  mainStatsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  salesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  salesLabel: {
    fontSize: 14,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  salesAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  comparedText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
  },
  secondaryStatsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
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
    color: COLORS.darkGray,
  },
  statItemLabel: {
    fontSize: 13,
    color: COLORS.gray,
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
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderLeftWidth: 4,
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
    color: COLORS.darkGray,
    marginBottom: 2,
  },
  alertText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  alertArrow: {
    fontSize: 18,
    color: COLORS.gray,
  },
  recentSection: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.darkGray,
  },
  seeAllText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '500',
  },
  recentTransactions: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    color: COLORS.darkGray,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionCustomer: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionTime: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  placeholderText: {
    ...FONTS.body4,
    color: COLORS.gray,
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
    color: COLORS.gray,
    marginTop: 8,
  },
  rankBadge: {
    ...FONTS.h3,
    fontWeight: '700',
    fontSize: 14,
  },
});
