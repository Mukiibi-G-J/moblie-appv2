export interface Vendor {
  id: number;
  system_id: string;
  no: string;
  name: string;
  blocked?: boolean;
  balance?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  payment_method?: number;
  payment_method_name?: string;
  vendor_posting_group?: number;
  vendor_posting_group_name?: string;
  business_posting_group?: number;
  business_posting_group_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  gl_account?: number;
}

export interface VendorPostingGroup {
  id: number;
  code: string;
  description?: string;
}

export interface GeneralBusinessPostingGroup {
  id: number;
  code: string;
  description?: string;
}

export interface VendorFormValues {
  name: string;
  blocked?: boolean;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  payment_method?: number | null;
  vendor_posting_group?: number | null;
  business_posting_group?: number | null;
}

export interface VendorListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}

export interface PaginatedVendorResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Vendor[];
}

