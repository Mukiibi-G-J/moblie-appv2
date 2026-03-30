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
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {
  fetchBalanceSheetReport,
  fetchProfitLossStatement,
} from '../../services/app.services';

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

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

const getToday = () => new Date().toISOString().split('T')[0];

const ReportStatementScreen: React.FC<Props> = ({reportType}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profitLossData, setProfitLossData] = useState<ProfitLossResponse | null>(
    null,
  );
  const [balanceSheetData, setBalanceSheetData] =
    useState<BalanceSheetResponse | null>(null);

  const pageMeta = useMemo(() => {
    if (reportType === 'profit-loss') {
      return {
        title: 'Profit & Loss',
        subtitle: 'Revenue, expenses, and net income for the current month.',
      };
    }

    return {
      title: 'Balance Sheet',
      subtitle: 'Assets, liabilities, and equity as of today.',
    };
  }, [reportType]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (reportType === 'profit-loss') {
        const range = getMonthRange();
        const response = await fetchProfitLossStatement(range);
        setProfitLossData(response);
        setBalanceSheetData(null);
      } else {
        const response = await fetchBalanceSheetReport(getToday());
        setBalanceSheetData(response);
        setProfitLossData(null);
      }
    } catch (fetchError: any) {
      setError(
        fetchError?.response?.data?.detail ||
          fetchError?.message ||
          'Unable to load this report right now.',
      );
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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
            Loading {pageMeta.title.toLowerCase()}...
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
            {pageMeta.title}
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textSecondary}]}>
            {pageMeta.subtitle}
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadReport}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {renderBody()}
      </ScrollView>
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
  refreshButton: {
    backgroundColor: COLORS.primary2,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    ...FONTS.body5,
    color: COLORS.white,
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
