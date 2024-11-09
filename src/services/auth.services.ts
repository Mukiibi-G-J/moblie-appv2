import {axiosInstance, createAxiosInstance} from '../axios/axios'; // Import the Axios instance
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage

export const signUpUser = async (data: {
  email: string;
  username: string;
  password: string;
  full_name: string;
  company_name: string;
  address: string;
  phone_number: string;
}) => {
  try {
    const response = await axiosInstance.post('/api/auth/sign-up/', data);
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const loginUser = async (credentials: {
  email: string;
  password: string;
  tenant?: string;
}) => {
  try {
    // Get tenant from storage or from credentials
    const tenant = credentials.tenant || (await AsyncStorage.getItem('tenant'));
    if (!tenant) {
      return { error: 'Tenant not found' };
    }

    const axiosInstance = createAxiosInstance(tenant);

    const response = await axiosInstance.post('/api/auth/token/', credentials);
    await AsyncStorage.setItem('accessToken', response.data.access);

    // Store/update tenant info if not already stored
    if (tenant) {
      await AsyncStorage.setItem('tenant', tenant);
    }

    return response.data;
  } catch (error) {
    throw error;
  }
};

export const verifyOtp = async (email: string, otp: string) => {
  try {
    // Get tenant from storage
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);

    const response = await axiosInstance.post('/api/auth/verify-otp/', {
      email,
      otp,
    });
    return response;
  } catch (error) {
    throw error;
  }
};

export const resendOtp = async (email: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.post('/api/auth/resend-otp/', {email});
    return response;
  } catch (error) {
    throw error;
  }
};
