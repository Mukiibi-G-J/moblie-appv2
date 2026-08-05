import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  PaginatedUserSetupResponse,
  UserSetup,
  UserSetupFormValues,
  UserSetupListParams,
  UserWithoutSetup,
} from '../@types/userSetup';

export const UserSetupService = {
  async getUserSetups(
    params?: UserSetupListParams,
  ): Promise<PaginatedUserSetupResponse> {
    const {fetchPageDataPaginated, PAGE_IDS} = await import(
      './pageDataService'
    );
    return fetchPageDataPaginated({
      pageId: PAGE_IDS.UserSetupList,
      page: params?.page ?? 1,
      pageSize: params?.page_size ?? 50,
      search: params?.search,
      mapRow: row =>
        ({
          id: Number(row.id) || 0,
          system_id: String(row.SystemId ?? row.system_id ?? ''),
          user: row.user as any,
          user_name: String(row.user_name ?? row.user ?? ''),
          allow_posting_from: row.allow_posting_from as any,
          allow_posting_to: row.allow_posting_to as any,
          sales_resp_ctr_filter: row.sales_resp_ctr_filter as any,
          purchase_resp_ctr_filter: row.purchase_resp_ctr_filter as any,
        }) as any,
    });
  },

  async createUserSetup(data: UserSetupFormValues): Promise<UserSetup> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.post('/api/user-setup/', data);
    return response.data;
  },

  async updateUserSetup(
    id: number,
    data: Partial<UserSetupFormValues>,
  ): Promise<UserSetup> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.patch(`/api/user-setup/${id}/`, data);
    return response.data;
  },

  async deleteUserSetup(id: number): Promise<void> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    await api.delete(`/api/user-setup/${id}/`);
  },

  async getUsersWithoutSetup(): Promise<UserWithoutSetup[]> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.get('/api/user-setup/users-without-setup/');
    return Array.isArray(response.data) ? response.data : [];
  },

  async createMissingSetups(): Promise<{message: string; created_count: number}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.post('/api/user-setup/create-missing-setups/');
    return response.data;
  },
};
