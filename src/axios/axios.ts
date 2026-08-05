import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {navigate, navigationRef} from '../hooks/NavigationService';
import {
  USE_TEST_ENV,
  TEST_API_BASE_URL,
  TEST_TENANT_SCHEMA,
} from '../config/api.config';
import {forceLogout} from '../utils/authEvents';
import {
  getSubscriptionExpiredPayload,
  isSubscriptionExpiredError,
  type SubscriptionExpiredPayload,
} from '../utils/subscriptionExpired';
import {assertApiNotSimulatedOffline} from '../utils/simulatedOfflineGate';

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}
interface CustomError extends AxiosError {
  customMessage?: string;
}

/**
 * Public-schema API paths (company onboarding, etc.). In test mode we must not
 * send X-Tenant so the backend resolves these on the public tenant.
 */
const PUBLIC_SCHEMA_PATH_MARKERS = [
  '/api/company/create-company-account',
  '/api/company/task-status',
  '/api/company/validate-company-name',
  '/api/company/check-company-exists',
  '/api/home/on-boarding',
  '/api/auth/restaurant-app/company-lookup/',
];

function isPublicSchemaPath(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  return PUBLIC_SCHEMA_PATH_MARKERS.some(marker => url.includes(marker));
}

function shouldSendTestTenantHeader(url: string | undefined): boolean {
  if (!url) {
    return true;
  }
  return !isPublicSchemaPath(url);
}

/** Single-host / dev: X-Tenant from saved company schema, else config fallback. */
async function resolveTestXTenantHeader(): Promise<string | undefined> {
  const stored = await AsyncStorage.getItem('tenant');
  const fromStored = stored?.trim().toLowerCase();
  if (fromStored) {
    return fromStored;
  }
  const fromConfig = TEST_TENANT_SCHEMA?.trim().toLowerCase();
  return fromConfig || undefined;
}

function isRestaurantPinLoginPost(
  config: InternalAxiosRequestConfig | undefined,
): boolean {
  const url = config?.url || '';
  const method = (config?.method || 'get').toLowerCase();
  return method === 'post' && url.includes('/api/auth/pin/');
}

let lastSubscriptionRedirectAt = 0;

const BRANCH_SESSION_STORAGE_KEYS = {
  activeBranchId: 'branch.active_branch_id',
} as const;

function normalizeHeaderName(name: string): string {
  return name.toLowerCase();
}

function getHeaderValue(
  headers: Record<string, any> | undefined,
  name: string,
): unknown {
  if (!headers) return undefined;
  const target = normalizeHeaderName(name);
  // Axios v1 can use AxiosHeaders with .get() method.
  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(name);
  }
  const keys = Object.keys(headers);
  for (const k of keys) {
    if (normalizeHeaderName(k) === target) {
      return headers[k];
    }
  }
  return undefined;
}

function setHeaderValue(
  headers: Record<string, any> | undefined,
  name: string,
  value: string,
) {
  if (!headers) return;
  if (typeof (headers as any).set === 'function') {
    (headers as any).set(name, value);
    return;
  }
  headers[name] = value;
}

async function maybeInjectBranchHeaders(config: InternalAxiosRequestConfig) {
  const headers = (config.headers ?? {}) as any;
  if (!config.headers) config.headers = headers;

  // Never overwrite explicit per-request overrides.
  const hasScopeOverride = getHeaderValue(headers, 'X-Branch-Scope') != null;
  const hasBranchOverride = getHeaderValue(headers, 'X-Branch-Id') != null;
  if (hasScopeOverride || hasBranchOverride) {
    return;
  }

  const rawId = await AsyncStorage.getItem(BRANCH_SESSION_STORAGE_KEYS.activeBranchId);
  const id = rawId != null && rawId.trim() !== '' ? Number(rawId) : null;
  if (id != null && Number.isFinite(id)) {
    setHeaderValue(headers, 'X-Branch-Id', String(id));
  }
}

/**
 * Requests that must not attach the stored access token (e.g. PIN login, device-context).
 * Still applies branch + X-Tenant rules in test mode. No global 401 logout.
 */
export function createAnonymousAxiosInstance(tenant?: string) {
  const cleanTenant = tenant?.trim();
  const baseURL = USE_TEST_ENV
    ? TEST_API_BASE_URL
    : cleanTenant
    ? `https://${cleanTenant}.zentroapp-backend.com`
    : 'https://zentroapp-backend.com';

  const instance = axios.create({baseURL});
  instance.interceptors.request.use(
    async config => {
      assertApiNotSimulatedOffline(config);
      if (!isPublicSchemaPath(config.url)) {
        await maybeInjectBranchHeaders(config);
      }
      if (USE_TEST_ENV && shouldSendTestTenantHeader(config.url)) {
        const xTenant = await resolveTestXTenantHeader();
        if (xTenant) {
          setHeaderValue(config.headers as any, 'X-Tenant', xTenant);
        }
      }
      return config;
    },
    error => Promise.reject(error),
  );
  instance.interceptors.response.use(
    response => response,
    error => {
      if (error.message === 'Network Error' && USE_TEST_ENV) {
        return Promise.reject({
          ...error,
          customMessage:
            'Cannot reach the dev server. Same WiFi: set TEST_API_CONNECT_MODE to "lan" in api.config.ts and run `python manage.py runserver 0.0.0.0:8000`. USB/wireless ADB: run `adb reverse tcp:8000 tcp:8000` and use "adb-reverse" mode.',
        });
      }
      return Promise.reject(error);
    },
  );
  return instance;
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
      assertApiNotSimulatedOffline(config);
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Branch context (web parity): default X-Branch-Id unless request overrides.
      await maybeInjectBranchHeaders(config);

      if (USE_TEST_ENV && shouldSendTestTenantHeader(config.url)) {
        const xTenant = await resolveTestXTenantHeader();
        if (xTenant) {
          setHeaderValue(config.headers as any, 'X-Tenant', xTenant);
        }
      }

      return config;
    },
    error => Promise.reject(error),
  );

  // Add response interceptor
  const subscriptionNavParams = (payload: SubscriptionExpiredPayload) => ({
    fromExpiredModal: true,
    expiryKind: payload.expiryKind,
    lockDate: payload.lockDate,
  });

  const maybeHandleSubscriptionExpired = async (error: AxiosError) => {
    if (!isSubscriptionExpiredError(error)) {
      return false;
    }

    const now = Date.now();
    if (now - lastSubscriptionRedirectAt < 2000) {
      return true; // debounced
    }
    lastSubscriptionRedirectAt = now;

    const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
    const isAlreadyOnSubscription =
      currentRouteName === 'Subscription' ||
      currentRouteName === 'SubscriptionMobileMoney';
    if (isAlreadyOnSubscription) {
      return true;
    }

    const payload = getSubscriptionExpiredPayload(error);
    navigate('Subscription', subscriptionNavParams(payload));
    return true;
  };

  const isBenignPaginationError = (err: any) => {
    const detail = err?.response?.data?.detail;
    const message = err?.response?.data?.error;
    return (
      err?.response?.status === 404 &&
      (detail === 'Invalid page.' || message === 'Invalid page.')
    );
  };

  instance.interceptors.response.use(
    response => response,
    async error => {
      if (!isSubscriptionExpiredError(error) && !isBenignPaginationError(error)) {
        console.log('Full error object:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
          data: error.response?.data,
        });
      }

      // Handle 402 subscription expiry *before* rejecting `data.detail`.
      // Otherwise callers only see the detail string and no redirect happens.
      try {
        const handled = await maybeHandleSubscriptionExpired(error);
        if (handled) {
          return Promise.reject(error);
        }
      } catch (e) {
        // Non-fatal; fall back to other error handlers below.
        console.warn('Failed to handle subscription expiry:', e);
      }

      // Handle 401 (Unauthorized) - Authentication error
      if (error.response && error.response.status === 401) {
        if (!isRestaurantPinLoginPost(error.config)) {
          console.log('Token expired or invalid - logging out user');
          forceLogout();
        }

        // Preserve caller error context; do not convert to string too early.
        return Promise.reject(error);
      }

      // Handle 403 (Forbidden) - Permission error (don't log out)
      if (error.response && error.response.status === 403) {
        if (isRestaurantPinLoginPost(error.config)) {
          return Promise.reject(error);
        }
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

      // Keep full Axios error for pagination "Invalid page." so callers can
      // treat it as an empty page (unwrapping to a bare string hides status).
      if (isBenignPaginationError(error)) {
        return Promise.reject(error);
      }

      // If backend returned `{ detail: ... }`, often unwrap for callers — but keep the
      // full Axios error when the body also has app-specific fields (e.g. item journal post).
      const respData = error.response?.data as Record<string, unknown> | undefined;
      if (respData?.detail != null) {
        const hasStructuredAppError =
          Array.isArray(respData.invalid_journals) ||
          typeof respData.error === 'string';
        if (!hasStructuredAppError) {
          return Promise.reject(respData.detail);
        }
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
        assertApiNotSimulatedOffline(config);
        const token = await this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Branch context (web parity): default X-Branch-Id unless request overrides.
        await maybeInjectBranchHeaders(config);

        if (USE_TEST_ENV && config.headers && shouldSendTestTenantHeader(config.url)) {
          const xTenant = await resolveTestXTenantHeader();
          if (xTenant) {
            config.headers['X-Tenant'] = xTenant;
          }
        }

        // Add logging for the full URL
        console.log('Making request to:', `${config.baseURL}${config.url}`);
        if (USE_TEST_ENV) {
          const x = await resolveTestXTenantHeader();
          console.log('Test Environment - X-Tenant:', x ?? '(none)');
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

    // Handle 402 subscription expiry before extracting `detail`.
    try {
      if (isSubscriptionExpiredError(error)) {
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
        const isAlreadyOnSubscription =
          currentRouteName === 'Subscription' ||
          currentRouteName === 'SubscriptionMobileMoney';
        const payload = getSubscriptionExpiredPayload(error);
        const navParams = {
          fromExpiredModal: true,
          expiryKind: payload.expiryKind,
          lockDate: payload.lockDate,
        };

        if (!isAlreadyOnSubscription) {
          const now = Date.now();
          if (now - lastSubscriptionRedirectAt >= 2000) {
            lastSubscriptionRedirectAt = now;
            navigate('Subscription', navParams);
          }
        }

        return Promise.reject(error);
      }
    } catch (e) {
      console.warn('Failed to handle subscription expiry (ApiService):', e);
    }

    // Handle 401 (Unauthorized) - Authentication error
    if (error.response?.status === 401) {
      if (!isRestaurantPinLoginPost(error.config)) {
        await this.handleAuthenticationError();
      }

      // Preserve error context after logout.
      return Promise.reject(error);
    }

    // Handle 403 (Forbidden) - Permission error (don't log out)
    if (error.response?.status === 403) {
      if (isRestaurantPinLoginPost(error.config)) {
        return Promise.reject(error);
      }
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

    const respData = error.response?.data as Record<string, unknown> | undefined;
    if (respData && typeof respData === 'object' && 'detail' in respData) {
      const hasStructuredAppError =
        Array.isArray(respData.invalid_journals) ||
        typeof respData.error === 'string';
      if (!hasStructuredAppError) {
        return Promise.reject(respData.detail);
      }
    }

    return Promise.reject(error);
  }

  private async handleAuthenticationError(): Promise<void> {
    try {
      forceLogout();
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
