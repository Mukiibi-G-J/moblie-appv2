export interface BankAccount {
  id?: number;
  no?: string;
  name?: string;
  bank_account_no?: string;
  bank_branch_no?: string;
  bank_account_posting_group?: string;
  bank_account_posting_group_name?: string;
  bank_account_posting_group_code?: string;
  address?: string;
  contact?: string;
  min_balance?: number;
  debit_amount?: number;
  credit_amount?: number;
  balance?: number;
}

export interface PaginatedBankAccountResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BankAccount[];
}

export interface BankAccountListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}

export interface BankAccountLedgerEntry {
  entry_no?: number;
  bank_account_no?: string;
  bank_account_name?: string;
  posting_date?: string;
  document_no?: string;
  document_type?: string;
  description?: string;
  debit_amount?: number;
  credit_amount?: number;
  balance?: number;
}

export interface PaginatedBankAccountLedgerResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BankAccountLedgerEntry[];
}

export interface BankAccountLedgerParams {
  bank_account_no?: string;
  search?: string;
  document_type?: string;
  start_date?: string;
  end_date?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}



