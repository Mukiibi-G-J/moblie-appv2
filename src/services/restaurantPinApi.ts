import {
  ApiService,
  createAnonymousAxiosInstance,
} from '../axios/axios';

export type RestaurantCompanyLookupResponse = {
  schema_name: string;
  name: string;
  display_name: string;
  restaurant_enabled: boolean;
};

export type RestaurantPinStatusResponse = {
  eligible: boolean;
  has_pin: boolean;
  pin_expired: boolean;
};

export type RestaurantPinDeviceContextResponse = {
  staff_name: string;
};

export type LoginTokensResponse = {
  access: string;
  refresh?: string;
};

/**
 * Public: no Bearer, no X-Tenant (path excluded in axios public markers).
 */
export async function restaurantCompanyLookup(
  companyName: string,
): Promise<RestaurantCompanyLookupResponse> {
  const client = createAnonymousAxiosInstance();
  const {data} = await client.post<RestaurantCompanyLookupResponse>(
    '/api/auth/restaurant-app/company-lookup/',
    {company_name: companyName.trim()},
  );
  return data;
}

/**
 * After password login; pass fresh access if storage race is possible.
 */
export async function getRestaurantPinStatus(
  accessTokenOverride?: string,
): Promise<RestaurantPinStatusResponse> {
  const api = ApiService.getInstance();
  const headers: Record<string, string> = {};
  if (accessTokenOverride) {
    headers.Authorization = `Bearer ${accessTokenOverride}`;
  }
  const {data} = await api
    .getAxiosInstance()
    .get<RestaurantPinStatusResponse>('/api/auth/restaurant-pin/status/', {
      headers:
        Object.keys(headers).length > 0 ? headers : undefined,
    });
  return data;
}

export async function restaurantStaffEnroll(
  pin: string,
  deviceId: string,
): Promise<{status: string}> {
  const api = ApiService.getInstance();
  const {data} = await api.getAxiosInstance().post<{status: string}>(
    '/api/auth/restaurant-staff/enroll/',
    {pin, device_id: deviceId},
  );
  return data;
}

/** No Bearer; tenant via X-Tenant / subdomain. */
export async function restaurantPinLogin(
  pin: string,
  deviceId: string,
  tenant?: string,
): Promise<LoginTokensResponse> {
  const client = createAnonymousAxiosInstance(tenant);
  const {data} = await client.post<LoginTokensResponse>(
    '/api/auth/pin/',
    {pin, device_id: deviceId},
  );
  return data;
}

export async function getRestaurantPinDeviceContext(
  deviceId: string,
  tenant?: string,
): Promise<RestaurantPinDeviceContextResponse> {
  const client = createAnonymousAxiosInstance(tenant);
  const {data} = await client.get<RestaurantPinDeviceContextResponse>(
    '/api/auth/pin/device-context/',
    {params: {device_id: deviceId}},
  );
  return data;
}

export function mapRestaurantPinLoginError(err: unknown): string {
  const ax = err as {
    response?: {
      status?: number;
      data?: {detail?: string; code?: string};
    };
  };
  const status = ax.response?.status;
  const data = ax.response?.data;
  const code = data?.code;
  const detail = data?.detail;

  if (status === 429) {
    return 'Too many attempts. Please wait and try again.';
  }
  if (detail && typeof detail === 'string') {
    if (
      code === 'pin_locked' ||
      code === 'pin_expired' ||
      code === 'device_revoked'
    ) {
      return detail;
    }
    if (
      code === 'unknown_device' ||
      code === 'invalid_pin' ||
      code === 'invalid_request' ||
      code === 'no_pin' ||
      code === 'invalid_credentials'
    ) {
      return detail;
    }
    return detail;
  }
  return 'Invalid PIN. Try again.';
}

export function mapRestaurantEnrollError(err: unknown): string {
  const ax = err as {
    response?: {status?: number; data?: {detail?: string}};
  };
  const d = ax.response?.data?.detail;
  if (typeof d === 'string' && d.length > 0) {
    return d;
  }
  if (ax.response?.status === 403) {
    return 'You are not eligible for restaurant PIN login.';
  }
  return 'Could not save PIN. Try again.';
}
