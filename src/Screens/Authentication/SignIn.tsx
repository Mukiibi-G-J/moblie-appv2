import {
  Image,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import React, { useContext, useEffect, useState } from 'react';
import AuthLayout from './AuthLayout';
import { COLORS, FONTS, icons, SIZES } from '../../constants';
import FormInput from '../../Components/FormInput';
import TextButton from '../../Components/TextButton';
import CustomSwitch from '../../Components/CustomSwitch';
import TextIconButton from '../../Components/TextIconButton';
import utils from '../../utils/utils';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { AppContextType, useAppContext } from '../../context/Store';
import Toast from 'react-native-toast-message';
import {
  getEmail,
  getTenant,
  getTenantAxios,
  setTenantOnLogin,
} from '../../utils/tenant';
import CustomAlert from '../../Components/CustomAlert';

const SignIn = ({ navigation }: { navigation: any }) => {
  const context = useAppContext();
  const { login } = context as AppContextType;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');

  const [showPass, setShowPass] = useState(false);
  const [saveMe, setSaveMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState('');
  const [inputedTenant, setInputedTenant] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    const loadStoredCredentials = async () => {
      const storedEmail = await getEmail();
      const storedTenant = await getTenant();

      if (storedTenant) {
        setTenant(storedTenant);
      }
      if (storedEmail) {
        setEmail(storedEmail);
      }
    };
    loadStoredCredentials();
  }, []);

  function isEnableSignIn() {
    return email !== '' && password !== '' && emailError === '';
  }

  const handleSubmit = async () => {
    if (isEnableSignIn()) {
      const userCredentials = { email, password };
      setLoading(true);
      try {
        if (inputedTenant) {
          setTenantOnLogin(inputedTenant);
        }
        const response = await login(userCredentials);
        if (response && response.access) {
          console.log('response', response);
          // Navigate to Home screen and reset the entire navigation stack
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
          Toast.show({
            text1: 'Login Successful',
            text2: `Welcome, ${email}!`,
            type: 'success',
          });
        } else {
          Toast.show({
            text1: 'Login Failed',
            text2: 'Invalid credentials. Please try again.',
            type: 'error',
          });
        }
      } catch (error: any) {
        if (error.customMessage) {
          setAlertMessage(error.customMessage);
          setShowAlert(true);
        }
        handleError(error);
      } finally {
        setLoading(false);
      }
    } else {
      console.warn('Please fill in all fields correctly.');
    }
  };

  const handleError = (error: any) => {
    let title = 'Login Failed';
    let message = 'An unexpected error occurred';
    let type = 'error';

    // Network error
    if (error.response?.status === 500) {
      title = 'Network Error';
      message = 'Please check your internet connection and try again';
    }
    // Invalid credentials
    else if (error.response?.status === 401) {
      title = 'Invalid Credentials';
      message = 'The email or password you entered is incorrect';
    }
    // Custom error message from backend
    else if (error.customMessage) {
      message = error.customMessage;
    }
    // Other errors
    else if (typeof error === 'string') {
      message = error;
    }

    Toast.show({
      type,
      text1: title,
      text2: message,
      visibilityTime: 4000,
      position: 'top',
      topOffset: 50,
      props: {
        style: {
          borderLeftColor: COLORS.red,
          borderLeftWidth: 6,
        },
        contentContainerStyle: {
          paddingHorizontal: 15,
        },
        text1Style: {
          fontSize: 16,
          fontWeight: 'bold',
          color: COLORS.darkGray,
        },
        text2Style: {
          fontSize: 30,
          color: COLORS.black,
        },
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <AuthLayout
          titleContainerStyle={{
            marginBottom: SIZES.radius,
          }}
          title="Let's Sign You In"
          subtitle="Welcome back, you've been missed!">
          <View
            style={{
              flex: 1,
              marginTop: SIZES.height > 800 ? SIZES.padding * 2 : SIZES.radius,
            }}>
            {tenant && (
              // <Text style={{ color: COLORS.black, ...FONTS.body4, marginTop: SIZES.radius }}>{tenant}</Text>}

              <FormInput
                label="Company Name"
                value={inputedTenant ? inputedTenant : tenant}
                placeholder="Enter your Company Name"
                containerStyle={{ marginTop: SIZES.radius }}
                inputContainerStyle={{
                  borderBottomWidth: 0,
                  borderBottomColor: COLORS.gray,
                }}
                inputStyle={{ fontSize: 16, color: COLORS.black }}
                prependComponent={''}
                appendComponent={''}
                secureTextEntry={false}
                maxLength={100}
                onChange={(value: string) => {
                  setInputedTenant(value.replace(/\s+/g, ''));
                }}
                helperText="companyname should be in lower case"
              />
            )}
            {!tenant && (
              <FormInput
                label="Company Name"
                value={inputedTenant}
                placeholder="Enter your Company Name"
                containerStyle={{ marginTop: SIZES.radius }}
                inputContainerStyle={{
                  borderBottomWidth: 0,
                  borderBottomColor: COLORS.gray,
                }}
                inputStyle={{ fontSize: 16, color: COLORS.black }}
                prependComponent={''}
                appendComponent={''}
                secureTextEntry={false}
                maxLength={100}
                onChange={(value: string) =>
                  setInputedTenant(value.replace(/\s+/g, ''))
                }
                helperText="companyname should be in lower case"
              />
            )}

            <FormInput
              label="Email"
              value={email}
              autoCompleteType="email"
              placeholder="Enter your email"
              containerStyle={{ marginTop: SIZES.radius }}
              inputContainerStyle={{
                borderBottomWidth: 0,
                borderBottomColor: COLORS.gray,
              }}
              inputStyle={{ fontSize: 16, color: COLORS.black }}
              prependComponent={''}
              appendComponent={''}
              secureTextEntry={false}
              maxLength={100}
              onChange={(value: string) => {
                utils.validateEmail(value, setEmailError);
                setEmail(value);
              }}
            />
            {emailError && (
              <Text style={{ color: COLORS.red, ...FONTS.body4, marginTop: 4 }}>
                {emailError}
              </Text>
            )}

            <FormInput
              label="Password"
              secureTextEntry={!showPass}
              autoCompleteType="password"
              containerStyle={{ marginTop: SIZES.radius }}
              value={password}
              onChange={(value: string) => setPassword(value)}
              placeholder="Enter your password"
              inputContainerStyle={{
                marginBottom: 12,
                borderBottomWidth: 0,
                borderBottomColor: COLORS.gray,
              }}
              inputStyle={{ fontSize: 16, color: COLORS.black }}
              maxLength={100}
              prependComponent={''}
              appendComponent={
                <TouchableOpacity
                  style={{
                    width: 40,
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                  onPress={() => setShowPass(!showPass)}>
                  <Image
                    source={showPass ? icons.eye_close : icons.eye}
                    style={{
                      height: 20,
                      width: 20,
                      tintColor: COLORS.gray,
                    }}
                  />
                </TouchableOpacity>
              }
            />

            {loading && (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginTop: SIZES.radius }}
              />
            )}

            <View
              style={{
                flexDirection: 'row',
                marginTop: SIZES.radius,
                justifyContent: 'space-between',
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CustomSwitch
                  label="Save Me"
                  value={saveMe}
                  onChange={(value: boolean) => setSaveMe(value)}
                />
                /
              </View>
              <TextButton
                label="Forgot Password?"
                buttonContainerStyle={{ backgroundColor: null }}
                labelStyle={{ color: COLORS.primary, ...FONTS.body4 }}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={false}
              />
            </View>

            <TextButton
              label="Sign In"
              disabled={!isEnableSignIn() || loading}
              labelStyle={{ color: COLORS.white, ...FONTS.body4 }}
              buttonContainerStyle={{
                height: 55,
                alignItems: 'center',
                marginTop: SIZES.padding,
                borderRadius: SIZES.radius,
                backgroundColor:
                  isEnableSignIn() && !loading
                    ? COLORS.primary2
                    : COLORS.transparentPrimary2,
              }}
              onPress={handleSubmit}
            />

            {/* Sign Up */}
            <View
              style={{
                flexDirection: 'row',
                marginTop: SIZES.radius,
                justifyContent: 'center',
              }}>
              <Text style={{ color: COLORS.darkGray, ...FONTS.body3 }}>
                Don't have an account?{' '}
              </Text>
              <TextButton
                disabled={loading}
                label="Sign Up"
                buttonContainerStyle={{ backgroundColor: null }}
                labelStyle={{ color: COLORS.primary, ...FONTS.h3 }}
                onPress={() => navigation.navigate('SignUp')}
              />
            </View>
          </View>

          {/* Footer */}
          {/* <View>
                        <TextIconButton
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
                            onPress={() => { }}
                        />

                        <TextIconButton
                            containerStyle={{
                                height: 50,
                                alignItems: 'center',
                                marginTop: SIZES.radius,
                                borderRadius: SIZES.radius,
                                backgroundColor: COLORS.lightGray2,
                            }}
                            icon={icons.google}
                            iconPosition="LEFT"
                            iconStyle={{ tintColor: null }}
                            label="Continue With Google"
                            labelStyle={{ marginLeft: SIZES.radius, color: 'black' }}
                            onPress={() => { }}
                        />
                    </View> */}
        </AuthLayout>
      </ScrollView>
      <CustomAlert
        visible={showAlert}
        title="Login Failed"
        message={alertMessage}
        onClose={() => setShowAlert(false)}
      />
      <Toast />
    </KeyboardAvoidingView>
  );
};

export default SignIn;
