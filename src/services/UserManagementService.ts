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
    const {fetchPageDataPaginated, PAGE_IDS} = await import(
      './pageDataService'
    );
    const {mapPageDataUser} = await import('./pageDataMappers');
    return fetchPageDataPaginated({
      pageId: PAGE_IDS.UsersList,
      page: params?.page ?? 1,
      pageSize: params?.page_size ?? 50,
      search: params?.search,
      mapRow: mapPageDataUser,
    });
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
