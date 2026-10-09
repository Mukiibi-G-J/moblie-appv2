import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, FONTS} from '../../constants';
import {
  fetchSalesByCategory,
  SalesCategoryStatement,
} from '../../services/app.services';

type PeriodId = 'this_month' | 'this_month_to_date' | 'this_year';

const PERIODS: {id: PeriodId; label: string}[] = [
  {id: 'this_month', label: 'This Month'},
  {id: 'this_month_to_date', label: 'To Date'},
  {id: 'this_year', label: 'This Year'},
];

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function rangeFor(period: PeriodId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  if (period === 'this_year') {
    return {startDate: isoDate(new Date(year, 0, 1)), endDate: isoDate(new Date(year, 11, 31))};
  }
  if (period === 'this_month_to_date') {
    return {startDate: isoDate(new Date(year, month, 1)), endDate: isoDate(today)};
  }
  return {
    startDate: isoDate(new Date(year, month, 1)),
    endDate: isoDate(new Date(year, month + 1, 0)),
  };
}

export default function SalesByCategory() {
  const [period, setPeriod] = useState<PeriodId>('this_month');
  const [statement, setStatement] = useState<SalesCategoryStatement | null>(null);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const {startDate, endDate} = rangeFor(period);
    setLoading(true);
    setError('');
    fetchSalesByCategory(startDate, endDate)
      .then(next => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setVisible(false);
          setStatement(null);
          return;
        }
        setVisible(true);
        setStatement(next);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load sales by category.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.company} numberOfLines={1}>
          {statement?.CompanyName || 'Sales by Sales Category'}
        </Text>
        <Text style={styles.title}>
          {statement?.Title || 'Sales by Sales Category'}
        </Text>
        {statement ? (
          <Text style={styles.range}>
            {statement.StartDate} → {statement.EndDate}
          </Text>
        ) : null}

        <View style={styles.periods}>
          {PERIODS.map(item => {
            const selected = item.id === period;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.periodChip, selected && styles.periodChipOn]}
                onPress={() => setPeriod(item.id)}
                activeOpacity={0.7}>
                <Text style={[styles.periodText, selected && styles.periodTextOn]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : !statement?.Rows?.length ? (
          <Text style={styles.empty}>No posted sales in this period.</Text>
        ) : (
          <View>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.labelCol]}>Sales category</Text>
              <Text style={[styles.head, styles.amountCol]}>Amount</Text>
              <Text style={[styles.head, styles.shareCol]}>% of sales</Text>
            </View>
            {statement.Rows.map(row => (
              <View key={row.Label} style={styles.row}>
                <Text style={[styles.label, styles.labelCol]} numberOfLines={2}>
                  {row.Label}
                </Text>
                <Text style={[styles.amount, styles.amountCol]}>
                  {row.FormattedAmount}
                </Text>
                <Text style={[styles.share, styles.shareCol]}>
                  {Math.round(row.Share)}%
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, {width: `${Math.min(row.Share, 100)}%`}]} />
                </View>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{statement.TotalFormatted}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  company: {
    ...FONTS.body4,
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.darkGray,
    marginTop: 4,
  },
  range: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 2,
  },
  periods: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
  },
  periodChip: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  periodChipOn: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    ...FONTS.body5,
    color: COLORS.darkGray,
  },
  periodTextOn: {
    color: COLORS.white,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  empty: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    marginVertical: 16,
  },
  headRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  head: {
    ...FONTS.body5,
    color: COLORS.gray,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  labelCol: {flex: 1.4},
  amountCol: {flex: 1.2, textAlign: 'right'},
  shareCol: {width: 64, textAlign: 'right'},
  label: {
    ...FONTS.body4,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  amount: {
    ...FONTS.body4,
    color: COLORS.darkGray,
  },
  share: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  barTrack: {
    height: 4,
    width: '100%',
    marginTop: 6,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
  },
  totalLabel: {
    ...FONTS.h4,
    color: COLORS.darkGray,
  },
  totalAmount: {
    ...FONTS.h4,
    color: COLORS.darkGray,
  },
});
