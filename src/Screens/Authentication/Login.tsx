import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {icons, images} from '../../constants';
import AuthLayout from '../../Components/layouts/AuthLayout';
import FormInput from '../../Components/FormInput2';
import {COLORS} from '../../constants';
import {authService} from '../../services/auth.services';
import Toast from 'react-native-toast-message';
import { RootStackParamList } from '../../@types/types.dto';

const {width} = Dimensions.get('window');

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const Login = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [isCheckingTenant, setIsCheckingTenant] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const handleLogin = async () => {
    if (!tenant || !email || !password) {
      Toast.show({
        type: 'error',
        text1: `Please ${!tenant ? 'enter company name' : ''} ${
          !email ? 'enter email' : ''
        } ${!password ? 'enter password' : ''}`,
      });
      return;


    }

    setLoading(true);
    try {
      // Add your login logic here
      const response = await authService.login({tenant, email, password});
      if (response) {
        Toast.show({
          type: 'success',
          text1: 'Login successful',
        });
          setLoading(false);
          navigation.navigate('Home');
      }
    } catch (error) {
      console.log(error);
    }
  };

  const validateTenant = async (value: string) => {
    if (value.length >= 3) {
      setIsCheckingTenant(true);
      try {
        // Make your API call here to verify tenant
        const response = await authService.isCompanyExists(value);
        if (response) {
          setTenantError('');
        } else {
          setTenantError('Company not found');
        }
      } catch (error) {
        setTenantError('Error verifying company');
      } finally {
        setIsCheckingTenant(false);
      }
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Sign in to continue">
      <FormInput
        label="Company Name"
        value={tenant}
        onChangeText={text => {
          setTenant(text);
          validateTenant(text);
        }}
        placeholder="Enter Company Name"
        required
        error={tenantError}
        isLoading={isCheckingTenant}
        helpText="Enter your registered company name"
        startIcon={
          <Image
            source={icons.company}
            style={{width: 20, height: 20, tintColor: COLORS.grey}}
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
            style={{width: 20, height: 20, tintColor: COLORS.grey}}
          />
        }
        keyboardType="email-address"
        autoCapitalize="none"
      />

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
                tintColor: COLORS.grey,
              }}
            />
          </TouchableOpacity>
        }
      />

      {/* <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotPassword}>
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity> */}

      <TouchableOpacity
        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
        onPress={handleLogin}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      {/* <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account? </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('SignUp')}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Text style={styles.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View> */}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#80bdff',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signupText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    padding: 8,
  },
});

export default Login;
