import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import axios from 'axios';
import {
  BillingCycle,
  CollectionMethod,
  getCollectionStatus,
  getCurrentSubscription,
  getPricingPlans,
  initiateSubscriptionCollection,
  normalizeUgPhone,
  PricingPlan,
} from '../../services/SubscriptionService';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
} from '../../constants';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext, useAuth} from '../../context/Store';
import {usePermissions} from '../../hooks/usePermissions';
import {safeGoBack} from '../../hooks/NavigationService';
import type {SubscriptionExpiryKind} from '../../utils/subscriptionExpired';
import {USE_TEST_ENV} from '../../config/api.config';
import {
  formatSubscriptionPrice,
  SUBSCRIPTION_UGX_PER_USD,
  type SubscriptionDisplayCurrency,
} from '../../utils/subscriptionCurrency';

type Phase = 'form' | 'waiting' | 'success' | 'failed';

/** Map backend Subscription.plan labels to pricing-plan display names (web parity). */
function planToPricingName(plan: string | null | undefined): string | null {
  if (!plan) return null;
  const p = plan.trim();
  if (
    p === 'Starter' ||
    p === 'Free Trial' ||
    p === 'Standard Plan' ||
    p === 'Starter Pack'
  ) {
    return 'Starter';
  }
  if (p === 'Business' || p === 'Multi-Branch Plan') {
    return 'Business';
  }
  if (p === 'Pro' || p === 'Premium Plan with EFRIS') {
    return 'Pro';
  }
  return p;
}

function findPlanForSubscription(
  plans: PricingPlan[],
  subscriptionPlan?: string | null,
): PricingPlan | null {
  if (!plans.length) return null;
  const target = planToPricingName(subscriptionPlan);
  if (target) {
    const exact = plans.find(
      p => (p.name || '').trim().toLowerCase() === target.toLowerCase(),
    );
    if (exact) return exact;
    const partial = plans.find(p =>
      (p.name || '').toLowerCase().includes(target.toLowerCase()),
    );
    if (partial) return partial;
  }
  return null;
}

export default function SubscriptionPage() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const {logout} = useAppContext();
  const {auth} = useAuth();
  const {canManageCompany} = usePermissions();

  const fromExpiredModal = !!route.params?.fromExpiredModal;
  const fromBillingRenewal = !!route.params?.fromBillingRenewal;
  const expiryKind: SubscriptionExpiryKind =
    route.params?.expiryKind === 'trial' ? 'trial' : 'subscription';
  const lockDate: string | null = route.params?.lockDate ?? null;
  const isTrialExpiry = expiryKind === 'trial';

  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [displayCurrency, setDisplayCurrency] =
    useState<SubscriptionDisplayCurrency>('UGX');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<CollectionMethod>('mobile_money');
  const [phone, setPhone] = useState('');
  const [testAmountUgx, setTestAmountUgx] = useState(500);

  const [phase, setPhase] = useState<Phase>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [amountLabel, setAmountLabel] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState<string | null>(null);

  const [expiredModalVisible, setExpiredModalVisible] = useState(
    fromExpiredModal,
  );

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useMemo(
    () => ({
      screen: {backgroundColor: colors.background},
      topHeader: {backgroundColor: colors.background},
      headerBorder: {borderBottomColor: colors.border},
      headerRoundButton: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      headerRoundIcon: {tintColor: colors.textPrimary},
      topTitle: {color: colors.textPrimary},
      pageSubtitle: {color: colors.textSecondary},
      sectionTitle: {color: colors.textPrimary},
      toggleBtn: {
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      toggleBtnActive: {
        borderColor: COLORS.primary2,
        backgroundColor: colors.screenMuted,
      },
      toggleBtnText: {color: colors.textSecondary},
      toggleBtnTextActive: {color: COLORS.primary2},
      card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      cardSelected: {
        borderColor: COLORS.primary2,
        backgroundColor: colors.screenMuted,
      },
      cardTitle: {color: colors.textPrimary},
      cardPrice: {color: colors.textSecondary},
      emptyText: {color: colors.textSecondary},
      pickerWrap: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      picker: {
        backgroundColor: colors.card,
        color: colors.textPrimary,
      },
      footerTotal: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      footerTotalLabel: {color: colors.textSecondary},
      footerTotalValue: {color: colors.textPrimary},
      modalCard: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      modalTitle: {color: colors.textPrimary},
      modalText: {color: colors.textSecondary},
      input: {
        backgroundColor: colors.card,
        borderColor: colors.border,
        color: colors.textPrimary,
      },
      bodyText: {color: colors.textSecondary},
    }),
    [colors],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [plansResp, currentSub] = await Promise.all([
          getPricingPlans(),
          getCurrentSubscription(),
        ]);
        if (cancelled) return;

        setPlans(plansResp);

        const matched = findPlanForSubscription(plansResp, currentSub?.plan);
        if (matched) {
          setSelectedPlanId(matched.id);
        } else if (plansResp.length) {
          const popular = plansResp.find(p => p.is_popular) ?? plansResp[0];
          setSelectedPlanId(popular.id);
        }

        const cycle = (currentSub?.billing_cycle || '').toLowerCase();
        if (cycle === 'yearly' || cycle === 'annual') {
          setBillingCycle('yearly');
        } else if (cycle === 'monthly') {
          setBillingCycle('monthly');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setExpiredModalVisible(fromExpiredModal);
  }, [fromExpiredModal]);

  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) ?? null;
  }, [plans, selectedPlanId]);

  const totalAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    const unit =
      billingCycle === 'yearly'
        ? selectedPlan.yearly_price ??
          selectedPlan.annual_price ??
          selectedPlan.price ??
          0
        : selectedPlan.monthly_price ??
          selectedPlan.price ??
          selectedPlan.yearly_price ??
          0;
    return unit * months;
  }, [billingCycle, months, selectedPlan]);

  const finishSuccess = useCallback(() => {
    setPhase('success');
  }, []);

  useEffect(() => {
    if (phase !== 'waiting' || !reference) return;

    let cancelled = false;
    let consecutiveErrors = 0;

    const poll = async () => {
      try {
        const status = await getCollectionStatus(reference);
        if (cancelled) return;
        consecutiveErrors = 0;
        setAmountLabel(formatSubscriptionPrice(Number(status.amount), 'UGX'));
        setProductLabel(status.product);
        if (status.status === 'paid') {
          finishSuccess();
          return;
        }
        if (status.status === 'failed' || status.status === 'cancelled') {
          setPhase('failed');
          setError(
            status.failure_message ||
              'Payment was declined or failed. You can try again.',
          );
          return;
        }
        const marz = String(status.marz_status || '').toLowerCase();
        if (
          ['failed', 'error', 'declined', 'unsuccessful', 'rejected'].includes(
            marz,
          )
        ) {
          setPhase('failed');
          setError(
            status.failure_message ||
              'Payment was declined or failed. You can try again.',
          );
          return;
        }
      } catch {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 8) {
          setPhase('failed');
          setError(
            'Could not confirm payment status. If money was deducted, wait a moment and try again; otherwise retry payment.',
          );
          return;
        }
      }
      if (!cancelled) {
        pollRef.current = setTimeout(poll, 3000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [phase, reference, finishSuccess]);

  // Resume polling when user returns from card browser
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && phase === 'waiting' && reference) {
        // Poll loop already running; no-op — status will refresh on next tick
      }
    });
    return () => sub.remove();
  }, [phase, reference]);

  const handlePay = async () => {
    setError(null);
    if (!selectedPlanId) {
      setError('Select a plan.');
      return;
    }
    if (method === 'mobile_money') {
      const normalized = normalizeUgPhone(phone);
      if (!/^\+256[7]\d{8}$/.test(normalized)) {
        setError(
          'Enter the mobile money phone number that will receive the prompt (e.g. 07XXXXXXXX).',
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const tenant = auth?.schema_name || '';
      const returnUrl = tenant
        ? `https://${tenant}.zentroapp.app/subscription`
        : 'https://zentroapp.app/subscription';

      const res = await initiateSubscriptionCollection({
        plan_id: selectedPlanId,
        months,
        billing_cycle: billingCycle,
        method,
        phone_number:
          method === 'mobile_money' ? normalizeUgPhone(phone) : undefined,
        return_url: method === 'card' ? returnUrl : undefined,
        test_amount_ugx: USE_TEST_ENV ? testAmountUgx : undefined,
      });

      setReference(res.reference);
      const displayAmount =
        res.test_mode && res.charged_amount != null
          ? Number(res.charged_amount)
          : Number(res.amount);
      setAmountLabel(formatSubscriptionPrice(displayAmount, 'UGX'));
      setProductLabel(res.product);

      if (res.status === 'paid') {
        finishSuccess();
        return;
      }

      if (method === 'card' && res.redirect_url) {
        setPhase('waiting');
        await Linking.openURL(res.redirect_url);
        return;
      }

      setPhase('waiting');
    } catch (err) {
      let message = 'Could not start payment. Please try again.';
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as {error?: string} | undefined;
        if (data?.error) message = data.error;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({index: 0, routes: [{name: 'SignIn'}]});
  };

  const goHome = () => {
    navigation.reset({index: 0, routes: [{name: 'Home'}]});
  };

  const lockedEntry = fromExpiredModal || fromBillingRenewal;

  const renderTopBar = () => (
    <View
      style={[
        styles.topHeader,
        t.topHeader,
        {
          paddingTop: Math.max(
            insets.top,
            Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
            12,
          ),
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        t.headerBorder,
      ]}>
      {lockedEntry ? (
        <View style={styles.headerTrailingSpacer} />
      ) : (
        <QuickIconPressable
          style={[styles.headerRoundButton, t.headerRoundButton]}
          onPress={() => safeGoBack(navigation, 'Home')}
          accessibilityLabel="Go back">
          <Image
            source={icons.back as any}
            style={[styles.headerRoundIcon, t.headerRoundIcon]}
          />
        </QuickIconPressable>
      )}
      <Text style={[styles.topTitle, t.topTitle]}>Pay subscription</Text>
      <View style={styles.headerTrailing}>
        {lockedEntry ? (
          <QuickIconPressable
            style={[styles.headerRoundButton, t.headerRoundButton]}
            onPress={() => void handleLogout()}
            accessibilityLabel="Log out">
            <Image
              source={icons.logout as any}
              style={[styles.headerRoundIcon, t.headerRoundIcon]}
            />
          </QuickIconPressable>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
      </View>
    </View>
  );

  if (!canManageCompany && !lockedEntry) {
    return (
      <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
        {renderTopBar()}
        <View style={styles.centerPhase}>
          <View style={[styles.phaseCard, t.card]}>
            <Text style={[styles.phaseTitle, t.modalTitle]}>Access denied</Text>
            <Text style={[styles.phaseBody, t.bodyText]}>
              Subscription and billing are limited to users with company
              management access.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!canManageCompany && lockedEntry) {
    return (
      <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
        {renderTopBar()}
        <View style={styles.centerPhase}>
          <View style={[styles.phaseCard, t.card]}>
            <Text style={[styles.phaseTitle, t.modalTitle]}>
              Subscription needs attention
            </Text>
            <Text style={[styles.phaseBody, t.bodyText]}>
              Ask an administrator to renew the company plan. You can log out
              and continue after billing is updated.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'success') {
    return (
      <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
        {renderTopBar()}
        <View style={styles.centerPhase}>
          <View style={[styles.phaseCard, t.card]}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={[styles.phaseTitle, t.modalTitle]}>Payment successful</Text>
            <Text style={[styles.phaseBody, t.bodyText]}>
              {productLabel
                ? `${productLabel} is now active`
                : 'Your subscription is now active'}
              {amountLabel ? ` (${amountLabel}).` : '.'} Access updates
              automatically — no manual approval needed.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={goHome}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
              <Text style={styles.primaryButtonText}>Go to home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'failed') {
    return (
      <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
        {renderTopBar()}
        <View style={styles.centerPhase}>
          <View style={[styles.phaseCard, t.card]}>
            <View style={styles.failBadge}>
              <Text style={styles.failBadgeText}>!</Text>
            </View>
            <Text style={[styles.phaseTitle, t.modalTitle]}>Payment failed</Text>
            <Text style={[styles.phaseBody, t.bodyText]}>
              {error || 'Payment was declined or failed. You can try again.'}
            </Text>
            {amountLabel ? (
              <Text style={[styles.phaseAmount, t.modalTitle]}>{amountLabel}</Text>
            ) : null}
            {reference ? (
              <Text style={[styles.phaseRef, t.bodyText]}>Ref: {reference}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setPhase('form');
                setError(null);
                setReference('');
              }}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'waiting') {
    return (
      <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
        {renderTopBar()}
        <View style={styles.centerPhase}>
          <View style={[styles.phaseCard, t.card]}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
            <Text style={[styles.phaseTitle, t.modalTitle]}>Waiting for payment</Text>
            <Text style={[styles.phaseBody, t.bodyText]}>
              {method === 'card'
                ? 'Finish card payment in the browser. This screen updates automatically when payment is confirmed.'
                : 'Approve the mobile money prompt on your phone. This screen updates when payment finishes.'}
            </Text>
            {amountLabel ? (
              <Text style={[styles.phaseAmount, t.modalTitle]}>{amountLabel}</Text>
            ) : null}
            {reference ? (
              <Text style={[styles.phaseRef, t.bodyText]}>Ref: {reference}</Text>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setPhase('form');
                setError(null);
              }}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
              <Text style={styles.linkBtn}>Cancel and try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
      {renderTopBar()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageSubtitle, t.pageSubtitle]}>
          {fromExpiredModal
            ? isTrialExpiry
              ? 'Select a plan and pay with mobile money or card. Activation is automatic after payment.'
              : 'Renew your plan with mobile money or card — activation is automatic after payment.'
            : 'Extend your current plan. Pay with mobile money or card — activation is automatic after payment.'}
        </Text>

        {USE_TEST_ENV ? (
          <View style={styles.devBanner}>
            <Text style={styles.devBannerText}>
              Development: Marz charges a small test amount. History still records
              the full plan price.
            </Text>
            <Text style={styles.devBannerLabel}>Test charge (UGX)</Text>
            <View style={styles.devChipRow}>
              {[500, 1000, 30000].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.devChip,
                    testAmountUgx === amount && styles.devChipActive,
                  ]}
                  onPress={() => setTestAmountUgx(amount)}
                  activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                  <Text
                    style={[
                      styles.devChipText,
                      testAmountUgx === amount && styles.devChipTextActive,
                    ]}>
                    {amount.toLocaleString('en-UG')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
            <Text style={[styles.loadingText, t.pageSubtitle]}>
              Loading subscription options…
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.planHeaderRow}>
              <Text style={[styles.sectionTitle, t.sectionTitle, styles.planHeaderTitle]}>
                Select a plan
              </Text>
              <View style={[styles.currencyToggle, t.toggleBtn]}>
                {(['UGX', 'USD'] as const).map(code => (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.currencyToggleBtn,
                      displayCurrency === code && [
                        styles.toggleBtnActive,
                        t.toggleBtnActive,
                      ],
                    ]}
                    onPress={() => setDisplayCurrency(code)}
                    activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                    <Text
                      style={[
                        styles.toggleBtnText,
                        t.toggleBtnText,
                        displayCurrency === code && [
                          styles.toggleBtnTextActive,
                          t.toggleBtnTextActive,
                        ],
                      ]}>
                      {code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {displayCurrency === 'USD' ? (
              <Text style={[styles.currencyHint, t.emptyText]}>
                Approx. at 1 USD = {SUBSCRIPTION_UGX_PER_USD.toLocaleString('en-UG')}{' '}
                UGX · billed in UGX
              </Text>
            ) : null}
            <View style={styles.cardList}>
              {plans.length === 0 ? (
                <Text style={[styles.emptyText, t.emptyText]}>
                  No plans available.
                </Text>
              ) : (
                plans.map(plan => {
                  const isSelected = plan.id === selectedPlanId;
                  const monthly =
                    plan.monthly_price ?? plan.price ?? plan.yearly_price ?? 0;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.card,
                        t.card,
                        isSelected && [styles.cardSelected, t.cardSelected],
                      ]}
                      onPress={() => setSelectedPlanId(plan.id)}
                      activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                      <Text style={[styles.cardTitle, t.cardTitle]}>
                        {plan.name}
                      </Text>
                      <Text style={[styles.cardPrice, t.cardPrice]}>
                        {formatSubscriptionPrice(monthly, displayCurrency)}
                        <Text style={styles.perMo}> / mo</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <Text style={[styles.sectionTitle, t.sectionTitle]}>Billing cycle</Text>
            <View style={styles.toggleRow}>
              {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
                <TouchableOpacity
                  key={cycle}
                  style={[
                    styles.toggleBtn,
                    t.toggleBtn,
                    billingCycle === cycle && [
                      styles.toggleBtnActive,
                      t.toggleBtnActive,
                    ],
                  ]}
                  onPress={() => setBillingCycle(cycle)}
                  activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                  <Text
                    style={[
                      styles.toggleBtnText,
                      t.toggleBtnText,
                      billingCycle === cycle && [
                        styles.toggleBtnTextActive,
                        t.toggleBtnTextActive,
                      ],
                    ]}>
                    {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, t.sectionTitle]}>
              Months upfront (1–24)
            </Text>
            <View style={[styles.pickerWrap, t.pickerWrap]}>
              <Picker
                selectedValue={months}
                onValueChange={(v: number) => setMonths(Number(v))}
                style={[styles.picker, t.picker]}
                dropdownIconColor={colors.textPrimary}>
                {Array.from({length: 24}, (_, i) => i + 1).map(n => (
                  <Picker.Item key={n} label={String(n)} value={n} />
                ))}
              </Picker>
            </View>

            <Text style={[styles.sectionTitle, t.sectionTitle]}>
              Payment method
            </Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  t.card,
                  method === 'mobile_money' && [
                    styles.cardSelected,
                    t.cardSelected,
                  ],
                ]}
                onPress={() => setMethod('mobile_money')}
                activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                <Image
                  source={icons.wallet as any}
                  style={[styles.methodIcon, {tintColor: COLORS.primary2}]}
                />
                <Text style={[styles.cardTitle, t.cardTitle]}>Mobile money</Text>
                <Text style={[styles.cardPrice, t.cardPrice]}>
                  MTN / Airtel USSD prompt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodCard,
                  t.card,
                  method === 'card' && [styles.cardSelected, t.cardSelected],
                ]}
                onPress={() => setMethod('card')}
                activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                <Image
                  source={icons.mastercard as any}
                  style={styles.methodIcon}
                />
                <Text style={[styles.cardTitle, t.cardTitle]}>Card</Text>
                <Text style={[styles.cardPrice, t.cardPrice]}>
                  Secure card gateway
                </Text>
              </TouchableOpacity>
            </View>

            {method === 'mobile_money' ? (
              <>
                <Text style={[styles.sectionTitle, t.sectionTitle]}>
                  Phone number (receives the prompt)
                </Text>
                <TextInput
                  style={[styles.phoneInput, t.input]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0750123456"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  autoCorrect={false}
                />
              </>
            ) : null}

            <View style={[styles.footerTotal, t.footerTotal]}>
              <View>
                <Text style={[styles.footerTotalLabel, t.footerTotalLabel]}>
                  {USE_TEST_ENV ? 'Catalog total' : 'Total due'}
                </Text>
                <Text style={[styles.footerTotalValue, t.footerTotalValue]}>
                  {formatSubscriptionPrice(totalAmount, displayCurrency)}
                </Text>
                {displayCurrency === 'USD' ? (
                  <Text style={[styles.footerTotalLabel, t.footerTotalLabel]}>
                    Charged as {formatSubscriptionPrice(totalAmount, 'UGX')}
                  </Text>
                ) : null}
                {USE_TEST_ENV ? (
                  <Text style={styles.testChargeHint}>
                    Marz charge: {formatSubscriptionPrice(testAmountUgx, 'UGX')}
                  </Text>
                ) : null}
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!selectedPlanId || submitting) && styles.primaryButtonDisabled,
              ]}
              disabled={!selectedPlanId || submitting}
              onPress={() => void handlePay()}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {method === 'card'
                    ? 'Continue to card payment'
                    : 'Pay with mobile money'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {expiredModalVisible ? (
        <View
          style={[
            styles.expiredOverlay,
            {
              backgroundColor: isDark
                ? 'rgba(15, 23, 42, 0.72)'
                : 'rgba(0, 0, 0, 0.45)',
            },
          ]}>
          <View style={[styles.modalCard, t.modalCard]}>
            <Text style={[styles.modalDialogTitle, t.modalText]}>
              {isTrialExpiry ? 'Trial period ended' : 'Subscription inactive'}
            </Text>
            <View style={styles.modalBodyRow}>
              <View style={styles.modalIconWrapAmber}>
                <Image
                  source={icons.wallet as any}
                  style={styles.modalWalletIcon}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.modalBodyText}>
                <Text style={[styles.modalTitle, t.modalTitle]}>
                  {isTrialExpiry
                    ? 'Your trial period has ended'
                    : 'Your subscription needs renewal'}
                </Text>
                <Text style={[styles.modalText, t.modalText]}>
                  {isTrialExpiry
                    ? 'To continue using Zentro, please subscribe to a plan. You will be taken to the subscription page to choose a plan and proceed with payment.'
                    : 'Your paid period and grace window have ended. Renew your subscription on the next page to restore full access to Zentro.'}
                </Text>
                {!!lockDate && !isTrialExpiry ? (
                  <Text style={[styles.modalLockNote, t.modalText]}>
                    Access ended after grace period (lock date: {lockDate}).
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.modalFooter, t.headerBorder]}>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => setExpiredModalVisible(false)}
                activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                <Text style={styles.modalPrimaryText}>
                  {isTrialExpiry ? 'Proceed to payment' : 'Renew subscription'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  scroll: {flex: 1},
  container: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 10,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRoundIcon: {width: 20, height: 20},
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailing: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTrailingSpacer: {width: 40, height: 40},
  pageSubtitle: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  loadingText: {marginTop: 4},
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  planHeaderTitle: {marginTop: 0, marginBottom: 0, flex: 1},
  currencyToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  currencyToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencyHint: {
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  toggleRow: {flexDirection: 'row', gap: 10, marginBottom: 16},
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {},
  toggleBtnText: {fontWeight: '600', fontSize: 15},
  toggleBtnTextActive: {fontWeight: '700'},
  cardList: {gap: 10, marginBottom: 8},
  card: {borderRadius: 12, padding: 16, borderWidth: 1},
  cardSelected: {},
  cardTitle: {fontWeight: '700', fontSize: 16, marginBottom: 4},
  cardPrice: {fontSize: 14},
  perMo: {fontSize: 12},
  emptyText: {textAlign: 'center', paddingVertical: 12},
  pickerWrap: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  picker: {width: '100%'},
  methodCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  methodIcon: {width: 28, height: 28, marginBottom: 8},
  phoneInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    marginBottom: 8,
  },
  footerTotal: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  footerTotalLabel: {fontSize: 12, textTransform: 'uppercase'},
  footerTotalValue: {fontWeight: '700', fontSize: 20, marginTop: 4},
  testChargeHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary2,
    borderRadius: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryButtonDisabled: {opacity: 0.5},
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  errorBox: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  errorText: {color: '#991B1B', fontSize: 14, fontWeight: '500'},
  devBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    padding: 12,
    marginBottom: 12,
  },
  devBannerText: {fontSize: 12, color: '#78350F', marginBottom: 8, lineHeight: 17},
  devBannerLabel: {fontSize: 12, fontWeight: '700', color: '#78350F', marginBottom: 6},
  devChipRow: {flexDirection: 'row', gap: 8},
  devChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  devChipActive: {backgroundColor: '#F59E0B'},
  devChipText: {fontSize: 12, fontWeight: '700', color: '#78350F'},
  devChipTextActive: {color: COLORS.white},
  centerPhase: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  phaseCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  phaseTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  phaseBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  phaseAmount: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  phaseRef: {
    marginTop: 8,
    fontSize: 11,
    textAlign: 'center',
  },
  successIcon: {
    fontSize: 40,
    color: '#059669',
    fontWeight: '700',
  },
  failBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failBadgeText: {fontSize: 24, fontWeight: '800', color: '#DC2626'},
  linkBtn: {
    marginTop: 20,
    color: COLORS.primary2,
    fontWeight: '600',
    fontSize: 14,
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalDialogTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'left',
  },
  modalBodyRow: {flexDirection: 'row', alignItems: 'flex-start'},
  modalIconWrapAmber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
  },
  modalWalletIcon: {width: 24, height: 24, tintColor: '#D97706'},
  modalBodyText: {flex: 1, marginLeft: 14},
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'left',
  },
  modalText: {
    marginBottom: 8,
    textAlign: 'left',
    lineHeight: 21,
    fontSize: 14,
  },
  modalLockNote: {fontSize: 12, lineHeight: 18, marginBottom: 0, opacity: 0.85},
  modalFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
  },
  modalPrimary: {
    backgroundColor: COLORS.primary2,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
