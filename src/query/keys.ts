export type ItemsQueryFilters = {
  search?: string;
  categoryId?: number | string | null;
  lowStock?: boolean;
  inventoryStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';
  scope?: 'items' | 'services';
};

export type CustomersQueryFilters = {
  search?: string;
};

export type SalesQueryFilters = {
  search?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  paymentMethod?: string;
  user?: number | null;
};

export type VendorsQueryFilters = {
  search?: string;
};

export type ExpensesQueryFilters = {
  search?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  expenseType?: number | null;
  paymentMethod?: number | null;
};

export const queryKeys = {
  all: ['zentro'] as const,
  items: (filters: ItemsQueryFilters = {}) =>
    [...queryKeys.all, 'items', filters] as const,
  categories: () => [...queryKeys.all, 'categories'] as const,
  customers: (filters: CustomersQueryFilters = {}) =>
    [...queryKeys.all, 'customers', filters] as const,
  saleCustomers: () => [...queryKeys.all, 'saleCustomers'] as const,
  paymentMethods: () => [...queryKeys.all, 'paymentMethods'] as const,
  sales: (filters: SalesQueryFilters = {}) =>
    [...queryKeys.all, 'sales', filters] as const,
  salesSummary: (filters: SalesQueryFilters = {}) =>
    [...queryKeys.all, 'salesSummary', filters] as const,
  salesUserSummary: (filters: SalesQueryFilters = {}) =>
    [...queryKeys.all, 'salesUserSummary', filters] as const,
  userSetup: () => [...queryKeys.all, 'userSetup'] as const,
  vendors: (filters: VendorsQueryFilters = {}) =>
    [...queryKeys.all, 'vendors', filters] as const,
  expenses: (filters: ExpensesQueryFilters = {}) =>
    [...queryKeys.all, 'expenses', filters] as const,
  expenseTypes: () => [...queryKeys.all, 'expenseTypes'] as const,
};
