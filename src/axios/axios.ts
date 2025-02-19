import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigate} from '../hooks/NavigationService';

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}
interface CustomError extends AxiosError {
  customMessage?: string;
}

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
      console.log('Full error object:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data,
      });
      if (error.response?.data.detail) {
        return Promise.reject(error.response?.data.detail);
      }

      if (
        error.response &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        console.log('Clearing tokens and navigating to SignIn');
        // await AsyncStorage.removeItem('accessToken');
        // await AsyncStorage.removeItem('cartItems');
        // navigate('Auth', { screen: 'SignIn' });
      }
      if (error.message === 'Network Error') {
        return Promise.reject({
          ...error,
          customMessage: 'Please check your internet connection and try again.',
        });
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

class ApiService {
  private static instance: ApiService;
  private axiosInstance: AxiosInstance;

  private constructor(tenant?: string) {
    const config: ApiConfig = {
      baseURL: this.getBaseUrl(tenant),
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    this.axiosInstance = axios.create(config);
    this.setupInterceptors();
  }

  private getBaseUrl(tenant?: string): string {
    return tenant ? `https://${tenant}.zentroapp.app` : 'https://zentroapp.app';
  //   return tenant
  //     ? `https://${tenant}.a728-196-43-138-183.ngrok-free.app`
  //     : `https://a728-196-43-138-183.ngrok-free.app`;
  }

  public static getInstance(tenant?: string): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService(tenant);
    }
    console.log(ApiService.instance);
    return ApiService.instance;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('accessToken');
    } catch (error) {
      console.error('Error retrieving auth token:', error);
      return null;
    }
  }

  private setupInterceptors(): void {
    // Request Interceptor
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Add logging for the full URL
        console.log('Making request to:', `${config.baseURL}${config.url}`);
        return config;
      },
      (error: AxiosError) => {
        console.error('Request Interceptor Error:', error);
        return Promise.reject(error);
      },
    );

    // Response Interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: CustomError) => {
        return this.handleApiError(error);
      },
    );
  }

  private async handleApiError(error: CustomError) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
    };


    if (error.response?.data?.detail) {
      return Promise.reject(error.response.data.detail);
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      await this.handleAuthenticationError();
    }

    if (error.message === 'Network Error') {
      return Promise.reject({
        ...error,
        customMessage: 'Please check your internet connection and try again.',
      });
    }

    return Promise.reject(error);
  }

  private async handleAuthenticationError(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'cartItems']);
      navigate('Auth', {screen: 'SignIn'});
    } catch (error) {
      console.error('Error handling authentication:', error);
    }
  }

  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  public updateBaseUrl(tenant: string): void {
    this.axiosInstance.defaults.baseURL = this.getBaseUrl(tenant);
  }
}

// Create default instance
const defaultApiService = ApiService.getInstance();
const defaultAxiosInstance = defaultApiService.getAxiosInstance();

export {ApiService, defaultAxiosInstance, type CustomError};
