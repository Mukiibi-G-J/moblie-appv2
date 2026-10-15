import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {UserGroupListResponse} from '../@types/userManagement';

export const UserGroupService = {
  async getUserGroups(): Promise<UserGroupListResponse> {
    const {fetchPageDataPaginated, PAGE_IDS} = await import(
      './pageDataService'
    );
    const {mapPageDataUserGroup} = await import('./pageDataMappers');
    return fetchPageDataPaginated({
      pageId: PAGE_IDS.UserGroupsList,
      page: 1,
      pageSize: 500,
      mapRow: mapPageDataUserGroup,
    });
  },
};
