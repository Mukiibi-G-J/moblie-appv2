import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import AuthLayout from "./AuthLayout";
import { FormInput, TextButton } from "../../Components";
import TextIconButton from "../../Components/TextIconButton";
import { COLORS, FONTS, icons, SIZES } from "../../constants";
import { useColorScheme } from 'react-native';
import utils from "../../utils/utils";
import React, { useState, useRef, useEffect } from 'react';
import CountryPicker, { CountryCode, Country } from 'react-native-country-picker-modal';
import CustomPhoneInput from "../../Components/CustomPhoneInput";
// import CustomPhoneInput from '../../Components/CustomPhoneInput'
import { ActivityIndicator } from "react-native";
import { signUpUser } from "../../services/auth.services";
import { navigate } from "../../hooks/NavigationService";
import Toast from "react-native-toast-message";
import { getEmail, getVerifiedEmail, setTenant, setVerifiedEmail } from "../../utils/tenant";

// Create a wrapper component
const CountryPickerWrapper = (props) => {
    const defaultProps = {
        // Add any default props here
        withFilter: true,
        withFlag: true,
        withCountryNameButton: true,
        withAlphaFilter: true,
        withCallingCode: true,
        withEmoji: true,
    };

    return <CountryPicker {...defaultProps} {...props} />;
};

const SignUp = ({ navigation }) => {



    useEffect(() => {
        const checkEmail = async () => {
            const verifiedEmail = await getVerifiedEmail();
            const email = await getEmail();
            if (verifiedEmail === 'false') {
                navigation.navigate("Otp", { email: email })
            }
        }
        checkEmail();
    }, [])

    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    const [form, setForm] = React.useState({
        email: "",
        fullName: "",
        phone: "",
        address: "",
        company_name: "",
        username: "",
        password: "",
    });

    const [errors, setErrors] = React.useState({
        emailError: "",
        usernameError: "",
        passwordError: "",
        fullNameError: "",
        phoneError: "",
        addressError: "",
        companyNameError: "",
    });

    const [showPass, setShowPass] = React.useState(false);

    const [phoneCountryCode, setPhoneCountryCode] = React.useState < CountryCode > ('UG');
    const [showPhoneCountryPicker, setShowPhoneCountryPicker] = React.useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isPhoneValid, setIsPhoneValid] = useState(true);
    const phoneInputRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);

    function isEnableSignUp() {
        return form.email && form.username && form.password && !errors.emailError && !errors.passwordError;
    }

    // Field configuration array
    const fields = [
        {
            label: "Full Name",
            value: form.fullName,
            autoCompleteType: 'name',
            errorMsg: errors.fullNameError,
            onChange: (value) => setForm({ ...form, fullName: value }),
        },
        {
            label: "Email",
            value: form.email,
            keyboardType: "email-address",
            autoCompleteType: "email",
            errorMsg: errors.emailError,
            onChange: (value) => {
                utils.validateEmail(value, (msg) => setErrors({ ...errors, emailError: msg }));
                setForm({ ...form, email: value });
            },
        },
        {
            label: "Username",
            value: form.username,
            onChange: (value) => setForm({ ...form, username: value }),
            errorMsg: errors.usernameError,
        },
        {
            label: "Address",
            value: form.address,
            errorMsg: errors.addressError,
            onChange: (value) => setForm({ ...form, address: value }),
        },
        {
            label: "Company Name",
            value: form.company_name,
            errorMsg: errors.companyNameError,
            onChange: (value) => setForm({ ...form, company_name: value }),
        },
        {
            label: "Phone Number",
            value: phoneNumber,
            errorMsg: !isPhoneValid && phoneNumber.length > 0 ? "Please enter a valid phone number" : "",
            customInput: (
                <CustomPhoneInput
                    ref={phoneInputRef}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    onValidationChange={setIsPhoneValid}
                    containerStyle={{
                        marginTop: SIZES.base,
                    }}
                    textInputStyle={{
                        ...FONTS.body3,
                    }}
                />
            ),
        },
        {
            label: "Password",
            value: form.password,
            secureTextEntry: !showPass,
            autoCompleteType: "password",
            onChange: (value) => {
                utils.validatePassword(value, (msg) => setErrors({ ...errors, passwordError: msg }));
                setForm({ ...form, password: value });
            },
            appendComponent: (
                <TouchableOpacity style={{ alignItems: 'center', justifyContent: 'center' }} onPress={() => setShowPass(!showPass)}>
                    <Image
                        source={showPass ? icons.eye_close : icons.eye}
                        style={{ height: 20, width: 20, tintColor: COLORS.gray }}
                    />
                </TouchableOpacity>
            ),
            errorMsg: errors.passwordError,
        },
    ];

    const handleSignUp = async () => {
        setIsLoading(true);
        const data = {
            email: form.email,
            username: form.username,
            password: form.password,
            full_name: form.fullName,
            company_name: form.company_name,
            address: form.address,
            phone_number: phoneCountryCode + phoneNumber,
        }

        try {
            const response = await signUpUser(data)
            console.log(response.data.sec)
            if (response.status === 201) {
                console.log(response.data)
                // store tenant
                await setTenant(response.data.schema_name, form.email);
                await setVerifiedEmail(false);
                Toast.show({
                    text1: "Sign up successful, check your email for verification code",
                    type: "success",
                });
                navigation.navigate("Otp", { email: form.email })
            }
        } catch (error) {
            console.error("Sign up error:", error.response?.data);
            const errorMessage = error.response?.data?.[0] || '';

            // Check for the specific duplicate company error
            if (errorMessage.includes('company_company_schema_name_key')) {
                setErrors(prev => ({
                    ...prev,
                    companyNameError: "This company name is already taken. Please choose a different name."
                }));
            } else if (error.response?.data) {
                const errorData = error.response.data;
                const newErrors = { ...errors };

                // Handle other specific field errors
                if (errorData.password) {
                    newErrors.passwordError = errorData.password[0];
                }
                if (errorData["Company Name"]) {
                    newErrors.companyNameError = errorData["Company Name"][0];
                }
                if (errorData.email) {
                    newErrors.emailError = errorData.email[0];
                }
                // Add other field error handlers as needed

                setErrors(newErrors);
            }

            // Show toast message for general errors
            Toast.show({
                type: 'error',
                text1: 'Sign Up Failed',
                text2: 'Please check your information and try again.',
            });
        } finally {
            setIsLoading(false);
        }
    }
    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
            >
                <AuthLayout
                    title="Getting Started"
                    subtitle="Create an account to continue!"
                    titleContainerStyle={{ marginTop: SIZES.height > 800 ? SIZES.radius : 0 }}
                >
                    <View style={{ flex: 1, marginTop: SIZES.height > 800 ? SIZES.padding : SIZES.radius }}>
                        {fields.map((field, index) => (
                            <View key={index} style={{ marginTop: index > 0 ? SIZES.radius : 0 }}>
                                {field.customInput ? (
                                    <>
                                        <Text style={{ color: COLORS.gray, ...FONTS.body4 }}>{field.label}</Text>
                                        {field.customInput}
                                    </>
                                ) : (
                                    <FormInput
                                        label={field.label}
                                        value={field.value}
                                        keyboardType={field.keyboardType}
                                        autoCompleteType={field.autoCompleteType}
                                        secureTextEntry={field.secureTextEntry}
                                        onChange={field.onChange}
                                        appendComponent={field.appendComponent}
                                        inputContainerStyle={{
                                            borderColor: field.errorMsg ? COLORS.red : COLORS.gray,
                                        }}
                                    />
                                )}
                                {field.errorMsg ? (
                                    <Text style={{ color: COLORS.red, ...FONTS.body4, marginTop: 5 }}>
                                        {field.errorMsg}
                                    </Text>
                                ) : null}
                            </View>
                        ))}
                        <TextButton
                            label={isLoading ? "Signing Up..." : "Sign Up"}
                            // disabled={!isEnableSignUp() || isLoading}
                            buttonContainerStyle={{
                                height: 55,
                                alignItems: 'center',
                                marginTop: SIZES.padding,
                                borderRadius: SIZES.radius,
                                backgroundColor: isEnableSignUp() && !isLoading ? COLORS.primary2 : COLORS.transparentPrimary2,
                            }}
                            onPress={handleSignUp}
                        // onPress={() => navigation.navigate("Otp", { email: form.email })}
                        >
                            {isLoading && <ActivityIndicator color={COLORS.white} style={{ marginLeft: 10 }} />}
                        </TextButton>

                        <View style={{ flexDirection: 'row', marginTop: SIZES.radius, justifyContent: 'center' }}>
                            <Text style={{ color: COLORS.darkGray, ...FONTS.body3 }}>Already have an account? </Text>
                            <TextButton
                                label="Sign In"
                                buttonContainerStyle={{ backgroundColor: null }}
                                labelStyle={{ color: COLORS.primary, ...FONTS.h3 }}
                                onPress={() => navigation.goBack()}
                            />
                        </View>
                    </View>

                    <View>
                        {/* <TextIconButton
                            containerStyle={{
                                height: 50,
                                alignItems: 'center',
                                borderRadius: SIZES.radius,
                                backgroundColor: COLORS.blue,
                            }}
                            icon={icons.fb}
                            iconPosition="LEFT"
                            iconStyle={{ tintColor: COLORS.white }}
                            label="Continue With Facebook"
                            labelStyle={{ marginLeft: SIZES.radius, color: COLORS.white }}
                            onPress={() => navigation.replace("Home")}
                        /> */}

                        <TextIconButton
                            containerStyle={{
                                marginTop: 20,
                                height: 50,
                                alignItems: 'center',
                                marginTop: SIZES.radius,
                                borderRadius: SIZES.radius,
                                backgroundColor: isDarkMode ? COLORS.white : COLORS.blue
                            }}
                            icon={icons.google}
                            iconPosition="LEFT"
                            iconStyle={{ tintColor: isDarkMode ? COLORS.black : COLORS.white }}
                            label="Continue With Google"
                            labelStyle={{ marginLeft: SIZES.radius, color: isDarkMode ? COLORS.black : COLORS.white }}
                            onPress={() => navigation.replace("Home")}
                        />
                    </View>
                </AuthLayout>
            </ScrollView>
            <Toast />

            {isLoading && (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary2} />
                </View>
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    loaderContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
});

export default SignUp;
