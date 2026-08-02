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
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.get('/api/user-setup/', {params});
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data;
    }
    return {count: 0, next: null, previous: null, results: []};
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
