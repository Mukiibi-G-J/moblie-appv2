import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigate} from '../hooks/NavigationService';
import {
  USE_TEST_ENV,
  TEST_API_BASE_URL,
  TEST_TENANT_SCHEMA,
  PROD_BASE_URL,
} from '../config/api.config';

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}
interface CustomError extends AxiosError {
  customMessage?: string;
}

const createAxiosInstance = (tenant?: string) => {
  // Use test environment if enabled, otherwise use production
  // Trim tenant to remove any leading/trailing spaces
  const cleanTenant = tenant?.trim();
  const baseURL = USE_TEST_ENV
    ? TEST_API_BASE_URL
    : cleanTenant
    ? `https://${cleanTenant}.zentroapp-backend.com`
    : 'https://zentroapp-backend.com';
  // :'https://0f4c-41-75-190-104.ngrok-free.app'

  const instance = axios.create({baseURL});

  // Add request interceptor
  instance.interceptors.request.use(
    async config => {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Add X-Tenant header for test environment
      if (USE_TEST_ENV && TEST_TENANT_SCHEMA) {
        config.headers['X-Tenant'] = TEST_TENANT_SCHEMA;
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

      // Handle 401 (Unauthorized) - Authentication error
      if (error.response && error.response.status === 401) {
        console.log('Token expired or invalid - logging out user');
        await AsyncStorage.multiRemove(['accessToken', 'cartItems']);
        // Navigate to SignIn screen - AuthGuard will handle the rest
        navigate('Auth', {screen: 'SignIn'});
      }

      // Handle 403 (Forbidden) - Permission error (don't log out)
      if (error.response && error.response.status === 403) {
        const errorMessage =
          error.response?.data?.detail ||
          'You do not have permission to perform this action.';

        // Import Toast dynamically to avoid circular dependencies
        const Toast = require('react-native-toast-message').default;
        Toast.show({
          type: 'error',
          text1: 'Access Denied',
          text2: errorMessage,
          position: 'bottom',
        });

        return Promise.reject({
          ...error,
          customMessage: errorMessage,
        });
      }
      if (error.message === 'Network Error') {
        console.error('Network Error Details:', {
          code: error.code,
          message: error.message,
          baseURL: error.config?.baseURL,
          url: error.config?.url,
          fullUrl: `${error.config?.baseURL}${error.config?.url}`,
        });
        return Promise.reject({
          ...error,
          customMessage: USE_TEST_ENV
            ? 'Unable to connect to test server. Make sure:\n1. Your device and computer are on the same WiFi network\n2. The server is running on http://10.10.0.3:8000\n3. For Android: Run "adb reverse tcp:8000 tcp:8000" and use "http://localhost:8000" instead'
            : 'Please check your internet connection and try again.',
        });
      }
      return Promise.reject(error);
    },
  );

  return instance;
};

// Default instance - created without tenant initially
// IMPORTANT: Services should use createAxiosInstance(tenant) to ensure tenant is included
// This default instance is only for backward compatibility
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
    // Use test environment if enabled, otherwise use production
    if (USE_TEST_ENV) {
      return TEST_API_BASE_URL;
    }
    // Trim tenant to remove any leading/trailing spaces
    const cleanTenant = tenant?.trim();
    return cleanTenant
      ? `https://${cleanTenant}.zentroapp-backend.com`
      : 'https://zentroapp-backend.com';
    //   return tenant
    //     ? `https://${tenant}.a728-196-43-138-183.ngrok-free.app`
    //     : `https://a728-196-43-138-183.ngrok-free.app`;
  }

  public static getInstance(tenant?: string): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService(tenant);
    } else if (tenant) {
      // Update base URL if tenant is provided and instance already exists
      ApiService.instance.updateBaseUrl(tenant);
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

        // Add X-Tenant header for test environment
        if (USE_TEST_ENV && TEST_TENANT_SCHEMA && config.headers) {
          config.headers['X-Tenant'] = TEST_TENANT_SCHEMA;
        }

        // Add logging for the full URL
        console.log('Making request to:', `${config.baseURL}${config.url}`);
        if (USE_TEST_ENV) {
          console.log('Test Environment - X-Tenant:', TEST_TENANT_SCHEMA);
        }
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

    if (
      error.response?.data &&
      typeof error.response.data === 'object' &&
      'detail' in error.response.data
    ) {
      return Promise.reject((error.response.data as any).detail);
    }

    // Handle 401 (Unauthorized) - Authentication error
    if (error.response?.status === 401) {
      await this.handleAuthenticationError();
    }

    // Handle 403 (Forbidden) - Permission error (don't log out)
    if (error.response?.status === 403) {
      const errorData = error.response?.data as any;
      const errorMessage =
        errorData?.detail ||
        'You do not have permission to perform this action.';

      // Import Toast dynamically to avoid circular dependencies
      const Toast = require('react-native-toast-message').default;
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: errorMessage,
        position: 'bottom',
      });

      return Promise.reject({
        ...error,
        customMessage: errorMessage,
      });
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
