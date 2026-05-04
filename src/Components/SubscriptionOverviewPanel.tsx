import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {CompanyOverview} from '../services/SubscriptionService';
import {useTheme} from '../context/ThemeContext';
import {COLORS} from '../constants';

function formatOverviewDate(iso?: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

/**
 * Subscription / starter-pack status from GET /api/company/overview/
 * (same data as the web Company page).
 */
export function SubscriptionOverviewPanel({
  overview,
}: {
  overview: CompanyOverview;
}) {
  const {colors} = useTheme();
  const sp = overview.starter_pack ?? {has_starter_pack: false};
  const sub = overview.subscription ?? null;
  const hasStarter = sp.has_starter_pack;
  /** Starter "days" UI: only the free-period card (not starter-order subscription dates, which can disagree with the main Plan). */
  const starterShowsDays = hasStarter && sp.free_period_active;

  if (!hasStarter && !sub) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
          Subscription
        </Text>
        <Text style={[styles.emptyHint, {color: colors.textSecondary}]}>
          {sp?.message?.trim() ||
            'Choose a plan in Add-ons when you are ready to subscribe.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
        Subscription
      </Text>

      {hasStarter && sp.free_period_active && (
        <View style={styles.greenBox}>
          <Text style={styles.greenTitle}>Free period active</Text>
          <View style={styles.daysRow}>
            <View style={styles.daysRowText}>
              <Text style={styles.greenSubtitle}>
                {sp.free_period_days_remaining ?? 0} days remaining
              </Text>
              {sp.free_period_end_date ? (
                <Text style={styles.greenHint}>
                  Ends: {formatOverviewDate(sp.free_period_end_date)}
                </Text>
              ) : null}
            </View>
            <View style={styles.daysBadge}>
              <Text style={styles.daysBadgeNum}>
                {sp.free_period_days_remaining ?? 0}
              </Text>
              <Text style={styles.daysBadgeLbl}>days left</Text>
            </View>
          </View>
          {sp.offer_name ? (
            <Text style={styles.offerName}>{sp.offer_name}</Text>
          ) : null}
        </View>
      )}

      {sub ? (
        <View
          style={[
            styles.planCard,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <Text style={[styles.planTitle, {color: colors.textSecondary}]}>
            Plan
          </Text>
          <Text style={[styles.planName, {color: colors.textPrimary}]}>
            {sub.plan}
          </Text>
          <View style={styles.planGrid}>
            <View style={styles.planCell}>
              <Text style={[styles.planLbl, {color: colors.textSecondary}]}>
                Status
              </Text>
              <Text style={[styles.planVal, {color: colors.textPrimary}]}>
                {sub.status}
              </Text>
            </View>
            <View style={styles.planCell}>
              <Text style={[styles.planLbl, {color: colors.textSecondary}]}>
                Billing
              </Text>
              <Text style={[styles.planVal, {color: colors.textPrimary}]}>
                {sub.billing_cycle}
              </Text>
            </View>
            <View style={styles.planCell}>
              <Text style={[styles.planLbl, {color: colors.textSecondary}]}>
                Next payment / end
              </Text>
              <Text style={[styles.planVal, {color: colors.textPrimary}]}>
                {formatOverviewDate(sub.subscription_end_date) || '—'}
              </Text>
            </View>
            <View style={styles.planCell}>
              <Text style={[styles.planLbl, {color: colors.textSecondary}]}>
                Days remaining
              </Text>
              <Text style={[styles.planVal, styles.planDays, {color: COLORS.primary}]}>
                {sub.days_remaining}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasStarter && !starterShowsDays && !sub ? (
        <View
          style={[
            styles.planCard,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <Text style={[styles.planTitle, {color: colors.textSecondary}]}>
            Starter pack
          </Text>
          <Text style={[styles.planName, {color: colors.textPrimary}]}>
            {sp.offer_name || 'Starter offer'}
          </Text>
          {sp.order_status ? (
            <Text style={[styles.starterStatus, {color: colors.textSecondary}]}>
              Status: {sp.order_status}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginTop: 8, marginBottom: 4},
  emptyHint: {fontSize: 14, lineHeight: 20},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  greenBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  greenTitle: {fontSize: 15, fontWeight: '700', color: '#065F46', marginBottom: 8},
  greenSubtitle: {fontSize: 14, color: '#047857', fontWeight: '600'},
  greenHint: {fontSize: 12, color: '#059669', marginTop: 4},
  blueBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  blueTitle: {fontSize: 15, fontWeight: '700', color: '#1E40AF', marginBottom: 8},
  blueSubtitle: {fontSize: 14, color: '#1D4ED8', fontWeight: '600'},
  blueHint: {fontSize: 12, color: '#2563EB', marginTop: 4},
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysRowText: {flex: 1, paddingRight: 12},
  daysBadge: {alignItems: 'center'},
  daysBadgeNum: {fontSize: 28, fontWeight: '800', color: '#059669'},
  daysBadgeLbl: {fontSize: 11, color: '#059669', fontWeight: '600'},
  offerName: {fontSize: 12, color: '#047857', marginTop: 8, fontWeight: '500'},
  planCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  planTitle: {fontSize: 12, fontWeight: '600', marginBottom: 4},
  planName: {fontSize: 17, fontWeight: '700', marginBottom: 12},
  planGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  planCell: {width: '47%', minWidth: 120},
  planLbl: {fontSize: 11, marginBottom: 2},
  planVal: {fontSize: 14, fontWeight: '600'},
  planDays: {fontSize: 20, fontWeight: '800'},
  starterStatus: {fontSize: 13, marginTop: 4},
});
