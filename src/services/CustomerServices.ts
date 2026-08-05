import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  Customer,
  PaymentMethod,
  CustomerPostingGroup,
  GeneralBusinessPostingGroup,
  CustomerListParams,
  PaginatedCustomerResponse,
} from '../@types/customer';

export const CustomerServices = {
  // Get customers list with filters
  async getCustomers(
    params?: CustomerListParams,
  ): Promise<PaginatedCustomerResponse> {
    try {
      const {fetchPageDataPaginated, PAGE_IDS} = await import(
        './pageDataService'
      );
      const {mapPageDataCustomer} = await import('./pageDataMappers');
      return await fetchPageDataPaginated({
        pageId: PAGE_IDS.CustomerList,
        page: params?.page ?? 1,
        pageSize: params?.page_size ?? 50,
        search: params?.search,
        mapRow: mapPageDataCustomer,
      });
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },

  // Get single customer
  async getCustomer(id: number): Promise<Customer> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(`/api/customers/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  },

  // Create customer
  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      // Clean data - remove undefined, null, or empty string values
      const cleanedData: any = {};
      if (data.name && data.name.trim()) {
        cleanedData.name = data.name.trim();
      }
      if (data.contact && data.contact.trim()) {
        cleanedData.contact = data.contact.trim();
      }
      if (data.phone_number && data.phone_number.trim()) {
        cleanedData.phone_number = data.phone_number.trim();
      }
      if (data.address && data.address.trim()) {
        cleanedData.address = data.address.trim();
      }
      if (data.address_2 && data.address_2.trim()) {
        cleanedData.address_2 = data.address_2.trim();
      }
      if (data.city && data.city.trim()) {
        cleanedData.city = data.city.trim();
      }
      if (data.credit_limit !== undefined && data.credit_limit !== null) {
        // Convert to number if it's a string
        const creditLimit =
          typeof data.credit_limit === 'string'
            ? parseFloat(data.credit_limit)
            : data.credit_limit;
        if (!isNaN(creditLimit) && creditLimit >= 0) {
          cleanedData.credit_limit = creditLimit;
        }
      }
      if (data.payment_method) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.customer_posting_group) {
        cleanedData.customer_posting_group = data.customer_posting_group;
      }
      if (data.general_business_posting_group) {
        cleanedData.general_business_posting_group =
          data.general_business_posting_group;
      }
      if (data.customer_type) {
        cleanedData.customer_type = data.customer_type;
      }
      if (data.user) {
        cleanedData.user = data.user;
      }

      const response = await axiosInstance.post('/api/customers/', cleanedData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },

  // Update customer
  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
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
      if (data.contact !== undefined) {
        cleanedData.contact =
          data.contact && data.contact.trim()
            ? data.contact.trim()
            : data.contact;
      }
      if (data.phone_number !== undefined) {
        cleanedData.phone_number =
          data.phone_number && data.phone_number.trim()
            ? data.phone_number.trim()
            : data.phone_number;
      }
      if (data.address !== undefined) {
        cleanedData.address =
          data.address && data.address.trim()
            ? data.address.trim()
            : data.address;
      }
      if (data.address_2 !== undefined) {
        cleanedData.address_2 =
          data.address_2 && data.address_2.trim()
            ? data.address_2.trim()
            : data.address_2;
      }
      if (data.city !== undefined) {
        cleanedData.city =
          data.city && data.city.trim() ? data.city.trim() : data.city;
      }
      if (data.credit_limit !== undefined && data.credit_limit !== null) {
        // Convert to number if it's a string
        const creditLimit =
          typeof data.credit_limit === 'string'
            ? parseFloat(data.credit_limit)
            : data.credit_limit;
        if (!isNaN(creditLimit) && creditLimit >= 0) {
          cleanedData.credit_limit = creditLimit;
        }
      }
      if (data.payment_method !== undefined) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.customer_posting_group !== undefined) {
        cleanedData.customer_posting_group = data.customer_posting_group;
      }
      if (data.general_business_posting_group !== undefined) {
        cleanedData.general_business_posting_group =
          data.general_business_posting_group;
      }
      if (data.customer_type !== undefined) {
        cleanedData.customer_type = data.customer_type;
      }
      if (data.user !== undefined) {
        cleanedData.user = data.user;
      }

      const response = await axiosInstance.patch(
        `/api/customers/${id}/`,
        cleanedData,
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  // Delete customer
  async deleteCustomer(id: number): Promise<void> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      await axiosInstance.delete(`/api/customers/${id}/`);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  // Get payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
      const {mapPageDataPaymentMethod} = await import('./pageDataMappers');
      return await fetchPageDataAll({
        pageId: PAGE_IDS.PaymentMethodList,
        mapRow: mapPageDataPaymentMethod as any,
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  },

  // Get customer posting groups
  async getCustomerPostingGroups(): Promise<CustomerPostingGroup[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get('/api/customer-posting-groups/');
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching customer posting groups:', error);
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
