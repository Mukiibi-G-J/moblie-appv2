import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  PaginatedPrepaymentResponse,
  PostingPreview,
  Prepayment,
  PrepaymentListParams,
  PrepaymentLine,
} from '../@types/prepayment';

const cleanPayload = (data: Record<string, any>) => {
  const cleaned: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      !(typeof value === 'string' && value.trim() === '')
    ) {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

export const PrepaymentService = {
  async fetchPrepayments(
    params?: PrepaymentListParams,
  ): Promise<PaginatedPrepaymentResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get('/api/prepayments/', {params});
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching prepayments:', error);
      throw error;
    }
  },

  async getPrepayment(id: number): Promise<Prepayment> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get(`/api/prepayments/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching prepayment:', error);
      throw error;
    }
  },

  async createPrepayment(data: Partial<Prepayment>): Promise<Prepayment> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = cleanPayload({
        customer: data.customer,
        payment_method_id: data.payment_method_id,
        status: data.status,
      });
      const response = await axiosInstance.post('/api/prepayments/', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating prepayment:', error);
      throw error;
    }
  },

  async updatePrepayment(
    id: number,
    data: Partial<Prepayment>,
  ): Promise<Prepayment> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = cleanPayload({
        customer: data.customer,
        payment_method_id: data.payment_method_id,
        status: data.status,
      });
      const response = await axiosInstance.patch(
        `/api/prepayments/${id}/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating prepayment:', error);
      throw error;
    }
  },

  async deletePrepayment(id: number): Promise<void> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      await axiosInstance.delete(`/api/prepayments/${id}/`);
    } catch (error) {
      console.error('Error deleting prepayment:', error);
      throw error;
    }
  },

  async updateLines(
    id: number,
    lines: PrepaymentLine[],
  ): Promise<{prepayment: Prepayment}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = {
        id,
        lines: lines.map(line => ({
          ...line,
          // backend accepts camelCase or snake_case; ensure numeric fields
          quantity: line.quantity,
          unit_price: line.unit_price,
        })),
      };
      const response = await axiosInstance.post(
        `/api/prepayments/${id}/update_lines/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating prepayment lines:', error);
      throw error;
    }
  },

  async previewPosting(id: number): Promise<PostingPreview> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(`/api/prepayments/${id}/preview/`);
      return response.data;
    } catch (error) {
      console.error('Error previewing prepayment posting:', error);
      throw error;
    }
  },

  async postPrepayment(
    id: number,
    payload: {payment_method_id: number},
  ): Promise<{message?: string; prepayment?: Prepayment}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(
        `/api/prepayments/${id}/post/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error posting prepayment:', error);
      throw error;
    }
  },

  async previewFinalInvoice(id: number): Promise<PostingPreview> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(
        `/api/prepayments/${id}/preview-final-invoice/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error previewing final invoice:', error);
      throw error;
    }
  },

  async postFinalInvoice(
    id: number,
    payload: {payment_method_id: number | null},
  ): Promise<{message?: string; prepayment?: Prepayment}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(
        `/api/prepayments/${id}/post-final-invoice/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error posting final invoice:', error);
      throw error;
    }
  },

  async addInstallment(
    id: number,
    payload: {amount: number},
  ): Promise<{prepayment: Prepayment}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(
        `/api/prepayments/${id}/installments/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error adding installment:', error);
      throw error;
    }
  },

  async getPaymentMethods(): Promise<any[]> {
    try {
      const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
      const {mapPageDataPaymentMethod} = await import('./pageDataMappers');
      return await fetchPageDataAll({
        pageId: PAGE_IDS.PaymentMethodList,
        mapRow: mapPageDataPaymentMethod,
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  },
};

export default PrepaymentService;



