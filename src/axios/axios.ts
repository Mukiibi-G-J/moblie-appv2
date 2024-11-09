import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigate} from '../hooks/NavigationService';

const createAxiosInstance = (tenant?: string) => {
  const baseURL = tenant
    ? `https://${tenant}.zentroapp.app`
    : 'https://zentroapp.app';
  // :'https://0f4c-41-75-190-104.ngrok-free.app'

  const instance = axios.create({baseURL});

  // Add request interceptor
  instance.interceptors.request.use(
    async config => {
      const accessToken = await AsyncStorage.getItem('accessToken');
      console.log('accessToken being passed', accessToken);
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
      return config;
    },
    error => Promise.reject(error),
  );

  // Add response interceptor
  instance.interceptors.response.use(
    response => response,
    async error => {
      console.log('error', error);
      console.log('Axios interceptor caught error:', error.response?.status);
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('Clearing tokens and navigating to SignIn');
        // await AsyncStorage.removeItem('accessToken');
        // await AsyncStorage.removeItem('cartItems');
        // navigate('Auth', { screen: 'SignIn' });
      }
      return Promise.reject(error);
    },
  );

  return instance;
};

// Default instance without tenant
const axiosInstance = createAxiosInstance();

// Export both the default instance and the creator function
export {axiosInstance, createAxiosInstance};
