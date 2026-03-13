import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  BankAccount,
  BankAccountLedgerParams,
  PaginatedBankAccountResponse,
  PaginatedBankAccountLedgerResponse,
  BankAccountListParams,
} from '../@types/bankAccount';

const cleanPayload = (data: Record<string, any>) => {
  const cleaned: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      !(typeof value === 'string' && value.trim() === '')
    ) {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

export const BankAccountServices = {
  async getBankAccounts(
    params?: BankAccountListParams,
  ): Promise<PaginatedBankAccountResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get('/api/bank-accounts/', {params});
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      throw error;
    }
  },

  async createBankAccount(data: Partial<BankAccount>): Promise<BankAccount> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const payload = cleanPayload(data);
    const response = await axiosInstance.post('/api/bank-accounts/', payload);
    return response.data;
  },

  async updateBankAccount(
    idOrNo: string | number,
    data: Partial<BankAccount>,
  ): Promise<BankAccount> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const payload = cleanPayload(data);
    const response = await axiosInstance.patch(
      `/api/bank-accounts/${idOrNo}/`,
      payload,
    );
    return response.data;
  },

  async deleteBankAccount(idOrNo: string | number): Promise<void> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    await axiosInstance.delete(`/api/bank-accounts/${idOrNo}/`);
  },

  async getBankAccountLedgerEntries(
    params?: BankAccountLedgerParams,
  ): Promise<PaginatedBankAccountLedgerResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.get(
      '/api/bank-account-ledger-entries/',
      {params},
    );
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data;
    }
    return {count: 0, next: null, previous: null, results: []};
  },

  async getPostingGroups(): Promise<any[]> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.get('/api/bank-account-posting-groups/', {
      params: {page_size: 1000},
    });
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    if (Array.isArray(response?.data)) return response.data;
    return [];
  },
};

export default BankAccountServices;



