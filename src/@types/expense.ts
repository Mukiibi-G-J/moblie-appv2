export interface Expense {
  id: number;
  document_no: string;
  posting_date: string;
  description?: string;
  expense_type: number;
  expense_type_name?: string;
  amount: number;
  payment_method?: number;
  payment_method_name?: string;
  status: 'Open' | 'Posted' | 'Reversed';
  gl_account?: number;
  gl_account_name?: string;
  balancing_account?: number;
  balancing_account_name?: string;
  external_document_no?: string;
  created_at?: string;
  updated_at?: string;
  posted_at?: string;
  posted_by?: number;
}

export interface ExpenseType {
  id: number;
  name: string;
  code?: string;
  category?: number;
  gl_account?: number;
}

export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  gl_account?: number;
}

export interface ExpenseFormValues {
  posting_date: string;
  expense_type: number | null;
  description: string;
  amount: string; // String for input, converted to number
  payment_method: number | null;
  external_document_no?: string;
  status?: 'Open' | 'Posted' | 'Reversed';
}

export interface PostingPreview {
  expense_id: number;
  document_no: string;
  debit_entry: {
    gl_account: string;
    gl_account_name: string;
    amount: number;
    description: string;
  };
  credit_entry: {
    gl_account: string;
    gl_account_name: string;
    amount: number;
    description: string;
  };
}

export interface ExpenseListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: 'Open' | 'Posted' | 'Reversed';
  expense_type?: number;
  start_date?: string;
  end_date?: string;
}

export interface PaginatedExpenseResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Expense[];
}

