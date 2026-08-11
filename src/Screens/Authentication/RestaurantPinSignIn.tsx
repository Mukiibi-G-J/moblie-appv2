import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';
import AuthLayout from '../../Components/layouts/AuthLayout';
import {COLORS} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {
  getRestaurantDevicePrefs,
  clearRestaurantDevicePrefs,
  setRestaurantDevicePrefs,
} from '../../storage/restaurantDeviceStorage';
import {
  getRestaurantPinDeviceContext,
  restaurantPinLogin,
  mapRestaurantPinLoginError,
} from '../../services/restaurantPinApi';
import {radii} from '../../design-system/theme';
import {authOnboarding} from '../../design-system/authOnboardingTokens';

const ao = authOnboarding;
const BRAND = '#005151';
const PIN_MAX = 6;

function firstNameOrShort(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'Staff';
  }
  return parts[0];
}

const RestaurantPinSignIn = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const ctx = useAppContext();
  const [prefs, setPrefsState] = useState<Awaited<
    ReturnType<typeof getRestaurantDevicePrefs>
  >>(null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolvedStaffName, setResolvedStaffName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getRestaurantDevicePrefs();
      if (!cancelled) {
        setPrefsState(p);
        setResolvedStaffName((p?.enrolledStaffName || '').trim());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const schemaName = prefs?.schemaName?.trim().toLowerCase() || '';
  const deviceId = prefs?.deviceId;
  const cachedStaff = (prefs?.enrolledStaffName || '').trim();
  const displayStaffName = (resolvedStaffName || cachedStaff || '').trim() || 'Staff';
  const pinPromptName = firstNameOrShort(displayStaffName);
  const brandTitle = prefs?.companyDisplayName || schemaName || 'Restaurant';

  useEffect(() => {
    if (!deviceId || !schemaName) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await getRestaurantPinDeviceContext(deviceId, schemaName);
        const name = (resp.staff_name || '').trim();
        if (cancelled || !name) {
          return;
        }
        setResolvedStaffName(name);
        const cur = await getRestaurantDevicePrefs();
        if (cur?.deviceId === deviceId && cur.enrolledStaffName !== name) {
          await setRestaurantDevicePrefs({...cur, enrolledStaffName: name});
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId, schemaName]);

  const appendDigit = useCallback((d: string) => {
    setMessage('');
    setPin(prev => (prev.length >= PIN_MAX ? prev : prev + d));
  }, []);

  const backspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  const submit = useCallback(async () => {
    if (!deviceId || !schemaName) {
      setMessage('Device is not registered. Use full sign-in.');
      return;
    }
    if (pin.length < 4) {
      setMessage('Enter at least 4 digits.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await AsyncStorage.setItem('tenant', schemaName);
      const data = await restaurantPinLogin(pin, deviceId, schemaName);
      await ctx?.loginWithTokens(data.access, data.refresh);
    } catch (e) {
      setMessage(mapRestaurantPinLoginError(e));
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [ctx, deviceId, pin, schemaName]);

  const useFullSignIn = useCallback(async () => {
    await clearRestaurantDevicePrefs();
    await AsyncStorage.multiRemove([
      'accessToken',
      'refreshToken',
      'userData',
    ]);
    navigation.reset({index: 0, routes: [{name: 'SignIn'}]});
  }, [navigation]);

  if (!prefs?.deviceId || !prefs.schemaName) {
    return (
      <AuthLayout title="Sign in" subtitle="Use full sign-in to continue">
        <Text style={[styles.hint, {color: colors.textSecondary}]}>
          This device is not set up for quick PIN.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={useFullSignIn}>
          <Text style={styles.primaryBtnText}>Full sign-in</Text>
        </TouchableOpacity>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={brandTitle}
      subtitle={
        <Text style={{color: colors.textSecondary}}>
          {(resolvedStaffName || '').trim()
            ? `Welcome back, ${pinPromptName}`
            : 'Enter your PIN to sign in'}
        </Text>
      }>
      <View style={styles.dotsRow}>
        {Array.from({length: PIN_MAX}).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i < pin.length ? COLORS.primary2 : colors.border,
              },
            ]}
          />
        ))}
      </View>
      {message ? (
        <Text style={[styles.err, {color: COLORS.red}]}>{message}</Text>
      ) : null}
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={COLORS.primary2} />
      ) : (
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
                    appendDigit(key);
                  }
                }}>
                <Text style={[styles.keyText, {color: colors.textPrimary}]}>
                  {key === 'del' ? '⌫' : key}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>
      )}
      {pin.length >= 4 && !loading ? (
        <TouchableOpacity style={styles.continueBtn} onPress={() => void submit()}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.linkBtn} onPress={useFullSignIn}>
        <Text style={[styles.linkText, {color: colors.textPrimary}]}>
          Use full sign-in
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  hint: {
    textAlign: 'center',
    marginBottom: ao.spacing.lg,
  },
  primaryBtn: {
    minHeight: 56,
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
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: ao.spacing.lg,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  err: {
    textAlign: 'center',
    marginBottom: ao.spacing.sm,
  },
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
  keyHidden: {
    opacity: 0,
    borderWidth: 0,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
  },
  linkBtn: {
    marginTop: ao.spacing.xl,
    alignSelf: 'center',
    padding: 12,
  },
  continueBtn: {
    marginTop: ao.spacing.lg,
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: ao.typo.body,
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default RestaurantPinSignIn;
