import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

export interface CompanyModule {
  identifier: string;
  display_name: string;
  description: string;
  icon: string;
  category: string;
  enabled: boolean;
  from_plan: boolean;
  from_override: boolean;
}

export interface CompanyModulesResponse {
  modules: CompanyModule[];
  enabled_modules: string[];
  module_overrides: string[];
  plan_name: string | null;
  plan_modules: string[];
  plan_branches?: string | null;
  is_trial: boolean;
  allow_manual_module_toggle: boolean;
}

export async function getCompanyModules(): Promise<CompanyModulesResponse | null> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.get<CompanyModulesResponse>(
      '/api/company/modules/',
    );
    return response.data;
  } catch (error) {
    console.warn('getCompanyModules failed:', error);
    return null;
  }
}

export async function toggleCompanyModule(
  moduleId: string,
  action: 'enable' | 'disable',
): Promise<{success: boolean; error?: string}> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    await axiosInstance.post('/api/company/modules/toggle/', {
      module: moduleId,
      action,
    });
    return {success: true};
  } catch (error: unknown) {
    const msg =
      error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as {response?: {data?: {error?: string}}}).response?.data?.error;
    return {
      success: false,
      error: typeof msg === 'string' ? msg : `Failed to ${action} module`,
    };
  }
}
