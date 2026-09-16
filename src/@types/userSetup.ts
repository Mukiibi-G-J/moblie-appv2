export interface UserSetup {
  id: number;
  user: number;
  userId: number;
  username: string;
  email: string;
  fullName: string;
  canSeeBuyingPrice: boolean;
  canSeeProfitMargin: boolean;
  canSeeItemCost: boolean;
  canEditSalesPrice?: boolean;
  canPostPreviousDates: boolean;
  canReversePurchaseInvoice: boolean;
  canReverseSalesInvoice: boolean;
  canReverseItemJournal?: boolean;
  canViewOnlyTheirSales: boolean;
  defaultSalesUi?: 'phone' | 'pos';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSetupFormValues {
  user: number;
  canSeeBuyingPrice: boolean;
  canSeeProfitMargin: boolean;
  canSeeItemCost: boolean;
  canEditSalesPrice?: boolean;
  canPostPreviousDates: boolean;
  canReversePurchaseInvoice: boolean;
  canReverseSalesInvoice: boolean;
  canReverseItemJournal?: boolean;
  canViewOnlyTheirSales: boolean;
  defaultSalesUi?: 'phone' | 'pos';
  notes: string;
}

export interface UserWithoutSetup {
  id: number;
  username: string;
  email: string;
  fullName: string;
}

export interface UserSetupListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}

export interface PaginatedUserSetupResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UserSetup[];
}
