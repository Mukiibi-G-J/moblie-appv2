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
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      const response = await axiosInstance.get('/api/bank-accounts/', {
        params: {
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 50,
          search: params?.search,
          ordering: params?.ordering,
        },
      });
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      if (Array.isArray(response?.data)) {
        return {
          count: response.data.length,
          next: null,
          previous: null,
          results: response.data,
        };
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
    // Keep empty strings so optional fields can be cleared on auto-save.
    const payload: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
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
    try {
      const {fetchPageDataPaginated, PAGE_IDS} = await import(
        './pageDataService'
      );
      const {mapPageDataBankLedger} = await import('./pageDataMappers');
      const filters: Record<string, string | number> = {};
      if ((params as any)?.bank_account || (params as any)?.bank_account_no) {
        filters.bank_account_no = String(
          (params as any).bank_account || (params as any).bank_account_no,
        );
      }
      if ((params as any)?.posting_date__gte) {
        filters.posting_date_from = String((params as any).posting_date__gte);
      }
      if ((params as any)?.posting_date__lte) {
        filters.posting_date_to = String((params as any).posting_date__lte);
      }
      return await fetchPageDataPaginated({
        pageId: PAGE_IDS.BankAccountLedgerEntryList,
        page: params?.page ?? 1,
        pageSize: params?.page_size ?? 50,
        search: (params as any)?.search,
        filters,
        mapRow: mapPageDataBankLedger,
      });
    } catch (error) {
      console.error('Error fetching bank ledger:', error);
      throw error;
    }
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



