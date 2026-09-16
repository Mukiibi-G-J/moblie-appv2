import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AuthLayout from '../../Components/layouts/AuthLayout';
import FormInput from '../../Components/FormInput2';
import CustomOTPInput from '../../Components/CustomOTPInput';
import {COLORS, icons} from '../../constants';
import {RootStackParamList} from '../../@types/types.dto';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {radii} from '../../design-system/theme';
import {useTheme} from '../../context/ThemeContext';
import {
  passwordResetErrorMessage,
  requestPasswordResetOtp,
  resetPasswordWithToken,
  verifyForgotPasswordOtp,
} from '../../services/auth.services';

const ao = authOnboarding;
const BRAND = '#005151';
const OTP_LENGTH = 6;
const RESEND_TIMER_SECONDS = 30;

type Step = 'email' | 'otp' | 'password' | 'done';
type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
type Route = RouteProp<RootStackParamList, 'ForgotPassword'>;

const emailLooksValid = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const ForgotPassword = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const initialEmail = route.params?.email?.trim() || '';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [remainingTime, setRemainingTime] = useState(RESEND_TIMER_SECONDS);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerActive && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime(prev => prev - 1);
      }, 1000);
    } else if (remainingTime === 0) {
      setIsTimerActive(false);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerActive, remainingTime]);

  const startResendTimer = useCallback(() => {
    setIsTimerActive(true);
    setRemainingTime(RESEND_TIMER_SECONDS);
  }, []);

  const goToSignIn = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('SignIn');
  }, [navigation]);

  const onBack = useCallback(() => {
    if (step === 'otp') {
      setStep('email');
      setOtpCode('');
      return;
    }
    if (step === 'password') {
      setStep('otp');
      return;
    }
    goToSignIn();
  }, [goToSignIn, step]);

  const sendCode = useCallback(async () => {
    const trimmed = email.trim();
    if (!emailLooksValid(trimmed)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid email',
        text2: 'Enter the email on your account',
      });
      return false;
    }
    await requestPasswordResetOtp(trimmed);
    startResendTimer();
    return true;
  }, [email, startResendTimer]);

  const handleSendCode = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const sent = await sendCode();
      if (sent) {
        setStep('otp');
        Toast.show({
          type: 'success',
          text1: 'Code sent',
          text2: 'Check your email for a 6-digit code',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not send code',
        text2: passwordResetErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || isTimerActive) {
      return;
    }
    setResending(true);
    try {
      await sendCode();
      Toast.show({
        type: 'success',
        text1: 'Code sent',
        text2: 'Check your email for a new code',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Resend failed',
        text2: passwordResetErrorMessage(error),
      });
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== OTP_LENGTH || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const response = await verifyForgotPasswordOtp(email.trim(), otpCode);
      const token = response.data?.reset_token;
      if (!token) {
        throw new Error('Could not verify the code. Please try again.');
      }
      setResetToken(token);
      setStep('password');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Invalid code',
        text2: passwordResetErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (submitting) {
      return;
    }
    if (password.length < 8) {
      Toast.show({
        type: 'error',
        text1: 'Password too short',
        text2: 'Use at least 8 characters',
      });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Passwords do not match',
        text2: 'Re-enter the same password in both fields',
      });
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordWithToken(resetToken, password);
      setStep('done');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Reset failed',
        text2: passwordResetErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const titles: Record<Step, {title: string; subtitle: string}> = {
    email: {
      title: 'Forgot password',
      subtitle:
        "Enter the email on your account and we'll send a 6-digit reset code.",
    },
    otp: {
      title: 'Enter the code',
      subtitle: `We sent a 6-digit code to ${email.trim() || 'your email'}.`,
    },
    password: {
      title: 'Set a new password',
      subtitle: 'Choose a password you have not used before. Minimum 8 characters.',
    },
    done: {
      title: 'Password updated',
      subtitle: 'You can now sign in with your new password.',
    },
  };

  const eyeToggle = (
    visible: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity onPress={onPress} style={styles.iconButton}>
      <Image
        source={visible ? icons.eye : icons.eye_close}
        style={{width: 20, height: 20, tintColor: colors.iconMuted}}
      />
    </TouchableOpacity>
  );

  return (
    <AuthLayout
      title={titles[step].title}
      subtitle={titles[step].subtitle}
      showBackButton={step !== 'done'}
      onBackPress={onBack}>
      {step === 'email' ? (
        <>
          <FormInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            required
            startIcon={
              <Image
                source={icons.email}
                style={{width: 20, height: 20, tintColor: colors.iconMuted}}
              />
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabled]}
            onPress={handleSendCode}
            disabled={submitting}
            activeOpacity={0.88}>
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Send code</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'otp' ? (
        <>
          <CustomOTPInput
            pinCount={OTP_LENGTH}
            onCodeFilled={setOtpCode}
            onCodeChanged={setOtpCode}
            editable={!submitting}
          />
          <View style={styles.resendRow}>
            <Text style={[styles.resendLead, {color: colors.textSecondary}]}>
              Didn&apos;t receive a code?
            </Text>
            {isTimerActive ? (
              <Text style={[styles.timerText, {color: colors.textTertiary}]}>
                {`Resend in ${remainingTime}s`}
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                {resending ? (
                  <ActivityIndicator color={BRAND} size="small" />
                ) : (
                  <Text style={styles.resendAction}>Resend code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (submitting || otpCode.length !== OTP_LENGTH) && styles.disabled,
            ]}
            onPress={handleVerifyOtp}
            disabled={submitting || otpCode.length !== OTP_LENGTH}
            activeOpacity={0.88}>
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Verify code</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <FormInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter new password"
            required
            helpText="Minimum 8 characters"
            secureTextEntry={!showPassword}
            endIcon={eyeToggle(showPassword, () => setShowPassword(v => !v))}
          />
          <FormInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            required
            secureTextEntry={!showConfirm}
            endIcon={eyeToggle(showConfirm, () => setShowConfirm(v => !v))}
          />
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabled]}
            onPress={handleResetPassword}
            disabled={submitting}
            activeOpacity={0.88}>
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Update password</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'done' ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={goToSignIn}
          activeOpacity={0.88}>
          <Text style={styles.primaryButtonText}>Back to sign in</Text>
        </TouchableOpacity>
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  primaryButton: {
    marginTop: ao.sectionSpacing.beforePrimaryAction,
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ao.spacing.lg,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: ao.typo.body,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.55,
  },
  iconButton: {
    padding: 8,
  },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ao.spacing.lg,
    gap: 6,
  },
  resendLead: {
    fontSize: ao.typo.caption,
  },
  resendAction: {
    fontSize: ao.typo.body,
    fontWeight: '700',
    color: BRAND,
  },
  timerText: {
    fontSize: ao.typo.caption,
  },
});

export default ForgotPassword;
