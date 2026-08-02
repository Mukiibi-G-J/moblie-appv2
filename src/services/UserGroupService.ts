import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {UserGroupListResponse} from '../@types/userManagement';

export const UserGroupService = {
  async getUserGroups(): Promise<UserGroupListResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant);
    const response = await api.get('/api/user-groups/');
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data;
    }
    return {count: 0, next: null, previous: null, results: []};
  },
};
