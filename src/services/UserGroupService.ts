import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {UserGroupListResponse} from '../@types/userManagement';

export const UserGroupService = {
  async getUserGroups(options?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<UserGroupListResponse> {
    const {fetchPageDataPaginated, PAGE_IDS} = await import(
      './pageDataService'
    );
    const {mapPageDataUserGroup} = await import('./pageDataMappers');
    return fetchPageDataPaginated({
      pageId: PAGE_IDS.UserGroupsList,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 40,
      search: options?.search,
      mapRow: mapPageDataUserGroup,
    });
  },
};
