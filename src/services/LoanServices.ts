import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {
  BankAccount,
  Loan,
  LoanListParams,
  LoanRepayment,
  PaginatedLoanResponse,
  PaginatedRepaymentResponse,
  PostingPreview,
  RepaymentListParams,
} from '../@types/loans';

const cleanPayload = (data: Record<string, any>) => {
  const cleaned: Record<string, any> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      // allow 0 and empty string for fields like search
      !(typeof value === 'string' && value.trim() === '')
    ) {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

export const LoanServices = {
  // Loans CRUD
  async getLoans(params?: LoanListParams): Promise<PaginatedLoanResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get('/api/loans/loans/', {params});
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching loans:', error);
      throw error;
    }
  },

  async getLoan(id: number): Promise<Loan> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get(`/api/loans/loans/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching loan:', error);
      throw error;
    }
  },

  async createLoan(data: Partial<Loan>): Promise<Loan> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = cleanPayload({
        loan_type: data.loan_type,
        lender_name: data.lender_name,
        loan_amount: data.loan_amount,
        disbursement_date: data.disbursement_date,
        interest_rate: data.interest_rate,
        repayment_period: data.repayment_period,
        repayment_account: data.repayment_account,
        bank_account: data.bank_account,
        purpose: data.purpose,
        status: data.status,
      });
      const response = await axiosInstance.post('/api/loans/loans/', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating loan:', error);
      throw error;
    }
  },

  async updateLoan(id: number, data: Partial<Loan>): Promise<Loan> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = cleanPayload({
        loan_type: data.loan_type,
        lender_name: data.lender_name,
        loan_amount: data.loan_amount,
        disbursement_date: data.disbursement_date,
        interest_rate: data.interest_rate,
        repayment_period: data.repayment_period,
        repayment_account: data.repayment_account,
        bank_account: data.bank_account,
        purpose: data.purpose,
        status: data.status,
      });
      const response = await axiosInstance.patch(
        `/api/loans/loans/${id}/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating loan:', error);
      throw error;
    }
  },

  async deleteLoan(id: number): Promise<void> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      await axiosInstance.delete(`/api/loans/loans/${id}/`);
    } catch (error) {
      console.error('Error deleting loan:', error);
      throw error;
    }
  },

  async previewLoanPosting(id: number): Promise<PostingPreview> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get(
        `/api/loans/loans/${id}/preview_posting/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error previewing loan posting:', error);
      throw error;
    }
  },

  async postLoan(
    id: number,
  ): Promise<{message?: string; loan?: Loan; preview?: PostingPreview}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(
        `/api/loans/loans/${id}/post_loan/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error posting loan:', error);
      throw error;
    }
  },

  // Bank accounts helper
  async getBankAccounts(): Promise<BankAccount[]> {
    try {
      const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
      const {mapPageDataBankAccount} = await import('./pageDataMappers');
      return await fetchPageDataAll({
        pageId: PAGE_IDS.BankAccountList,
        mapRow: mapPageDataBankAccount as any,
      });
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      return [];
    }
  },

  // Repayments
  async getRepayments(
    params?: RepaymentListParams,
  ): Promise<PaginatedRepaymentResponse> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get('/api/loans/loan-repayments/', {
        params,
      });
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching loan repayments:', error);
      throw error;
    }
  },

  async getRepayment(id: number): Promise<LoanRepayment> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get(
        `/api/loans/loan-repayments/${id}/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching loan repayment:', error);
      throw error;
    }
  },

  async createRepayment(data: Partial<LoanRepayment>): Promise<LoanRepayment> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = cleanPayload({
        loan: data.loan,
        amount_paid: data.amount_paid,
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        bank_account: data.bank_account,
        status: data.status,
      });
      const response = await axiosInstance.post(
        '/api/loans/loan-repayments/',
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error creating loan repayment:', error);
      throw error;
    }
  },

  async updateRepayment(
    id: number,
    data: Partial<LoanRepayment>,
  ): Promise<LoanRepayment> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const payload = cleanPayload({
        loan: data.loan,
        amount_paid: data.amount_paid,
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        bank_account: data.bank_account,
        status: data.status,
      });
      const response = await axiosInstance.patch(
        `/api/loans/loan-repayments/${id}/`,
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating loan repayment:', error);
      throw error;
    }
  },

  async deleteRepayment(id: number): Promise<void> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      await axiosInstance.delete(`/api/loans/loan-repayments/${id}/`);
    } catch (error) {
      console.error('Error deleting loan repayment:', error);
      throw error;
    }
  },

  async previewRepaymentPosting(id: number): Promise<PostingPreview> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.get(
        `/api/loans/loan-repayments/${id}/preview_posting/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error previewing repayment posting:', error);
      throw error;
    }
  },

  async postRepayment(
    id: number,
  ): Promise<{message?: string; repayment?: LoanRepayment; preview?: PostingPreview}> {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    try {
      const response = await axiosInstance.post(
        `/api/loans/loan-repayments/${id}/post_repayment/`,
      );
      return response.data;
    } catch (error) {
      console.error('Error posting loan repayment:', error);
      throw error;
    }
  },
};

export default LoanServices;

