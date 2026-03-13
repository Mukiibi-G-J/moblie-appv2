import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  Expense,
  ExpenseType,
  PaymentMethod,
  PostingPreview,
  ExpenseListParams,
  PaginatedExpenseResponse,
} from '../@types/expense';

export const ExpenseServices = {
  // Get expenses list with filters
  async getExpenses(
    params?: ExpenseListParams,
  ): Promise<PaginatedExpenseResponse> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get('/api/expenses/', {
        params,
      });

      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }
  },

  // Get single expense
  async getExpense(id: number): Promise<Expense> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(`/api/expenses/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching expense:', error);
      throw error;
    }
  },

  // Create expense
  async createExpense(data: Partial<Expense>): Promise<Expense> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      // Clean the data - remove undefined, null, or empty string values
      const cleanedData: any = {};
      
      // Required fields
      if (data.posting_date) cleanedData.posting_date = data.posting_date;
      if (data.expense_type) cleanedData.expense_type = data.expense_type;
      if (data.amount !== undefined && data.amount !== null) {
        cleanedData.amount = data.amount;
      }
      
      // Optional fields - only include if they have values
      if (data.description && data.description.trim()) {
        cleanedData.description = data.description.trim();
      }
      if (data.payment_method) {
        cleanedData.payment_method = data.payment_method;
      }
      if (data.external_document_no && data.external_document_no.trim()) {
        cleanedData.external_document_no = data.external_document_no.trim();
      }
      if (data.status) {
        cleanedData.status = data.status;
      }
      
      // Add document_type if not provided (defaults to "Expense")
      cleanedData.document_type = data.document_type || 'Expense';

      console.log('[ExpenseServices] Creating expense with data:', cleanedData);

      const response = await axiosInstance.post('/api/expenses/', cleanedData);
      return response.data;
    } catch (error: any) {
      console.error('Error creating expense:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      throw error;
    }
  },

  // Update expense
  async updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.put(
        `/api/expenses/${id}/`,
        data,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  },

  // Delete expense
  async deleteExpense(id: number): Promise<void> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      await axiosInstance.delete(`/api/expenses/${id}/`);
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  },

  // Get expense types
  async getExpenseTypes(): Promise<ExpenseType[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get('/api/expense-types/');
      // Handle both direct array and paginated response
      if (response?.data && Array.isArray(response.data)) {
        return response.data;
      }
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      return [];
    } catch (error) {
      console.error('Error fetching expense types:', error);
      throw error;
    }
  },

  // Get payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        '/api/expenses/payment_methods/',
      );
      // Handle both direct array and paginated response
      if (response?.data && Array.isArray(response.data)) {
        return response.data;
      }
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      return [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  },

  // Preview posting
  async previewPosting(id: number): Promise<PostingPreview> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.get(
        `/api/expenses/${id}/preview_posting/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error previewing posting:', error);
      throw error;
    }
  },

  // Post expense
  async postExpense(id: number): Promise<{message: string; expense: Expense}> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);

      const response = await axiosInstance.post(
        `/api/expenses/${id}/post_expense/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error posting expense:', error);
      throw error;
    }
  },
};

