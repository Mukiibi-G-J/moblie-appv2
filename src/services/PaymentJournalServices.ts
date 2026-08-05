import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  PaymentJournal,
  PaymentJournalFormValues,
  PaymentJournalFilterQueries,
  PaginatedPaymentJournalResponse,
  ContentType,
  CustomerLedgerEntry,
  VendorLedgerEntry,
  PaymentMethod,
  Customer,
  Vendor,
  GLAccount,
} from '../@types/paymentJournal';

export const PaymentJournalServices = {
  // Get payment journals list with filters
  async getPaymentJournals(
    params?: PaymentJournalFilterQueries,
  ): Promise<PaginatedPaymentJournalResponse> {
    try {
      const {fetchPageDataPaginated, PAGE_IDS} = await import(
        './pageDataService'
      );
      const {mapPageDataPaymentJournal} = await import('./pageDataMappers');
      const filters: Record<string, string | number | boolean> = {};
      if (params?.status) {
        filters.status = String(params.status);
      }
      if ((params as any)?.posting_date__gte || (params as any)?.start_date) {
        filters.posting_date_from = String(
          (params as any).posting_date__gte || (params as any).start_date,
        );
      }
      if ((params as any)?.posting_date__lte || (params as any)?.end_date) {
        filters.posting_date_to = String(
          (params as any).posting_date__lte || (params as any).end_date,
        );
      }
      return await fetchPageDataPaginated({
        pageId: PAGE_IDS.PaymentJournalList,
        page: params?.page ?? 1,
        pageSize: params?.page_size ?? 50,
        search: params?.search,
        filters,
        mapRow: mapPageDataPaymentJournal,
      });
    } catch (error) {
      console.error('Error fetching payment journals:', error);
      throw error;
    }
  },

  // Get single payment journal
  async getPaymentJournal(id: number): Promise<PaymentJournal> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        `/api/payments/payment-journal/${id}/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching payment journal:', error);
      throw error;
    }
  },

  // Create payment journal
  async createPaymentJournal(
    data: Partial<PaymentJournalFormValues>,
  ): Promise<PaymentJournal> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      // Clean data - convert null values to undefined for API compatibility
      const cleanedData: any = {};
      if (data.posting_date) {
        cleanedData.posting_date = data.posting_date;
      }
      if (data.document_type) {
        cleanedData.document_type = data.document_type;
      }
      if (data.description && data.description.trim()) {
        cleanedData.description = data.description.trim();
      }
      if (data.account_type) {
        cleanedData.account_type = data.account_type;
      }
      if (data.account_content_type_id) {
        cleanedData.account_content_type_id = data.account_content_type_id;
      }
      if (data.account_object_id) {
        cleanedData.account_object_id = data.account_object_id;
      }
      if (data.payment_method) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.amount !== undefined && data.amount !== null) {
        cleanedData.amount = data.amount;
      }
      if (data.bal_account_type) {
        cleanedData.bal_account_type = data.bal_account_type;
      }
      if (data.bal_account_content_type_id) {
        cleanedData.bal_account_content_type_id = data.bal_account_content_type_id;
      }
      if (data.bal_account_object_id) {
        cleanedData.bal_account_object_id = data.bal_account_object_id;
      }
      if (data.applies_to_doc_type) {
        cleanedData.applies_to_doc_type = data.applies_to_doc_type;
      }
      if (data.applies_to_content_type_id) {
        cleanedData.applies_to_content_type_id = data.applies_to_content_type_id;
      }
      if (data.applies_to_object_id) {
        cleanedData.applies_to_object_id = data.applies_to_object_id;
      }

      const response = await axiosInstance.post(
        '/api/payments/payment-journal/',
        cleanedData,
      );
      return response.data;
    } catch (error) {
      console.error('Error creating payment journal:', error);
      throw error;
    }
  },

  // Update payment journal
  async updatePaymentJournal(
    id: number,
    data: Partial<PaymentJournalFormValues>,
  ): Promise<PaymentJournal> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      // Clean data - convert null values to undefined for API compatibility
      const cleanedData: any = {};
      if (data.posting_date) {
        cleanedData.posting_date = data.posting_date;
      }
      if (data.document_type) {
        cleanedData.document_type = data.document_type;
      }
      if (data.description !== undefined) {
        cleanedData.description = data.description?.trim() || '';
      }
      if (data.account_type !== undefined) {
        cleanedData.account_type = data.account_type;
      }
      if (data.account_content_type_id !== undefined) {
        cleanedData.account_content_type_id = data.account_content_type_id;
      }
      if (data.account_object_id !== undefined) {
        cleanedData.account_object_id = data.account_object_id;
      }
      if (data.payment_method !== undefined) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.amount !== undefined && data.amount !== null) {
        cleanedData.amount = data.amount;
      }
      if (data.bal_account_type !== undefined) {
        cleanedData.bal_account_type = data.bal_account_type;
      }
      if (data.bal_account_content_type_id !== undefined) {
        cleanedData.bal_account_content_type_id = data.bal_account_content_type_id;
      }
      if (data.bal_account_object_id !== undefined) {
        cleanedData.bal_account_object_id = data.bal_account_object_id;
      }
      if (data.applies_to_doc_type !== undefined) {
        cleanedData.applies_to_doc_type = data.applies_to_doc_type;
      }
      if (data.applies_to_content_type_id !== undefined) {
        cleanedData.applies_to_content_type_id = data.applies_to_content_type_id;
      }
      if (data.applies_to_object_id !== undefined) {
        cleanedData.applies_to_object_id = data.applies_to_object_id;
      }

      const response = await axiosInstance.put(
        `/api/payments/payment-journal/${id}/`,
        cleanedData,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating payment journal:', error);
      throw error;
    }
  },

  // Delete payment journal
  async deletePaymentJournal(id: number): Promise<void> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      await axiosInstance.delete(`/api/payments/payment-journal/${id}/`);
    } catch (error) {
      console.error('Error deleting payment journal:', error);
      throw error;
    }
  },

  // Post payment journal
  async postPaymentJournal(id: number): Promise<PaymentJournal> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.post(
        `/api/payments/payment-journal/${id}/post_payment_journal/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error posting payment journal:', error);
      throw error;
    }
  },

  // Get content types
  async getContentTypes(): Promise<ContentType[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        '/api/payments/payment-journal/content_types/',
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching content types:', error);
      return [];
    }
  },

  // Get customer ledger entries
  async getCustomerLedgerEntries(
    customerId: number,
  ): Promise<{ledger_entries: CustomerLedgerEntry[]}> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        `/api/customer-ledger/${customerId}/ledger_entries/`,
      );
      return response.data || {ledger_entries: []};
    } catch (error) {
      console.error('Error fetching customer ledger entries:', error);
      return {ledger_entries: []};
    }
  },

  // Get vendor ledger entries
  async getVendorLedgerEntries(
    vendorId: number,
  ): Promise<{ledger_entries: VendorLedgerEntry[]}> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        `/api/vendor-ledger/${vendorId}/ledger_entries/`,
      );
      return response.data || {ledger_entries: []};
    } catch (error) {
      console.error('Error fetching vendor ledger entries:', error);
      return {ledger_entries: []};
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

  // Get customers
  async getCustomers(): Promise<{results: Customer[]; count: number}> {
    try {
      const {fetchPageDataPaginated, PAGE_IDS} = await import(
        './pageDataService'
      );
      const {mapPageDataCustomer} = await import('./pageDataMappers');
      return await fetchPageDataPaginated({
        pageId: PAGE_IDS.CustomerList,
        page: 1,
        pageSize: 200,
        mapRow: mapPageDataCustomer as any,
      });
    } catch (error) {
      console.error('Error fetching customers:', error);
      return {results: [], count: 0};
    }
  },

  // Get vendors
  async getVendors(): Promise<{results: Vendor[]; count: number}> {
    try {
      const {fetchPageDataPaginated, PAGE_IDS} = await import(
        './pageDataService'
      );
      const {mapPageDataVendor} = await import('./pageDataMappers');
      return await fetchPageDataPaginated({
        pageId: PAGE_IDS.VendorList,
        page: 1,
        pageSize: 200,
        mapRow: mapPageDataVendor as any,
      });
    } catch (error) {
      console.error('Error fetching vendors:', error);
      return {results: [], count: 0};
    }
  },

  // Get GL accounts
  async getGLAccounts(): Promise<GLAccount[]> {
    try {
      const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
      const {mapPageDataGLAccount} = await import('./pageDataMappers');
      return await fetchPageDataAll({
        pageId: PAGE_IDS.GLAccountList,
        mapRow: mapPageDataGLAccount as any,
      });
    } catch (error) {
      console.error('Error fetching GL accounts:', error);
      return [];
    }
  },
};



