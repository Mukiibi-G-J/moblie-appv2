import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS, FONTS, icons} from '../../constants';
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
  normalizePinLength,
  type RestaurantPinLength,
} from '../../services/restaurantPinApi';
import {authOnboarding} from '../../design-system/authOnboardingTokens';

const ao = authOnboarding;
const KEY_ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

function firstNameOrShort(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[0] || '';
}

function initialOf(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : '';
}

function buzzDigit() {
  if (Platform.OS === 'android') {
    Vibration.vibrate(12);
  }
}

function buzzError() {
  if (Platform.OS === 'android') {
    Vibration.vibrate([0, 28, 46, 28]);
  } else {
    Vibration.vibrate();
  }
}

const RestaurantPinSignIn = () => {
  const {colors} = useTheme();
  const {width, height} = useWindowDimensions();
  const navigation = useNavigation<any>();
  const ctx = useAppContext();
  const [prefs, setPrefsState] = useState<Awaited<
    ReturnType<typeof getRestaurantDevicePrefs>
  >>(null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolvedStaffName, setResolvedStaffName] = useState('');
  const [pinLength, setPinLength] = useState<RestaurantPinLength>(4);
  const [prefsReady, setPrefsReady] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;
  const dotScales = useRef(
    Array.from({length: 6}, () => new Animated.Value(1)),
  ).current;
  const attemptRef = useRef(0);
  const inputLocked = useRef(false);
  const pinRef = useRef('');

  const isShort = height < 700;
  const padWidth = Math.min(336, width - ao.screenPadding.horizontal * 2);
  const keySize = Math.min(isShort ? 68 : 76, Math.floor((padWidth - 40) / 3));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getRestaurantDevicePrefs();
      if (!cancelled) {
        setPrefsState(p);
        setResolvedStaffName((p?.enrolledStaffName || '').trim());
        setPrefsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const schemaName = prefs?.schemaName?.trim().toLowerCase() || '';
  const deviceId = prefs?.deviceId;
  const knownName = (resolvedStaffName || prefs?.enrolledStaffName || '').trim();
  const pinPromptName = firstNameOrShort(knownName);
  const brandTitle = prefs?.companyDisplayName || schemaName || 'Restaurant';

  useEffect(() => {
    if (!deviceId || !schemaName) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await getRestaurantPinDeviceContext(deviceId, schemaName);
        if (cancelled) {
          return;
        }
        const nextLength = normalizePinLength(resp.pin_length);
        setPinLength(nextLength);
        setPin(prev => {
          const next = prev.length > nextLength ? prev.slice(0, nextLength) : prev;
          pinRef.current = next;
          return next;
        });
        const name = (resp.staff_name || '').trim();
        if (!name) {
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

  const playError = useCallback(() => {
    buzzError();
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: 12,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -12,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 8,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -6,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 0,
        duration: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeX]);

  const pulseDot = useCallback(
    (index: number) => {
      const scale = dotScales[index];
      if (!scale) {
        return;
      }
      scale.setValue(0.55);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }).start();
    },
    [dotScales],
  );

  const submit = useCallback(
    async (pinToUse: string) => {
      const attempt = ++attemptRef.current;
      if (!deviceId || !schemaName) {
        setMessage('Device is not registered. Use email sign-in.');
        playError();
        return;
      }
      if (pinToUse.length !== pinLength) {
        setMessage(`Enter ${pinLength} digits.`);
        playError();
        return;
      }
      setLoading(true);
      inputLocked.current = true;
      setMessage('');
      try {
        await AsyncStorage.setItem('tenant', schemaName);
        const data = await restaurantPinLogin(pinToUse, deviceId, schemaName);
        if (attempt !== attemptRef.current) {
          return;
        }
        await ctx?.loginWithTokens(data.access, data.refresh);
      } catch (e) {
        if (attempt !== attemptRef.current) {
          return;
        }
        setMessage(mapRestaurantPinLoginError(e));
        pinRef.current = '';
        setPin('');
        playError();
      } finally {
        if (attempt === attemptRef.current) {
          inputLocked.current = false;
          setLoading(false);
        }
      }
    },
    [ctx, deviceId, pinLength, playError, schemaName],
  );

  const appendDigit = useCallback(
    (d: string) => {
      if (inputLocked.current) {
        return;
      }
      const prev = pinRef.current;
      if (prev.length >= pinLength) {
        return;
      }
      const next = prev + d;
      pinRef.current = next;
      setMessage('');
      setPin(next);
      buzzDigit();
      pulseDot(prev.length);
      if (next.length === pinLength) {
        void submit(next);
      }
    },
    [pinLength, pulseDot, submit],
  );

  const backspace = useCallback(() => {
    if (!pinRef.current) {
      return;
    }
    attemptRef.current += 1;
    inputLocked.current = false;
    pinRef.current = pinRef.current.slice(0, -1);
    setLoading(false);
    setMessage('');
    setPin(pinRef.current);
  }, []);

  const confirmFullSignIn = useCallback(async () => {
    await clearRestaurantDevicePrefs();
    await AsyncStorage.multiRemove([
      'accessToken',
      'refreshToken',
      'userData',
    ]);
    navigation.reset({index: 0, routes: [{name: 'SignIn'}]});
  }, [navigation]);

  const useFullSignIn = useCallback(() => {
    Alert.alert(
      'Use email sign-in?',
      'This device will forget the quick PIN. You can set it up again after you sign in.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            void confirmFullSignIn();
          },
        },
      ],
    );
  }, [confirmFullSignIn]);

  if (!prefsReady) {
    return (
      <SafeAreaView
        style={[styles.screen, {backgroundColor: colors.background}]}
        edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingGate}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!prefs?.deviceId || !prefs.schemaName) {
    return (
      <SafeAreaView
        style={[styles.screen, {backgroundColor: colors.background}]}
        edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.fallback}>
          <View
            style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
            <Image
              source={icons.lock}
              style={[styles.lockIcon, {tintColor: COLORS.primary}]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.headline, {color: colors.textPrimary}]}>
            PIN not set up
          </Text>
          <Text style={[styles.hint, {color: colors.textSecondary}]}>
            This device is not set up for quick PIN. Sign in with email and
            password to continue.
          </Text>
          <Pressable
            style={({pressed}) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={() => {
              void confirmFullSignIn();
            }}>
            <Text style={styles.primaryBtnText}>Sign in with email</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initial = initialOf(knownName);

  return (
    <SafeAreaView
      style={[styles.screen, {backgroundColor: colors.background}]}
      edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <View style={[styles.header, isShort && styles.headerShort]}>
          <View style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
            {initial ? (
              <Text style={[styles.avatarText, {color: COLORS.primary}]}>
                {initial}
              </Text>
            ) : (
              <Image
                source={icons.lock}
                style={[styles.lockIcon, {tintColor: COLORS.primary}]}
                resizeMode="contain"
              />
            )}
          </View>
          <Text
            style={[styles.brand, {color: COLORS.primary}]}
            numberOfLines={1}>
            {brandTitle}
          </Text>
          <Text style={[styles.kicker, {color: colors.textSecondary}]}>
            {pinPromptName ? 'Welcome back' : 'Quick sign-in'}
          </Text>
          <Text
            style={[styles.headline, {color: colors.textPrimary}]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {pinPromptName || 'Enter your PIN'}
          </Text>
          <Text style={[styles.hint, {color: colors.textTertiary}]}>
            {`${pinLength}-digit PIN for this device`}
          </Text>
        </View>

        <Animated.View
          accessibilityLabel={`${pin.length} of ${pinLength} digits entered`}
          style={[styles.dotsRow, {transform: [{translateX: shakeX}]}]}>
          {Array.from({length: pinLength}).map((_, i) => {
            const filled = i < pin.length;
            return (
              <Animated.View
                key={i}
                style={{transform: [{scale: dotScales[i]}]}}>
                <View
                  style={[
                    styles.dot,
                    filled ? styles.dotFilled : styles.dotEmpty,
                  ]}
                />
              </Animated.View>
            );
          })}
        </Animated.View>

        <View style={styles.statusSlot}>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : message ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{message}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.spacer} />

        <View style={[styles.pad, {width: padWidth}]}>
          {KEY_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.padRow}>
              {row.map((key, colIndex) => {
                if (!key) {
                  return (
                    <View
                      key={`spacer-${colIndex}`}
                      style={{width: keySize, height: keySize}}
                    />
                  );
                }
                const isDelete = key === 'del';
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={1}
                    accessibilityRole="button"
                    accessibilityLabel={isDelete ? 'Delete' : `Digit ${key}`}
                    hitSlop={
                      isDelete
                        ? {top: 12, bottom: 12, left: 12, right: 12}
                        : undefined
                    }
                    style={[
                      styles.key,
                      {
                        width: keySize,
                        height: keySize,
                        borderRadius: keySize / 2,
                        backgroundColor: COLORS.white,
                      },
                      isDelete && pin.length === 0 && styles.keyMuted,
                    ]}
                    onPressIn={() => {
                      if (isDelete) {
                        backspace();
                      } else {
                        appendDigit(key);
                      }
                    }}>
                    {isDelete ? (
                      <Image
                        source={icons.back}
                        style={[styles.deleteIcon, {tintColor: colors.textSecondary}]}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={[styles.keyText, {color: colors.textPrimary}]}>
                        {key}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in with email and password"
          style={({pressed}) => [styles.linkBtn, pressed && styles.linkPressed]}
          onPress={useFullSignIn}>
          <Text style={[styles.linkText, {color: colors.textSecondary}]}>
            Sign in with email instead
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: ao.screenPadding.horizontal,
    paddingBottom: ao.spacing.sm,
  },
  loadingGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ao.screenPadding.horizontal,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: ao.spacing.lg,
  },
  headerShort: {
    paddingTop: ao.spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ao.spacing.md,
  },
  avatarText: {
    ...FONTS.h1,
    fontSize: 28,
    lineHeight: 34,
  },
  lockIcon: {
    width: 26,
    height: 26,
  },
  brand: {
    ...FONTS.h5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: ao.spacing.sm,
    maxWidth: '100%',
  },
  kicker: {
    ...FONTS.body4,
    marginBottom: 2,
  },
  headline: {
    ...FONTS.h2,
    textAlign: 'center',
  },
  hint: {
    ...FONTS.body4,
    textAlign: 'center',
    marginTop: ao.spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ao.spacing.lg,
    minHeight: 36,
    gap: 16,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  dotEmpty: {
    backgroundColor: COLORS.white,
    borderColor: '#b7b7b7',
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusSlot: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ao.spacing.sm,
  },
  errorPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  errorText: {
    ...FONTS.body5,
    color: COLORS.error,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: 8,
  },
  pad: {
    alignSelf: 'center',
    gap: 14,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  keyMuted: {
    opacity: 0.35,
  },
  keyText: {
    fontFamily: 'Outfit-Medium',
    fontSize: 28,
  },
  deleteIcon: {
    width: 22,
    height: 22,
  },
  linkBtn: {
    alignSelf: 'center',
    marginTop: ao.spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkText: {
    ...FONTS.body4,
    fontFamily: 'Outfit-Medium',
  },
  primaryBtn: {
    marginTop: ao.spacing.xl,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnPressed: {
    backgroundColor: COLORS.primary3,
  },
  primaryBtnText: {
    ...FONTS.button,
    color: COLORS.white,
  },
});

export default RestaurantPinSignIn;
