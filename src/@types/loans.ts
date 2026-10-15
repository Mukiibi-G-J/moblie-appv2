export type LoanStatus = 'Open' | 'Posted' | 'Cancelled';

export type RepaymentAccount = 'Cash' | 'Bank/Mobile Money' | string;

export interface Loan {
  id: number;
  document_no?: string;
  lender_name?: string;
  loan_type?: string;
  loan_amount?: number;
  disbursement_date?: string;
  interest_rate?: number;
  repayment_period?: number;
  repayment_account?: RepaymentAccount | null;
  bank_account?: number | string | null;
  purpose?: string | null;
  status?: LoanStatus;
  posted?: boolean;
  posted_date?: string | null;
  posted_by?: string | null;
}

export interface LoanListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: LoanStatus | 'All';
  posted?: boolean;
  lender_name?: string;
  loan_type?: string;
  repayment_account?: RepaymentAccount | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface PaginatedLoanResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Loan[];
}

export interface BankAccount {
  id?: number;
  no?: string;
  name?: string;
  number?: string;
}

export type RepaymentStatus = 'Open' | 'Posted' | 'Cancelled';

export interface LoanRepayment {
  id: number;
  loan: number | Loan;
  document_no?: string;
  amount_paid: number;
  payment_date: string;
  payment_method?: number | null;
  bank_account?: number | null;
  status?: RepaymentStatus;
  posted?: boolean;
  posted_date?: string | null;
}

export interface RepaymentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  loan?: number;
  status?: RepaymentStatus | 'All';
  start_date?: string | null;
  end_date?: string | null;
}

export interface PaginatedRepaymentResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LoanRepayment[];
}

export interface PostingPreviewLine {
  account?: string;
  description?: string;
  amount?: number;
}

export interface PostingPreview {
  lines?: PostingPreviewLine[];
  totals?: {
    debit?: number;
    credit?: number;
  };
  message?: string;
}

