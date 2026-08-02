import {axiosInstance} from '../../axios/axios';

type DeltaPullResponse = {
  results: unknown[];
  has_more: boolean;
  max_updated_at: string;
  count: number;
  total: number;
  page: number;
};

export type PushEventResult = {
  event_id: string;
  ok?: boolean;
  error?: string;
  server_sale_id?: number;
  invoice_no?: string;
  system_id?: string;
  cached?: boolean;
  local_id?: string;
};

class SyncApi {
  async ping() {
    const {data} = await axiosInstance.get('/api/sync/ping/', {timeout: 8000});
    return data;
  }

  async registerDevice(payload: {
    device_id?: string;
    name?: string;
    client_type?: string;
    branch_id?: number | null;
    app_version?: string;
  }) {
    const {data} = await axiosInstance.post('/api/sync/register-device/', {
      client_type: 'mobile',
      ...payload,
    });
    return data as {
      device_id: string;
      server_time: string;
      branches?: unknown[];
    };
  }

  async bootstrap(deviceId: string, branchId?: number | null) {
    const {data} = await axiosInstance.post('/api/sync/bootstrap/', {
      device_id: deviceId,
      branch_id: branchId ?? null,
    });
    return data;
  }

  async push(deviceId: string, events: unknown[], branchId?: number | null) {
    const {data} = await axiosInstance.post('/api/sync/push/', {
      device_id: deviceId,
      branch_id: branchId ?? null,
      events,
    });
    return data as {results: PushEventResult[]};
  }

  async pullChanges(since?: string) {
    const {data} = await axiosInstance.get('/api/sync/changes/', {
      params: {updated_since: since || '1970-01-01T00:00:00Z'},
    });
    return data;
  }

  async pullCustomersDelta(updatedSince: string, page = 1, pageSize = 500) {
    const {data} = await axiosInstance.get('/api/sync/pull/customers/', {
      params: {updated_since: updatedSince, page, page_size: pageSize},
    });
    return data as DeltaPullResponse;
  }

  async pullPaymentMethodsDelta(updatedSince: string, page = 1, pageSize = 500) {
    const {data} = await axiosInstance.get('/api/sync/pull/payment-methods/', {
      params: {updated_since: updatedSince, page, page_size: pageSize},
    });
    return data as DeltaPullResponse;
  }

  async pullItemsDelta(updatedSince: string, page = 1, pageSize = 500) {
    const {data} = await axiosInstance.get('/api/sync/pull/items/', {
      params: {updated_since: updatedSince, page, page_size: pageSize},
    });
    return data as DeltaPullResponse;
  }
}

export default new SyncApi();
