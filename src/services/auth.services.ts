import {jwtDecode} from 'jwt-decode';
import {
  ApiService,
  createAnonymousAxiosInstance,
  createAxiosInstance,
} from '../axios/axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import Toast from 'react-native-toast-message';
import type {AuthMeSession, AuthNavItem} from '../types/auth';
interface LoginResponse {
  access: string;
  refresh?: string;
}
interface AuthError {
  message: string;
  code?: string;
  status?: number;
}
export const loginUser = async (credentials: {
  email: string;
  password: string;
  tenant?: string;
}) => {
  try {
    // Get tenant from storage or from credentials
    const tenant = credentials.tenant || (await AsyncStorage.getItem('tenant'));
    if (!tenant) {
      return {error: 'Tenant not found'};
    }

    // Trim tenant to remove any leading/trailing spaces
    const cleanTenant = tenant.trim();
    const axiosInstance = createAxiosInstance(cleanTenant);

    const response = await axiosInstance.post('/api/auth/token/', credentials);
    await AsyncStorage.setItem('accessToken', response.data.access);

    // Store/update tenant info if not already stored (store trimmed version)
    if (cleanTenant) {
      await AsyncStorage.setItem('tenant', cleanTenant);
    }

    return response.data;
  } catch (error: any) {
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
    const cleanTenant = tenant?.trim();
    const axiosInstance = createAxiosInstance(cleanTenant);
    const response = await axiosInstance.post('/api/auth/resend-otp/', {email});
    return response;
  } catch (error) {
    throw error;
  }
};

export function passwordResetErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  const err = error as {
    message?: string;
    customMessage?: string;
    response?: {data?: {error?: string; detail?: string; message?: string}};
  };
  const fromBody =
    err?.response?.data?.error ||
    err?.response?.data?.detail ||
    err?.response?.data?.message;
  if (typeof fromBody === 'string' && fromBody.trim()) {
    return fromBody;
  }
  if (typeof err?.customMessage === 'string' && err.customMessage.trim()) {
    return err.customMessage;
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

async function passwordResetClient() {
  const tenant = ((await AsyncStorage.getItem('tenant')) || '').trim();
  if (!tenant) {
    throw new Error(
      'Company is required. Go back and enter your company name first.',
    );
  }
  return createAnonymousAxiosInstance(tenant);
}

export const requestPasswordResetOtp = async (email: string) => {
  const client = await passwordResetClient();
  return client.post('/api/auth/forgot-password/', {
    email: email.trim(),
    delivery: 'otp',
  });
};

export const verifyForgotPasswordOtp = async (email: string, otp: string) => {
  const client = await passwordResetClient();
  return client.post<{message: string; reset_token: string}>(
    '/api/auth/verify-forgot-password-otp/',
    {email: email.trim(), otp},
  );
};

export const resetPasswordWithToken = async (
  resetToken: string,
  newPassword: string,
) => {
  const client = await passwordResetClient();
  return client.post('/api/auth/reset-password/', {
    reset_token: resetToken,
    new_password: newPassword,
  });
};

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Authenticates user and manages token storage
   * @param credentials - User login credentials
   * @returns LoginResponse object containing access token and user data
   * @throws AuthError if authentication fails
   */
  public async login(credentials: {
    email: string;
    password: string;
    tenant?: string;
  }): Promise<LoginResponse> {
    try {
      const tenant = await this.resolveTenant(credentials.tenant);
      if (!tenant) {
        throw this.createError('Tenant is required', 'TENANT_REQUIRED');
      }

      // Clean up the tenant string - remove spaces and convert to lowercase
      const cleanTenant = tenant.trim().toLowerCase();

      const api = ApiService.getInstance(cleanTenant);
      const response = await api
        .getAxiosInstance()
        .post<LoginResponse>('/api/auth/token/', {
          email: credentials.email,
          password: credentials.password,
        });

      await this.handleSuccessfulLogin(response.data, cleanTenant);
      return response.data;
    } catch (error: any) {
      console.log('Login error:', error);
      throw this.handleLoginError(error);
    }
  }
  /**
   * Check if a company exists
   * @param companyName - Name of the company to check
   * @returns Promise<boolean> - True if company exists, false otherwise
   * @throws CompanyError if request fails
   */
  public async isCompanyExists(companyName: string): Promise<boolean> {
    try {
      if (!companyName || companyName.trim() === '') {
        throw {message: 'Company name is required', status: 400};
      }

      const api = ApiService.getInstance();
      const response = await api
        .getAxiosInstance()
        .post('/api/company/check-company-exists/', {
          company_name: companyName.trim().toLowerCase(),
        });

      if (response.status === 200) {
        return true;
      }
      return false;
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 404) {
          return false;
        }
        Toast.show({
          type: 'error',
          text1: error.response.data?.message || 'Failed to check company',
        });

        // throw {
        //   message: error.response.data?.message || 'Failed to check company',
        //   status: error.response.status,
        // };
      }
      throw error;
    }
  }

  private async resolveTenant(providedTenant?: string): Promise<string | null> {
    try {
      const tenant = providedTenant || (await AsyncStorage.getItem('tenant'));
      // Trim tenant to remove any leading/trailing spaces
      return tenant?.trim() || null;
    } catch (error) {
      console.error('Error resolving tenant:', error);
      return null;
    }
  }
  private async handleSuccessfulLogin(
    loginData: LoginResponse,
    tenant: string,
  ): Promise<void> {
    const storageItems: [string, string][] = [
      ['accessToken', loginData.access],
      ['tenant', tenant],
    ];

    if (loginData.refresh) {
      storageItems.push(['refreshToken', loginData.refresh]);
    }

    if (loginData.refresh) {
      const jwt = jwtDecode(loginData.access);
      storageItems.push(['userData', JSON.stringify(jwt)]);
    }

    try {
      await AsyncStorage.multiSet(storageItems);
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw this.createError('Failed to store auth data', 'STORAGE_ERROR');
    }
  }
  private handleLoginError(error: any): AuthError {
    if (error.response) {
      // Handle specific API errors
      const status = error.response.status;
      const detail = error.response.data?.detail;

      switch (status) {
        case 401:
          return this.createError(
            'Invalid credentials',
            'INVALID_CREDENTIALS',
            status,
          );
        case 404:
          return this.createError(
            'Tenant not found',
            'TENANT_NOT_FOUND',
            status,
          );
        case 429:
          return this.createError(
            'Too many attempts',
            'RATE_LIMIT_EXCEEDED',
            status,
          );
        default:
          return this.createError(
            detail || 'Authentication failed',
            'AUTH_ERROR',
            status,
          );
      }
    }
    if (error.message === 'Network Error') {
      return this.createError(
        'Please check your internet connection',
        'NETWORK_ERROR',
      );
    }

    return this.createError('An unexpected error occurred', 'UNKNOWN_ERROR');
  }

  private createError(
    message: string,
    code?: string,
    status?: number,
  ): AuthError {
    return {message, code, status};
  }
}

export const authService = AuthService.getInstance();

export const ROLE_CENTRE_SESSION_KEY = 'roleCentre.session';

export type CachedRoleCentreSession = {
  roleCentrePageId: number | null;
  applicationProfileCode: string | null;
  applicationProfileDescription: string | null;
  navItems: AuthNavItem[];
  enabledModules?: string[];
};

export async function fetchAuthSession(): Promise<AuthMeSession> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant);
  const response = await axiosInstance.get<AuthMeSession>('/api/auth/me/');
  return response.data;
}

export function roleCentreFieldsFromSession(session: AuthMeSession): CachedRoleCentreSession {
  const navItems = Array.isArray(session.navItems) ? session.navItems : [];
  return {
    roleCentrePageId: session.roleCentrePageId ?? null,
    applicationProfileCode: session.profile?.code ?? null,
    applicationProfileDescription: session.profile?.description ?? null,
    navItems,
    enabledModules: Array.isArray(session.enabledModules)
      ? session.enabledModules
      : undefined,
  };
}

export async function readCachedRoleCentreSession(): Promise<CachedRoleCentreSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ROLE_CENTRE_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedRoleCentreSession;
    if (!parsed || !Array.isArray(parsed.navItems)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedRoleCentreSession(
  session: CachedRoleCentreSession,
): Promise<void> {
  await AsyncStorage.setItem(ROLE_CENTRE_SESSION_KEY, JSON.stringify(session));
}

export async function clearCachedRoleCentreSession(): Promise<void> {
  await AsyncStorage.removeItem(ROLE_CENTRE_SESSION_KEY);
}
