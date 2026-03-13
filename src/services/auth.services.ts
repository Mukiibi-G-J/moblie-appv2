import {jwtDecode} from 'jwt-decode';
import {ApiService, axiosInstance, createAxiosInstance} from '../axios/axios'; // Import the Axios instance
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import Toast from 'react-native-toast-message';
interface LoginResponse {
  access: string;
  refresh?: string;
}
interface AuthError {
  message: string;
  code?: string;
  status?: number;
}
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
    // Get tenant from storage
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
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
