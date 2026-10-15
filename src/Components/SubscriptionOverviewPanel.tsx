import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {CompanyOverview} from '../services/SubscriptionService';
import {useTheme} from '../context/ThemeContext';
import {COLORS, ICON_BUTTON_ACTIVE_OPACITY} from '../constants';

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
  const navigation = useNavigation<any>();
  const {colors} = useTheme();
  const sp = overview.starter_pack ?? {has_starter_pack: false};
  const sub = overview.subscription ?? null;
  const hasStarter = sp.has_starter_pack;
  /** Starter "days" UI: only the free-period card (not starter-order subscription dates, which can disagree with the main Plan). */
  const starterShowsDays = hasStarter && sp.free_period_active;

  const subscriptionInGrace = sub?.in_grace_period === true;
  const subscriptionLastDayOfPeriod = Boolean(
    sub && sub.is_active && !subscriptionInGrace && sub.days_remaining === 0,
  );

  const openRenewal = () => {
    navigation.navigate('Subscription', {fromBillingRenewal: true});
  };

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

  const statusPrimary = !sub
    ? ''
    : !sub.is_active
      ? 'No Plan'
      : subscriptionInGrace
        ? `Grace: ${sub.grace_days_remaining ?? 0} day(s) left`
        : sub.days_remaining > 0
          ? `${sub.days_remaining} days in period`
          : 'Period ends today — pay soon';

  const statusSecondary = subscriptionInGrace
    ? 'Payment overdue — renew in Billing'
    : subscriptionLastDayOfPeriod
      ? 'Payment due tomorrow — open Billing'
      : 'Subscription';

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

      {subscriptionInGrace ? (
        <View style={styles.graceAlert} accessibilityRole="alert">
          <Text style={styles.graceAlertTitle}>
            Payment required — pending renewal (grace period)
          </Text>
          <Text style={styles.graceAlertBody}>
            Your billing period has ended and payment is overdue. You still have
            full access during the grace window. Pay now to keep Zentro active —
            access will be limited after{' '}
            {sub?.access_lock_date
              ? formatOverviewDate(sub.access_lock_date)
              : 'the grace period ends'}
            .
          </Text>
          <TouchableOpacity
            style={styles.gracePayBtn}
            onPress={openRenewal}
            activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
            <Text style={styles.payBtnText}>Pay now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {subscriptionLastDayOfPeriod ? (
        <View style={styles.lastDayAlert} accessibilityRole="alert">
          <Text style={styles.lastDayAlertTitle}>
            Last day of your billing period
          </Text>
          <Text style={styles.lastDayAlertBody}>
            Payment is due{' '}
            <Text style={styles.lastDayDueDate}>
              {sub?.payment_due_date
                ? formatOverviewDate(sub.payment_due_date)
                : 'tomorrow'}
            </Text>
            . Pay today to stay ahead — after that, you enter the grace period
            until access is restricted.
          </Text>
          <TouchableOpacity
            style={styles.lastDayPayBtn}
            onPress={openRenewal}
            activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
            <Text style={styles.payBtnText}>Pay now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {sub ? (
        <View
          style={[
            styles.planCard,
            {backgroundColor: colors.card, borderColor: colors.border},
            subscriptionInGrace && styles.planCardGrace,
            subscriptionLastDayOfPeriod && styles.planCardLastDay,
          ]}>
          {(subscriptionInGrace || subscriptionLastDayOfPeriod) && (
            <Text
              style={[
                styles.actionNeeded,
                subscriptionInGrace
                  ? styles.actionNeededGrace
                  : styles.actionNeededLastDay,
              ]}>
              {subscriptionInGrace
                ? '● Action needed: payment is overdue during grace.'
                : '● Heads up: period ends today — pay before the due date.'}
            </Text>
          )}
          <Text style={[styles.planTitle, {color: colors.textSecondary}]}>
            Plan
          </Text>
          <Text style={[styles.planName, {color: colors.textPrimary}]}>
            {sub.plan}
          </Text>
          <View
            style={[
              styles.statusSummary,
              subscriptionInGrace
                ? styles.statusSummaryGrace
                : subscriptionLastDayOfPeriod
                  ? styles.statusSummaryLastDay
                  : {backgroundColor: colors.screenMuted},
            ]}>
            <Text
              style={[
                styles.statusPrimary,
                subscriptionInGrace
                  ? styles.statusPrimaryGrace
                  : subscriptionLastDayOfPeriod
                    ? styles.statusPrimaryLastDay
                    : {color: colors.textPrimary},
              ]}>
              {statusPrimary}
            </Text>
            <Text
              style={[
                styles.statusSecondary,
                subscriptionInGrace
                  ? styles.statusSecondaryGrace
                  : subscriptionLastDayOfPeriod
                    ? styles.statusSecondaryLastDay
                    : {color: colors.textSecondary},
              ]}>
              {statusSecondary}
            </Text>
          </View>
          <View style={styles.planGrid}>
            <View style={styles.planCell}>
              <Text style={[styles.planLbl, {color: colors.textSecondary}]}>
                Status
              </Text>
              {subscriptionInGrace ? (
                <View style={styles.badgeGrace}>
                  <Text style={styles.badgeText}>
                    Grace period — payment overdue
                  </Text>
                </View>
              ) : subscriptionLastDayOfPeriod ? (
                <View style={styles.badgeLastDay}>
                  <Text style={styles.badgeText}>Active — pay by tomorrow</Text>
                </View>
              ) : (
                <Text style={[styles.planVal, {color: colors.textPrimary}]}>
                  {sub.status}
                </Text>
              )}
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
                {subscriptionInGrace ? 'Payment due' : 'Next payment / end'}
              </Text>
              <Text
                style={[
                  styles.planVal,
                  {
                    color: subscriptionInGrace
                      ? '#991B1B'
                      : subscriptionLastDayOfPeriod
                        ? '#92400E'
                        : colors.textPrimary,
                  },
                ]}>
                {formatOverviewDate(
                  subscriptionInGrace
                    ? sub.payment_due_date || sub.subscription_end_date
                    : sub.subscription_end_date,
                ) || '—'}
              </Text>
            </View>
            <View style={styles.planCell}>
              <Text style={[styles.planLbl, {color: colors.textSecondary}]}>
                {subscriptionInGrace
                  ? 'Grace period — full access days left'
                  : 'Days left in current period'}
              </Text>
              <Text
                style={[
                  styles.planVal,
                  styles.planDays,
                  {
                    color: subscriptionInGrace
                      ? '#991B1B'
                      : subscriptionLastDayOfPeriod
                        ? '#92400E'
                        : COLORS.primary,
                  },
                ]}>
                {subscriptionInGrace
                  ? sub.grace_days_remaining ?? 0
                  : sub.days_remaining === 0
                    ? 'Period ends today'
                    : sub.days_remaining}
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
  graceAlert: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    padding: 14,
    marginBottom: 10,
  },
  graceAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7F1D1D',
    marginBottom: 8,
  },
  graceAlertBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#991B1B',
    fontWeight: '500',
  },
  gracePayBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lastDayAlert: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    padding: 14,
    marginBottom: 10,
  },
  lastDayAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#78350F',
    marginBottom: 8,
  },
  lastDayAlertBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
    fontWeight: '500',
  },
  lastDayDueDate: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  lastDayPayBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  payBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  planCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  planCardGrace: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  planCardLastDay: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  actionNeeded: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  actionNeededGrace: {color: '#991B1B'},
  actionNeededLastDay: {color: '#78350F'},
  statusSummary: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  statusSummaryGrace: {backgroundColor: '#FEE2E2'},
  statusSummaryLastDay: {backgroundColor: '#FEF3C7'},
  statusPrimary: {fontSize: 16, fontWeight: '800', marginBottom: 2},
  statusPrimaryGrace: {color: '#B91C1C'},
  statusPrimaryLastDay: {color: '#92400E'},
  statusSecondary: {fontSize: 13, fontWeight: '600'},
  statusSecondaryGrace: {color: '#991B1B'},
  statusSecondaryLastDay: {color: '#78350F'},
  badgeGrace: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeLastDay: {
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
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
