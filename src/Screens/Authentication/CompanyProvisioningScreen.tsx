import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import {useTheme} from "../../context/ThemeContext";
import {useScreenTopInset} from "../../hooks/useScreenTopInset";
import { FONTS } from "../../constants";
import { authOnboarding } from "../../design-system/authOnboardingTokens";
import { seedLoginCredentialsAfterSignup } from "../../utils/loginCredentials";
import {
    getPendingCompanyCreation,
    clearPendingCompanyCreation,
} from "../../utils/pendingCompanyCreation";
import { pollCompanyCreationTask } from "../../services/companyOnboarding.service";
import type { RootStackParamList } from "../../@types/types.dto";

type Nav = NativeStackNavigationProp<RootStackParamList, "CompanyProvisioning">;

const CTA_BRAND = "#0b5cff";

const CompanyProvisioningScreen = () => {
    const { colors } = useTheme();
    const topInset = useScreenTopInset();
    const navigation = useNavigation<Nav>();
    const [statusMessage, setStatusMessage] = useState("Checking company setup…");
    const ranRef = useRef(false);

    const finishSuccess = useCallback(
        async (companyName: string, email: string) => {
            await clearPendingCompanyCreation();
            await seedLoginCredentialsAfterSignup(companyName, email);
            Toast.show({
                text1: "Company created",
                text2: "Sign in with your email and password to verify your account.",
                type: "success",
            });
            navigation.replace("SignIn");
        },
        [navigation],
    );

    const handleFailure = useCallback(
        async (message: string, navigateTo: "SignUp" | "SignIn") => {
            await clearPendingCompanyCreation();
            Toast.show({
                type: "error",
                text1: "Company setup",
                text2: message,
            });
            navigation.replace(navigateTo);
        },
        [navigation],
    );

    useEffect(() => {
        if (ranRef.current) {
            return;
        }
        ranRef.current = true;

        (async () => {
            const pending = await getPendingCompanyCreation();
            if (!pending) {
                navigation.replace("SignIn");
                return;
            }

            setStatusMessage("Creating your workspace…");

            try {
                await pollCompanyCreationTask(pending.taskId, {
                    onProgress: (data) => {
                        if (data.message) {
                            setStatusMessage(data.message);
                        }
                    },
                });
                await finishSuccess(pending.companyName, pending.email);
            } catch (error: any) {
                const taskState = error?.taskStatus?.state;
                if (taskState === "FAILURE") {
                    await handleFailure(
                        error?.message || "Company creation failed.",
                        "SignUp",
                    );
                    return;
                }

                const msg = String(error?.message || "");
                const isNetworkish =
                    msg.includes("connection") ||
                    msg.includes("Network") ||
                    msg.includes("timeout") ||
                    msg.includes("longer than expected");

                if (error?.response?.status === 404) {
                    await handleFailure(
                        "This setup session is no longer valid. Please sign up again.",
                        "SignUp",
                    );
                    return;
                }

                if (isNetworkish) {
                    Toast.show({
                        type: "info",
                        text1: "Still working on it",
                        text2: "Open the app again to continue checking status.",
                    });
                    navigation.replace("SignIn");
                    return;
                }

                await handleFailure(
                    msg || "Something went wrong. Try again from sign up.",
                    "SignUp",
                );
            }
        })();
    }, [finishSuccess, handleFailure, navigation]);

    const onCancel = async () => {
        await clearPendingCompanyCreation();
        navigation.replace("SignIn");
    };

    return (
        <SafeAreaView
            style={[styles.safe, { backgroundColor: colors.background }]}
            edges={["left", "right", "bottom"]}>
            <View style={[styles.center, { paddingTop: topInset }]}>
                <ActivityIndicator size="large" color={CTA_BRAND} />
                <Text
                    style={[
                        styles.title,
                        { color: colors.textPrimary },
                    ]}>
                    Setting up your company
                </Text>
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {statusMessage}
                </Text>
                <TouchableOpacity
                    onPress={onCancel}
                    style={styles.cancelBtn}
                    activeOpacity={0.85}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                        Cancel
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: authOnboarding.screenPadding.horizontal,
    },
    title: {
        ...FONTS.h2,
        marginTop: 24,
        textAlign: "center",
    },
    message: {
        ...FONTS.body3,
        marginTop: 12,
        textAlign: "center",
        lineHeight: 22,
    },
    cancelBtn: {
        marginTop: 32,
        paddingVertical: 12,
    },
    cancelText: {
        ...FONTS.body3,
        textDecorationLine: "underline",
        fontWeight: "600",
    },
});

export default CompanyProvisioningScreen;
