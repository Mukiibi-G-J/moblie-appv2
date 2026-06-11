import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  AddOn,
  getAddOns,
  getMobileMoneyInstructions,
  getPricingPlans,
  PricingPlan,
} from '../../services/SubscriptionService';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  images,
  ICON_BUTTON_ACTIVE_OPACITY,
} from '../../constants';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {safeGoBack} from '../../hooks/NavigationService';

type BillingCycle = 'monthly' | 'yearly';

export default function SubscriptionPage() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {colors, isDark} = useTheme();
  const {logout} = useAppContext();

  const fromExpiredModal = !!route.params?.fromExpiredModal;

  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [addOns, setAddOnsState] = useState<AddOn[]>([]);

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<number[]>([]);
  const [months, setMonths] = useState<number>(1);

  const [expiredModalVisible, setExpiredModalVisible] = useState(
    fromExpiredModal,
  );

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
      addOnRowActive: {
        borderColor: COLORS.success,
        backgroundColor: colors.screenMuted,
      },
      addOnName: {color: colors.textPrimary},
      addOnPrice: {color: COLORS.success},
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
      modalIconWrap: {backgroundColor: colors.screenMuted},
    }),
    [colors],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const instructions = await getMobileMoneyInstructions();
        if (
          instructions?.has_pending_verification &&
          instructions.pending_payment_reference
        ) {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'SubscriptionMobileMoney',
                params: {
                  fromExpired: 1,
                  submitted: true,
                  reference: instructions.pending_payment_reference,
                },
              },
            ],
          });
          return;
        }

        const [plansResp, addOnsResp] = await Promise.all([
          getPricingPlans(),
          getAddOns(),
        ]);
        if (cancelled) return;

        setPlans(plansResp);
        setAddOnsState(addOnsResp);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  useEffect(() => {
    setExpiredModalVisible(fromExpiredModal);
  }, [fromExpiredModal]);

  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) ?? null;
  }, [plans, selectedPlanId]);

  const planPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    if (billingCycle === 'monthly') {
      return (
        selectedPlan.monthly_price ??
        selectedPlan.price ??
        selectedPlan.yearly_price ??
        0
      );
    }
    return (
      selectedPlan.yearly_price ??
      selectedPlan.price ??
      selectedPlan.monthly_price ??
      0
    );
  }, [billingCycle, selectedPlan]);

  const addOnTotal = useMemo(() => {
    const byId = new Map<number, AddOn>(addOns.map(a => [a.id, a]));
    return selectedAddOnIds.reduce((sum, id) => {
      const addon = byId.get(id);
      if (!addon) return sum;
      const price =
        billingCycle === 'monthly'
          ? addon.monthly_price ?? addon.price ?? 0
          : addon.yearly_price ?? addon.price ?? 0;
      return sum + price;
    }, 0);
  }, [addOns, billingCycle, selectedAddOnIds]);

  const totalAmount = useMemo(() => {
    return Math.round(planPrice * months + addOnTotal || 0);
  }, [addOnTotal, months, planPrice]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const toggleAddOn = (addOnId: number) => {
    setSelectedAddOnIds(prev => {
      if (prev.includes(addOnId)) return prev.filter(id => id !== addOnId);
      return [...prev, addOnId];
    });
  };

  const proceedToMobileMoney = () => {
    if (!selectedPlan || !selectedPlanId) return;

    navigation.navigate('SubscriptionMobileMoney', {
      fromExpired: fromExpiredModal ? 1 : 0,
      submitted: false,
      selectedPlanId,
      selectedPlanName: selectedPlan.name,
      amount: totalAmount,
      billingCycle,
      months,
    });
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({index: 0, routes: [{name: 'SignIn'}]});
  };

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
      {fromExpiredModal ? (
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
      <Text style={[styles.topTitle, t.topTitle]}>Choose plan</Text>
      <View style={styles.headerTrailing}>
        {fromExpiredModal ? (
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

  return (
    <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
      {renderTopBar()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageSubtitle, t.pageSubtitle]}>
          14-day free trial · No upfront payment · Monthly from UGX 50,000
        </Text>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
            <Text style={[styles.loadingText, t.pageSubtitle]}>
              Loading subscription options…
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, t.sectionTitle]}>
              Billing cycle
            </Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  t.toggleBtn,
                  billingCycle === 'monthly' && [
                    styles.toggleBtnActive,
                    t.toggleBtnActive,
                  ],
                ]}
                onPress={() => setBillingCycle('monthly')}
                activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                <Text
                  style={[
                    styles.toggleBtnText,
                    t.toggleBtnText,
                    billingCycle === 'monthly' && [
                      styles.toggleBtnTextActive,
                      t.toggleBtnTextActive,
                    ],
                  ]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  t.toggleBtn,
                  billingCycle === 'yearly' && [
                    styles.toggleBtnActive,
                    t.toggleBtnActive,
                  ],
                ]}
                onPress={() => setBillingCycle('yearly')}
                activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                <Text
                  style={[
                    styles.toggleBtnText,
                    t.toggleBtnText,
                    billingCycle === 'yearly' && [
                      styles.toggleBtnTextActive,
                      t.toggleBtnTextActive,
                    ],
                  ]}>
                  Yearly
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, t.sectionTitle]}>
              Select a plan
            </Text>
            <View style={styles.cardList}>
              {plans.length === 0 ? (
                <Text style={[styles.emptyText, t.emptyText]}>
                  No plans available.
                </Text>
              ) : (
                plans.map(plan => {
                  const isSelected = plan.id === selectedPlanId;
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
                        {plan.name ?? `Plan ${plan.id}`}
                      </Text>
                      <Text style={[styles.cardPrice, t.cardPrice]}>
                        {formatCurrency(
                          billingCycle === 'monthly'
                            ? plan.monthly_price ?? plan.price ?? 0
                            : plan.yearly_price ?? plan.price ?? 0,
                        )}{' '}
                        / {billingCycle === 'monthly' ? 'month' : 'year'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <Text style={[styles.sectionTitle, t.sectionTitle]}>
              Upfront months
            </Text>
            <View style={[styles.pickerWrap, t.pickerWrap]}>
              <Picker
                selectedValue={months}
                onValueChange={val => setMonths(Number(val))}
                mode="dropdown"
                style={[styles.picker, t.picker]}
                dropdownIconColor={colors.textSecondary}>
                {Array.from({length: 24}).map((_, idx) => {
                  const m = idx + 1;
                  return <Picker.Item key={m} label={`${m}`} value={m} />;
                })}
              </Picker>
            </View>

            <Text style={[styles.sectionTitle, t.sectionTitle]}>
              Add-ons (optional)
            </Text>
            <View style={styles.cardList}>
              {addOns.length === 0 ? (
                <Text style={[styles.emptyText, t.emptyText]}>
                  No add-ons available.
                </Text>
              ) : (
                addOns.map(a => {
                  const active = selectedAddOnIds.includes(a.id);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.addOnRow,
                        t.card,
                        active && [styles.addOnRowActive, t.addOnRowActive],
                      ]}
                      onPress={() => toggleAddOn(a.id)}
                      activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
                      <Text style={[styles.addOnName, t.addOnName]}>
                        {a.name ?? `Add-on ${a.id}`}
                      </Text>
                      <Text style={[styles.addOnPrice, t.addOnPrice]}>
                        +{' '}
                        {formatCurrency(
                          billingCycle === 'monthly'
                            ? a.monthly_price ?? a.price ?? 0
                            : a.yearly_price ?? a.price ?? 0,
                        )}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={[styles.footerTotal, t.footerTotal]}>
              <Text style={[styles.footerTotalLabel, t.footerTotalLabel]}>
                Total to pay
              </Text>
              <Text style={[styles.footerTotalValue, t.footerTotalValue]}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !selectedPlanId && styles.primaryButtonDisabled,
              ]}
              disabled={!selectedPlanId}
              onPress={proceedToMobileMoney}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
              <Text style={styles.primaryButtonText}>
                Proceed to Mobile Money
              </Text>
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
            <View style={[styles.modalIconWrap, t.modalIconWrap]}>
              <Image
                source={images.logo_icon}
                style={styles.modalLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.modalTitle, t.modalTitle]}>
              Your trial period has ended
            </Text>
            <Text style={[styles.modalText, t.modalText]}>
              To continue using Zentroapp, please subscribe to a plan. Choose a
              plan below and proceed with mobile money payment.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => setExpiredModalVisible(false)}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
              <Text style={styles.modalPrimaryText}>Proceed to payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
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
  headerRoundIcon: {
    width: 20,
    height: 20,
  },
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
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  pageSubtitle: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  loadingText: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {},
  toggleBtnText: {
    fontWeight: '600',
    fontSize: 15,
  },
  toggleBtnTextActive: {
    fontWeight: '700',
  },
  cardList: {
    gap: 10,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardSelected: {},
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 12,
  },
  pickerWrap: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  picker: {
    width: '100%',
  },
  addOnRow: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addOnRowActive: {},
  addOnName: {
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
  },
  addOnPrice: {
    fontWeight: '700',
    fontSize: 14,
  },
  footerTotal: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerTotalLabel: {
    fontSize: 14,
  },
  footerTotalValue: {
    fontWeight: '700',
    fontSize: 17,
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
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalLogo: {
    width: 36,
    height: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
  },
  modalPrimary: {
    backgroundColor: COLORS.primary2,
    borderRadius: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
