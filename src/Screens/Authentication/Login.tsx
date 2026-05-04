import React, {useState, useCallback, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {icons} from '../../constants';
import AuthLayout from '../../Components/layouts/AuthLayout';
import FormInput from '../../Components/FormInput2';
import {COLORS} from '../../constants';
import {authService} from '../../services/auth.services';
import {restaurantCompanyLookup} from '../../services/restaurantPinApi';
import Toast from 'react-native-toast-message';
import {jwtDecode} from 'jwt-decode';
import {RootStackParamList} from '../../@types/types.dto';
import {useAppContext, AppContextType} from '../../context/Store';
import {DecodedToken} from '../../types/auth';
import {shouldOfferRestaurantPinFromToken} from '../../utils/restaurantPinOffer';
import {getRestaurantPinStatus} from '../../services/restaurantPinApi';
import {
  setPinSetupPending,
  RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
} from '../../storage/restaurantDeviceStorage';
import {
  getEmail,
  getTenant,
  getVerifiedEmail,
  setVerifiedEmail,
} from '../../utils/tenant';
import {radii} from '../../design-system/theme';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {useTheme} from '../../context/ThemeContext';

const ao = authOnboarding;

/** Continue CTA solid fill */
const CONTINUE_BRAND = '#0b5cff';

type LoginNav = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const emailLooksValid = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

/** Last sign-in attempt (wrong credentials): refill fields after error and across app restarts. */
const LOGIN_DRAFT_TENANT = '@zentro_login_draft_tenant';
const LOGIN_DRAFT_EMAIL = '@zentro_login_draft_email';
const LOGIN_DRAFT_PASSWORD = '@zentro_login_draft_password';
const LOGIN_DRAFT_COMPANY_DISPLAY = '@zentro_login_draft_company_display';

const Login = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<LoginNav>();
  const context = useAppContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [isCheckingTenant, setIsCheckingTenant] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const saveLoginDraft = useCallback(
    async (includePassword: boolean) => {
      try {
        const pairs: [string, string][] = [
          [LOGIN_DRAFT_TENANT, tenant.trim()],
          [LOGIN_DRAFT_EMAIL, email.trim()],
        ];
        if (includePassword) {
          pairs.push([LOGIN_DRAFT_PASSWORD, password]);
        }
        await AsyncStorage.multiSet(pairs);
      } catch {
        /* ignore */
      }
    },
    [tenant, email, password],
  );

  const clearStoredLoginPassword = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(LOGIN_DRAFT_PASSWORD);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await AsyncStorage.multiGet([
          LOGIN_DRAFT_TENANT,
          LOGIN_DRAFT_EMAIL,
          LOGIN_DRAFT_PASSWORD,
        ]);
        if (cancelled) {
          return;
        }
        const map = Object.fromEntries(rows) as Record<string, string | undefined>;
        const t = map[LOGIN_DRAFT_TENANT];
        const e = map[LOGIN_DRAFT_EMAIL];
        const p = map[LOGIN_DRAFT_PASSWORD];
        if (t) {
          setTenant(t);
        }
        if (e) {
          setEmail(e);
        }
        if (p) {
          setPassword(p);
        }
        if (t && e && p) {
          setStep(2);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const verifiedFlag = await getVerifiedEmail();
        const storedEmail = await getEmail();
        const t = await getTenant();
        if (cancelled || !storedEmail?.trim() || !t?.trim()) {
          return;
        }
        if (verifiedFlag === 'false') {
          navigation.navigate('Otp', {email: storedEmail.trim()});
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const goBackToCredentials = useCallback(() => {
    setPassword('');
    setPasswordError('');
    setShowPassword(false);
    setStep(1);
    void clearStoredLoginPassword();
  }, [clearStoredLoginPassword]);

  const handleLogin = async () => {
    if (!tenant || !email || !password) {
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
      const response = await authService.login({
        tenant: schemaTenant,
        email,
        password,
      });
      if (response) {
        await context?.login({email, password, tenant: schemaTenant});

        const access = await AsyncStorage.getItem('accessToken');
        if (!access) {
          setLoading(false);
          await saveLoginDraft(true);
          Toast.show({
            type: 'error',
            text1: 'Login failed',
            text2: 'Could not complete sign-in. Try again.',
          });
          return;
        }

        const dec = jwtDecode(access) as DecodedToken;
        if (dec.verified === false) {
          await setVerifiedEmail(false);
          await AsyncStorage.setItem('email', email.trim());
          setLoading(false);
          Toast.show({
            type: 'info',
            text1: 'Verify your account',
            text2: 'Enter the code sent to your phone.',
          });
          navigation.reset({
            index: 0,
            routes: [{name: 'Otp', params: {email: email.trim()}}],
          });
          return;
        }

        await setVerifiedEmail(true);

        Toast.show({
          type: 'success',
          text1: 'Login successful',
          text2: 'Redirecting to dashboard...',
        });

        try {
          if (
            shouldOfferRestaurantPinFromToken(
              dec.role_center_modules,
              dec.enabled_modules,
              dec.authority,
            )
          ) {
            const status = await getRestaurantPinStatus(access);
            if (status.eligible && (!status.has_pin || status.pin_expired)) {
              const willShowBranchPicker =
                dec.enable_multiple_branches === true &&
                dec.can_switch_branch !== false;
              const branchPendingRaw = await AsyncStorage.getItem(
                'branch.branchSelectionPending',
              );
              const branchPending = branchPendingRaw === '1';
              if (willShowBranchPicker && branchPending) {
                await setPinSetupPending(true);
              } else {
                await AsyncStorage.setItem(
                  RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
                  '1',
                );
              }
            }
          }
        } catch {
          /* non-fatal */
        }

        await clearStoredLoginPassword();
        await saveLoginDraft(false);

        setTimeout(() => {
          setLoading(false);
        }, 5000);
      } else {
        setLoading(false);
        await saveLoginDraft(true);
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: 'Please check your credentials and try again',
        });
      }
    } catch (error: any) {
      console.log(error);
      setLoading(false);

      let errorMessage = 'An error occurred. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 401) {
        errorMessage =
          'Invalid credentials. Please check your email and password.';
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
    const e = email.trim();

    if (!t || !e) {
      Toast.show({
        type: 'error',
        text1: 'Missing information',
        text2: 'Enter company name and email',
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

    if (!emailLooksValid(e)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid email',
        text2: 'Enter a valid email address',
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
        {email.trim()}
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
      onBackPress={onBack}>
      {step === 1 ? (
        <>
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
});

export default Login;
