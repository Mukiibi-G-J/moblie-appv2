import React, {useState, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {icons} from '../../constants';
import AuthLayout from '../../Components/layouts/AuthLayout';
import FormInput from '../../Components/FormInput2';
import LoginMethodToggle, {
  type LoginMethod,
} from '../../Components/LoginMethodToggle';
import CustomPhoneInput, {
  UGANDA_DIAL_CODE,
} from '../../Components/CustomPhoneInput';
import {COLORS} from '../../constants';
import {restaurantCompanyLookup} from '../../services/restaurantPinApi';
import Toast from 'react-native-toast-message';
import {RootStackParamList} from '../../@types/types.dto';
import {useAppContext} from '../../context/Store';
import {getEmail, getTenant} from '../../utils/tenant';
import {
  LOGIN_DRAFT_TENANT,
  LOGIN_DRAFT_EMAIL,
  LOGIN_DRAFT_PASSWORD,
  LOGIN_DRAFT_LOGIN_METHOD,
  resolveLoginMethodFromCredential,
  type LoginDraftMethod,
} from '../../utils/loginCredentials';
import {loginAndRouteAfterCredentials} from '../../utils/postAuthNavigation';
import {showAuthSupportAlert} from '../../utils/authSupport';
import {radii} from '../../design-system/theme';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {useTheme} from '../../context/ThemeContext';

const ao = authOnboarding;

/** Continue CTA solid fill */
const CONTINUE_BRAND = '#0b5cff';

type LoginNav = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const emailLooksValid = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const E164_RE = /^\+[1-9]\d{1,14}$/;

function nationalFromStoredPhone(value: string): string {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('256')) {
    d = d.slice(3);
  }
  d = d.replace(/^0+/, '');
  return d.slice(0, 9);
}

const LOGIN_DRAFT_COMPANY_DISPLAY = '@zentro_login_draft_company_display';

const Login = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<LoginNav>();
  const context = useAppContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [isCheckingTenant, setIsCheckingTenant] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const buildLoginPhone = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    return `${UGANDA_DIAL_CODE}${digits}`;
  }, [phoneNumber]);

  const resolveLoginCredential = useCallback(() => {
    if (loginMethod === 'phone') {
      return buildLoginPhone();
    }
    return email.trim();
  }, [loginMethod, email, buildLoginPhone]);

  const saveLoginDraft = useCallback(
    async (includePassword: boolean) => {
      try {
        const pairs: [string, string][] = [
          [LOGIN_DRAFT_TENANT, tenant.trim()],
          [LOGIN_DRAFT_EMAIL, resolveLoginCredential()],
          [LOGIN_DRAFT_LOGIN_METHOD, loginMethod],
        ];
        if (includePassword) {
          pairs.push([LOGIN_DRAFT_PASSWORD, password]);
        }
        await AsyncStorage.multiSet(pairs);
      } catch {
        /* ignore */
      }
    },
    [tenant, resolveLoginCredential, loginMethod, password],
  );

  const clearStoredLoginPassword = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(LOGIN_DRAFT_PASSWORD);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (loading) {
        return;
      }
      let cancelled = false;
      void (async () => {
        try {
          const rows = await AsyncStorage.multiGet([
            LOGIN_DRAFT_TENANT,
            LOGIN_DRAFT_EMAIL,
            LOGIN_DRAFT_PASSWORD,
            LOGIN_DRAFT_LOGIN_METHOD,
          ]);
          if (cancelled) {
            return;
          }
          const map = Object.fromEntries(rows) as Record<
            string,
            string | undefined
          >;
          const storedTenant = ((await getTenant()) || '').trim();
          const storedEmail = ((await getEmail()) || '').trim();
          const p = map[LOGIN_DRAFT_PASSWORD];

          let t = storedTenant || map[LOGIN_DRAFT_TENANT]?.trim() || '';
          const draftCredential = map[LOGIN_DRAFT_EMAIL]?.trim() || '';
          let e = draftCredential || storedEmail;
          const storedMethod = resolveLoginMethodFromCredential(
            e,
            map[LOGIN_DRAFT_LOGIN_METHOD] as LoginDraftMethod | undefined,
          );

          if (t) {
            setTenant(t);
          }
          setLoginMethod(storedMethod);
          if (storedMethod === 'phone') {
            setPhoneNumber(nationalFromStoredPhone(e));
            setEmail('');
          } else if (e) {
            setEmail(e);
            setPhoneNumber('');
          }
          if (p) {
            setPassword(p);
            if (t && e) {
              setStep(2);
            }
          } else {
            setPassword('');
            setStep(1);
          }
        } catch {
          /* ignore */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loading]),
  );

  const goBackToCredentials = useCallback(() => {
    setPassword('');
    setPasswordError('');
    setShowPassword(false);
    setStep(1);
    void clearStoredLoginPassword();
  }, [clearStoredLoginPassword]);

  const handleLoginMethodChange = useCallback((method: LoginMethod) => {
    setLoginMethod(method);
    if (method === 'email') {
      setPhoneNumber('');
      setIsPhoneValid(false);
    } else {
      setEmail('');
    }
  }, []);

  const handleLogin = async () => {
    const credential = resolveLoginCredential();
    if (!tenant || !credential || !password) {
      Toast.show({
        type: 'error',
        text1: 'Please enter your password',
      });
      return;
    }

    const schemaTenant =
      ((await AsyncStorage.getItem('tenant')) || '').trim().toLowerCase() ||
      tenant.trim().toLowerCase();

    setLoading(true);
    try {
      const loginResult = await loginAndRouteAfterCredentials({
        context: context ?? null,
        navigation,
        credential,
        password,
        tenant: schemaTenant,
      });

      if (loginResult === 'otp') {
        setLoading(false);
        return;
      }

      if (loginResult === 'home') {
        await clearStoredLoginPassword();
        await saveLoginDraft(false);
        Toast.show({
          type: 'success',
          text1: 'Login successful',
          text2: 'Redirecting to dashboard...',
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      await saveLoginDraft(true);
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: 'Please check your credentials and try again',
      });
    } catch (error: any) {
      console.log(error);
      setLoading(false);

      let errorMessage = 'An error occurred. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 401) {
        errorMessage =
          'Invalid email, phone number, or password. Please try again.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Company not found. Please check your company name.';
      }

      await saveLoginDraft(true);
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: errorMessage,
      });
    }
  };

  const validateTenantLive = async (value: string) => {
    const v = value.trim();
    if (v.length < 3) {
      setTenantError('');
      return;
    }
    setIsCheckingTenant(true);
    try {
      await restaurantCompanyLookup(v);
      setTenantError('');
    } catch (e: any) {
      const st = e?.response?.status;
      const code = e?.response?.data?.code;
      if (st === 404) {
        setTenantError('Company not found');
      } else if (st === 400 && code === 'ambiguous_company_name') {
        setTenantError('Multiple matches — use exact company name');
      } else {
        setTenantError('');
      }
    } finally {
      setIsCheckingTenant(false);
    }
  };

  const continueToPassword = async () => {
    const t = tenant.trim();
    const credential = resolveLoginCredential();

    if (!t || !credential) {
      Toast.show({
        type: 'error',
        text1: 'Missing information',
        text2:
          loginMethod === 'phone'
            ? 'Enter company name and phone number'
            : 'Enter company name and email',
      });
      return;
    }

    if (t.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Company name',
        text2: 'Use at least 3 characters',
      });
      return;
    }

    if (loginMethod === 'email') {
      if (!emailLooksValid(credential)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid email',
          text2: 'Enter a valid email address',
        });
        return;
      }
    } else if (!isPhoneValid || !E164_RE.test(credential)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid phone number',
        text2: 'Enter a complete phone number',
      });
      return;
    }

    setContinuing(true);
    try {
      const result = await restaurantCompanyLookup(t);
      const schema = result.schema_name.trim().toLowerCase();
      await AsyncStorage.setItem('tenant', schema);
      try {
        await AsyncStorage.setItem(
          LOGIN_DRAFT_COMPANY_DISPLAY,
          result.display_name || result.name || '',
        );
      } catch {
        /* ignore */
      }
      setTenantError('');
    } catch (e: any) {
      const st = e?.response?.status;
      const code = e?.response?.data?.code;
      if (st === 404) {
        setTenantError('Company not found');
        Toast.show({
          type: 'error',
          text1: 'Company not found',
          text2: 'Check the name or sign up',
        });
      } else if (st === 400 && code === 'ambiguous_company_name') {
        setTenantError('Multiple matches — use exact company name');
        Toast.show({
          type: 'error',
          text1: 'Company name',
          text2: 'Use the exact name your administrator gave you.',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Could not verify company',
          text2: 'Check your connection and try again',
        });
      }
      return;
    } finally {
      setContinuing(false);
    }

    await saveLoginDraft(false);
    setStep(2);
  };

  const canExit = navigation.canGoBack();
  const showBack = step === 2 || canExit;
  const onBack =
    step === 2
      ? goBackToCredentials
      : canExit
        ? () => navigation.goBack()
        : undefined;

  const identitySubtitle = (
    <View style={styles.identityRow}>
      <Text
        style={[styles.identityEmail, {color: colors.textPrimary}]}
        numberOfLines={1}>
        {resolveLoginCredential()}
      </Text>
      <TouchableOpacity
        onPress={goBackToCredentials}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
        <Text style={[styles.changeLink, {color: colors.textPrimary}]}>
          Change
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AuthLayout
      title={step === 1 ? 'Sign in' : 'Welcome back'}
      subtitle={step === 2 ? identitySubtitle : undefined}
      showBackButton={showBack && !!onBack}
      onBackPress={onBack}
      headerRight={
        <TouchableOpacity
          onPress={showAuthSupportAlert}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          accessibilityRole="button"
          accessibilityLabel="Help and support">
          <Text style={[styles.helpLink, {color: colors.textPrimary}]}>
            Help
          </Text>
        </TouchableOpacity>
      }>
      {step === 1 ? (
        <>
          <LoginMethodToggle
            value={loginMethod}
            onChange={handleLoginMethodChange}
          />

          <FormInput
            label="Company Name"
            value={tenant}
            onChangeText={text => {
              setTenant(text);
              validateTenantLive(text);
            }}
            placeholder="Enter Company Name"
            required
            error={tenantError}
            isLoading={isCheckingTenant}
            helpText="Enter your registered company name"
            startIcon={
              <Image
                source={icons.company}
                style={{width: 20, height: 20, tintColor: colors.iconMuted}}
              />
            }
            autoCapitalize="none"
          />

          {loginMethod === 'email' ? (
            <FormInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              required
              helpText="We'll never share your email"
              startIcon={
                <Image
                  source={icons.email}
                  style={{width: 20, height: 20, tintColor: colors.iconMuted}}
                />
              }
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <View style={styles.phoneField}>
              <Text style={[styles.phoneLabel, {color: colors.textPrimary}]}>
                Phone number <Text style={styles.requiredMark}>*</Text>
              </Text>
              <CustomPhoneInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                onValidationChange={setIsPhoneValid}
              />
              {!isPhoneValid && phoneNumber.length > 0 ? (
                <Text style={[styles.phoneError, {color: COLORS.error}]}>
                  Enter a valid phone number
                </Text>
              ) : (
                <Text
                  style={[styles.phoneHelp, {color: colors.textSecondary}]}>
                  e.g. {UGANDA_DIAL_CODE}750440865
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.continueButton,
              continuing && styles.loginButtonDisabled,
            ]}
            onPress={continueToPassword}
            disabled={continuing}
            activeOpacity={0.88}>
            {continuing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={[styles.signupText, {color: colors.textSecondary}]}>
              Don&apos;t have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SignUp')}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Text style={[styles.signupLink, {color: colors.textPrimary}]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            required
            error={passwordError}
            helpText="Minimum 8 characters"
            secureTextEntry={!showPassword}
            endIcon={
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.iconButton}>
                <Image
                  source={showPassword ? icons.eye : icons.eye_close}
                  style={{
                    width: 20,
                    height: 20,
                    tintColor: colors.iconMuted,
                  }}
                />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            onPress={() =>
              Toast.show({
                type: 'info',
                text1: 'Forgot password',
                text2: 'Contact your administrator to reset your password.',
              })
            }
            style={styles.forgotPassword}
            hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
            <Text
              style={[styles.forgotPasswordText, {color: colors.textPrimary}]}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ao.spacing.sm,
  },
  identityEmail: {
    flex: 1,
    fontSize: ao.typo.body,
  },
  changeLink: {
    fontSize: ao.typo.body,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotPassword: {
    alignSelf: 'flex-start',
    marginBottom: ao.spacing.md,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: ao.typo.caption,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  continueButton: {
    marginTop: ao.sectionSpacing.beforePrimaryAction,
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: CONTINUE_BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ao.spacing.lg,
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: ao.typo.body,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loginButton: {
    marginTop: ao.sectionSpacing.beforePrimaryAction,
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: CONTINUE_BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ao.spacing.lg,
  },
  loginButtonDisabled: {
    opacity: 0.55,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: ao.typo.body,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ao.spacing.lg,
  },
  signupText: {
    fontSize: ao.typo.caption,
  },
  signupLink: {
    fontSize: ao.typo.caption,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  iconButton: {
    padding: 8,
  },
  helpLink: {
    fontSize: ao.typo.caption,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  phoneField: {
    marginBottom: ao.sectionSpacing.betweenFields,
  },
  phoneLabel: {
    fontSize: ao.typo.caption,
    fontWeight: '600',
    marginBottom: 8,
  },
  requiredMark: {
    color: COLORS.error,
  },
  phoneHelp: {
    fontSize: ao.typo.micro,
    marginTop: 6,
  },
  phoneError: {
    fontSize: ao.typo.micro,
    marginTop: 6,
  },
});

export default Login;
