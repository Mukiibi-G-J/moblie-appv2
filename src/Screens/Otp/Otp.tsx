import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { FONTS, SIZES } from '../../constants';
import AuthLayout from '../../Components/layouts/AuthLayout';
import { authOnboarding } from '../../design-system/authOnboardingTokens';
import CustomOTPInput from '../../Components/CustomOTPInput';
import { useRoute, useNavigation } from '@react-navigation/native';
import { resendOtp, verifyOtp } from '../../services/auth.services';
import Toast from 'react-native-toast-message';
import AppToastHost from '../../Components/AppToastHost';
import { getEmail, setVerifiedEmail } from '../../utils/tenant';
import { useAppContext, AppContextType } from '../../context/Store';
import { useTheme } from '../../context/ThemeContext';
import { radii } from '../../design-system/theme';
import type { AxiosError } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { DecodedToken } from '../../types/auth';
import { shouldOfferRestaurantPinFromToken } from '../../utils/restaurantPinOffer';
import { getRestaurantPinStatus } from '../../services/restaurantPinApi';
import {
    setPinSetupPending,
    RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
} from '../../storage/restaurantDeviceStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOGIN_DRAFT_PASSWORD } from '../../utils/loginCredentials';

const RESEND_TIMER_SECONDS = 30;
const OTP_LENGTH = 6;
const BRAND = '#005151';

function maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) {
        return phone;
    }
    return `***${digits.slice(-4)}`;
}

const Otp = () => {
    const { colors } = useTheme();
    const route = useRoute();
    const routeEmail =
        (route.params as { email?: string } | undefined)?.email?.trim() || '';
    const [email, setEmail] = useState(routeEmail);
    const navigation = useNavigation();
    const ctx = useAppContext() as AppContextType | null;
    const userPhone = (ctx?.auth?.phone || '').trim();

    const [otpCode, setOtpCode] = useState('');
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [remainingTime, setRemainingTime] = useState(RESEND_TIMER_SECONDS);
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        if (routeEmail) {
            return undefined;
        }
        let cancelled = false;
        void (async () => {
            const stored = (await getEmail())?.trim() || '';
            if (!cancelled && stored) {
                setEmail(stored);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [routeEmail]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (isTimerActive && remainingTime > 0) {
            interval = setInterval(() => {
                setRemainingTime((prevTime) => prevTime - 1);
            }, 1000);
        } else if (remainingTime === 0) {
            setIsTimerActive(false);
        }
        return () => clearInterval(interval);
    }, [isTimerActive, remainingTime]);

    const handleCodeFilled = (code: string) => {
        setOtpCode(code);
    };

    const handleCodeChanged = (code: string) => {
        setOtpCode(code);
    };

    const onBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('SignIn' as never);
        }
    };

    const handleResend = async () => {
        if (!email) {
            Toast.show({
                text1: 'Missing email',
                text2: 'Go back and sign in again.',
                type: 'error',
            });
            return;
        }
        if (resending) {
            return;
        }
        setResending(true);
        try {
            setIsTimerActive(true);
            setRemainingTime(RESEND_TIMER_SECONDS);
            const response = await resendOtp(email);
            if (response.status === 200) {
                Toast.show({
                    text1: 'Code sent',
                    text2:
                        email && userPhone
                            ? 'Check your email and phone for the new code.'
                            : 'Check your email for the new code.',
                    type: 'success',
                });
            }
        } catch (err: unknown) {
            const ax = err as AxiosError<{ message?: string }>;
            const msg =
                ax.response?.data?.message ||
                'Could not resend the code. Try again shortly.';
            Toast.show({
                type: 'error',
                text1: 'Resend failed',
                text2: msg,
            });
        } finally {
            setResending(false);
        }
    };

    const handleSubmit = async () => {
        if (!email) {
            Toast.show({
                text1: 'Missing email',
                text2: 'Go back and sign in again.',
                type: 'error',
            });
            return;
        }
        if (otpCode.length !== OTP_LENGTH || submitting) {
            return;
        }
        setSubmitting(true);
        try {
            const response = await verifyOtp(email, otpCode);
            const access = response.data?.access;
            const refresh = response.data?.refresh;

            if (response.status !== 200 || !access || !refresh) {
                throw new Error('Missing session tokens after verification');
            }

            await ctx?.loginWithTokens(access, refresh);
            await setVerifiedEmail(true);
            await AsyncStorage.removeItem(LOGIN_DRAFT_PASSWORD);

            const dec = jwtDecode(access) as DecodedToken;
            try {
                if (
                    shouldOfferRestaurantPinFromToken(
                        dec.role_center_modules,
                        dec.enabled_modules,
                        dec.authority,
                        dec.user_permissions?.allowPinLogin,
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

            Toast.show({
                text1: 'Account verified',
                text2: 'Welcome! Taking you to your dashboard…',
                type: 'success',
            });
        } catch (err: unknown) {
            const ax = err as AxiosError<{ message?: string }>;
            const msg =
                ax.response?.data?.message ||
                'Invalid or expired code. Please try again.';
            Toast.show({
                type: 'error',
                text1: 'Verification failed',
                text2: msg,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const codeReady = otpCode.length === OTP_LENGTH;
    const busy = submitting || resending;
    const canPressSubmit = codeReady && !busy;

    const usePrimarySubmitStyle = submitting || (codeReady && !resending);

    return (
        <AuthLayout
            title="Verify your account"
            showBackButton
            onBackPress={onBack}
            subtitle={
                <Text style={[styles.subtitleLead, { color: colors.textSecondary }]}>
                    We sent a {OTP_LENGTH}-digit code to your email
                    {userPhone ? ' and phone' : ''}. Enter it below to continue.
                </Text>
            }
        >
            <View style={styles.container}>
                <View
                    style={[
                        styles.emailCard,
                        {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Text
                        style={[styles.emailLabel, { color: colors.textTertiary }]}
                    >
                        Sent to
                    </Text>
                    <Text
                        style={[styles.emailValue, { color: BRAND }]}
                        numberOfLines={3}
                        selectable
                    >
                        {email || '—'}
                        {userPhone ? `\n${maskPhone(userPhone)}` : ''}
                    </Text>
                </View>

                <CustomOTPInput
                    pinCount={OTP_LENGTH}
                    onCodeFilled={handleCodeFilled}
                    onCodeChanged={handleCodeChanged}
                    editable={!busy}
                />

                <View style={styles.resendContainer}>
                    <Text style={[styles.resendLead, { color: colors.textSecondary }]}>
                        Didn&apos;t receive a code?
                    </Text>
                    {isTimerActive ? (
                        <Text style={[styles.timerText, { color: colors.textTertiary }]}>
                            {`Resend in ${remainingTime}s`}
                        </Text>
                    ) : (
                        <TouchableOpacity
                            onPress={handleResend}
                            disabled={resending || !email}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            {resending ? (
                                <ActivityIndicator color={BRAND} size="small" />
                            ) : (
                                <Text style={[styles.resendActionText, { color: BRAND }]}>
                                    Resend code
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.submitBtn,
                        usePrimarySubmitStyle
                            ? { backgroundColor: BRAND }
                            : {
                                  backgroundColor: colors.inputBackground,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                              },
                    ]}
                    onPress={handleSubmit}
                    disabled={!canPressSubmit}
                    activeOpacity={0.88}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text
                            style={[
                                styles.submitLabel,
                                {
                                    color: usePrimarySubmitStyle
                                        ? '#FFFFFF'
                                        : colors.textTertiary,
                                },
                            ]}
                        >
                            Verify &amp; continue
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
            <AppToastHost />
        </AuthLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignSelf: 'stretch',
        alignItems: 'stretch',
        paddingTop: SIZES.padding,
    },
    subtitleLead: {
        ...FONTS.body4,
        lineHeight: 22,
    },
    emailCard: {
        marginTop: authOnboarding.spacing.md,
        borderRadius: radii.lg,
        borderWidth: StyleSheet.hairlineWidth * 2,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    emailLabel: {
        ...FONTS.body4,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '600',
        marginBottom: 6,
    },
    emailValue: {
        ...FONTS.body3,
        fontWeight: '700',
        lineHeight: 22,
    },
    resendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: authOnboarding.spacing.lg,
        gap: 6,
    },
    resendLead: {
        ...FONTS.body4,
    },
    resendActionText: {
        ...FONTS.h3,
        fontWeight: '700',
    },
    timerText: {
        ...FONTS.body4,
    },
    submitBtn: {
        marginTop: authOnboarding.sectionSpacing.beforePrimaryAction,
        minHeight: 56,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: authOnboarding.spacing.lg,
    },
    submitLabel: {
        fontSize: authOnboarding.typo.body,
        fontWeight: '700',
    },
});

export default Otp;
