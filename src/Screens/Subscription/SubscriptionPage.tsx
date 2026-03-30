import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import Picker from '@react-native-picker/picker';
import RNModal from 'react-native-modal';
import {
  AddOn,
  getAddOns,
  getMobileMoneyInstructions,
  getPricingPlans,
  PricingPlan,
} from '../../services/SubscriptionService';

type BillingCycle = 'monthly' | 'yearly';

export default function SubscriptionPage() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

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
      selectedPlan.yearly_price ?? selectedPlan.price ?? selectedPlan.monthly_price ?? 0
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
    // amount = plan * upfront months + add-ons total.
    return Math.round((planPrice * months + addOnTotal) || 0);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Choose Your Plan</Text>
      <Text style={styles.subtext}>
        14-day free trial • No upfront payment • Monthly from UGX 50,000
      </Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading subscription options...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Billing Cycle</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                billingCycle === 'monthly' && styles.toggleBtnActive,
              ]}
              onPress={() => setBillingCycle('monthly')}>
              <Text
                style={[
                  styles.toggleBtnText,
                  billingCycle === 'monthly' && styles.toggleBtnTextActive,
                ]}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                billingCycle === 'yearly' && styles.toggleBtnActive,
              ]}
              onPress={() => setBillingCycle('yearly')}>
              <Text
                style={[
                  styles.toggleBtnText,
                  billingCycle === 'yearly' && styles.toggleBtnTextActive,
                ]}>
                Yearly
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Select a plan</Text>
          <View style={styles.cardList}>
            {plans.length === 0 ? (
              <Text style={styles.emptyText}>No plans available.</Text>
            ) : (
              plans.map(plan => {
                const isSelected = plan.id === selectedPlanId;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.card,
                      isSelected && styles.cardSelected,
                    ]}
                    onPress={() => setSelectedPlanId(plan.id)}>
                    <Text style={styles.cardTitle}>
                      {plan.name ?? `Plan ${plan.id}`}
                    </Text>
                    <Text style={styles.cardPrice}>
                      {formatCurrency(
                        billingCycle === 'monthly'
                          ? plan.monthly_price ?? plan.price ?? 0
                          : plan.yearly_price ?? plan.price ?? 0,
                      )}
                      / {billingCycle === 'monthly' ? 'month' : 'year'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>Upfront months</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={months}
              onValueChange={val => setMonths(Number(val))}
              mode="dropdown">
              {Array.from({length: 24}).map((_, idx) => {
                const m = idx + 1;
                return (
                  <Picker.Item key={m} label={`${m}`} value={m} />
                );
              })}
            </Picker>
          </View>

          <Text style={styles.sectionTitle}>Add-ons (optional)</Text>
          <View style={styles.cardList}>
            {addOns.length === 0 ? (
              <Text style={styles.emptyText}>No add-ons available.</Text>
            ) : (
              addOns.map(a => {
                const active = selectedAddOnIds.includes(a.id);
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.addOnRow,
                      active && styles.addOnRowActive,
                    ]}
                    onPress={() => toggleAddOn(a.id)}>
                    <Text style={styles.addOnName}>{a.name ?? `Add-on ${a.id}`}</Text>
                    <Text style={styles.addOnPrice}>
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

          <View style={styles.footerTotal}>
            <Text style={styles.footerTotalLabel}>Total to pay</Text>
            <Text style={styles.footerTotalValue}>{formatCurrency(totalAmount)}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !selectedPlanId && styles.primaryButtonDisabled,
            ]}
            disabled={!selectedPlanId}
            onPress={proceedToMobileMoney}>
            <Text style={styles.primaryButtonText}>Proceed to Mobile Money</Text>
          </TouchableOpacity>
        </>
      )}

      <RNModal
        isVisible={expiredModalVisible}
        backdropOpacity={0.35}
        onBackdropPress={() => setExpiredModalVisible(false)}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Your trial period has ended</Text>
          <Text style={styles.modalText}>
            To continue using Zentroapp, please subscribe to a plan. You will be taken to the subscription page to choose a plan and proceed with payment.
          </Text>
          <TouchableOpacity
            style={styles.modalPrimary}
            onPress={() => {
              setExpiredModalVisible(false);
              if (selectedPlanId) {
                proceedToMobileMoney();
              }
            }}>
            <Text style={styles.modalPrimaryText}>Proceed to Payment</Text>
          </TouchableOpacity>
        </View>
      </RNModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    flexGrow: 1,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {color: '#6B7280'},
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    marginTop: 6,
  },
  subtext: {
    color: '#6B7280',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    color: '#111827',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#DBEAFE',
  },
  toggleBtnText: {
    color: '#374151',
    fontWeight: '700',
  },
  toggleBtnTextActive: {color: '#1D4ED8'},
  cardList: {gap: 10},
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#EFF6FF',
  },
  cardTitle: {fontWeight: '800', color: '#111827', marginBottom: 6},
  cardPrice: {color: '#374151'},
  emptyText: {color: '#6B7280', textAlign: 'center', paddingVertical: 10},
  pickerWrap: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addOnRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addOnRowActive: {borderColor: '#16a34a', backgroundColor: '#ECFDF3'},
  addOnName: {fontWeight: '700', color: '#111827', flex: 1},
  addOnPrice: {color: '#16a34a', fontWeight: '800'},
  footerTotal: {
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerTotalLabel: {color: '#6B7280'},
  footerTotalValue: {fontWeight: '900', color: '#111827', fontSize: 16},
  primaryButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {backgroundColor: '#93C5FD'},
  primaryButtonText: {color: '#fff', fontWeight: '900'},
  modalCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
  },
  modalTitle: {fontSize: 18, fontWeight: '900', marginBottom: 10, color: '#111827'},
  modalText: {color: '#4B5563', marginBottom: 16},
  modalPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: {color: '#fff', fontWeight: '900'},
});

