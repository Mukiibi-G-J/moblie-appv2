import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {COLORS} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {
  fetchDashboardReport,
  fetchRoleCentreBreakdowns,
  exportDashboardReportPdf,
  type DashboardReportStatement,
  type RoleCentreBreakdown,
} from '../services/dashboardReport.service';
import {savePdfBase64AndShare} from '../utils/reportPdfDownload';

type Preset = 'this_month' | 'last_month' | 'this_year' | 'custom';

const PRESETS: {id: Preset; label: string}[] = [
  {id: 'this_month', label: 'This month'},
  {id: 'last_month', label: 'Last month'},
  {id: 'this_year', label: 'This year'},
  {id: 'custom', label: 'Custom'},
];

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function rangeForPreset(preset: Preset, customStart: string, customEnd: string) {
  const now = new Date();
  if (preset === 'last_month') {
    return {
      startDate: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      endDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (preset === 'this_year') {
    return {
      startDate: isoDate(new Date(now.getFullYear(), 0, 1)),
      endDate: isoDate(new Date(now.getFullYear(), 11, 31)),
    };
  }
  if (preset === 'custom') {
    return {startDate: customStart, endDate: customEnd};
  }
  return {
    startDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

type Props = {
  pageId: number | null;
  refreshKey?: number;
};

export default function SalesCategoryHomeReport({pageId, refreshKey = 0}: Props) {
  const {colors, isDark} = useTheme();
  const [sections, setSections] = useState<RoleCentreBreakdown[]>([]);
  const [preset, setPreset] = useState<Preset>('this_month');
  const initial = rangeForPreset('this_month', '', '');
  const [customStart, setCustomStart] = useState(initial.startDate);
  const [customEnd, setCustomEnd] = useState(initial.endDate);
  const [statement, setStatement] = useState<DashboardReportStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const dates = useMemo(
    () => rangeForPreset(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );
  const section = sections[0];
  const code = section?.WidgetCode || '';

  useEffect(() => {
    if (!pageId) {
      setSections([]);
      return;
    }
    let cancelled = false;
    fetchRoleCentreBreakdowns(pageId)
      .then(next => {
        if (!cancelled) setSections(next);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, refreshKey]);

  useEffect(() => {
    if (!code || !dates.startDate || !dates.endDate || dates.startDate > dates.endDate) {
      setStatement(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDashboardReport(code, dates.startDate, dates.endDate)
      .then(next => {
        if (!cancelled) setStatement(next);
      })
      .catch(() => {
        if (!cancelled) setStatement(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, dates.startDate, dates.endDate, refreshKey]);

  const onSharePdf = useCallback(async () => {
    if (!code || sharing) return;
    setSharing(true);
    try {
      const file = await exportDashboardReportPdf(
        code,
        dates.startDate,
        dates.endDate,
      );
      const baseName = file.fileName.replace(/\.pdf$/i, '') || 'sales-by-category';
      await savePdfBase64AndShare(file.base64, baseName);
      Toast.show({
        type: 'success',
        text1: 'PDF ready',
        text2: 'Use the share sheet to save or send.',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not create the PDF',
      });
    } finally {
      setSharing(false);
    }
  }, [code, dates.endDate, dates.startDate, sharing]);

  if (!section) return null;

  const rows = statement?.Rows ?? [];
  const cardBg = isDark ? colors.card : '#fff';

  return (
    <View style={styles.block}>
      <Text style={[styles.eyebrow, {color: colors.textPrimary}]}>
        {section.Caption || 'Sales by category'}
      </Text>
      <View style={[styles.card, {backgroundColor: cardBg, borderColor: colors.border}]}>
        <View collapsable={false} style={styles.chips}>
          {PRESETS.map(item => {
            const selected = preset === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setPreset(item.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? COLORS.primary : 'transparent',
                    borderColor: selected ? COLORS.primary : colors.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    {color: selected ? '#fff' : colors.textSecondary},
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {preset === 'custom' ? (
          <View collapsable={false} style={styles.dates}>
            <TextInput
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={[styles.dateInput, {color: colors.textPrimary, borderColor: colors.border}]}
            />
            <TextInput
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={[styles.dateInput, {color: colors.textPrimary, borderColor: colors.border}]}
            />
          </View>
        ) : (
          <View collapsable={false} style={styles.periodRow}>
            <Text style={[styles.period, {color: colors.textSecondary}]}>
              {dates.startDate} – {dates.endDate}
            </Text>
          </View>
        )}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : rows.length === 0 ? (
          <Text style={[styles.empty, {color: colors.textSecondary}]}>
            No posted sales in this period.
          </Text>
        ) : (
          rows.map(row => (
            <View key={row.Label} style={[styles.row, {borderBottomColor: colors.border}]}>
              <Text style={[styles.label, {color: colors.textPrimary}]} numberOfLines={1}>
                {row.Label}
              </Text>
              <Text style={[styles.amount, {color: colors.textPrimary}]}>
                {row.FormattedAmount}
              </Text>
              <Text style={[styles.share, {color: colors.textSecondary}]}>
                {(row.Share ?? 0).toFixed(1)}%
              </Text>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, {color: colors.textPrimary}]}>Total</Text>
          <Text style={[styles.amount, {color: colors.textPrimary}]}>
            {statement?.TotalFormatted || '—'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onSharePdf}
          disabled={sharing || !statement}
          style={[styles.pdfButton, {opacity: sharing || !statement ? 0.5 : 1}]}>
          <Text style={styles.pdfText}>{sharing ? 'Preparing PDF…' : 'Share PDF'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {marginBottom: 0},
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dates: {flexDirection: 'row', gap: 8, marginBottom: 12},
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  periodRow: {
    marginBottom: 12,
  },
  period: {
    fontSize: 13,
  },
  loader: {marginVertical: 16},
  empty: {marginVertical: 16, fontSize: 13},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 8,
  },
  label: {flex: 1, fontSize: 14},
  amount: {fontSize: 14, fontVariant: ['tabular-nums']},
  share: {width: 52, textAlign: 'right', fontSize: 12},
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  totalLabel: {fontSize: 14, fontWeight: '700'},
  pdfButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  pdfText: {color: '#fff', fontWeight: '700', fontSize: 14},
});
