import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SIZES } from '../../constants';
import AuthLayout from '../Authentication/AuthLayout';
import CustomOTPInput from '../../Components/CustomOTPInput'
import TextButton from '../../Components/TextButton'; // Assuming you have this component
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { resendOtp, verifyOtp } from '../../services/auth.services';
import { ColorSpace } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { setVerifiedEmail } from '../../utils/tenant';


const RESEND_TIMER_SECONDS = 30;
const OTP_LENGTH = 5; // Changed from 4 to 5

const Otp = () => {
    const route = useRoute();
    const email = route.params?.email;
    const navigation = useNavigation();

    const [otpCode, setOtpCode] = useState('');
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [remainingTime, setRemainingTime] = useState(RESEND_TIMER_SECONDS);

    useEffect(() => {
        let interval;
        if (isTimerActive && remainingTime > 0) {
            interval = setInterval(() => {
                setRemainingTime((prevTime) => prevTime - 1);
            }, 1000);
        } else if (remainingTime === 0) {
            setIsTimerActive(false);
        }
        return () => clearInterval(interval);
    }, [isTimerActive, remainingTime]);

    const handleCodeFilled = (code) => {
        setOtpCode(code);
    };

    const handleCodeChanged = (code) => {
        setOtpCode(code);
    };

    const handleResend = async () => {
        // Implement your resend logic here
        console.log('Resending OTP');
        setIsTimerActive(true);
        setRemainingTime(RESEND_TIMER_SECONDS);
        const response = await resendOtp(email);
        console.log(response)
        if (response.status === 200) {
            Toast.show({
                text1: "OTP resent successfully",
                type: "success",
            });
        }
    };

    const handleSubmit = async () => {
        // Implement your submit logic here
        console.log(`Submitting OTP: ${otpCode}`);
        // Navigate to the next screen or verify OTP
        const response = await verifyOtp(email, otpCode);
        console.log(response);
        if (response.status === 200) {
            await setVerifiedEmail(true);
            Toast.show({
                text1: "OTP verified successfully",
                type: "success",
            });
            navigation.navigate("SignIn");
        }

    };

    return (
        <AuthLayout
            title="OTP Verification"
            subtitle={
                <>
                    An authentication code has been sent to this Email:{' '}
                    <Text style={{ color: COLORS.primary2, fontWeight: 'bold', fontSize: 18 }}>
                        {email}
                    </Text>
                </>
            }
        >
            <View style={styles.container}>
                <CustomOTPInput
                    pinCount={OTP_LENGTH} // Changed from 4 to 5
                    onCodeFilled={handleCodeFilled}
                    onCodeChanged={handleCodeChanged}
                />

                <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Didn't receive code?</Text>
                    {isTimerActive ? (
                        <Text style={styles.timerText}>{`Resend in ${remainingTime}s`}</Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend}>
                            <Text style={styles.resendActionText}>Resend OTP</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TextButton
                    label="Submit"
                    disabled={otpCode.length !== OTP_LENGTH} // Changed from 4 to 5
                    buttonContainerStyle={{
                        height: 55,
                        alignItems: 'center',
                        marginTop: SIZES.padding,
                        borderRadius: SIZES.radius,
                        backgroundColor: otpCode.length === OTP_LENGTH ? COLORS.primary2 : COLORS.transparentPrimary2,
                        width: '90%',
                    }}
                    onPress={handleSubmit}
                />
            </View>
            <Toast />
        </AuthLayout >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingTop: SIZES.padding * 2,
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SIZES.padding,
    },
    resendText: {
        color: COLORS.darkGray,
        ...FONTS.body3,
    },
    resendActionText: {
        color: COLORS.primary,
        ...FONTS.h3,
        marginLeft: 5,
    },
    timerText: {
        color: COLORS.darkGray,
        ...FONTS.body3,
        marginLeft: 5,
    },
});

export default Otp;
