import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  createExtraUsersPayment,
  createManualPayment,
  getMobileMoneyInstructions,
  MobileMoneyInstructions,
} from '../../services/SubscriptionService';
import {useAuth, useAppContext} from '../../context/Store';
import {COLORS, icons, images} from '../../constants';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function MobileMoneyPaymentInstructions() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};

  const {auth} = useAuth();
  const {logout} = useAppContext();

  const [isLoading, setIsLoading] = useState(true);
  const [instructions, setInstructions] = useState<MobileMoneyInstructions | null>(
    null,
  );

  const [submitted, setSubmitted] = useState(!!params.submitted);
  const [reference, setReference] = useState<string>(params.reference ?? '');

  const [txnRef, setTxnRef] = useState('');
  const [txnRefTouched, setTxnRefTouched] = useState(false);
  const txnRefValid = /^\d{12}$/.test(txnRef);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const apiInstructions = await getMobileMoneyInstructions();
        if (cancelled) return;

        setInstructions(apiInstructions);

        if (apiInstructions?.has_active_subscription) {
          navigation.reset({index: 0, routes: [{name: 'Home'}]});
          return;
        }

        if (
          apiInstructions?.has_pending_verification &&
          apiInstructions.pending_payment_reference
        ) {
          setSubmitted(true);
          setReference(apiInstructions.pending_payment_reference);
          return;
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigation.reset({index: 0, routes: [{name: 'SignIn'}]});
    }
  };

  const phoneNumbers = useMemo(() => {
    if (!instructions) return [];
    if (Array.isArray(instructions.mobile_money_numbers) && instructions.mobile_money_numbers.length) {
      return instructions.mobile_money_numbers;
    }
    if (instructions.mobile_money_number) {
      return [instructions.mobile_money_number];
    }
    return [];
  }, [instructions]);

  const amountToSend = Number(params.amount ?? 0);
  const selectedPlanName = params.selectedPlanName ?? '';
  const billingCycle = params.billingCycle ?? 'monthly';
  const months = Number(params.months ?? 1);

  const onSubmit = async () => {
    const referenceToSubmit = txnRef;
    if (!txnRefValid) {
      setTxnRefTouched(true);
      return;
    }

    // Extra-users payment (optional flow)
    if (params.extraUsersOnly) {
      const result = await createExtraUsersPayment({
        extra_users_count: Number(params.extraUsersCount ?? 0),
        reference: referenceToSubmit,
      });
      const ref = result?.reference ?? referenceToSubmit;
      setReference(String(ref));
      setSubmitted(true);
      return;
    }

    // Manual payment (plan flow)
    const result = await createManualPayment({
      plan_id: Number(params.selectedPlanId ?? 0),
      amount: amountToSend,
      billing_cycle: billingCycle,
      months,
      reference: referenceToSubmit,
    });

    const ref = result?.reference ?? result?.pending_payment_reference ?? referenceToSubmit;
    setReference(String(ref));
    setSubmitted(true);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading instructions...</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.subscriptionNav}>
          <Image
            source={images.logo_icon}
            style={styles.subscriptionNavLogo}
            resizeMode="contain"
          />
          <Text style={styles.subscriptionNavUser}>
            {auth.username || 'User'}
          </Text>
          <TouchableOpacity
            style={styles.subscriptionNavLogoutBtn}
            onPress={handleLogout}>
            <Image
              source={icons.logout}
              style={styles.subscriptionNavLogoutIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.submittedCard}>
          <View style={styles.successIconCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.submittedTitle}>Payment submitted</Text>
          <Text style={styles.submittedText}>
            We will verify your payment and activate your subscription shortly. You will receive an email when it is ready.
          </Text>

          <Text style={styles.submittedReferenceLabel}>
            Your payment reference:
          </Text>
          <View style={styles.referencePill}>
            <Text style={styles.referenceValue}>{reference}</Text>
          </View>

          <Text style={styles.submittedFooter}>
            You can close this page. We will contact you once verification is complete.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.reset({index: 0, routes: [{name: 'Home'}]})}>
            <Text style={styles.primaryButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (!instructions) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Unable to load mobile money instructions.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Subscription')}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showTxnError = txnRefTouched && !txnRefValid;

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Pay with Mobile Money</Text>
        <Text style={styles.productLine}>
          {(selectedPlanName || (params.extraUsersOnly ? 'Extra Users' : 'Plan')) + ' - ' + formatCurrency(amountToSend)}
        </Text>
        <Text style={styles.instructionText}>{instructions.instructions}</Text>

        <View style={styles.phoneList}>
          {phoneNumbers.map((num: string) => (
            <View key={num} style={styles.phonePill}>
              <Text style={styles.phoneText}>{num}</Text>
            </View>
          ))}
        </View>

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to send</Text>
          <Text style={styles.amountValue}>{formatCurrency(amountToSend)}</Text>
          <Text style={styles.amountMeta}>
            {billingCycle === 'monthly' ? `${months} month(s) upfront` : `${months} year(s) upfront`}
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Transaction ID (12 digits)</Text>
          <TextInput
            style={[
              styles.input,
              showTxnError && styles.inputErrorBorder,
            ]}
            keyboardType="number-pad"
            value={txnRef}
            placeholder="12 digits from your mobile money receipt"
            maxLength={12}
            onChangeText={val => setTxnRef(val.replace(/[^\d]/g, ''))}
            onBlur={() => setTxnRefTouched(true)}
          />
          {showTxnError && (
            <Text style={styles.errorText}>
              Transaction reference must be exactly 12 digits
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !txnRefValid && styles.primaryButtonDisabled,
            ]}
            disabled={!txnRefValid}
            onPress={onSubmit}>
            <Text style={styles.primaryButtonText}>I HAVE PAID</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10},
  loadingText: {color: '#6B7280'},
  container: {padding: 16, backgroundColor: '#F5F5F5', flexGrow: 1},
  title: {fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 6},
  productLine: {fontWeight: '800', color: '#374151', marginBottom: 14},
  instructionText: {color: '#4B5563', lineHeight: 20, marginBottom: 16},
  phoneList: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  phonePill: {backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB'},
  phoneText: {fontWeight: '800', color: '#111827'},
  amountCard: {backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16},
  amountLabel: {color: '#6B7280', marginBottom: 6},
  amountValue: {fontWeight: '900', color: '#111827', fontSize: 18, marginBottom: 4},
  amountMeta: {color: '#6B7280'},
  formCard: {backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB'},
  formLabel: {fontWeight: '800', color: '#111827', marginBottom: 10},
  input: {backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontWeight: '700'},
  inputErrorBorder: {borderColor: '#EF4444'},
  errorText: {color: '#EF4444', marginTop: 8},
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  primaryButtonDisabled: {backgroundColor: '#93C5FD'},
  primaryButtonText: {color: '#fff', fontWeight: '900'},
  submittedCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    marginTop: 28,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 6,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a15',
    borderWidth: 1,
    borderColor: '#16a34a33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successIcon: {
    color: '#16a34a',
    fontSize: 26,
    fontWeight: '900',
  },
  submittedTitle: {fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 10},
  submittedText: {color: '#4B5563', lineHeight: 22, marginBottom: 14},
  submittedReferenceLabel: {color: '#374151', fontWeight: '800', marginBottom: 10},
  referencePill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 16,
  },
  referenceValue: {fontWeight: '900', color: '#111827'},
  submittedFooter: {color: '#6B7280', lineHeight: 18, marginBottom: 6},
  modalPrimary: {backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 12, alignItems: 'center'},
  subscriptionNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 14,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2FF',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  subscriptionNavLogo: {
    width: 40,
    height: 40,
  },
  subscriptionNavUser: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.darkGray,
    fontWeight: '900',
    fontSize: 16,
    marginRight: 10,
  },
  subscriptionNavLogoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionNavLogoutIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary,
  },
});

