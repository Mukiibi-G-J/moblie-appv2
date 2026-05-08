import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import AuthLayout from '../../Components/layouts/AuthLayout';
import {COLORS} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {radii} from '../../design-system/theme';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {
  getOrCreateRestaurantDeviceId,
  setRestaurantDevicePrefs,
  setPinSetupPending,
  setRestaurantPinPromptDismissed,
  setRestaurantPinConfiguredThisSession,
} from '../../storage/restaurantDeviceStorage';
import {
  restaurantStaffEnroll,
  mapRestaurantEnrollError,
} from '../../services/restaurantPinApi';
import type {RootStackParamList} from '../../@types/types.dto';
import Toast from 'react-native-toast-message';

const ao = authOnboarding;
const BRAND = '#0b5cff';
const LOGIN_DRAFT_COMPANY_DISPLAY = '@zentro_login_draft_company_display';

type RestaurantPinSetupRoute = RouteProp<
  RootStackParamList,
  'RestaurantPinSetup'
>;

const RestaurantPinSetup = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RestaurantPinSetupRoute>();
  const fromSettings = route.params?.fromSettings === true;
  const pinSetupMode = route.params?.pinSetupMode;
  const ctx = useAppContext();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goHome = useCallback(() => {
    navigation.reset({index: 0, routes: [{name: 'Home'}]});
  }, [navigation]);

  const leaveAfterDone = useCallback(() => {
    if (fromSettings && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    goHome();
  }, [fromSettings, goHome, navigation]);

  const onNotNow = useCallback(async () => {
    if (fromSettings) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        goHome();
      }
      return;
    }
    await setRestaurantPinPromptDismissed(true);
    await setPinSetupPending(false);
    goHome();
  }, [fromSettings, goHome, navigation]);

  const finishEnroll = useCallback(async () => {
    const p = pin.trim();
    const c = confirm.trim();
    if (p.length < 4 || p.length > 6 || !/^\d+$/.test(p)) {
      setError('PIN must be 4–6 digits only.');
      return;
    }
    if (p !== c) {
      setError('PINs do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const tenant =
        ((await AsyncStorage.getItem('tenant')) || '').trim().toLowerCase();
      if (!tenant) {
        setError('Missing company context. Sign in again.');
        return;
      }
      const deviceId = await getOrCreateRestaurantDeviceId();
      await restaurantStaffEnroll(p, deviceId);
      const companyDisplay =
        (await AsyncStorage.getItem(LOGIN_DRAFT_COMPANY_DISPLAY)) || undefined;
      const staffName = (ctx?.auth?.full_name || '').trim();
      await setRestaurantDevicePrefs({
        isRestaurantDevice: true,
        deviceId,
        schemaName: tenant,
        companyDisplayName: companyDisplay,
        enrolledStaffName: staffName || undefined,
      });
      await setRestaurantPinConfiguredThisSession(true);
      await setPinSetupPending(false);
      await AsyncStorage.removeItem(LOGIN_DRAFT_COMPANY_DISPLAY);
      Toast.show({
        type: 'success',
        text1:
          pinSetupMode === 'change'
            ? 'Quick PIN updated'
            : pinSetupMode === 'renew'
              ? 'Quick PIN renewed'
              : 'Quick PIN enabled',
      });
      leaveAfterDone();
    } catch (e) {
      setError(mapRestaurantEnrollError(e));
    } finally {
      setLoading(false);
    }
  }, [confirm, ctx?.auth?.full_name, leaveAfterDone, pin, pinSetupMode]);

  const append = (d: string) => {
    setError('');
    if (step === 1) {
      setPin(prev => (prev.length >= 6 ? prev : prev + d));
    } else {
      setConfirm(prev => (prev.length >= 6 ? prev : prev + d));
    }
  };
  const backspace = () => {
    if (step === 1) {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirm(prev => prev.slice(0, -1));
    }
  };

  const padRow = (
    <View style={styles.pad}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
        (key, idx) => (
          <TouchableOpacity
            key={`${key}-${idx}`}
            style={[
              styles.key,
              {borderColor: colors.border},
              key === '' && styles.keyHidden,
            ]}
            disabled={key === '' || loading}
            onPress={() => {
              if (key === 'del') {
                backspace();
              } else if (key) {
                append(key);
              }
            }}>
            <Text style={[styles.keyText, {color: colors.textPrimary}]}>
              {key === 'del' ? '⌫' : key}
            </Text>
          </TouchableOpacity>
        ),
      )}
    </View>
  );

  const title =
    pinSetupMode === 'change'
      ? 'Change quick PIN'
      : pinSetupMode === 'renew'
        ? 'Set up new PIN'
        : 'Set up quick PIN';

  const subtitleNode = (
    <Text style={{color: colors.textSecondary}}>
      {pinSetupMode === 'change'
        ? step === 1
          ? 'Choose a new 4–6 digit PIN. Your current PIN will stop working after you save.'
          : 'Enter the same PIN again to confirm.'
        : pinSetupMode === 'renew'
          ? step === 1
            ? 'Your previous PIN expired. Choose a new 4–6 digit PIN for this device.'
            : 'Enter the same PIN again to confirm.'
          : step === 1
            ? 'Choose a 4–6 digit PIN for fast sign-in on this device.'
            : 'Enter the same PIN again to confirm.'}
    </Text>
  );

  return (
    <AuthLayout
      title={title}
      subtitle={subtitleNode}
      showBackButton={step === 2}
      onBackPress={() => {
        setStep(1);
        setConfirm('');
        setError('');
      }}>
      <Text style={[styles.valuePreview, {color: colors.textPrimary}]}>
        {(step === 1 ? pin : confirm).replace(/\d/g, '●')}
      </Text>
      {error ? (
        <Text style={[styles.err, {color: COLORS.red}]}>{error}</Text>
      ) : null}
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={COLORS.primary2} />
      ) : (
        padRow
      )}
      {step === 1 && pin.length >= 4 && !loading ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            setError('');
            setStep(2);
          }}>
          <Text style={styles.primaryBtnText}>Next</Text>
        </TouchableOpacity>
      ) : null}
      {step === 2 && confirm.length >= 4 && !loading ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => void finishEnroll()}>
          <Text style={styles.primaryBtnText}>
            {pinSetupMode === 'change' ? 'Save new PIN' : 'Save PIN'}
          </Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.linkBtn} onPress={onNotNow}>
        <Text style={[styles.linkText, {color: colors.textSecondary}]}>
          {fromSettings ? 'Cancel' : 'Not now'}
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  valuePreview: {
    fontSize: 28,
    letterSpacing: 4,
    textAlign: 'center',
    marginVertical: ao.spacing.md,
    minHeight: 40,
  },
  err: {textAlign: 'center', marginBottom: ao.spacing.sm},
  spinner: {marginVertical: ao.spacing.md},
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: ao.spacing.md,
  },
  key: {
    width: '28%',
    aspectRatio: 1.4,
    maxWidth: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  keyHidden: {opacity: 0, borderWidth: 0},
  keyText: {fontSize: 22, fontWeight: '600'},
  primaryBtn: {
    marginTop: ao.spacing.lg,
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: ao.typo.body,
  },
  linkBtn: {marginTop: ao.spacing.lg, alignSelf: 'center', padding: 12},
  linkText: {fontWeight: '500'},
});

export default RestaurantPinSetup;
