import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
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
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  createExtraUsersPayment,
  createManualPayment,
  getMobileMoneyInstructions,
  MobileMoneyInstructions,
} from '../../services/SubscriptionService';
import {useAuth, useAppContext} from '../../context/Store';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
} from '../../constants';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';

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
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {auth} = useAuth();
  const {logout} = useAppContext();

  const fromExpired = !!params.fromExpired;

  const [isLoading, setIsLoading] = useState(true);
  const [instructions, setInstructions] = useState<MobileMoneyInstructions | null>(
    null,
  );

  const [submitted, setSubmitted] = useState(!!params.submitted);
  const [reference, setReference] = useState<string>(params.reference ?? '');

  const [txnRef, setTxnRef] = useState('');
  const [txnRefTouched, setTxnRefTouched] = useState(false);
  const txnRefValid = /^\d{12}$/.test(txnRef);

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
      card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      bodyText: {color: colors.textSecondary},
      phonePill: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      phoneText: {color: colors.textPrimary},
      amountLabel: {color: colors.textSecondary},
      amountValue: {color: colors.textPrimary},
      amountMeta: {color: colors.textSecondary},
      formLabel: {color: colors.textPrimary},
      input: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
        color: colors.textPrimary,
      },
      referencePill: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      referenceValue: {color: colors.textPrimary},
      successCircle: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      successIcon: {color: COLORS.success},
      centeredText: {color: colors.textSecondary},
      errorText: {color: COLORS.error},
    }),
    [colors],
  );

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
    if (
      Array.isArray(instructions.mobile_money_numbers) &&
      instructions.mobile_money_numbers.length
    ) {
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

    const result = await createManualPayment({
      plan_id: Number(params.selectedPlanId ?? 0),
      amount: amountToSend,
      billing_cycle: billingCycle,
      months,
      reference: referenceToSubmit,
    });

    const ref =
      result?.reference ?? result?.pending_payment_reference ?? referenceToSubmit;
    setReference(String(ref));
    setSubmitted(true);
  };

  const headerTitle = submitted
    ? 'Payment submitted'
    : 'Mobile money payment';

  const renderTopBar = (options?: {showBack?: boolean}) => {
    const showBack = options?.showBack ?? (!fromExpired && !submitted);

    return (
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
        {showBack ? (
          <QuickIconPressable
            style={[styles.headerRoundButton, t.headerRoundButton]}
            onPress={() => {
              if (submitted) {
                navigation.reset({index: 0, routes: [{name: 'Home'}]});
              } else {
                safeGoBack(navigation, 'Subscription');
              }
            }}
            accessibilityLabel="Go back">
            <Image
              source={icons.back as any}
              style={[styles.headerRoundIcon, t.headerRoundIcon]}
            />
          </QuickIconPressable>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
        <Text style={[styles.topTitle, t.topTitle]} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerTrailing}>
          {fromExpired || submitted ? (
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
  };

  const renderLoading = () => (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={COLORS.primary2} />
      <Text style={[styles.loadingText, t.centeredText]}>
        Loading instructions…
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.centered}>
      <Text style={[styles.errorText, t.errorText]}>
        Unable to load mobile money instructions.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Subscription')}
        activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
        <Text style={styles.primaryButtonText}>Back to plans</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSubmitted = () => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <View style={[styles.card, t.card, styles.submittedCard]}>
        <View style={[styles.successIconCircle, t.successCircle]}>
          <Text style={[styles.successIcon, t.successIcon]}>✓</Text>
        </View>

        <Text style={[styles.submittedTitle, t.sectionTitle]}>
          Payment submitted
        </Text>
        <Text style={[styles.submittedText, t.bodyText]}>
          We will verify your payment and activate your subscription shortly. You
          will receive an email when it is ready.
        </Text>

        <Text style={[styles.formLabel, t.formLabel]}>
          Your payment reference
        </Text>
        <View style={[styles.referencePill, t.referencePill]}>
          <Text style={[styles.referenceValue, t.referenceValue]}>
            {reference}
          </Text>
        </View>

        <Text style={[styles.submittedFooter, t.bodyText]}>
          You can close this page. We will contact you once verification is
          complete.
        </Text>

        {auth.username ? (
          <Text style={[styles.userHint, t.pageSubtitle]}>
            Signed in as {auth.username}
          </Text>
        ) : null}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.reset({index: 0, routes: [{name: 'Home'}]})}
          activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
          <Text style={styles.primaryButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const showTxnError = txnRefTouched && !txnRefValid;

  const renderForm = () => (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageSubtitle, t.pageSubtitle]}>
          {(selectedPlanName ||
            (params.extraUsersOnly ? 'Extra users' : 'Plan')) +
            ' · ' +
            formatCurrency(amountToSend)}
        </Text>

        <Text style={[styles.sectionTitle, t.sectionTitle]}>Instructions</Text>
        <View style={[styles.card, t.card, styles.infoCard]}>
          <Text style={[styles.bodyText, t.bodyText]}>
            {instructions?.instructions}
          </Text>

          {phoneNumbers.length > 0 ? (
            <View style={styles.phoneList}>
              {phoneNumbers.map((num: string) => (
                <View key={num} style={[styles.phonePill, t.phonePill]}>
                  <Text style={[styles.phoneText, t.phoneText]}>{num}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, t.sectionTitle]}>Amount</Text>
        <View style={[styles.card, t.card, styles.amountCard]}>
          <Text style={[styles.amountLabel, t.amountLabel]}>Amount to send</Text>
          <Text style={[styles.amountValue, t.amountValue]}>
            {formatCurrency(amountToSend)}
          </Text>
          <Text style={[styles.amountMeta, t.amountMeta]}>
            {billingCycle === 'monthly'
              ? `${months} month(s) upfront`
              : `${months} year(s) upfront`}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, t.sectionTitle]}>
          Confirm payment
        </Text>
        <View style={[styles.card, t.card, styles.formCard]}>
          <Text style={[styles.formLabel, t.formLabel]}>
            Transaction ID (12 digits)
          </Text>
          <TextInput
            style={[
              styles.input,
              t.input,
              showTxnError && styles.inputErrorBorder,
            ]}
            keyboardType="number-pad"
            value={txnRef}
            placeholder="12 digits from your mobile money receipt"
            placeholderTextColor={colors.placeholder}
            maxLength={12}
            onChangeText={val => setTxnRef(val.replace(/[^\d]/g, ''))}
            onBlur={() => setTxnRefTouched(true)}
          />
          {showTxnError ? (
            <Text style={[styles.errorText, t.errorText]}>
              Transaction reference must be exactly 12 digits
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !txnRefValid && styles.primaryButtonDisabled,
            ]}
            disabled={!txnRefValid}
            onPress={onSubmit}
            activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}>
            <Text style={styles.primaryButtonText}>I have paid</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={[styles.screen, t.screen]} edges={['left', 'right', 'bottom']}>
      {renderTopBar()}
      {isLoading
        ? renderLoading()
        : submitted
          ? renderSubmitted()
          : !instructions
            ? renderError()
            : renderForm()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
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
    paddingHorizontal: 8,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding,
    gap: 16,
  },
  loadingText: {
    ...FONTS.body4,
    marginTop: 4,
  },
  pageSubtitle: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoCard: {
    padding: 16,
  },
  bodyText: {
    ...FONTS.body4,
    fontSize: 15,
    lineHeight: 22,
  },
  phoneList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  phonePill: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  phoneText: {
    fontWeight: '700',
    fontSize: 14,
  },
  amountCard: {
    padding: 16,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  amountValue: {
    fontWeight: '700',
    fontSize: 22,
    marginBottom: 4,
  },
  amountMeta: {
    fontSize: 13,
  },
  formCard: {
    padding: 16,
  },
  formLabel: {
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 52,
  },
  inputErrorBorder: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary2,
    borderRadius: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  submittedCard: {
    padding: 20,
    marginTop: 8,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 26,
    fontWeight: '700',
  },
  submittedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  submittedText: {
    lineHeight: 22,
    fontSize: 15,
    marginBottom: 16,
  },
  referencePill: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  referenceValue: {
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  submittedFooter: {
    lineHeight: 20,
    fontSize: 14,
    marginBottom: 8,
  },
  userHint: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});
