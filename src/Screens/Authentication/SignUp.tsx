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
} from "react-native";
import AuthLayout from "../../Components/layouts/AuthLayout";
import FormInput2 from "../../Components/FormInput2";
import { COLORS, FONTS, icons, SIZES } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import utils from "../../utils/utils";
import React, { useState, useRef, useEffect } from "react";
import CustomPhoneInput, {
    UGANDA_DIAL_CODE,
} from "../../Components/CustomPhoneInput";
import Toast from "react-native-toast-message";
import { setTenant } from "../../utils/tenant";
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

/** Primary CTA — match Login Continue / Sign in */
const SIGNUP_PRIMARY = "#0b5cff";

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
    const { colors } = useTheme();

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
    const [isCompanyNameValid, setIsCompanyNameValid] = useState(false);
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

    useEffect(() => {
        const name = form.company_name.trim();
        if (companyValidateTimer.current) {
            clearTimeout(companyValidateTimer.current);
        }
        if (name.length < 3) {
            setCompanyValidationMessage("");
            setIsCompanyNameValid(false);
            return;
        }
        if (!isValidTenantSlug(name)) {
            setCompanyValidationMessage(
                "Use only letters, numbers, and underscores (no spaces). Minimum 3 characters.",
            );
            setIsCompanyNameValid(false);
            return;
        }
        companyValidateTimer.current = setTimeout(async () => {
            try {
                const { data } = await validateCompanyNameApi(name);
                setCompanyValidationMessage(data.message || "");
                setIsCompanyNameValid(data.isValid === true);
            } catch (e: any) {
                const msg =
                    e?.response?.data?.message ||
                    "Unable to validate company name. Try again.";
                setCompanyValidationMessage(msg);
                setIsCompanyNameValid(false);
            }
        }, 450);
        return () => {
            if (companyValidateTimer.current) {
                clearTimeout(companyValidateTimer.current);
            }
        };
    }, [form.company_name]);

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

            await setTenant(schemaName, form.email.trim());
            await clearPendingCompanyCreation();
            Toast.show({
                text1: "Company created",
                text2: "Sign in with your email and password.",
                type: "success",
            });
            navigation.navigate("SignIn");
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
        } finally {
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
            onChange: (value: string) =>
                setForm({ ...form, company_name: value.replace(/\s/g, "") }),
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
                                    <Text
                                        style={{
                                            color: isCompanyNameValid ? COLORS.success : COLORS.red,
                                            ...FONTS.body4,
                                            marginTop: 8,
                                        }}
                                    >
                                        {companyValidationMessage ||
                                            (isCompanyNameValid ? "Name looks good" : "")}
                                    </Text>
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

            {busy ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary2} />
                    <Text style={styles.loaderTitle}>
                        {statusMessage ||
                            (phase === "submitting"
                                ? "Starting company setup…"
                                : "Creating your company…")}
                    </Text>
                    <Text style={styles.loaderHint}>
                        This can take several minutes. Please stay on this screen and wait — do not
                        close the app.
                        {"\n\n"}
                        When your company is ready, we&apos;ll send a confirmation email to{" "}
                        {form.email.trim() ? form.email.trim() : "the address you entered"}.
                    </Text>
                </View>
            ) : null}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    loaderContainer: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        paddingHorizontal: 24,
    },
    loaderTitle: {
        ...FONTS.body3,
        color: COLORS.white,
        marginTop: SIZES.padding,
        textAlign: "center",
        fontWeight: "600",
        maxWidth: 340,
    },
    loaderHint: {
        ...FONTS.body4,
        color: "rgba(255,255,255,0.92)",
        marginTop: 16,
        textAlign: "center",
        lineHeight: 22,
        maxWidth: 340,
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
