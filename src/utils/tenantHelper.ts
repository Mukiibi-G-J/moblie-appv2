import AsyncStorage from '@react-native-async-storage/async-storage';
import {axiosInstance} from '../axios/axios';
import {USE_TEST_ENV, TEST_API_BASE_URL} from '../config/api.config';

export const TENANT_STORAGE_KEY = 'current_tenant';

export interface TenantConfig {
  tenant: string;
  baseURL: string;
}

export async function getCurrentTenant(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TENANT_STORAGE_KEY);
  } catch (error) {
    console.error('Error getting current tenant:', error);
    return null;
  }
}

export async function setCurrentTenant(tenant: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TENANT_STORAGE_KEY, tenant);
    updateAxiosBaseURL(tenant);
  } catch (error) {
    console.error('Error setting current tenant:', error);
  }
}

export function updateAxiosBaseURL(tenant: string): void {
  // Use test environment if enabled, otherwise use production
  const baseURL = USE_TEST_ENV
    ? TEST_API_BASE_URL
    : tenant
    ? `https://${tenant}.zentroapp-backend.com`
    : 'https://zentroapp-backend.com';

  axiosInstance.defaults.baseURL = baseURL;
}

export async function validateTenantURL(tenant: string): Promise<boolean> {
  // In test environment, skip validation or use test URL
  if (USE_TEST_ENV) {
    try {
      const testURL = `${TEST_API_BASE_URL}/api/health-check`;
      const response = await fetch(testURL);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  const testURL = `https://${tenant}.zentroapp-backend.com/api/health-check`;
  try {
    const response = await fetch(testURL);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function getFallbackTenant(): Promise<string | null> {
  // Try to get tenant from storage first
  const storedTenant = await getCurrentTenant();
  if (storedTenant) {
    const isValid = await validateTenantURL(storedTenant);
    if (isValid) return storedTenant;
  }

  // If stored tenant is invalid, try default tenant
  const isDefaultValid = await validateTenantURL('zentroapp');
  if (isDefaultValid) {
    await setCurrentTenant('zentroapp');
    return 'zentroapp';
  }

  return null;
}

export function extractTenantFromURL(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostParts = urlObj.hostname.split('.');
    if (hostParts.length >= 3) {
      return hostParts[0];
    }
    return null;
  } catch (error) {
    return null;
  }
}
