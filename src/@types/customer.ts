export interface Customer {
  id: number;
  system_id: string;
  no: string;
  name: string;
  contact?: string;
  phone_number?: string;
  address?: string;
  address_2?: string;
  city?: string;
  credit_limit?: string;
  balance?: string;
  payment_method?: number;
  payment_method_name?: string;
  customer_posting_group?: number;
  customer_posting_group_name?: string;
  general_business_posting_group?: number;
  general_business_posting_group_name?: string;
  customer_type?: 'GENERAL' | 'CORPORATE' | 'INDIVIDUAL';
  user?: number;
  user_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  gl_account?: number;
}

export interface CustomerPostingGroup {
  id: number;
  code: string;
  description?: string;
}

export interface GeneralBusinessPostingGroup {
  id: number;
  code: string;
  description?: string;
}

export interface CustomerFormValues {
  name: string;
  contact?: string;
  phone_number?: string;
  address?: string;
  address_2?: string;
  city?: string;
  credit_limit?: string;
  payment_method?: number | null;
  customer_posting_group?: number | null;
  general_business_posting_group?: number | null;
  customer_type?: 'GENERAL' | 'CORPORATE' | 'INDIVIDUAL';
}

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  customer_type?: 'GENERAL' | 'CORPORATE' | 'INDIVIDUAL';
}

export interface PaginatedCustomerResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
}





