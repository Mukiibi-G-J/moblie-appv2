import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

export type SearchMode = 'barcode' | 'realtime';

export interface MobileSettingsResponse {
  searchMode: SearchMode;
  barcodeScannerEnabled: boolean;
  barcodeBeepEnabled: boolean;
  printer?: {
    type: 'sunmi' | 'bluetooth' | 'none';
    deviceName: string;
    macAddress: string;
    paperWidth: '58' | '80';
    copies: number;
  };
  tenant?: {
    currentTenant: string;
  };
  updatedAt: string;
}

export interface MobileSettingsPatchPayload {
  searchMode?: SearchMode;
  barcodeScannerEnabled?: boolean;
  barcodeBeepEnabled?: boolean;
}

const SETTINGS_ENDPOINT = '/api/settings/mobile/';

export const fetchMobileSettings = async (): Promise<MobileSettingsResponse> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axios = createAxiosInstance(tenant);
  const response = await axios.get<MobileSettingsResponse>(SETTINGS_ENDPOINT);
  return response.data;
};

export const patchMobileSettings = async (
  payload: MobileSettingsPatchPayload,
  ifUnmodifiedSince?: string,
): Promise<MobileSettingsResponse> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axios = createAxiosInstance(tenant);
  const headers: Record<string, string> = {};

  if (ifUnmodifiedSince) {
    headers['If-Unmodified-Since'] = ifUnmodifiedSince;
  }

  const response = await axios.patch<MobileSettingsResponse>(
    SETTINGS_ENDPOINT,
    payload,
    {
    headers: Object.keys(headers).length ? headers : undefined,
    },
  );
  return response.data;
};
