import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {FONTS} from '../../constants';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {seedLoginCredentialsAfterSignup} from '../../utils/loginCredentials';
import {LOGIN_DRAFT_PASSWORD} from '../../utils/loginCredentials';
import {
  getPendingCompanyCreation,
  clearPendingCompanyCreation,
} from '../../utils/pendingCompanyCreation';
import {loginAndRouteAfterCredentials} from '../../utils/postAuthNavigation';
import {
  getCompanyCreationTaskStatus,
  getWorkspaceStatus,
  isSignupAccountReady,
  isWorkspaceProvisioningError,
} from '../../services/companyOnboarding.service';
import type {RootStackParamList} from '../../@types/types.dto';

type Props = NativeStackScreenProps<RootStackParamList, 'CompanyProvisioning'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'CompanyProvisioning'>;

const CTA_BRAND = '#005151';
const POLL_MS = 2000;

const CompanyProvisioningScreen = ({route}: Props) => {
  const {colors} = useTheme();
  const topInset = useScreenTopInset();
  const navigation = useNavigation<Nav>();
  const context = useAppContext();
  const [statusMessage, setStatusMessage] = useState(
    'Creating your account…',
  );
  const [progress, setProgress] = useState(8);
  const ranRef = useRef(false);
  const cancelledRef = useRef(false);

  const finishToSignIn = useCallback(
    async (companyName?: string, email?: string) => {
      await clearPendingCompanyCreation();
      if (companyName && email) {
        await seedLoginCredentialsAfterSignup(companyName, email);
      }
      navigation.replace('SignIn');
    },
    [navigation],
  );

  const tryAutoLogin = useCallback(
    async (tenant: string, email: string) => {
      const password = (await AsyncStorage.getItem(LOGIN_DRAFT_PASSWORD)) || '';
      if (!password || !context) {
        return false;
      }
      try {
        const result = await loginAndRouteAfterCredentials({
          context,
          navigation,
          credential: email,
          password,
          tenant,
          otpToast: true,
        });
        if (result === 'otp' || result === 'home') {
          await clearPendingCompanyCreation();
          return true;
        }
      } catch (error: any) {
        if (isWorkspaceProvisioningError(error)) {
          return false;
        }
        if (error?.response?.status === 401) {
          await finishToSignIn(tenant, email);
          Toast.show({
            type: 'error',
            text1: 'Check your password',
            text2: 'Your workspace is ready. Sign in with the password you used at signup.',
          });
          return true;
        }
        throw error;
      }
      return false;
    },
    [context, finishToSignIn, navigation],
  );

  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;
    cancelledRef.current = false;

    (async () => {
      const pending = await getPendingCompanyCreation();
      const tenant = (
        route.params?.tenant ||
        pending?.companyName ||
        ''
      )
        .trim()
        .toLowerCase();
      const email = (route.params?.email || pending?.email || '').trim();
      const taskId = pending?.taskId || '';
      const autoLogin = route.params?.autoLogin !== false;

      if (!tenant && !taskId) {
        navigation.replace('SignIn');
        return;
      }

      while (!cancelledRef.current) {
        try {
          if (taskId) {
            const {data} = await getCompanyCreationTaskStatus(taskId);
            if (data.message) {
              setStatusMessage(data.message);
            }
            if (typeof data.progress === 'number') {
              setProgress(Math.max(8, Math.min(99, data.progress)));
            }
            if (data.state === 'FAILURE') {
              await clearPendingCompanyCreation();
              Toast.show({
                type: 'error',
                text1: 'Company setup',
                text2: data.message || 'Setup failed. Please try again.',
              });
              navigation.replace('SignUp');
              return;
            }
            if (isSignupAccountReady(data)) {
              setProgress(100);
              setStatusMessage('Account ready. Signing you in…');
            }
          } else if (tenant) {
            const {data} = await getWorkspaceStatus(tenant);
            if (data.message) {
              setStatusMessage(data.message);
            }
            setProgress(
              Math.max(
                8,
                Math.min(isSignupAccountReady(data) ? 100 : 99, data.progress || 8),
              ),
            );
          }

          if (autoLogin && tenant && email) {
            const signedIn = await tryAutoLogin(tenant, email);
            if (signedIn) {
              return;
            }
          }

          if (taskId) {
            const {data} = await getCompanyCreationTaskStatus(taskId);
            if (isSignupAccountReady(data)) {
              await finishToSignIn(tenant, email);
              Toast.show({
                type: 'success',
                text1: 'Account ready',
                text2: 'Sign in and verify. Workspace setup continues in the background.',
              });
              return;
            }
          } else if (tenant) {
            const {data} = await getWorkspaceStatus(tenant);
            if (isSignupAccountReady(data)) {
              await finishToSignIn(tenant, email);
              Toast.show({
                type: 'success',
                text1: 'Account ready',
                text2: 'Sign in and verify. Workspace setup continues in the background.',
              });
              return;
            }
          }
        } catch (error: any) {
          if (cancelledRef.current) {
            return;
          }
          if (isWorkspaceProvisioningError(error)) {
            setStatusMessage('Still creating your account…');
          } else if (error?.response?.status === 404) {
            await clearPendingCompanyCreation();
            Toast.show({
              type: 'error',
              text1: 'Setup session expired',
              text2: 'Please sign up again.',
            });
            navigation.replace('SignUp');
            return;
          }
        }
        await new Promise<void>(resolve => setTimeout(resolve, POLL_MS));
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [finishToSignIn, navigation, route.params, tryAutoLogin]);

  const onCancel = async () => {
    cancelledRef.current = true;
    await clearPendingCompanyCreation();
    navigation.replace('SignIn');
  };

  const pct = Math.max(0, Math.min(100, progress));

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.center, {paddingTop: topInset}]}>
        <ActivityIndicator size="large" color={CTA_BRAND} />
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Creating your account
        </Text>
        <Text style={[styles.message, {color: colors.textSecondary}]}>
          {statusMessage}
        </Text>
        <View style={[styles.track, {backgroundColor: '#E8EEEC'}]}>
          <View style={[styles.fill, {width: `${pct}%`}]} />
        </View>
        <Text style={[styles.percent, {color: colors.textSecondary}]}>
          {Math.round(pct)}%
        </Text>
        <Text style={[styles.hint, {color: colors.textSecondary}]}>
          You can sign in and verify as soon as your account is ready.
        </Text>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.cancelBtn}
          activeOpacity={0.85}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Text style={[styles.cancelText, {color: colors.textSecondary}]}>
            I’ll sign in later
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: authOnboarding.screenPadding.horizontal,
  },
  title: {
    ...FONTS.h2,
    marginTop: 24,
    textAlign: 'center',
  },
  message: {
    ...FONTS.body3,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  track: {
    marginTop: 28,
    height: 6,
    width: '100%',
    maxWidth: 280,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: CTA_BRAND,
    borderRadius: 999,
  },
  percent: {
    ...FONTS.body4,
    marginTop: 10,
    fontWeight: '700',
  },
  hint: {
    ...FONTS.body4,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelBtn: {
    marginTop: 32,
    paddingVertical: 12,
  },
  cancelText: {
    ...FONTS.body3,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default CompanyProvisioningScreen;
