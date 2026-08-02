import {
    Image,
    KeyboardAvoidingView,
    StyleSheet,
    Platform,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Pressable,
    Modal,
} from "react-native";
import AuthLayout from "../../Components/layouts/AuthLayout";
import FormInput2 from "../../Components/FormInput2";
import { COLORS, FONTS, icons } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import utils from "../../utils/utils";
import React, { useState, useRef, useEffect, useCallback } from "react";
import CustomPhoneInput, {
    UGANDA_DIAL_CODE,
} from "../../Components/CustomPhoneInput";
import Toast from "react-native-toast-message";
import { seedLoginCredentialsAfterSignup } from "../../utils/loginCredentials";
import { loginAndRouteAfterCredentials } from "../../utils/postAuthNavigation";
import { useAppContext } from "../../context/Store";
import {
    savePendingCompanyCreation,
    clearPendingCompanyCreation,
} from "../../utils/pendingCompanyCreation";
import { Picker } from "@react-native-picker/picker";
import {
    createCompanyAccount,
    getOnboardingDataApi,
    pollCompanyCreationTask,
    validateCompanyNameApi,
} from "../../services/companyOnboarding.service";
import type { AxiosError } from "axios";
import { radii } from "../../design-system/theme";
import { authOnboarding } from "../../design-system/authOnboardingTokens";
import { SafeAreaView } from "react-native-safe-area-context";

/** Primary CTA — match Login Continue / Sign in */
const SIGNUP_PRIMARY = "#0b5cff";
const COMPANY_VALIDATION_DEBOUNCE_MS = 400;

const ORG_SIZE_OPTIONS = [
    { label: "Solo", value: "solo" },
    { label: "2 ~ 10 members", value: "2~10" },
    { label: "11 ~ 50 members", value: "11~50" },
    { label: "51 ~ 200 members", value: "51~200" },
    { label: "201 ~ 500 members", value: "201~500" },
];

/** Uganda-only for now; sent to the API, not shown on the form. */
const COMPANY_COUNTRY_CODE = "UG";

function isValidTenantSlug(name: string): boolean {
    const s = name.trim();
    if (s.length < 3) {
        return false;
    }
    return /^[a-zA-Z0-9_]+$/.test(s);
}

/** Same defaults as web `Welcome.tsx` — not shown in the form. */
function resolveDefaultOnboardingIds(
    categories: { id: number; name: string }[],
    objectives: { id: number; description: string }[],
): { businessCategory: string; businessObjective: string } {
    const category =
        categories.find((c) => /^others?$/i.test(c.name.trim())) ?? categories[0];
    const objective =
        objectives.find((o) => o.description === "Start a New Business") ??
        objectives[0];
    return {
        businessCategory: category ? String(category.id) : "1",
        businessObjective: objective ? String(objective.id) : "1",
    };
}

/** Backend still expects `userName`; derive from email when not collected (matches web). */
function deriveUserNameFromEmail(email: string): string {
    const local = email.trim().split("@")[0] || "user";
    let s = local.replace(/[^a-zA-Z0-9_]/g, "");
    if (s.length < 3) {
        s = `${s}usr`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32);
    }
    if (s.length < 3) {
        s = "user";
    }
    return s.slice(0, 50);
}

const SignUp = ({ navigation }) => {
    const context = useAppContext();
    const { colors, isDark } = useTheme();

    const [form, setForm] = React.useState({
        email: "",
        fullName: "",
        address: "",
        company_name: "",
        password: "",
    });

    const [errors, setErrors] = React.useState({
        emailError: "",
        passwordError: "",
        fullNameError: "",
        phoneError: "",
        addressError: "",
        companyNameError: "",
        organizationSizeError: "",
    });

    const [showPass, setShowPass] = React.useState(false);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isPhoneValid, setIsPhoneValid] = useState(false);
    const phoneInputRef = useRef(null);

    const [organizationSize, setOrganizationSize] = useState("");

    const [businessCategoryId, setBusinessCategoryId] = useState("1");
    const [businessObjectiveId, setBusinessObjectiveId] = useState("1");

    const [companyValidationMessage, setCompanyValidationMessage] = useState("");
    const [companyValidationErrors, setCompanyValidationErrors] = useState<string[]>([]);
    const [isCompanyNameValid, setIsCompanyNameValid] = useState(false);
    const [isCheckingCompanyName, setIsCheckingCompanyName] = useState(false);
    const latestCompanyNameRef = useRef("");
    const validationInFlightRef = useRef(0);
    const companyValidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [phase, setPhase] = useState<"idle" | "submitting" | "provisioning">("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const totalSteps = 3;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await getOnboardingDataApi();
                if (cancelled) return;
                const cats = data.business_categories || [];
                const objs = data.business_objectives || [];
                const defaults = resolveDefaultOnboardingIds(cats, objs);
                setBusinessCategoryId(defaults.businessCategory);
                setBusinessObjectiveId(defaults.businessObjective);
            } catch {
                if (!cancelled) {
                    setBusinessCategoryId("1");
                    setBusinessObjectiveId("1");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const applyCompanyValidation = useCallback(async (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.length < 3) {
            setIsCompanyNameValid(false);
            setCompanyValidationMessage("");
            setCompanyValidationErrors([]);
            return;
        }
        if (!isValidTenantSlug(trimmed)) {
            setIsCompanyNameValid(false);
            setCompanyValidationMessage(
                "Use only letters, numbers, and underscores (no spaces). Minimum 3 characters.",
            );
            setCompanyValidationErrors([]);
            return;
        }

        validationInFlightRef.current += 1;
        setIsCheckingCompanyName(true);
        setIsCompanyNameValid(false);
        setCompanyValidationMessage("");
        setCompanyValidationErrors([]);

        try {
            const { data } = await validateCompanyNameApi(trimmed);
            if (trimmed !== latestCompanyNameRef.current) {
                return;
            }
            setIsCompanyNameValid(data.isValid === true);
            setCompanyValidationMessage(data.message || "");
            setCompanyValidationErrors(data.errors || []);
        } catch (e: any) {
            if (trimmed !== latestCompanyNameRef.current) {
                return;
            }
            const body = e?.response?.data;
            if (
                body &&
                typeof body === "object" &&
                typeof body.message === "string"
            ) {
                setIsCompanyNameValid(body.isValid === true);
                setCompanyValidationMessage(body.message);
                setCompanyValidationErrors(
                    Array.isArray(body.errors) ? body.errors : [],
                );
                return;
            }
            const msg =
                e?.customMessage ||
                (e?.message === "Network Error"
                    ? "Cannot reach the server. Check api.config.ts and that Django is running."
                    : null) ||
                "Unable to validate company name. Try again.";
            setIsCompanyNameValid(false);
            setCompanyValidationMessage(msg);
            setCompanyValidationErrors([]);
        } finally {
            validationInFlightRef.current -= 1;
            if (validationInFlightRef.current === 0) {
                setIsCheckingCompanyName(false);
            }
        }
    }, []);

    const scheduleCompanyValidation = useCallback(
        (value: string) => {
            const trimmed = value.trim();
            latestCompanyNameRef.current = trimmed;

            if (companyValidateTimer.current) {
                clearTimeout(companyValidateTimer.current);
                companyValidateTimer.current = null;
            }

            if (!trimmed) {
                setIsCompanyNameValid(false);
                setCompanyValidationMessage("");
                setCompanyValidationErrors([]);
                setIsCheckingCompanyName(false);
                return;
            }

            if (trimmed.length < 3) {
                setIsCompanyNameValid(false);
                setCompanyValidationMessage("");
                setCompanyValidationErrors([]);
                setIsCheckingCompanyName(false);
                return;
            }

            if (!isValidTenantSlug(trimmed)) {
                setIsCompanyNameValid(false);
                setCompanyValidationMessage(
                    "Use only letters, numbers, and underscores (no spaces). Minimum 3 characters.",
                );
                setCompanyValidationErrors([]);
                setIsCheckingCompanyName(false);
                return;
            }

            companyValidateTimer.current = setTimeout(() => {
                void applyCompanyValidation(trimmed);
            }, COMPANY_VALIDATION_DEBOUNCE_MS);
        },
        [applyCompanyValidation],
    );

    useEffect(() => {
        return () => {
            if (companyValidateTimer.current) {
                clearTimeout(companyValidateTimer.current);
            }
        };
    }, []);

    function buildCompanyPhone(): string {
        const digits = phoneNumber.replace(/\D/g, "");
        return `${UGANDA_DIAL_CODE}${digits}`;
    }

    function canAdvanceFromStep1(): boolean {
        return (
            !!form.email.trim() &&
            !!form.password &&
            !!form.company_name.trim() &&
            isCompanyNameValid &&
            !isCheckingCompanyName &&
            !errors.emailError &&
            !errors.passwordError
        );
    }

    function canAdvanceFromStep2(): boolean {
        return (
            !!organizationSize &&
            !!form.fullName.trim() &&
            !!form.address.trim() &&
            !errors.fullNameError
        );
    }

    function isEnableSignUp(): boolean {
        const phoneOk =
            isPhoneValid &&
            buildCompanyPhone().length >= 11 &&
            buildCompanyPhone().length <= 16;
        return (
            !!form.email &&
            !!form.password &&
            !!form.fullName.trim() &&
            !!form.address.trim() &&
            !!form.company_name.trim() &&
            !!organizationSize &&
            !!businessCategoryId &&
            !!businessObjectiveId &&
            isCompanyNameValid &&
            phoneOk &&
            agreedTerms &&
            !errors.emailError &&
            !errors.passwordError
        );
    }

    const validateFullName = (value: string) => {
        if (value.length > 0 && value.length < 3) {
            setErrors((prev) => ({
                ...prev,
                fullNameError: "Full name must be at least 3 characters",
            }));
            return;
        }
        if (value.length > 0 && !/^[a-zA-Z\s]+$/.test(value)) {
            setErrors((prev) => ({
                ...prev,
                fullNameError: "Only letters and spaces",
            }));
            return;
        }
        setErrors((prev) => ({ ...prev, fullNameError: "" }));
    };

    const handleSignUp = async () => {
        const companyPhone = buildCompanyPhone();
        if (!isEnableSignUp()) {
            Toast.show({
                type: "error",
                text1: "Check your details",
                text2: "Please fill all fields and fix any errors.",
            });
            return;
        }

        setPhase("submitting");
        setStatusMessage("Starting company setup…");

        const payload = {
            companyName: form.company_name.trim(),
            companyEmail: form.email.trim(),
            companyPhone,
            companyAddress: form.address.trim(),
            companyCity: "",
            companyCountry: COMPANY_COUNTRY_CODE,
            userName: deriveUserNameFromEmail(form.email),
            fullName: form.fullName.trim(),
            password: form.password,
            organization_size: organizationSize,
            business_category: businessCategoryId,
            business_objective: businessObjectiveId,
            subscription: {
                plan: "FREE_TRIAL",
                price: 0,
                yearlyPrice: 0,
            },
        };

        try {
            const response = await createCompanyAccount(payload);
            if (response.status !== 200 || !response.data?.task_id) {
                throw new Error(response.data?.message || "Failed to start signup");
            }

            setPhase("provisioning");
            setStatusMessage(response.data.message || "Creating your company…");

            const schemaName = form.company_name.trim().toLowerCase();
            await savePendingCompanyCreation({
                taskId: response.data.task_id,
                companyName: schemaName,
                email: form.email.trim(),
            });

            await pollCompanyCreationTask(response.data.task_id, {
                onProgress: (data) => {
                    if (data.message) {
                        setStatusMessage(data.message);
                    }
                },
            });

            await seedLoginCredentialsAfterSignup(schemaName, form.email.trim());
            await clearPendingCompanyCreation();
            Toast.show({
                text1: "Company created",
                text2: "Enter the verification code we sent you.",
                type: "success",
            });
            setStatusMessage("Taking you to verification…");
            const loginResult = await loginAndRouteAfterCredentials({
                context,
                navigation,
                credential: form.email.trim(),
                password: form.password,
                tenant: schemaName,
                otpToast: false,
            });
            if (loginResult === "otp" || loginResult === "home") {
                return;
            }
            setPhase("idle");
            setStatusMessage("");
            Toast.show({
                type: "error",
                text1: "Could not start verification",
                text2: "Sign in with your email and password.",
            });
            navigation.replace("SignIn");
        } catch (error: any) {
            const taskStatus = error?.taskStatus as { state?: string } | undefined;
            if (taskStatus?.state === "FAILURE") {
                await clearPendingCompanyCreation();
            }
            const ax = error as AxiosError<{
                message?: string;
                error_type?: string;
            }>;
            if (ax.response?.status === 503) {
                Toast.show({
                    type: "error",
                    text1: "Service unavailable",
                    text2: "Please try again in a few minutes.",
                });
            } else if (ax.response?.data?.error_type === "validation_error") {
                Toast.show({
                    type: "error",
                    text1: "Validation",
                    text2: ax.response.data.message || "Check required fields.",
                });
            } else if (error?.message) {
                Toast.show({
                    type: "error",
                    text1: "Sign up failed",
                    text2: String(error.message),
                });
            } else {
                Toast.show({
                    type: "error",
                    text1: "Sign up failed",
                    text2: "Please check your connection and try again.",
                });
            }
            setPhase("idle");
            setStatusMessage("");
        }
    };

    const iconMuted = { width: 20, height: 20, tintColor: colors.iconMuted } as const;

    const fields = [
        {
            label: "Organization / company name (URL slug)",
            value: form.company_name,
            autoCompleteType: "off" as const,
            errorMsg: errors.companyNameError,
            onChange: (value: string) => {
                const cleaned = value.replace(/\s/g, "");
                setForm({ ...form, company_name: cleaned });
                scheduleCompanyValidation(cleaned);
            },
        },
        {
            label: "Email",
            value: form.email,
            keyboardType: "email-address" as const,
            autoCompleteType: "email" as const,
            errorMsg: errors.emailError,
            onChange: (value: string) => {
                utils.validateEmail(value, (msg) =>
                    setErrors({ ...errors, emailError: msg }),
                );
                setForm({ ...form, email: value });
            },
        },
        {
            label: "Password",
            value: form.password,
            secureTextEntry: !showPass,
            autoCompleteType: "password" as const,
            onChange: (value: string) => {
                utils.validatePassword(value, (msg) =>
                    setErrors({ ...errors, passwordError: msg }),
                );
                setForm({ ...form, password: value });
            },
            errorMsg: errors.passwordError,
        },
        {
            label: "Full name",
            value: form.fullName,
            autoCompleteType: "name" as const,
            errorMsg: errors.fullNameError,
            onChange: (value: string) => {
                validateFullName(value);
                setForm({ ...form, fullName: value });
            },
        },
        {
            label: "Address",
            value: form.address,
            errorMsg: errors.addressError,
            onChange: (value: string) => setForm({ ...form, address: value }),
        },
    ];

    const busy = phase !== "idle";

    const gap = authOnboarding.sectionSpacing.betweenFields;

    const subtitleBlock =
        step === 1 ? (
            <Text
                style={{
                    color: colors.textSecondary,
                    fontSize: authOnboarding.typo.body,
                    lineHeight: 24,
                }}
            >
                No long-term commitments.{"\n"}
                Just the tools you need to run your business.{"\n"}
                Get started in minutes.
            </Text>
        ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                Step {step} of {totalSteps}
            </Text>
        );

    const stepTitle =
        step === 1
            ? "Create a Zentroapp account"
            : step === 2
              ? "Business details"
              : "Contact & finish";

    const pickerShell = {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        marginTop: 8,
        overflow: "hidden" as const,
        backgroundColor: colors.inputBackground,
    };

    const goBackScreen = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate("SignIn");
        }
    };

    const onBack = () => {
        if (busy) {
            Toast.show({
                type: "info",
                text1: "Setup in progress",
                text2: "Please keep this screen open until we are finished.",
            });
            return;
        }
        if (step === 3) {
            setStep(2);
        } else if (step === 2) {
            setStep(1);
        } else {
            goBackScreen();
        }
    };

    const goNext = () => {
        if (step === 1) {
            if (!canAdvanceFromStep1()) {
                Toast.show({
                    type: "error",
                    text1: "Check your details",
                    text2: "Enter a valid email, password, and company URL.",
                });
                return;
            }
            setStep(2);
            return;
        }
        if (step === 2) {
            if (!canAdvanceFromStep2()) {
                Toast.show({
                    type: "error",
                    text1: "Check your details",
                    text2: "Select organization size and fill name and address.",
                });
                return;
            }
            setStep(3);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
            <AuthLayout
                title={stepTitle}
                subtitle={subtitleBlock}
                showBackButton
                onBackPress={onBack}
            >
                <View style={{ marginTop: gap }}>
                    {step === 1 ? (
                        <>
                            <View style={{ marginTop: 0 }}>
                                <FormInput2
                                    label={fields[0].label}
                                    value={fields[0].value}
                                    autoCapitalize="none"
                                    onChangeText={(t) => fields[0].onChange(t)}
                                    error={fields[0].errorMsg || undefined}
                                    startIcon={
                                        <Image source={icons.company} style={iconMuted} />
                                    }
                                    containerStyle={styles.inputNoExtraBottom}
                                />
                                {form.company_name.trim().length >= 3 ? (
                                    <View style={{ marginTop: 8 }}>
                                        {isCheckingCompanyName ? (
                                            <Text
                                                style={{
                                                    color: colors.textSecondary,
                                                    ...FONTS.body4,
                                                }}
                                            >
                                                Checking…
                                            </Text>
                                        ) : null}
                                        {companyValidationMessage && !isCheckingCompanyName ? (
                                            <Text
                                                style={{
                                                    color: isCompanyNameValid
                                                        ? COLORS.success
                                                        : COLORS.red,
                                                    ...FONTS.body4,
                                                }}
                                            >
                                                {companyValidationMessage}
                                            </Text>
                                        ) : null}
                                        {companyValidationErrors.length > 0 &&
                                        !isCheckingCompanyName ? (
                                            companyValidationErrors.map((err, index) => (
                                                <Text
                                                    key={`${err}-${index}`}
                                                    style={{
                                                        color: COLORS.red,
                                                        ...FONTS.body4,
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    • {err}
                                                </Text>
                                            ))
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>

                            <View style={{ marginTop: gap }}>
                                <FormInput2
                                    label={fields[1].label}
                                    value={fields[1].value}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    onChangeText={(t) => fields[1].onChange(t)}
                                    error={fields[1].errorMsg || undefined}
                                    startIcon={<Image source={icons.email} style={iconMuted} />}
                                    containerStyle={styles.inputNoExtraBottom}
                                />
                            </View>
                            <View style={{ marginTop: gap }}>
                                <FormInput2
                                    label={fields[2].label}
                                    value={fields[2].value}
                                    secureTextEntry={!showPass}
                                    onChangeText={(t) => fields[2].onChange(t)}
                                    helpText="Your password should have 8+ characters."
                                    error={fields[2].errorMsg || undefined}
                                    startIcon={<Image source={icons.lock} style={iconMuted} />}
                                    endIcon={
                                        <TouchableOpacity
                                            onPress={() => setShowPass(!showPass)}
                                            style={styles.iconButton}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                            <Image
                                                source={showPass ? icons.eye_close : icons.eye}
                                                style={iconMuted}
                                            />
                                        </TouchableOpacity>
                                    }
                                    containerStyle={styles.inputNoExtraBottom}
                                />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.nextButton,
                                    {
                                        backgroundColor: SIGNUP_PRIMARY,
                                        opacity: canAdvanceFromStep1() ? 1 : 0.45,
                                    },
                                ]}
                                onPress={goNext}
                                activeOpacity={0.88}
                            >
                                <Text style={styles.nextButtonText}>Next</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}

                    {step === 2 ? (
                        <>
                            <View style={{ marginTop: 0 }}>
                                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                                    Organization size
                                </Text>
                                <View style={pickerShell}>
                                    <Picker
                                        selectedValue={organizationSize}
                                        onValueChange={(v) => setOrganizationSize(v)}
                                    >
                                        <Picker.Item label="Select size..." value="" />
                                        {ORG_SIZE_OPTIONS.map((o) => (
                                            <Picker.Item key={o.value} label={o.label} value={o.value} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <View style={{ marginTop: gap }}>
                                <FormInput2
                                    label={fields[3].label}
                                    value={fields[3].value}
                                    autoCapitalize="words"
                                    onChangeText={(t) => fields[3].onChange(t)}
                                    error={fields[3].errorMsg || undefined}
                                    startIcon={<Image source={icons.profile} style={iconMuted} />}
                                    containerStyle={styles.inputNoExtraBottom}
                                />
                            </View>
                            <View style={{ marginTop: gap }}>
                                <FormInput2
                                    label={fields[4].label}
                                    value={fields[4].value}
                                    onChangeText={(t) => fields[4].onChange(t)}
                                    error={fields[4].errorMsg || undefined}
                                    startIcon={<Image source={icons.location} style={iconMuted} />}
                                    containerStyle={styles.inputNoExtraBottom}
                                />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.nextButton,
                                    {
                                        backgroundColor: SIGNUP_PRIMARY,
                                        opacity: canAdvanceFromStep2() ? 1 : 0.45,
                                    },
                                ]}
                                onPress={goNext}
                                activeOpacity={0.88}
                            >
                                <Text style={styles.nextButtonText}>Next</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}

                    {step === 3 ? (
                        <>
                            <View style={{ marginTop: 0 }}>
                                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                                    Phone number
                                </Text>
                                <CustomPhoneInput
                                    ref={phoneInputRef}
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    onValidationChange={setIsPhoneValid}
                                    containerStyle={{ marginTop: 8 }}
                                    textInputStyle={{ ...FONTS.body3 }}
                                />
                                {!isPhoneValid && phoneNumber.length > 0 ? (
                                    <Text style={[styles.fieldError, { color: COLORS.red }]}>
                                        Enter a valid phone number
                                    </Text>
                                ) : null}
                            </View>

                            <Pressable
                                onPress={() => setAgreedTerms(!agreedTerms)}
                                style={[styles.termsRow, { marginTop: gap + 4 }]}
                            >
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            borderColor: colors.textPrimary,
                                            backgroundColor: agreedTerms ? colors.textPrimary : "transparent",
                                        },
                                    ]}
                                >
                                    {agreedTerms ? (
                                        <Text style={{ color: colors.background, fontSize: 14, fontWeight: "700" }}>
                                            ✓
                                        </Text>
                                    ) : null}
                                </View>
                                <Text style={[styles.termsText, { color: colors.textPrimary }]}>
                                    I agree to Zentroapp&apos;s{" "}
                                    <Text style={styles.termsLink}>Terms of Service</Text>
                                    {" and "}
                                    <Text style={styles.termsLink}>Privacy Policy</Text>.
                                </Text>
                            </Pressable>

                            <Text style={[styles.legalFooter, { color: colors.textTertiary }]}>
                                By creating an account you accept our terms and data practices.
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.primaryCta,
                                    {
                                        backgroundColor: SIGNUP_PRIMARY,
                                        opacity: isEnableSignUp() && !busy ? 1 : 0.45,
                                    },
                                ]}
                                onPress={handleSignUp}
                                disabled={busy}
                                activeOpacity={0.88}
                            >
                                {busy ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <Text style={styles.primaryCtaText}>
                                        {phase === "provisioning"
                                            ? "Creating company…"
                                            : phase === "submitting"
                                              ? "Starting…"
                                              : "Create account"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : null}

                    {(step === 1 || step === 2) ? (
                        <View
                            style={[
                                styles.stepDivider,
                                { backgroundColor: colors.border, marginTop: authOnboarding.spacing.lg },
                            ]}
                        />
                    ) : null}

                    <View style={[styles.footerRow, { marginTop: step === 3 ? authOnboarding.spacing.lg : gap }]}>
                        <Text style={{ color: colors.textSecondary, ...FONTS.body3 }}>
                            Already have an account?{" "}
                        </Text>
                        <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
                            <Text style={[styles.inlineLink, { color: colors.textPrimary }]}>
                                Sign in
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </AuthLayout>
            <Toast />

            <Modal
                visible={busy}
                transparent={false}
                animationType="fade"
                statusBarTranslucent
                presentationStyle="fullScreen"
                onRequestClose={() => {
                    Toast.show({
                        type: "info",
                        text1: "Setup in progress",
                        text2: "Please keep this screen open until we are finished.",
                    });
                }}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                    <View style={styles.processingRoot}>
                        <View
                            style={[
                                styles.processingCard,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                },
                            ]}
                            accessibilityViewIsModal
                        >
                            <View
                                style={[
                                    styles.processingSpinnerRing,
                                    { backgroundColor: colors.inputBackground },
                                ]}
                            >
                                <ActivityIndicator size="large" color={SIGNUP_PRIMARY} />
                            </View>

                            <Text style={[styles.processingKicker, { color: colors.textTertiary }]}>
                                {phase === "submitting" ? "Starting" : "Provisioning"}
                            </Text>

                            <Text style={[styles.processingTitle, { color: colors.textPrimary }]}>
                                {statusMessage ||
                                    (phase === "submitting"
                                        ? "Starting company setup…"
                                        : "Creating your company…")}
                            </Text>

                            <Text style={[styles.processingBody, { color: colors.textSecondary }]}>
                                This can take several minutes. Keep this screen open and do not close
                                the app. We will notify you when it is done.
                            </Text>

                            <View
                                style={[
                                    styles.processingEmailPanel,
                                    {
                                        backgroundColor: isDark
                                            ? "rgba(11, 92, 255, 0.14)"
                                            : "rgba(11, 92, 255, 0.08)",
                                        borderColor: isDark
                                            ? "rgba(11, 92, 255, 0.35)"
                                            : "rgba(11, 92, 255, 0.2)",
                                    },
                                ]}
                            >
                                <Text
                                    style={[styles.processingEmailLead, { color: colors.textSecondary }]}
                                >
                                    Confirmation email will be sent to
                                </Text>
                                <Text
                                    style={[styles.processingEmailValue, { color: colors.textPrimary }]}
                                    numberOfLines={2}
                                >
                                    {form.email.trim() || "the address you entered"}
                                </Text>
                            </View>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    processingRoot: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: authOnboarding.spacing.lg,
    },
    processingCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: radii.lg,
        borderWidth: StyleSheet.hairlineWidth * 2,
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: "center",
    },
    processingSpinnerRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    processingKicker: {
        ...FONTS.body4,
        marginTop: 20,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontWeight: "600",
    },
    processingTitle: {
        ...FONTS.h3,
        marginTop: 8,
        textAlign: "center",
        fontWeight: "700",
        lineHeight: 26,
    },
    processingBody: {
        ...FONTS.body4,
        marginTop: 14,
        textAlign: "center",
        lineHeight: 22,
    },
    processingEmailPanel: {
        marginTop: 22,
        width: "100%",
        borderRadius: radii.md,
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    processingEmailLead: {
        ...FONTS.body4,
        textAlign: "center",
    },
    processingEmailValue: {
        ...FONTS.body3,
        marginTop: 6,
        textAlign: "center",
        fontWeight: "700",
    },
    pickerLabel: {
        ...FONTS.body4,
        marginBottom: 4,
    },
    fieldError: {
        ...FONTS.body4,
        marginTop: 6,
    },
    inputNoExtraBottom: {
        marginBottom: 0,
    },
    iconButton: {
        padding: 8,
    },
    termsRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        marginTop: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    termsText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    termsLink: {
        textDecorationLine: "underline",
        fontWeight: "600",
    },
    legalFooter: {
        fontSize: 12,
        lineHeight: 18,
        marginTop: 12,
        marginBottom: 4,
    },
    primaryCta: {
        marginTop: authOnboarding.sectionSpacing.beforePrimaryAction,
        minHeight: 56,
        borderRadius: radii.full,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: authOnboarding.spacing.lg,
    },
    primaryCtaText: {
        color: COLORS.white,
        fontSize: authOnboarding.typo.body,
        fontWeight: "600",
    },
    nextButton: {
        marginTop: authOnboarding.sectionSpacing.beforePrimaryAction,
        minHeight: 56,
        borderRadius: radii.full,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: authOnboarding.spacing.lg,
    },
    nextButtonText: {
        color: COLORS.white,
        fontSize: authOnboarding.typo.body,
        fontWeight: "600",
        letterSpacing: 0.3,
    },
    stepDivider: {
        height: 1,
        width: "100%",
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: authOnboarding.spacing.lg,
        flexWrap: "wrap",
    },
    inlineLink: {
        ...FONTS.h3,
        textDecorationLine: "underline",
        fontWeight: "600",
    },
});

export default SignUp;
