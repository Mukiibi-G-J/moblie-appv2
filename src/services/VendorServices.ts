import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  Vendor,
  PaymentMethod,
  VendorPostingGroup,
  GeneralBusinessPostingGroup,
  VendorListParams,
  PaginatedVendorResponse,
} from '../@types/vendor';

export const VendorServices = {
  // Get vendors list with filters
  async getVendors(params?: VendorListParams): Promise<PaginatedVendorResponse> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get('/api/vendors/', {params});

      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching vendors:', error);
      throw error;
    }
  },

  // Get single vendor
  async getVendor(id: number): Promise<Vendor> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(`/api/vendors/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching vendor:', error);
      throw error;
    }
  },

  // Create vendor
  async createVendor(data: Partial<Vendor>): Promise<Vendor> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      // Clean data - remove undefined, null, or empty string values
      const cleanedData: any = {};
      if (data.name && data.name.trim()) {
        cleanedData.name = data.name.trim();
      }
      if (data.blocked !== undefined) {
        cleanedData.blocked = data.blocked;
      }
      if (data.address && data.address.trim()) {
        cleanedData.address = data.address.trim();
      }
      if (data.city && data.city.trim()) {
        cleanedData.city = data.city.trim();
      }
      if (data.phone && data.phone.trim()) {
        cleanedData.phone = data.phone.trim();
      }
      if (data.email && data.email.trim()) {
        cleanedData.email = data.email.trim();
      }
      if (data.website && data.website.trim()) {
        cleanedData.website = data.website.trim();
      }
      if (data.payment_method) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.vendor_posting_group) {
        cleanedData.vendor_posting_group = data.vendor_posting_group;
      }
      if (data.business_posting_group) {
        cleanedData.business_posting_group = data.business_posting_group;
      }

      const response = await axiosInstance.post('/api/vendors/', cleanedData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating vendor:', error);
      throw error;
    }
  },

  // Update vendor
  async updateVendor(id: number, data: Partial<Vendor>): Promise<Vendor> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      // Clean data - remove undefined, null, or empty string values
      const cleanedData: any = {};
      if (data.name !== undefined) {
        if (data.name && data.name.trim()) {
          cleanedData.name = data.name.trim();
        } else {
          cleanedData.name = data.name;
        }
      }
      if (data.blocked !== undefined) {
        cleanedData.blocked = data.blocked;
      }
      if (data.address !== undefined) {
        cleanedData.address =
          data.address && data.address.trim() ? data.address.trim() : data.address;
      }
      if (data.city !== undefined) {
        cleanedData.city =
          data.city && data.city.trim() ? data.city.trim() : data.city;
      }
      if (data.phone !== undefined) {
        cleanedData.phone =
          data.phone && data.phone.trim() ? data.phone.trim() : data.phone;
      }
      if (data.email !== undefined) {
        cleanedData.email =
          data.email && data.email.trim() ? data.email.trim() : data.email;
      }
      if (data.website !== undefined) {
        cleanedData.website =
          data.website && data.website.trim() ? data.website.trim() : data.website;
      }
      if (data.payment_method !== undefined) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.vendor_posting_group !== undefined) {
        cleanedData.vendor_posting_group = data.vendor_posting_group;
      }
      if (data.business_posting_group !== undefined) {
        cleanedData.business_posting_group = data.business_posting_group;
      }

      const response = await axiosInstance.patch(
        `/api/vendors/${id}/`,
        cleanedData,
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      throw error;
    }
  },

  // Delete vendor
  async deleteVendor(id: number): Promise<void> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      await axiosInstance.delete(`/api/vendors/${id}/`);
    } catch (error) {
      console.error('Error deleting vendor:', error);
      throw error;
    }
  },

  // Get payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        '/api/financials/payment-methods/',
      );
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  },

  // Get vendor posting groups
  async getVendorPostingGroups(): Promise<VendorPostingGroup[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get('/api/vendor-posting-groups/');
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching vendor posting groups:', error);
      return [];
    }
  },

  // Get general business posting groups
  async getGeneralBusinessPostingGroups(): Promise<
    GeneralBusinessPostingGroup[]
  > {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        '/api/general-business-posting-groups/',
      );
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching general business posting groups:', error);
      return [];
    }
  },
};

