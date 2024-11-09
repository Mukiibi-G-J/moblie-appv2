import AsyncStorage from '@react-native-async-storage/async-storage';
// import { createAxiosInstance } from '../axios/axios';
import {createAxiosInstance} from '../axios/axios';

export const getTenantAxios = async () => {
  const tenant = await AsyncStorage.getItem('tenant');
  return createAxiosInstance(tenant || '');
};
export const getTenant = async () => {
    return await AsyncStorage.getItem('tenant');
};

export const setTenant = async (tenant: string, email: string) => {
  await AsyncStorage.setItem('tenant', tenant.toLowerCase());
  await AsyncStorage.setItem('email', email);
  await AsyncStorage.setItem('verfiyed_email', 'false');
};

export const setTenantOnLogin = async (tenant: string) => {
  await AsyncStorage.setItem('tenant', tenant.toLowerCase());
};

export const setVerifiedEmail = async (verified: boolean) => {
  await AsyncStorage.setItem('verfiyed_email', verified.toString());
};

export const getVerifiedEmail = async () => {
  return await AsyncStorage.getItem('verfiyed_email');
};

export const getEmail = async () => {
  return await AsyncStorage.getItem('email');
};

export const clearTenant = async () => {
  await AsyncStorage.removeItem('tenant');
};
