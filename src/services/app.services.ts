import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CartItem,
  ItemJournalData,
  SalesItem,
  SalesPostData,
  SalesInvoiceData,
} from '../@types/types.dto';
import {axiosInstance, createAxiosInstance} from '../axios/axios';
import {Item} from '../Screens/Items/Items';

// New function to search for items
export const searchItems = async (searchQuery: string): Promise<CartItem[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      `/api/items/?q=${encodeURIComponent(searchQuery)}`,
    );
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error) {
    throw error; // Handle errors
  }
};

/** Single page from item ledger API (lot / remaining qty for sales tracking). */
export type ItemLedgerApiPage = {
  results?: ItemLedgerEntryRow[];
  ledger_entries?: ItemLedgerEntryRow[];
  count?: number;
  next?: string | null;
};

export type ItemLedgerEntryRow = {
  lot_no?: string;
  remaining_quantity?: number;
  document_no?: string;
  entry_type?: string;
  document_type?: string;
  expiry_date?: string;
};

export const getItemLedgerEntries = async (
  itemId: string | number,
  page: number = 1,
  pageSize: number = 500,
): Promise<ItemLedgerApiPage> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axios = createAxiosInstance(tenant) || undefined;
  const response = await axios.get(`/api/item-ledger/${itemId}/`, {
    params: {page, page_size: pageSize},
  });
  return response.data;
};

/** Paginate until no more pages (aligned with zentro-web POS). */
export const fetchAllItemLedgerEntries = async (
  itemNo: string | number,
  maxPages: number = 50,
): Promise<ItemLedgerEntryRow[]> => {
  let allEntries: ItemLedgerEntryRow[] = [];
  let page = 1;
  const pageSize = 500;
  let totalCount = 0;

  while (page <= maxPages) {
    const data = await getItemLedgerEntries(itemNo, page, pageSize);
    const pageEntries = data.results || data.ledger_entries || [];
    allEntries = [...allEntries, ...pageEntries];

    if (page === 1 && data.count !== undefined) {
      totalCount = data.count;
    }

    const hasNextUrl = data.next !== null && data.next !== undefined;
    const gotFullPage = pageEntries.length === pageSize;
    const hasMoreEntries =
      totalCount > 0 ? allEntries.length < totalCount : gotFullPage;

    const hasMore = hasNextUrl || (gotFullPage && hasMoreEntries);
    if (!hasMore) {
      break;
    }
    page++;
  }

  return allEntries;
};

// New function to fetch purchase data
export const fetchPurchasesData = async (filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  vendor?: number;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ results: any[]; count: number }> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const params: any = {};

    if (filters?.status) {
      params.status = filters.status;
    }
    if (filters?.startDate) {
      params.document_date__gte = filters.startDate;
    }
    if (filters?.endDate) {
      params.document_date__lte = filters.endDate;
    }
    if (filters?.vendor) {
      params.vendor = filters.vendor;
    }
    if (filters?.page) {
      params.page = filters.page;
    }
    if (filters?.pageSize) {
      params.page_size = filters.pageSize;
    }
    if (filters?.search) {
      params.search = filters.search;
    }

    const response = await axiosInstance.get('/api/purchases/', {params});

    if (response?.data?.results && Array.isArray(response.data.results)) {
      return { results: response.data.results, count: response.data.count || 0 };
    } else if (Array.isArray(response.data)) {
      return { results: response.data, count: response.data.length };
    }
    
    return { results: [], count: 0 };
  } catch (error: any) {
    console.error('fetchPurchasesData: Error fetching purchases:', error);
    throw error;
  }
};

// Create or update purchase invoice (upsert)
export const upsertPurchase = async (purchaseData: {
  id?: number;
  system_id?: string;
  vendor_name?: string;
  vendor?: number;
  document_date?: string;
  posting_date?: string;
  vat_date?: string;
  due_date?: string;
  vendor_invoice_no?: string;
  contact_person?: string;
  payment_method?: number;
  status?: string;
  deleted?: boolean;
}): Promise<any> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const response = await axiosInstance.post('/api/purchases/upsert/', purchaseData);
    return response.data;
  } catch (error: any) {
    console.error('upsertPurchase: Error upserting purchase:', error);
    throw error;
  }
};

// Update purchase lines
export const updatePurchaseLines = async (
  purchaseId: number | string,
  lines: any[],
): Promise<any> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const response = await axiosInstance.post(
      `/api/purchases/${purchaseId}/update_lines/`,
      { lines },
    );
    return response.data;
  } catch (error: any) {
    console.error('updatePurchaseLines: Error updating lines:', error);
    throw error;
  }
};

// Post purchase invoice
export const postPurchase = async (purchaseId: number | string): Promise<any> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const response = await axiosInstance.post(
      `/api/purchases/${purchaseId}/post_purchase/`,
      {},
    );
    return response.data;
  } catch (error: any) {
    console.error('postPurchase: Error posting purchase:', error);
    throw error;
  }
};

// Get vendors list
export const fetchVendors = async (search?: string): Promise<any[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const params: any = {};
    if (search) {
      params.search = search;
    }

    const response = await axiosInstance.get('/api/vendors/', {params});

    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    } else if (Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  } catch (error: any) {
    console.error('fetchVendors: Error fetching vendors:', error);
    throw error;
  }
};

/** Query params aligned with zentro-web SalesHistory / SalesServices.getSales */
export type SalesHistoryListFilters = {
  startDate?: string;
  endDate?: string;
  status?: string;
  paymentMethod?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

function buildSalesHistoryQueryParams(
  filters?: SalesHistoryListFilters,
  options?: {omitPagination?: boolean},
) {
  const params: Record<string, string | number> = {};

  if (filters?.status) {
    params.status = filters.status;
  }
  if (filters?.startDate) {
    params.date_range_after = filters.startDate;
  }
  if (filters?.endDate) {
    params.date_range_before = filters.endDate;
  }
  if (filters?.paymentMethod) {
    params.payment_method = filters.paymentMethod;
  }
  if (filters?.search) {
    params.search = filters.search;
  }
  if (!options?.omitPagination) {
    if (filters?.page) {
      params.page = filters.page;
    }
    if (filters?.pageSize) {
      params.page_size = filters.pageSize;
    }
  }

  return params;
}

export type SalesHistorySummary = {
  total_sales: number;
  total_products: number;
  total_invoices: number;
};

export type SalesUserSummaryRow = {
  user_id: number | null;
  user_name: string;
  total_sales: number;
  total_products: number;
  total_invoices: number;
};

/**
 * GET /api/sales/summary/ — same filters as list (no pagination), matches web SalesServices.getSalesSummary.
 * May 403 if user lacks Sales History summary permission (object 10004); returns null on any error.
 */
export const fetchSalesSummary = async (
  filters?: Omit<SalesHistoryListFilters, 'page' | 'pageSize'>,
): Promise<SalesHistorySummary | null> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const params = buildSalesHistoryQueryParams(filters, {omitPagination: true});
    const response = await axiosInstance.get('/api/sales/summary/', {params});
    const d = response.data;
    if (!d || typeof d !== 'object') {
      return null;
    }
    return {
      total_sales: Number(d.total_sales ?? 0),
      total_products: Number(d.total_products ?? 0),
      total_invoices: Number(d.total_invoices ?? 0),
    };
  } catch (e) {
    console.warn('fetchSalesSummary: summary endpoint unavailable or forbidden', e);
    return null;
  }
};

/**
 * GET /api/sales/summary/?group_by=user — matches web SalesServices.getSalesUserSummary.
 */
export const fetchSalesUserSummary = async (
  filters?: Omit<SalesHistoryListFilters, 'page' | 'pageSize'>,
): Promise<SalesUserSummaryRow[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const params = {
      ...buildSalesHistoryQueryParams(filters, {omitPagination: true}),
      group_by: 'user',
    };
    const response = await axiosInstance.get('/api/sales/summary/', {params});
    const users = response.data?.users;
    if (!Array.isArray(users)) {
      return [];
    }
    return users.map((u: any) => ({
      user_id: u.user_id ?? null,
      user_name: String(u.user_name ?? ''),
      total_sales: Number(u.total_sales ?? 0),
      total_products: Number(u.total_products ?? 0),
      total_invoices: Number(u.total_invoices ?? 0),
    }));
  } catch (e) {
    console.warn('fetchSalesUserSummary: user summary unavailable', e);
    return [];
  }
};

// New function to fetch sales data
// Matches the web frontend implementation in SalesHistory.tsx
export const fetchSalesData = async (filters?: SalesHistoryListFilters) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const params = buildSalesHistoryQueryParams(filters);

    console.log('fetchSalesData: Making API call with params:', params);
    const response = await axiosInstance.get('/api/sales/', {params});
    console.log('fetchSalesData: API response:', {
      status: response.status,
      hasData: !!response.data,
      hasResults: !!response.data?.results,
      isArray: Array.isArray(response.data?.results),
      isDirectArray: Array.isArray(response.data),
      dataLength: response.data?.results?.length || response.data?.length || 0,
      count: response.data?.count,
    });

    // Handle paginated response format: {results: [...], count: N, next: ..., previous: ...}
    if (response?.data?.results && Array.isArray(response.data.results)) {
      console.log('fetchSalesData: Returning paginated response, count:', response.data.count);
      return {
        results: response.data.results,
        count: response.data.count || response.data.results.length,
        next: response.data.next,
        previous: response.data.previous,
      };
    } else if (Array.isArray(response.data)) {
      console.log('fetchSalesData: Returning direct array, count:', response.data.length);
      return {
        results: response.data,
        count: response.data.length,
        next: null,
        previous: null,
      };
    }
    
    console.log('fetchSalesData: No valid data found, returning empty array');
    return {
      results: [],
      count: 0,
      next: null,
      previous: null,
    };
  } catch (error: any) {
    console.error('fetchSalesData: Error fetching sales data:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

export const createSales = async (salesData: SalesPostData[]) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    console.log('DEBUG: Sending sales invoice data:', salesData);
    const response = await axiosInstance.post('/api/sales/', salesData);
    return response;
  } catch (error) {
    throw error;
  }
};

export const postSalesInvoice = async (salesId: number) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Use the correct endpoint from frontend
    const endpoint = `/api/sales/${salesId}/post_sale/`;

    console.log(`DEBUG: Posting sales invoice at: ${endpoint}`);
    const response = await axiosInstance.post(endpoint);
    console.log(`DEBUG: Successfully posted at: ${endpoint}`);
    return response;
  } catch (error) {
    console.error('DEBUG: Error posting sales invoice:', error);
    throw error;
  }
};

export const createSalesInvoice = async (
  salesInvoiceData: SalesInvoiceData,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    console.log('DEBUG: Sending sales invoice data:', salesInvoiceData);
    const response = await axiosInstance.post('/api/sales/', salesInvoiceData);

    // Only auto-post if status is not "Draft"
    if (response.data && response.data.id && salesInvoiceData.status !== 'Draft') {
      try {
        const postResult = await postSalesInvoice(response.data.id);
        if (
          postResult &&
          typeof postResult === 'object' &&
          'success' in postResult &&
          postResult.success
        ) {
          console.log('DEBUG: Sales invoice posted successfully');
        } else {
          console.log('DEBUG: Sales invoice created but posting not available');
        }
      } catch (postError) {
        console.error('DEBUG: Error posting sales invoice:', postError);
        // Continue with the response even if posting fails
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};

// Fetch draft sales invoices
export const fetchDraftSales = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const params: any = {
      status: 'Draft',
    };

    const response = await axiosInstance.get('/api/sales/', {params});

    if (response?.data?.results && Array.isArray(response.data.results)) {
      // Return only first 3 drafts (max allowed)
      return response.data.results.slice(0, 3);
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching draft sales:', error);
    throw error;
  }
};

// Get a single sales invoice by ID
export const getSalesInvoice = async (invoiceId: number) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const response = await axiosInstance.get(`/api/sales/${invoiceId}/`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching sales invoice:', error);
    throw error;
  }
};

// Update sales invoice (for deleting drafts or full updates)
// Matches web frontend pattern: sends id and system_id in the data object
export const updateSalesInvoice = async (
  invoiceId: number,
  updateData: {
    id?: number;
    system_id?: string;
    deleted?: boolean;
    status?: string;
    customer?: number;
    customer_name?: string;
    document_date?: string;
    total_amount?: number;
    payment_method?: number;
    lines?: any[];
  },
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Use upsert endpoint like web app - supports full invoice updates
    // The id and system_id must be in the data object for upsert to work correctly
    const response = await axiosInstance.post('/api/sales/upsert/', {
      id: invoiceId,
      ...updateData,
    });
    return response;
  } catch (error: any) {
    console.error('Error updating sales invoice:', error);
    throw error;
  }
};

export const postItemJournal = async (itemJournalData: ItemJournalData) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.post(
      '/api/item-journals/',
      itemJournalData,
    );
    return response;
  } catch (error) {
    return {error: error};
  }
};

// items list api
export const fetchItems = async (
  page: number = 1,
  searchQuery: string = '',
  categoryId?: number,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const params: any = {
        page,
        q: searchQuery.trim(),
    };
    
    // Add category filter if provided
    if (categoryId) {
      params.category_id = categoryId;
    }
    
    const response = await axiosInstance.get(`/api/items/`, {
      params,
    });
    console.log('response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;
  }
};

// Add this new API call for categories
export const fetchCategories = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/categories/');
    // Handle both array and paginated response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// Item Category API functions
export interface ItemCategory {
  code: string;
  description: string;
  parent_id: string | null;
  level?: number;
  created_at?: string;
  updated_at?: string;
  system_id?: string;
}

export const getItemCategories = async (params?: {
  search?: string;
  parent_id?: string;
  page?: number;
  pageSize?: number;
}): Promise<ItemCategory[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/categories/', {params});
    // Handle both array and paginated response
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error) {
    console.error('Error fetching item categories:', error);
    throw error;
  }
};

export const getItemCategory = async (code: string): Promise<ItemCategory> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(`/api/categories/${code}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching item category:', error);
    throw error;
  }
};

export const createItemCategory = async (
  data: Partial<ItemCategory>,
): Promise<ItemCategory> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.post('/api/categories/', data);
    return response.data;
  } catch (error) {
    console.error('Error creating item category:', error);
    throw error;
  }
};

export const updateItemCategory = async (
  code: string,
  data: Partial<ItemCategory>,
): Promise<ItemCategory> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.put(`/api/categories/${code}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating item category:', error);
    throw error;
  }
};

export const deleteItemCategory = async (code: string): Promise<void> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    await axiosInstance.delete(`/api/categories/${code}/`);
  } catch (error) {
    console.error('Error deleting item category:', error);
    throw error;
  }
};

export const fetchDailyProfitReport = async (date?: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/reports/daily-profit/', {
      params: {
        date,
      },
    });
    return response?.data;
  } catch (error) {
    console.error('Error fetching daily profit report:', error);
    throw error;
  }
};

export const fetchWeeklySummaryReport = async (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/reports/weekly-summary/', {
      params: {
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return response?.data;
  } catch (error) {
    console.error('Error fetching weekly summary report:', error);
    throw error;
  }
};

export const fetchMonthlySummaryReport = async (month?: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/reports/monthly-summary/', {
      params: {
        month,
      },
    });
    return response?.data;
  } catch (error) {
    console.error('Error fetching monthly summary report:', error);
    throw error;
  }
};

export const fetchProductProfitabilityReport = async (params?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  productType?: string;
}) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      '/api/reports/profitable-products/',
      {
        params: {
          start_date: params?.startDate,
          end_date: params?.endDate,
          category: params?.category,
          product_type: params?.productType,
        },
      },
    );
    return response?.data;
  } catch (error) {
    console.error('Error fetching product profitability report:', error);
    throw error;
  }
};

export const fetchExpenseBreakdownReport = async (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      '/api/reports/expense-breakdown/',
      {
        params: {
          start_date: params?.startDate,
          end_date: params?.endDate,
        },
      },
    );
    return response?.data;
  } catch (error) {
    console.error('Error fetching expense breakdown report:', error);
    throw error;
  }
};

export const fetchProfitLossStatement = async (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      '/api/sales-dashboard/profit_loss_statement/',
      {
        params: {
          start_date: params?.startDate,
          end_date: params?.endDate,
        },
      },
    );
    return response?.data;
  } catch (error) {
    console.error('Error fetching profit & loss statement:', error);
    throw error;
  }
};

export const fetchBalanceSheetReport = async (asOfDate?: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      '/api/sales-dashboard/balance_sheet_report/',
      {
        params: {
          as_of_date: asOfDate,
        },
      },
    );
    return response?.data;
  } catch (error) {
    console.error('Error fetching balance sheet report:', error);
    throw error;
  }
};

// Create a new item (uses upsert endpoint without system_id)
export const createItem = async (itemData: Partial<Item>) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    
    // For new items, don't include system_id - backend will generate it
    const response = await axiosInstance.post(`/api/items/upsert/`, itemData);
    return response;
  } catch (error) {
    throw error;
  }
};

export const updateItem = async (itemId: string | number, itemData: Item) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    
    // Use upsert endpoint - include system_id for updates
    const upsertData = {
      ...itemData,
      // Include system_id if available (for updates)
      system_id: itemData.system_id || itemData.no || itemId.toString(),
    };
    
    const response = await axiosInstance.post(`/api/items/upsert/`, upsertData);
    return response;
  } catch (error) {
    throw error;
  }
};

// Upload image for an item
export const uploadItemImage = async (
  itemId: string | number,
  imageUri: string,
) => {
  try {
    console.log('uploadItemImage called with:', {itemId, imageUri});

    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Create FormData for file upload
    const formData = new FormData();

    // Get file name and type from URI
    let fileName = 'image.jpg';
    let fileType = 'jpeg';

    if (imageUri.startsWith('content://')) {
      // For content:// URIs, we need to handle them differently
      fileName = `image_${Date.now()}.jpg`;
      fileType = 'jpeg';
    } else if (imageUri.startsWith('file://')) {
      // For file:// URIs, try to extract the extension
      const pathParts = imageUri.split('/');
      fileName = pathParts.pop() || 'image.jpg';
      const extension = fileName.split('.').pop()?.toLowerCase();

      // Map common extensions to MIME types
      if (extension === 'png') {
        fileType = 'png';
      } else if (extension === 'gif') {
        fileType = 'gif';
      } else if (extension === 'webp') {
        fileType = 'webp';
      } else {
        // Default to jpeg for unknown extensions
        fileType = 'jpeg';
        if (!fileName.includes('.')) {
          fileName = `${fileName}.jpg`;
        }
      }
    }

    console.log('File info:', {fileName, fileType, imageUri});

    // Append the item ID and image file according to the backend API
    formData.append('item', itemId.toString());
    formData.append('url', {
      uri: imageUri,
      type: `image/${fileType}`,
      name: fileName,
    } as any);

    // Use the correct endpoint based on the backend analysis
    const response = await axiosInstance.post('/api/item-images/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('Upload response:', response.data);
    return response;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    // Provide more specific error messages
    if (error.response?.status === 413) {
      throw new Error(
        'Image file is too large. Please select a smaller image.',
      );
    } else if (error.response?.status === 415) {
      throw new Error(
        'Unsupported image format. Please select a JPG, PNG, or GIF image.',
      );
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    } else if (error.response?.status === 403) {
      throw new Error(
        'You do not have permission to upload images for this item.',
      );
    } else {
      throw error;
    }
  }
};

// Delete image for an item
export const deleteItemImage = async (imageId: number) => {
  try {
    console.log('deleteItemImage called with imageId:', imageId);

    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Use the correct endpoint based on the backend analysis
    const response = await axiosInstance.delete(`/api/item-images/${imageId}/`);

    console.log('Delete response:', response.data);
    return response;
  } catch (error: any) {
    console.error('Error deleting image:', error);
    // Provide more specific error messages
    if (error.response?.status === 404) {
      throw new Error('Image not found. It may have already been deleted.');
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    } else if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete this image.');
    } else {
      throw error;
    }
  }
};

// Create a function to get the configured axios instance
const getAxiosInstance = async () => {
  const tenant = await AsyncStorage.getItem('tenant');
  return tenant ? createAxiosInstance(tenant) : axiosInstance;
};

// Get company information
export const getCompanyInfo = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/sales/company-info/');
    return response;
  } catch (error: any) {
    console.error('Error fetching company info:', error);
    throw error;
  }
};

// Update fetchItemJournal to accept pagination parameters
export const fetchItemJournal = async (
  page: number = 1,
  searchQuery: string = '',
) => {
  try {
    const api = await getAxiosInstance();
    const response = await api.get('/api/item-journals/', {
      params: {
        page,
        q: searchQuery.trim(),
      },
    });
    console.log('request url', response.config.url);
    return response.data;
  } catch (error: any) {
    console.log('error', error.response?.data);
    throw error;
  }
};

// Update updateItemJournal similarly
export const updateItemJournal = async (
  itemJournalId: number,
  itemJournalData: ItemJournalData,
) => {
  try {
    const api = await getAxiosInstance();
    const response = await api.put(
      `/api/item-journals/${itemJournalId}/`,
      itemJournalData,
    );
    console.log('request url', response.config.url);
    return response;
  } catch (error: any) {
    console.log('error', error.response?.data);
    throw error;
  }
};

// Customer types
export interface Customer {
  id: number;
  no: string;
  name: string;
  system_id: string;
}

// Payment method types
export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  bal_account_type: string;
  bal_account_no: string;
  system_id: string;
  requires_amount_received: boolean;
}

/**
 * Fetch customers from API
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    const response = await api.get('/api/customers/');
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

/**
 * Fetch payment methods from API
 */
export const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    const response = await api.get('/api/financials/payment-methods/');
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
};

/**
 * Dashboard KPI Metrics Types
 */
export interface KPIMetrics {
  today_revenue: number;
  yesterday_revenue: number;
  revenue_growth: number;
  today_orders: number;
  yesterday_orders: number;
  order_growth: number;
  today_products_sold: number;
  total_products: number;
}

/**
 * Fetch KPI metrics for dashboard
 */
export const fetchKPIMetrics = async (): Promise<KPIMetrics | null> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Fetch today's sales (include both Posted and Open status)
    const todayResponse = await api.get('/api/sales/', {
      params: {
        document_date__gte: today,
        document_date__lte: today,
        // Don't filter by status - get all sales for today
      },
    });
    
    // Fetch yesterday's sales (include both Posted and Open status)
    const yesterdayResponse = await api.get('/api/sales/', {
      params: {
        document_date__gte: yesterday,
        document_date__lte: yesterday,
        // Don't filter by status - get all sales for yesterday
      },
    });
    
    // Filter to only include Posted sales (or Open if Posted doesn't exist)
    const filterPostedSales = (sales: any[]) => {
      return sales.filter(sale => {
        // Include Posted sales
        if (sale.status === 'Posted') return true;
        // Include Open sales if no Posted sales exist
        if (sale.status === 'Open') return true;
        return false;
      });
    };
    
    const todaySales = filterPostedSales(todayResponse?.data?.results || []);
    const yesterdaySales = filterPostedSales(yesterdayResponse?.data?.results || []);
    
    // Debug logging
    console.log('Today sales count:', todaySales.length);
    console.log('Yesterday sales count:', yesterdaySales.length);
    if (todaySales.length > 0) {
      console.log('Sample today sale:', {
        id: todaySales[0].id,
        total_amount: todaySales[0].total_amount,
        status: todaySales[0].status,
        has_lines: !!todaySales[0].lines,
        lines_count: todaySales[0].lines?.length || 0,
      });
    }
    
    // Helper function to get total amount from sale
    const getSaleTotal = (sale: any): number => {
      // First try to use total_amount directly from sale object
      if (sale.total_amount !== undefined && sale.total_amount !== null) {
        return typeof sale.total_amount === 'string' 
          ? parseFloat(sale.total_amount) || 0 
          : sale.total_amount;
      }
      
      // Fall back to calculating from lines if total_amount is not available
      if (sale.lines && Array.isArray(sale.lines)) {
        return sale.lines.reduce((lineSum: number, line: any) => {
          const lineAmount = line.total_amount || 0;
          return lineSum + (typeof lineAmount === 'string' 
            ? parseFloat(lineAmount) || 0 
            : lineAmount);
        }, 0);
      }
      
      return 0;
    };
    
    // Calculate today's revenue and orders
    const todayRevenue = todaySales.reduce((sum: number, sale: any) => {
      const saleTotal = getSaleTotal(sale);
      return sum + saleTotal;
    }, 0);
    
    const todayOrders = todaySales.length;
    
    // Debug logging
    console.log('Today revenue calculated:', todayRevenue);
    console.log('Today orders:', todayOrders);
    
    // Calculate yesterday's revenue and orders
    const yesterdayRevenue = yesterdaySales.reduce((sum: number, sale: any) => {
      return sum + getSaleTotal(sale);
    }, 0);
    
    const yesterdayOrders = yesterdaySales.length;
    
    // Calculate products sold today
    const todayProductsSold = todaySales.reduce((sum: number, sale: any) => {
      if (sale.lines && Array.isArray(sale.lines)) {
        return sum + sale.lines.reduce((lineSum: number, line: any) => {
          const qty = line.quantity || 0;
          return lineSum + (typeof qty === 'string' ? parseFloat(qty) || 0 : qty);
        }, 0);
      }
      return sum;
    }, 0);
    
    // Calculate growth percentages
    const revenueGrowth = yesterdayRevenue > 0 
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
      : 0;
    
    const orderGrowth = yesterdayOrders > 0 
      ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 
      : 0;
    
    // Fetch total products count
    const itemsResponse = await api.get('/api/items/', {
      params: { page: 1 },
    });
    const totalProducts = itemsResponse?.data?.count || 0;
    
    return {
      today_revenue: todayRevenue,
      yesterday_revenue: yesterdayRevenue,
      revenue_growth: revenueGrowth,
      today_orders: todayOrders,
      yesterday_orders: yesterdayOrders,
      order_growth: orderGrowth,
      today_products_sold: todayProductsSold,
      total_products: totalProducts,
    };
  } catch (error: any) {
    // Subscription expiry (402) is expected on trial end; redirect handling happens in axios interceptor.
    const errStr =
      typeof error === 'string'
        ? error
        : error?.message || error?.toString?.() || '';
    const looksLikeSubscriptionExpired =
      errStr.includes('trial period has ended') ||
      errStr.includes('proceed to the subscription page') ||
      errStr.includes('subscription_expired');
    if (!looksLikeSubscriptionExpired) {
      console.error('Error fetching KPI metrics:', error);
    }
    return null;
  }
};

/**
 * Fetch recent sales transactions
 */
export const fetchRecentTransactions = async (limit: number = 10) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    
    const response = await api.get('/api/sales/', {
      params: {
        limit,
        ordering: '-created_at',
        status: 'Posted',
      },
    });
    
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching recent transactions:', error);
    return [];
  }
};

/**
 * Fetch low stock items
 */
export const fetchLowStockItems = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    
    const response = await api.get('/api/items/', {
      params: {
        low_stock: true,
        page: 1,
      },
    });
    
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching low stock items:', error);
    return [];
  }
};

/**
 * Fetch outstanding receivables summary
 */
export const fetchOutstandingReceivables = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    
    // Try to get receivables dashboard data
    const response = await api.get('/api/customer-ledger/receivables_dashboard/');
    
    if (response?.data?.total_outstanding) {
      return {
        total_amount: response.data.total_outstanding.amount || 0,
        count: response.data.total_outstanding.count || 0,
      };
    }
    
    return { total_amount: 0, count: 0 };
  } catch (error: any) {
    console.error('Error fetching outstanding receivables:', error);
    // Return zero if endpoint doesn't exist or fails
    return { total_amount: 0, count: 0 };
  }
};

/**
 * Fetch today's top selling items
 */
export const fetchTopSellingItems = async (limit: number = 5) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch today's sales
    const response = await api.get('/api/sales/', {
      params: {
        document_date__gte: today,
        document_date__lte: today,
      },
    });
    
    const sales = response?.data?.results || [];
    
    // Aggregate items sold today
    const itemCounts: { [key: string]: { name: string; quantity: number; total: number } } = {};
    
    sales.forEach((sale: any) => {
      if (sale.lines && Array.isArray(sale.lines)) {
        sale.lines.forEach((line: any) => {
          const itemKey = line.item_no || line.item || 'unknown';
          const itemName = line.item_name || 'Unknown Item';
          const qty = typeof line.quantity === 'string' ? parseFloat(line.quantity) || 0 : (line.quantity || 0);
          const total = typeof line.total_amount === 'string' ? parseFloat(line.total_amount) || 0 : (line.total_amount || 0);
          
          if (!itemCounts[itemKey]) {
            itemCounts[itemKey] = {
              name: itemName,
              quantity: 0,
              total: 0,
            };
          }
          
          itemCounts[itemKey].quantity += qty;
          itemCounts[itemKey].total += total;
        });
      }
    });
    
    // Convert to array and sort by quantity
    const topItems = Object.entries(itemCounts)
      .map(([key, value]) => ({
        item_no: key,
        ...value,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
    
    return topItems;
  } catch (error: any) {
    console.error('Error fetching top selling items:', error);
    return [];
  }
};
