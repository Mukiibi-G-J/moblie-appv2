export interface PaymentJournal {
  id: number;
  system_id: string;
  posting_date: string;
  document_type: string;
  document_no: string;
  external_document_no?: string;
  account_type: string | null;
  account_content_type_id: number;
  account_object_id: number;
  account_name?: string;
  description?: string;
  payment_method?: number;
  payment_method_name?: string;
  amount: number;
  bal_account_type: string | null;
  bal_account_content_type_id: number;
  bal_account_object_id: number;
  bal_account_name?: string;
  status: string;
  application_status: string;
  applies_to_doc_type?: string;
  applies_to_content_type_id?: number;
  applies_to_object_id?: number;
  applies_to_doc_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentJournalFormValues {
  id?: number;
  system_id?: string;
  posting_date: string;
  document_type: string;
  document_no: string;
  external_document_no?: string;
  account_type: string | null;
  account_content_type_id: number | null;
  account_object_id: number | null;
  description?: string;
  payment_method?: number | null;
  amount: number;
  bal_account_type: string | null;
  bal_account_content_type_id: number | null;
  bal_account_object_id: number | null;
  status: string;
  application_status: string;
  applies_to_doc_type?: string;
  applies_to_content_type_id?: number | null;
  applies_to_object_id?: number | null;
}

export interface PaymentJournalFilterQueries {
  posting_date_from?: string;
  posting_date_to?: string;
  document_type?: string;
  account_type?: string | null;
  bal_account_type?: string | null;
  status?: string;
  application_status?: string;
  document_no?: string;
  external_document_no?: string;
  description?: string;
  applies_to_doc_type?: string;
  page?: number;
  page_size?: number;
  search?: string;
}

export interface PaginatedPaymentJournalResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaymentJournal[];
}

// Related data interfaces
export interface ContentType {
  id: number;
  app_label: string;
  model: string;
  name: string;
}

export interface CustomerLedgerEntry {
  id: number;
  document_no: string;
  description?: string;
  amount: number;
  remaining_amount: number;
}

export interface VendorLedgerEntry {
  id: number;
  document_no: string;
  description?: string;
  amount: number;
  remaining_amount: number;
}

export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  bal_account_type?: string;
  bal_account_content_type_id?: number;
  bal_account_object_id?: number;
  blocked?: boolean;
  requires_amount_received?: boolean;
}

export interface Customer {
  id: number;
  no: string;
  name: string;
  balance?: string | number | null;
  customer_type?: string | null;
  payment_method?: number | null;
}

export interface QuickCustomerPaymentPayload {
  customer_id: number;
  amount: number;
  payment_method_id: number;
  posting_date?: string;
}

export interface QuickCustomerPaymentResult {
  document_no: string;
  system_id: string;
  amount: number;
  customer_id: number;
  customer_no: string;
  customer_name: string;
  applied_document_no: string;
  applied_ledger_id: number;
  remaining_balance: number;
  payment_method_id: number;
  payment_method_code: string;
}

export interface Vendor {
  id: number;
  no: string;
  name: string;
  balance?: string | number | null;
  payment_method?: number | null;
  blocked?: boolean;
}

export interface QuickVendorPaymentPayload {
  vendor_id: number;
  amount: number;
  payment_method_id: number;
  posting_date?: string;
}

export interface QuickVendorPaymentResult {
  document_no: string;
  system_id: string;
  amount: number;
  vendor_id: number;
  vendor_no: string;
  vendor_name: string;
  applied_document_no?: string;
  applied_ledger_id?: number;
  remaining_balance: number;
  payment_method_id: number;
  payment_method_code: string;
  posted?: boolean;
}

export interface GLAccount {
  no: string;
  name: string;
}



