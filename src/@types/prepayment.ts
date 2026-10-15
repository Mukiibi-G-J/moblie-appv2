export type PrepaymentStatus = 'Draft' | 'Posted' | 'Cancelled';

export interface PrepaymentLine {
  id?: number;
  item?: string | number | null;
  unit_of_measure?: string | number | null;
  quantity: number;
  unit_price: number;
  amount?: number;
  is_deleted?: boolean;
}

export interface Prepayment {
  id: number;
  document_no?: string;
  customer?: number | string | null;
  customer_name?: string;
  status?: PrepaymentStatus;
  payment_method_id?: number | null;
  deposit_amount?: number;
  total_amount?: number;
  posted?: boolean;
  posted_date?: string | null;
  lines?: PrepaymentLine[];
}

export interface PrepaymentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: PrepaymentStatus | 'All';
}

export interface PaginatedPrepaymentResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Prepayment[];
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



