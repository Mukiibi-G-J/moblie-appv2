import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  PaginatedUserResponse,
  User,
  UserFormValues,
  UserListParams,
} from '../@types/userManagement';

export const UserManagementService = {
  async getUsers(params?: UserListParams): Promise<PaginatedUserResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.get('/api/users/', {params});
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data;
    }
    return {count: 0, next: null, previous: null, results: []};
  },

  async getUser(id: number): Promise<User> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.get(`/api/users/${id}/`);
    return response.data;
  },

  async createUser(data: UserFormValues): Promise<User> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.post('/api/users/', data);
    return response.data;
  },

  async updateUser(id: number, data: Partial<UserFormValues>): Promise<User> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.patch(`/api/users/${id}/`, data);
    return response.data;
  },

  async deleteUser(id: number): Promise<void> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    await api.delete(`/api/users/${id}/`);
  },
};
