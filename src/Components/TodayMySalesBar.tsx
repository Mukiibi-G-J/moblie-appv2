import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {formatCurrencyCompact} from '../utils/currency';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {COLORS, FONTS, SIZES} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {
  fetchTodayMySalesForUser,
  SalesUserSummaryRow,
} from '../services/app.services';

type TodayMySalesBarProps = {
  userId: number | null | undefined;
  /** When true, stacks label above actions (home section). */
  variant?: 'inline' | 'card';
  /**
   * Compact toolbar controls (no outer padding) — matches web POS sales strip.
   * Parent owns horizontal spacing.
   */
  compact?: boolean;
  onOpenHistory?: () => void;
  refreshKey?: number;
};

const TodayMySalesBar: React.FC<TodayMySalesBarProps> = ({
  userId,
  variant = 'inline',
  compact = false,
  onOpenHistory,
  refreshKey = 0,
}) => {
  const {colors, isDark} = useTheme();
  const [showAmount, setShowAmount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SalesUserSummaryRow | null>(null);

  const uid = useMemo(() => {
    const parsed = Number.parseInt(String(userId ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [userId]);

  const load = useCallback(async () => {
    if (uid == null) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const mine = await fetchTodayMySalesForUser(uid);
      setSummary(mine);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const themed = useMemo(
    () => ({
      card: {
        backgroundColor: isDark ? 'rgba(0, 184, 148, 0.12)' : 'rgba(0, 184, 148, 0.08)',
        borderColor: isDark ? 'rgba(0, 184, 148, 0.35)' : 'rgba(0, 184, 148, 0.25)',
      },
      toggleBtn: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      toggleText: {color: colors.textSecondary},
      amountWrap: {
        backgroundColor: isDark ? 'rgba(0, 184, 148, 0.16)' : 'rgba(0, 184, 148, 0.1)',
        borderColor: isDark ? 'rgba(0, 184, 148, 0.35)' : 'rgba(0, 184, 148, 0.25)',
      },
      amountLabel: {color: isDark ? '#6ee7b7' : '#047857'},
      amountValue: {color: colors.textPrimary},
      meta: {color: colors.textSecondary},
      sectionTitle: {color: colors.textPrimary},
    }),
    [colors, isDark],
  );

  if (uid == null) {
    return null;
  }

  const amountText = !showAmount
    ? 'Hidden'
    : loading
      ? 'Loading…'
      : formatCurrencyCompact(summary?.total_sales ?? 0);

  const invoiceCount = summary?.total_invoices ?? 0;

  if (variant === 'card') {
    return (
      <View style={[styles.cardRoot, themed.card]}>
        <Text style={[styles.cardTitle, themed.sectionTitle]}>My sales today</Text>
        <Text style={[styles.cardAmount, themed.amountValue]}>{amountText}</Text>
        {showAmount && !loading ? (
          <Text style={[styles.cardMeta, themed.meta]}>
            {invoiceCount} invoice{invoiceCount === 1 ? '' : 's'} posted today
          </Text>
        ) : null}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.toggleButton, themed.toggleBtn]}
            onPress={() => setShowAmount(prev => !prev)}
            activeOpacity={0.8}>
            <Text style={[styles.toggleButtonText, themed.toggleText]}>
              {showAmount ? 'Hide amount' : 'Show amount'}
            </Text>
          </TouchableOpacity>
          {onOpenHistory ? (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={onOpenHistory}
              activeOpacity={0.8}>
              <Text style={styles.historyButtonText}>Sales history</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.inlineRoot, compact && styles.inlineRootCompact]}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          compact && styles.toggleButtonCompact,
          themed.toggleBtn,
        ]}
        onPress={() => setShowAmount(prev => !prev)}
        activeOpacity={0.8}>
        <Text style={[styles.toggleButtonText, themed.toggleText]}>
          {showAmount ? 'Hide my sales' : 'Show my sales'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.amountButton,
          compact && styles.amountButtonCompact,
          themed.amountWrap,
        ]}
        onPress={onOpenHistory}
        disabled={!onOpenHistory}
        activeOpacity={onOpenHistory ? 0.8 : 1}>
        {loading && showAmount ? (
          <ActivityIndicator size="small" color={COLORS.primary2} />
        ) : (
          <Text style={[styles.amountButtonText, themed.amountLabel]}>
            Today my sales:{' '}
            <Text style={[styles.amountButtonValue, themed.amountValue]}>
              {amountText}
            </Text>
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inlineRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: SIZES.padding,
    paddingBottom: 8,
  },
  inlineRootCompact: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    flexShrink: 1,
  },
  cardRoot: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    ...FONTS.h4,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardAmount: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMeta: {
    ...FONTS.body4,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleButton: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleButtonText: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  amountButton: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  amountButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    flexShrink: 1,
  },
  amountButtonText: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  amountButtonValue: {
    fontWeight: '700',
  },
  historyButton: {
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  historyButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default TodayMySalesBar;
