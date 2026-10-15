import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CartItem,
  ItemJournalUpsertPayload,
  SalesItem,
  SalesPostData,
  SalesInvoiceData,
} from '../@types/types.dto';
import {AxiosResponse} from 'axios';
import {axiosInstance, createAxiosInstance} from '../axios/axios';
import {isSubscriptionExpiredError} from '../utils/subscriptionExpired';
import {normalizeSalesUiMode} from '../utils/salesUiMode';
import {resolveEffectiveBranchDimensionId} from '../utils/effectiveBranch';
import {Item} from '../Screens/Items/Items';
import type {AxiosRequestConfig} from 'axios';

// New function to search for items
export const searchItems = async (searchQuery: string): Promise<CartItem[]> => {
  try {
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataItem} = await import('./pageDataMappers');
    const rows = await fetchPageDataAll({
      pageId: PAGE_IDS.ItemList,
      search: searchQuery,
      limit: 50,
      mapRow: mapPageDataItem,
    });
    return rows as unknown as CartItem[];
  } catch (error) {
    throw error;
  }
};

export type GlobalSearchHit = {
  title: string;
  description?: string;
  icon?: string;
  category?: string;
  categoryTitle?: string;
  pageName?: string;
  systemId?: string;
  url?: string;
};

export type GlobalSearchSection = {
  title: string;
  data: GlobalSearchHit[];
};

/** Cross-module search: items, customers, invoices, vendors, payments, G/L, journals. */
export const globalSearch = async (
  searchQuery: string,
): Promise<GlobalSearchSection[]> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axios = createAxiosInstance(tenant);
  const response = await axios.post<{data?: GlobalSearchSection[]}>('/api/search/global/', {
    query: searchQuery,
  });
  return response.data?.data ?? [];
};

/** Item row from GET /api/items/?no= — used for purchase line tracking specs. */
export type ItemDetailByNo = {
  id: number;
  no: string;
  item_name: string;
  tracking_code?: {
    system_id?: string;
    code?: string;
    description?: string;
    require_serial_no?: boolean;
    require_lot_no?: boolean;
    require_expiry_date?: boolean;
  } | null;
};

export const fetchItemByNo = async (
  itemNo: string,
): Promise<ItemDetailByNo | null> => {
  try {
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataItem} = await import('./pageDataMappers');
    const rows = await fetchPageDataAll({
      pageId: PAGE_IDS.ItemList,
      search: itemNo,
      limit: 20,
      filters: {no: itemNo},
      mapRow: mapPageDataItem,
    });
    const row =
      rows.find(r => String(r.no).toLowerCase() === itemNo.toLowerCase()) ||
      rows[0];
    if (!row) {
      return null;
    }
    const id = row.id;
    if (id == null) {
      return null;
    }
    const mappedTracking = (row as any).tracking_code ?? null;
    if (mappedTracking) {
      return {
        id: Number(id),
        no: row.no ?? itemNo,
        item_name: row.item_name ?? '',
        tracking_code: mappedTracking,
      };
    }
    // Page-data often omits nested tracking — enrich from REST like web POS.
    const enriched = await fetchItemTrackingByNo(itemNo);
    return {
      id: Number(id),
      no: row.no ?? itemNo,
      item_name: row.item_name ?? '',
      tracking_code: enriched,
    };
  } catch {
    // Fallback: classic REST still returns tracking_code for purchase specs.
    const enriched = await fetchItemDetailByNoRest(itemNo);
    return enriched;
  }
};

export type ItemCardDetail = {
  no?: string;
  item_name?: string;
  description?: string;
  bar_code_no?: string;
  unit_cost?: number;
  unit_price?: number;
  type?: string;
};

/** Item card / REST detail — list page omits barcode and unit cost. */
export const fetchItemCardDetail = async (item: {
  system_id?: string;
  no?: string;
}): Promise<ItemCardDetail | null> => {
  const {fetchPageDataRecord, PAGE_IDS} = await import('./pageDataService');
  const {mapPageDataItem} = await import('./pageDataMappers');
  const systemId = String(item.system_id || '').trim();

  if (systemId) {
    try {
      const row = await fetchPageDataRecord(PAGE_IDS.ItemCard, systemId);
      return mapPageDataItem(row);
    } catch {
      // Fall through to classic REST.
    }
  }

  const itemNo = String(item.no || '').trim();
  if (!itemNo) {
    return null;
  }
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axios = createAxiosInstance(tenant) || undefined;
    const response = await axios.get('/api/items/', {
      params: {no: itemNo},
    });
    const results = response?.data?.results;
    const row = Array.isArray(results)
      ? results.find(
          (r: {no?: string}) =>
            String(r?.no || '').toLowerCase() === itemNo.toLowerCase(),
        ) || results[0]
      : response?.data;
    if (!row || typeof row !== 'object') {
      return null;
    }
    return mapPageDataItem(row as Record<string, unknown>);
  } catch {
    return null;
  }
};

/** REST item detail — reliable source for tracking_code (web POS parity). */
export async function fetchItemDetailByNoRest(
  itemNo: string,
): Promise<ItemDetailByNo | null> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axios = createAxiosInstance(tenant) || undefined;
    const response = await axios.get('/api/items/', {
      params: {no: itemNo},
    });
    const results = response?.data?.results;
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }
    const row = results[0];
    const id = row.id ?? row.item_id;
    if (id == null) {
      return null;
    }
    let tracking = row.tracking_code ?? null;
    if (Array.isArray(tracking)) {
      tracking = tracking.length > 0 ? tracking[0] : null;
    }
    return {
      id: Number(id),
      no: row.no ?? itemNo,
      item_name: row.item_name ?? '',
      tracking_code: tracking,
    };
  } catch (error) {
    console.warn('fetchItemDetailByNoRest failed:', error);
    return null;
  }
}

/** Only the tracking_code object for a catalog item (null if none / offline). */
export async function fetchItemTrackingByNo(
  itemNo: string,
): Promise<ItemDetailByNo['tracking_code']> {
  const detail = await fetchItemDetailByNoRest(itemNo);
  return detail?.tracking_code ?? null;
}

export type PurchaseTrackingSpecification = {
  id?: number;
  serial_no?: string | null;
  lot_no?: string | null;
  expiry_date?: string | null;
  quantity_base?: number;
  description?: string;
  item?: number;
  purchase_invoice?: number;
  purchase_invoice_line?: number;
};

export type PurchaseTrackingSummary = {
  expected_quantity: number;
  total_quantity: number;
  remaining_quantity: number;
  specifications_count: number;
};

export const getPurchaseLineTrackingSpecifications = async (
  purchaseInvoiceLineId: number,
): Promise<PurchaseTrackingSpecification[]> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const {data} = await axiosInstance.get('/api/tracking-specifications/', {
    params: {purchase_invoice_line: purchaseInvoiceLineId},
  });
  if (Array.isArray(data)) {
    return data;
  }
  if (data?.results && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
};

export const getPurchaseLineTrackingSummary = async (
  lineId: number,
): Promise<PurchaseTrackingSummary | null> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const {data} = await axiosInstance.get(
    `/api/tracking-specifications/summary/${lineId}/`,
    {params: {context_type: 'purchase'}},
  );
  return data ?? null;
};

export const createPurchaseTrackingSpecification = async (
  payload: Record<string, unknown>,
): Promise<PurchaseTrackingSpecification> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const {data} = await axiosInstance.post(
    '/api/tracking-specifications/',
    payload,
  );
  return data;
};

export const updatePurchaseTrackingSpecification = async (
  id: number,
  payload: Record<string, unknown>,
): Promise<PurchaseTrackingSpecification> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const {data} = await axiosInstance.put(
    `/api/tracking-specifications/${id}/`,
    payload,
  );
  return data;
};

export const deletePurchaseTrackingSpecification = async (
  id: number,
): Promise<void> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  await axiosInstance.delete(`/api/tracking-specifications/${id}/`);
};

export type LotCheckResponse = {
  exists?: boolean;
  expiry_date?: string;
  remaining_quantity?: number;
  location?: string;
};

export const checkPurchaseTrackingLot = async (
  lotNo: string,
  itemId: number | string,
): Promise<LotCheckResponse> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const {data} = await axiosInstance.get(
    '/api/tracking-specifications/check_lot/',
    {
      params: {lot_no: lotNo, item: itemId},
    },
  );
  return data ?? {};
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
  serial_no?: string;
  remaining_quantity?: number;
  document_no?: string;
  entry_type?: string;
  document_type?: string;
  expiry_date?: string;
  open?: boolean;
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
    const {fetchPageDataPaginated, PAGE_IDS} = await import(
      './pageDataService'
    );
    const {mapPageDataPurchase} = await import('./pageDataMappers');

    const status = filters?.status;
    // "all" spans open + posted tables — keep classic REST for that case.
    if (!status || status === 'all') {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant) || undefined;
      const params: any = {};
      if (filters?.startDate) params.document_date__gte = filters.startDate;
      if (filters?.endDate) params.document_date__lte = filters.endDate;
      if (filters?.vendor) params.vendor = filters.vendor;
      if (filters?.page) params.page = filters.page;
      if (filters?.pageSize) params.page_size = filters.pageSize;
      if (filters?.search) params.search = filters.search;
      const response = await axiosInstance.get('/api/purchases/', {params});
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return {
          results: response.data.results,
          count: response.data.count || 0,
        };
      }
      if (Array.isArray(response.data)) {
        return {results: response.data, count: response.data.length};
      }
      return {results: [], count: 0};
    }

    const pageId =
      status === 'Posted'
        ? PAGE_IDS.PostedPurchaseInvoiceList
        : PAGE_IDS.PurchaseInvoiceList;
    const pageFilters: Record<string, string | number> = {};
    if (filters?.startDate) {
      pageFilters.posting_date_from = filters.startDate;
    }
    if (filters?.endDate) {
      pageFilters.posting_date_to = filters.endDate;
    }
    if (filters?.vendor) {
      pageFilters.vendor = filters.vendor;
    }
    const data = await fetchPageDataPaginated({
      pageId,
      page: filters?.page ?? 1,
      pageSize: filters?.pageSize ?? 50,
      search: filters?.search,
      filters: pageFilters,
      mapRow: mapPageDataPurchase,
    });
    return {results: data.results, count: data.count};
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
  global_dimension_1?: number;
}): Promise<any> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const payload = {...purchaseData};
    if (payload.global_dimension_1 == null) {
      const branchId = await resolveEffectiveBranchDimensionId();
      if (branchId != null) {
        payload.global_dimension_1 = branchId;
      }
    }

    const response = await axiosInstance.post('/api/purchases/upsert/', payload);
    return response.data;
  } catch (error: any) {
    console.error('upsertPurchase: Error upserting purchase:', error);
    throw error;
  }
};

/** PUR-YYYYMMDD-######. With invoice_no, backend also saves on that purchase; without, preview only (form / before create). */
export const generatePurchaseVendorInvoiceNo = async (payload: {
  system_id?: string;
  invoice_no?: string;
}): Promise<{ vendor_invoice_no: string }> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const body: Record<string, string> = {
    system_id: payload.system_id ?? '',
  };
  const inv = payload.invoice_no?.trim();
  if (inv) {
    body.invoice_no = inv;
  }
  const response = await axiosInstance.post(
    '/api/purchases/generate-invoice-no/',
    body,
  );
  return response.data;
};

/** Same resource as web `POST/GET /api/document-attachments/`. */
export type DocumentAttachmentDto = {
  id: number;
  system_id: string;
  content_type?: number;
  object_id?: number;
  entity?: string;
  /** Set when entity is a purchase invoice (mirrors web payloads). */
  purchase_invoice?: number | null;
  file_url: string | null;
  original_name: string;
  created_at: string;
};

export type PurchaseInvoiceAttachmentDto = DocumentAttachmentDto;

function normalizeDrfList<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (
    data &&
    typeof data === 'object' &&
    'results' in data &&
    Array.isArray((data as {results: unknown}).results)
  ) {
    return (data as {results: T[]}).results;
  }
  return [];
}

const PURCHASE_INVOICE_ENTITY = 'purchases.purchaseinvoice';

export const fetchDocumentAttachments = async (params: {
  object_id: number | string;
  entity?: string;
}): Promise<DocumentAttachmentDto[]> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const response = await axiosInstance.get('/api/document-attachments/', {
    params: {
      object_id: params.object_id,
      entity: params.entity ?? PURCHASE_INVOICE_ENTITY,
    },
  });
  return normalizeDrfList<DocumentAttachmentDto>(response.data);
};

export const fetchPurchaseAttachments = async (
  purchaseInvoiceId: number | string,
): Promise<PurchaseInvoiceAttachmentDto[]> => {
  return fetchDocumentAttachments({
    object_id: purchaseInvoiceId,
    entity: PURCHASE_INVOICE_ENTITY,
  });
};

export const uploadPurchaseAttachment = async (
  purchaseInvoiceId: number | string,
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<PurchaseInvoiceAttachmentDto> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const formData = new FormData();
  formData.append('entity', PURCHASE_INVOICE_ENTITY);
  formData.append('purchase_invoice', String(purchaseInvoiceId));
  formData.append('file', {
    uri: fileUri,
    type: mimeType || 'application/octet-stream',
    name: fileName || 'attachment',
  } as any);
  const response = await axiosInstance.post(
    '/api/document-attachments/',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data as PurchaseInvoiceAttachmentDto;
};

export const deletePurchaseAttachment = async (
  attachmentId: number | string,
): Promise<void> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  await axiosInstance.delete(`/api/document-attachments/${attachmentId}/`);
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
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataVendor} = await import('./pageDataMappers');
    return await fetchPageDataAll({
      pageId: PAGE_IDS.VendorList,
      search,
      limit: 200,
      mapRow: mapPageDataVendor,
    });
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
  /** When set, GET /api/sales/?user=… filters to that ledger user (Sales History own-sales mode). */
  user?: number;
};

function buildSalesHistoryQueryParams(
  filters?: SalesHistoryListFilters,
  options?: {omitPagination?: boolean},
) {
  const params: Record<string, string | number> = {};

  // Unposted is client-side (Open + Draft); never send that status to the API.
  if (filters?.status && filters.status !== 'Unposted') {
    params.status = filters.status;
  }
  if (filters?.startDate) {
    // Legacy (document_date) + V2 Posted Sales History (posting_date).
    params.date_range_after = filters.startDate;
    params.posting_date__gte = filters.startDate;
  }
  if (filters?.endDate) {
    params.date_range_before = filters.endDate;
    params.posting_date__lte = filters.endDate;
  }
  // Single-day shortcut used by webV2 summary when from === to.
  if (
    filters?.startDate &&
    filters?.endDate &&
    filters.startDate === filters.endDate
  ) {
    params.posting_date = filters.startDate;
  }
  if (filters?.paymentMethod) {
    params.payment_method = filters.paymentMethod;
  }
  if (filters?.search) {
    params.search = filters.search;
  }
  if (filters?.user != null && Number.isFinite(filters.user)) {
    params.user = filters.user;
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

/** Fields used from GET /api/user-setup/my-setup/ (UserSetupSerializer). */
export type MyUserSetupLite = {
  canViewOnlyTheirSales?: boolean;
  canReverseSalesInvoice?: boolean;
  canEditSalesPrice?: boolean;
  defaultSalesUi?: 'phone' | 'pos';
};

/**
 * Current user's setup (web parity: UserSetupService.getMySetup).
 * Returns null on error; callers should default restrict-to-own-sales to true.
 */
export const fetchMyUserSetup = async (): Promise<MyUserSetupLite | null> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/user-setup/my-setup/');
    const d = response.data;
    if (!d || typeof d !== 'object') {
      return null;
    }
    const own = d.canViewOnlyTheirSales;
    const reverse = d.canReverseSalesInvoice;
    const editPrice = d.canEditSalesPrice ?? d.can_edit_sales_price;
    const salesUi = d.defaultSalesUi ?? d.default_sales_ui;
    return {
      canViewOnlyTheirSales:
        typeof own === 'boolean' ? own : undefined,
      canReverseSalesInvoice:
        typeof reverse === 'boolean' ? reverse : undefined,
      canEditSalesPrice:
        typeof editPrice === 'boolean' ? editPrice : undefined,
      defaultSalesUi:
        typeof salesUi === 'string' ? normalizeSalesUiMode(salesUi) : undefined,
    };
  } catch (e) {
    if (!isSubscriptionExpiredError(e)) {
      console.warn('fetchMyUserSetup: unavailable', e);
    }
    return null;
  }
};

export type SalesSetupPriceFlags = {
  disablePriceEditing: boolean;
  preventPriceBelowOriginal: boolean;
};

/**
 * Company Sales Setup flags that gate POS price edits.
 * Uses /api/sales/setup/ when online; falls back to the local bootstrap cache.
 */
export const fetchSalesSetupPriceFlags =
  async (): Promise<SalesSetupPriceFlags> => {
    const fallback: SalesSetupPriceFlags = {
      disablePriceEditing: false,
      preventPriceBelowOriginal: false,
    };
    const {salesPriceEditFlagsFromSetup} = await import(
      '../utils/salesPriceEdit'
    );
    const toFlags = (raw: unknown): SalesSetupPriceFlags => {
      const flags = salesPriceEditFlagsFromSetup(raw);
      return {
        disablePriceEditing: flags.disablePriceEditing,
        preventPriceBelowOriginal: flags.preventBelowOriginal,
      };
    };
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const api = createAxiosInstance(tenant);
      const response = await api.get('/api/sales/setup/');
      return toFlags(response.data);
    } catch {
      /* use local cache when offline */
    }
    try {
      const {getCachedSalesSetup} = await import('../db/sqlite');
      const cached = await getCachedSalesSetup();
      if (cached) {
        return toFlags(cached);
      }
    } catch {
      /* ignore */
    }
    return fallback;
  };

export type SalesHistorySummary = {
  total_sales: number;
  /** WebV2 POS prefers net_sales when present. */
  net_sales: number;
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
 * GET /api/sales/summary/ — same as web SalesServices.getSalesSummary / webV2 salesService.getSalesSummary.
 * Posted sales archive only (not Open invoices).
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
    const totalSales = Number(d.total_sales ?? 0);
    const netSales = Number(d.net_sales ?? totalSales);
    return {
      total_sales: totalSales,
      net_sales: netSales,
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
/** Calendar YYYY-MM-DD in local timezone. */
export function getLocalDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Posted sales totals for one user today.
 * WebV2 POS: GET /api/sales/summary/?posting_date=today&user=<id>
 */
export const fetchTodayMySalesForUser = async (
  userId: number,
): Promise<SalesUserSummaryRow | null> => {
  if (!Number.isFinite(userId)) {
    return null;
  }
  const today = getLocalDateYmd();
  const summary = await fetchSalesSummary({
    startDate: today,
    endDate: today,
    user: userId,
  });
  if (!summary) {
    return null;
  }
  return {
    user_id: userId,
    user_name: '',
    total_sales: summary.net_sales ?? summary.total_sales,
    total_products: summary.total_products,
    total_invoices: summary.total_invoices,
  };
};

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

function normalizeSalesListResponse(data: any) {
  if (data?.results && Array.isArray(data.results)) {
    return {
      results: data.results,
      count: data.count || data.results.length,
      next: data.next ?? null,
      previous: data.previous ?? null,
    };
  }
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      next: null,
      previous: null,
    };
  }
  return {results: [], count: 0, next: null, previous: null};
}

const EMPTY_SALES_PAGE = {
  results: [] as any[],
  count: 0,
  next: null as string | null,
  previous: null as string | null,
};

/** DRF returns 404 {"detail":"Invalid page."} past the last page. */
function isInvalidPageError(error: unknown): boolean {
  if (error === 'Invalid page.') {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as {
    message?: string;
    response?: {status?: number; data?: {detail?: string; error?: string}};
  };
  if (err.message === 'Invalid page.') {
    return true;
  }
  const data = err.response?.data;
  return data?.detail === 'Invalid page.' || data?.error === 'Invalid page.';
}

async function getSalesListPageOrEmpty(
  axiosInstance: ReturnType<typeof createAxiosInstance>,
  params: Record<string, string | number>,
  requestConfig?: AxiosRequestConfig,
) {
  try {
    return await axiosInstance.get('/api/sales/', {
      params,
      ...(requestConfig ?? {}),
    });
  } catch (error) {
    // One of Open/Draft often exhausts before the other when merged.
    if (isInvalidPageError(error)) {
      return {data: EMPTY_SALES_PAGE};
    }
    throw error;
  }
}

/** Open + Draft in one list (no ?user= — no CLE ownership yet). */
async function fetchUnpostedSalesPage(
  filters?: SalesHistoryListFilters,
  requestConfig?: AxiosRequestConfig,
) {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const half = Math.max(5, Math.ceil(pageSize / 2));
  const base = {
    ...buildSalesHistoryQueryParams(
      {...filters, status: undefined, user: undefined},
      {omitPagination: true},
    ),
    page,
    page_size: half,
    ordering: '-created_at',
  };

  const [openRes, draftRes] = await Promise.all([
    getSalesListPageOrEmpty(
      axiosInstance,
      {...base, status: 'Open'},
      requestConfig,
    ),
    getSalesListPageOrEmpty(
      axiosInstance,
      {...base, status: 'Draft'},
      requestConfig,
    ),
  ]);

  const open = normalizeSalesListResponse(openRes?.data);
  const draft = normalizeSalesListResponse(draftRes?.data);
  const results = [...open.results, ...draft.results].sort((a: any, b: any) => {
    const ta = new Date(a?.created_at || a?.document_date || 0).getTime();
    const tb = new Date(b?.created_at || b?.document_date || 0).getTime();
    return tb - ta;
  });

  return {
    results,
    count: (open.count || 0) + (draft.count || 0),
    next: open.next || draft.next || null,
    previous: open.previous || draft.previous || null,
  };
}

// New function to fetch sales data
// Matches the web frontend implementation in SalesHistory.tsx
export const fetchSalesData = async (
  filters?: SalesHistoryListFilters,
  requestConfig?: AxiosRequestConfig,
) => {
  try {
    if (filters?.status === 'Unposted') {
      return await fetchUnpostedSalesPage(filters, requestConfig);
    }

    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const params = buildSalesHistoryQueryParams(filters);

    console.log('fetchSalesData: Making API call with params:', params);
    const response = await axiosInstance.get('/api/sales/', {
      params,
      ...(requestConfig ?? {}),
    });
    console.log('fetchSalesData: API response:', {
      status: response.status,
      hasData: !!response.data,
      hasResults: !!response.data?.results,
      isArray: Array.isArray(response.data?.results),
      isDirectArray: Array.isArray(response.data),
      dataLength: response.data?.results?.length || response.data?.length || 0,
      count: response.data?.count,
    });

    const normalized = normalizeSalesListResponse(response?.data);
    console.log(
      'fetchSalesData: Returning list response, count:',
      normalized.count,
    );
    return normalized;
  } catch (error: any) {
    // Interceptor may reject bare `detail` strings (e.g. "Invalid page.").
    const detail =
      typeof error === 'string'
        ? error
        : error?.customMessage ||
          error?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error;
    console.error('fetchSalesData: Error fetching sales data:', {
      detail,
      message: typeof error === 'string' ? error : error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      raw: typeof error === 'string' ? error : undefined,
    });
    throw error;
  }
};

/**
 * Branch helpers (web parity):
 * - null => "All branches" (X-Branch-Scope: all, plus branch=all param when supported)
 * - number => specific branch id (X-Branch-Id)
 * - undefined => not initialised; omit overrides so global X-Branch-Id applies
 */
const branchParam = (b: number | null | undefined): string | number | undefined => {
  if (b === null) return 'all';
  return b ?? undefined;
};

const branchRequestConfig = (
  b: number | null | undefined,
): AxiosRequestConfig | undefined => {
  if (b === null) return {headers: {'X-Branch-Scope': 'all'}};
  if (typeof b === 'number') return {headers: {'X-Branch-Id': String(b)}};
  return undefined;
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

/** Pull a readable message from DRF / Axios error payloads. */
export const getSalesApiErrorMessage = (
  error: any,
  fallback = 'Request failed',
): string => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }
  if (data && typeof data === 'object') {
    const detail = data.detail;
    const err = data.error;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
    if (typeof err === 'string' && err.trim()) {
      return err.trim();
    }
    if (Array.isArray(detail) && detail.length) {
      return detail.map(String).join(' ');
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === 'detail' || key === 'error' || key === 'message') {
        continue;
      }
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (Array.isArray(value) && value.length) {
        return String(value[0]);
      }
    }
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
};

export const isAlreadyPostedSalesError = (error: any): boolean => {
  const msg = getSalesApiErrorMessage(error, '').toLowerCase();
  return msg.includes('already posted');
};

export const postSalesInvoice = async (salesId: number) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Use post_invoice (proper status checks + processor errors), not post_sale
    // admin alias which historically returned 200 even when posting failed.
    const endpoint = `/api/sales/${salesId}/post_invoice/`;

    console.log(`DEBUG: Posting sales invoice at: ${endpoint}`);
    const response = await axiosInstance.post(endpoint);
    console.log(`DEBUG: Successfully posted at: ${endpoint}`);
    return response;
  } catch (error) {
    console.error('DEBUG: Error posting sales invoice:', error);
    throw error;
  }
};

/**
 * Create a sales invoice only. Callers that need posting must call
 * postSalesInvoice and handle failures (do not swallow post errors here).
 */
export const createSalesInvoice = async (
  salesInvoiceData: SalesInvoiceData,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    console.log('DEBUG: Sending sales invoice data:', salesInvoiceData);
    const response = await axiosInstance.post('/api/sales/', salesInvoiceData);
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
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching draft sales:', error);
      throw error;
    }
    return [];
  }
};

/**
 * Unposted sales (Open + Draft) in one list.
 * Do not send ?user= — these invoices have no customer ledger ownership yet.
 */
export const fetchUnpostedSales = async (pageSize: number = 20) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const half = Math.max(5, Math.ceil(pageSize / 2));

    const [openRes, draftRes] = await Promise.all([
      axiosInstance.get('/api/sales/', {
        params: {
          status: 'Open',
          page: 1,
          page_size: half,
          ordering: '-created_at',
        },
      }),
      axiosInstance.get('/api/sales/', {
        params: {
          status: 'Draft',
          page: 1,
          page_size: half,
          ordering: '-created_at',
        },
      }),
    ]);

    const open = Array.isArray(openRes?.data?.results)
      ? openRes.data.results
      : [];
    const drafts = Array.isArray(draftRes?.data?.results)
      ? draftRes.data.results
      : [];

    return [...open, ...drafts]
      .sort((a: any, b: any) => {
        const ta = new Date(a?.created_at || a?.document_date || 0).getTime();
        const tb = new Date(b?.created_at || b?.document_date || 0).getTime();
        return tb - ta;
      })
      .slice(0, pageSize);
  } catch (error: any) {
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching unposted sales:', error);
    }
    return [];
  }
};

/** @deprecated Use fetchUnpostedSales */
export const fetchOpenSales = async (pageSize: number = 10) => {
  const rows = await fetchUnpostedSales(pageSize);
  return rows.filter((r: any) => r?.status === 'Open');
};

/**
 * Get a single sales invoice by ID.
 * Sales History page-data rows use PostedSalesInvoice.id; when that fails,
 * resolve the live SalesInvoice via invoice_no (posted archive `no`).
 */
export const getSalesInvoice = async (
  invoiceId: number | string,
  options?: {invoiceNo?: string},
) => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;

  const fetchById = async (id: number | string) => {
    const response = await axiosInstance.get(`/api/sales/${id}/`);
    return response.data;
  };

  try {
    return await fetchById(invoiceId);
  } catch (error: any) {
    const status = error?.response?.status ?? error?.status;
    const invoiceNo = options?.invoiceNo?.trim();
    if (!invoiceNo || (status !== 400 && status !== 404)) {
      console.error('Error fetching sales invoice:', error);
      throw error;
    }

    try {
      const listRes = await axiosInstance.get('/api/sales/', {
        params: {
          search: invoiceNo,
          status: 'Posted',
          page_size: 50,
        },
      });
      const rows = normalizeSalesListResponse(listRes?.data).results || [];
      const match = rows.find(
        (row: any) =>
          row?.invoice_no === invoiceNo ||
          row?.customer_invoice_no === invoiceNo,
      );
      if (match?.id != null) {
        return await fetchById(match.id);
      }
    } catch (fallbackError) {
      console.error(
        'Error resolving sales invoice by invoice_no:',
        fallbackError,
      );
    }

    console.error('Error fetching sales invoice:', error);
    throw error;
  }
};

export type ReverseSalesInvoiceResult = {
  message: string;
  sales_invoice_no: string;
  credit_memo_no: string;
  credit_memo_id: number;
  status: string;
  transaction_no: string;
};

/** Reverse a posted sales invoice (web parity: SalesServices.reverseSales). */
export const reverseSalesInvoice = async (
  salesId: number,
  reason?: string,
): Promise<ReverseSalesInvoiceResult> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const response = await axiosInstance.post(
    `/api/sales/${salesId}/reverse_sales/`,
    reason ? {reason} : {},
  );
  return response.data;
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

// items list api
export type ItemListFilters = {
  lowStock?: boolean;
  inventoryStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';
};

export {isInvalidPageError};

/** Classic REST item list — includes barcode and unit cost (ItemList page may omit them). */
export const fetchItemsFromRest = async (
  page: number = 1,
  searchQuery: string = '',
  categoryId?: number | string | null,
  extraParams?: Record<string, string | number>,
) => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const params: Record<string, string | number> = {
    page,
    page_size: 20,
    q: searchQuery.trim(),
    ...extraParams,
  };
  if (categoryId != null && categoryId !== '') {
    params.category_id = String(categoryId);
  }
  const response = await axiosInstance.get('/api/items/', {params});
  return response.data;
};

export const fetchItems = async (
  page: number = 1,
  searchQuery: string = '',
  categoryId?: number | string,
  filters?: ItemListFilters,
) => {
  try {
    // Stock filters are classic-API specific.
    if (filters?.lowStock || filters?.inventoryStatus) {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant) || undefined;
      const params: any = {
        page,
        page_size: 20,
        q: searchQuery.trim(),
      };
      if (categoryId) {
        params.category_id = categoryId;
      }
      if (filters?.lowStock) {
        params.low_stock = true;
      }
      if (filters?.inventoryStatus) {
        params.inventory_status = filters.inventoryStatus;
      }
      const response = await axiosInstance.get(`/api/items/`, {params});
      return response.data;
    }

    const {fetchPageDataPaginated, PAGE_IDS} = await import(
      './pageDataService'
    );
    const {mapPageDataItem} = await import('./pageDataMappers');
    const pageFilters: Record<string, string | number> = {};
    if (categoryId != null && categoryId !== '') {
      // ItemCategory relation filter — code or id depending on tenant data.
      pageFilters.item_category = String(categoryId);
    }
    return await fetchPageDataPaginated({
      pageId: PAGE_IDS.ItemList,
      page,
      pageSize: 20,
      search: searchQuery,
      filters: pageFilters,
      mapRow: mapPageDataItem,
    });
  } catch (error) {
    if (!isInvalidPageError(error)) {
      console.error('Error fetching items:', error);
    }
    throw error;
  }
};

/** Classic REST category list — works when ItemCategoryList (10216) is not seeded. */
async function fetchCategoriesFromRest(params?: {
  search?: string;
  parent_id?: string;
}): Promise<ItemCategory[]> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const query: Record<string, string> = {};
  if (params?.search) {
    query.search = params.search;
  }
  if (params?.parent_id) {
    query.parent_id = params.parent_id;
  }
  const response = await axiosInstance.get('/api/categories/', {params: query});
  const rows = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.results)
      ? response.data.results
      : [];
  return rows as ItemCategory[];
}

// Add this new API call for categories
export const fetchCategories = async () => {
  try {
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataCategory} = await import('./pageDataMappers');
    return await fetchPageDataAll({
      pageId: PAGE_IDS.ItemCategoryList,
      mapRow: mapPageDataCategory,
    });
  } catch (error) {
    try {
      return await fetchCategoriesFromRest();
    } catch (restError) {
      console.error('Error fetching categories:', restError);
      throw error;
    }
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
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataCategory} = await import('./pageDataMappers');
    const filters: Record<string, string> = {};
    if (params?.parent_id) {
      filters.parent = params.parent_id;
    }
    const rows = await fetchPageDataAll({
      pageId: PAGE_IDS.ItemCategoryList,
      search: params?.search,
      limit: params?.pageSize ?? 500,
      filters,
      mapRow: mapPageDataCategory,
    });
    return rows as ItemCategory[];
  } catch (error) {
    try {
      return await fetchCategoriesFromRest({
        search: params?.search,
        parent_id: params?.parent_id,
      });
    } catch (restError) {
      console.error('Error fetching item categories:', restError);
      throw error;
    }
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
    const response = await axiosInstance.patch(`/api/categories/${code}/`, data);
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

export const fetchDailyProfitReport = async (
  date?: string,
  branch?: number | null,
  requestConfig?: AxiosRequestConfig,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/reports/daily-profit/', {
      params: {
        date,
        branch: branchParam(branch),
      },
      ...(requestConfig ?? branchRequestConfig(branch) ?? {}),
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
  branch?: number | null;
  requestConfig?: AxiosRequestConfig;
}) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/reports/weekly-summary/', {
      params: {
        start_date: params?.startDate,
        end_date: params?.endDate,
        branch: branchParam(params?.branch),
      },
      ...(params?.requestConfig ?? branchRequestConfig(params?.branch) ?? {}),
    });
    return response?.data;
  } catch (error) {
    console.error('Error fetching weekly summary report:', error);
    throw error;
  }
};

export const fetchMonthlySummaryReport = async (
  month?: string,
  branch?: number | null,
  requestConfig?: AxiosRequestConfig,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/reports/monthly-summary/', {
      params: {
        month,
        branch: branchParam(branch),
      },
      ...(requestConfig ?? branchRequestConfig(branch) ?? {}),
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
  branch?: number | null;
  requestConfig?: AxiosRequestConfig;
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
          branch: branchParam(params?.branch),
        },
        ...(params?.requestConfig ?? branchRequestConfig(params?.branch) ?? {}),
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
  branch?: number | null;
  requestConfig?: AxiosRequestConfig;
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
          branch: branchParam(params?.branch),
        },
        ...(params?.requestConfig ?? branchRequestConfig(params?.branch) ?? {}),
      },
    );
    return response?.data;
  } catch (error) {
    console.error('Error fetching expense breakdown report:', error);
    throw error;
  }
};

/**
 * Analytics reports — POST `/api/reports/export-pdf/` when implemented on the backend.
 */
export const exportReportPdfFromApi = async (
  reportType: string,
  filters: Record<string, unknown>,
): Promise<ArrayBuffer> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const response = await axiosInstance.post(
    '/api/reports/export-pdf/',
    {report_type: reportType, filters},
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/pdf, application/json, application/octet-stream, */*',
      },
    },
  );
  return response.data as ArrayBuffer;
};

const financialPdfRequestConfig = (
  branch?: number | null,
  requestConfig?: AxiosRequestConfig,
): AxiosRequestConfig => ({
  responseType: 'arraybuffer',
  headers: {
    Accept: 'application/pdf, application/octet-stream, */*',
  },
  ...(requestConfig ?? branchRequestConfig(branch) ?? {}),
});

/** Seeded Profit & Loss financial report (webV2 `INCOME`). */
export const PROFIT_LOSS_REPORT_NAME = 'INCOME';

export type FinancialReportColumn = {
  key: string;
  line_no: number;
  header: string;
  column_type?: string;
  column_no?: string;
  comparison_period_formula?: string;
};

export type FinancialReportRow = {
  line_no: number;
  row_no: string;
  description: string;
  row_type?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  indentation?: number;
  amounts: Record<string, number | null>;
  visible?: boolean;
};

export type FinancialReportData = {
  report_name: string;
  description?: string;
  period_type?: string;
  period_label?: string;
  start_date?: string;
  end_date?: string;
  currency_code?: string;
  branch_code?: string;
  branch_name?: string;
  include_comparisons?: boolean;
  columns: FinancialReportColumn[];
  rows: FinancialReportRow[];
};

type PageActionResponse = {
  Successful?: boolean;
  Command?: string;
  Content?: Record<string, unknown>;
  Message?: string;
  error?: string;
};

const extractPageActionError = (payload: any, fallback: string): string => {
  if (!payload) {
    return fallback;
  }
  if (typeof payload === 'string') {
    return payload;
  }
  const msg =
    payload.error ||
    payload.detail ||
    payload.Message ||
    payload.message ||
    payload.Content?.Message;
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }
  return fallback;
};

/** WebV2 parity: POST `/api/pages/action/` → recalculate_financial_report (BatchName INCOME). */
export const fetchProfitLossStatement = async (params?: {
  startDate?: string;
  endDate?: string;
  branch?: number | null;
  includeComparisons?: boolean;
  reportName?: string;
  requestConfig?: AxiosRequestConfig;
}): Promise<FinancialReportData> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const sd = params?.startDate?.trim();
  const ed = params?.endDate?.trim();
  if (!sd || !ed) {
    throw new Error('Profit & loss requires start and end dates.');
  }

  const {PAGE_IDS, resolveTenantPageId} = await import('./pageDataService');
  const response = await axiosInstance.post<PageActionResponse>(
    '/api/pages/action/',
    {
      PageId: await resolveTenantPageId(PAGE_IDS.FinancialReportOverview),
      ActionId: 'recalculate_financial_report',
      BatchName: params?.reportName || PROFIT_LOSS_REPORT_NAME,
      StartDate: sd,
      EndDate: ed,
      IncludeComparisons: params?.includeComparisons ?? false,
    },
    params?.requestConfig ?? branchRequestConfig(params?.branch) ?? {},
  );

  const payload = response?.data;
  const report = payload?.Content?.FinancialReport as FinancialReportData | undefined;
  if (
    !report ||
    !Array.isArray(report.columns) ||
    !Array.isArray(report.rows)
  ) {
    throw new Error(
      extractPageActionError(payload, 'Profit & Loss report returned no data.'),
    );
  }
  return report;
};

/** WebV2 parity: POST `/api/pages/action/` → print_financial_report PDF (BatchName INCOME). */
export const downloadProfitLossPdf = async (params: {
  startDate: string;
  endDate: string;
  branch?: number | null;
  includeComparisons?: boolean;
  reportName?: string;
  requestConfig?: AxiosRequestConfig;
}): Promise<{fileName: string; base64: string; mimeType: string}> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const sd = params.startDate.trim();
  const ed = params.endDate.trim();
  if (!sd || !ed) {
    throw new Error('Start and end dates are required.');
  }

  const {PAGE_IDS, resolveTenantPageId} = await import('./pageDataService');
  const response = await axiosInstance.post<PageActionResponse>(
    '/api/pages/action/',
    {
      PageId: await resolveTenantPageId(PAGE_IDS.FinancialReportOverview),
      ActionId: 'print_financial_report',
      BatchName: params.reportName || PROFIT_LOSS_REPORT_NAME,
      StartDate: sd,
      EndDate: ed,
      Format: 'pdf',
      IncludeComparisons: params.includeComparisons ?? false,
    },
    params.requestConfig ?? branchRequestConfig(params.branch) ?? {},
  );

  const payload = response?.data;
  const content = payload?.Content as
    | {FileName?: string; FileBase64?: string; MimeType?: string}
    | undefined;
  if (
    payload?.Command !== 'DOWNLOAD' ||
    !content?.FileBase64 ||
    !content?.FileName
  ) {
    throw new Error(
      extractPageActionError(payload, 'Server did not return a PDF.'),
    );
  }
  return {
    fileName: content.FileName,
    base64: content.FileBase64,
    mimeType: content.MimeType || 'application/pdf',
  };
};

/** Web parity: GET `/api/financials/gl-accounts/balance-sheet/export/` */
export const downloadBalanceSheetPdf = async (params: {
  asOfDate: string;
  branch?: number | null;
  requestConfig?: AxiosRequestConfig;
}): Promise<ArrayBuffer> => {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const axiosInstance = createAxiosInstance(tenant) || undefined;
  const asOf = params.asOfDate.trim();
  if (!asOf) {
    throw new Error('As-of date is required.');
  }
  const query: Record<string, string> = {as_of_date: asOf};
  if (typeof branchParam(params.branch) === 'number') {
    query.global_dimension_1_id = String(branchParam(params.branch));
  }
  const response = await axiosInstance.get(
    '/api/financials/gl-accounts/balance-sheet/export/',
    {
      params: query,
      ...financialPdfRequestConfig(params.branch, params.requestConfig),
    },
  );
  return response.data as ArrayBuffer;
};

export const fetchBalanceSheetReport = async (
  asOfDate?: string,
  branch?: number | null,
  requestConfig?: AxiosRequestConfig,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const query: Record<string, string> = {};
    const d = asOfDate?.trim();
    if (d) {
      query.as_of_date = d;
    }
    const bp = branchParam(branch);
    if (typeof bp === 'number') {
      query.global_dimension_1_id = String(bp);
    } else if (bp === 'all') {
      query.branch = 'all';
    }
    const response = await axiosInstance.get(
      '/api/financials/gl-accounts/balance-sheet/',
      {params: query, ...(requestConfig ?? branchRequestConfig(branch) ?? {})},
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

export const deleteItem = async (item: Pick<Item, 'system_id' | 'no' | 'id'>) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    const response = await axiosInstance.post(`/api/items/upsert/`, {
      system_id: item.system_id || item.no,
      no: item.no,
      item_id: item.id,
      deleted: true,
    });
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

/** Build multipart file fields from a local image URI (shared by item + company logo uploads). */
function imageFormFieldsFromUri(imageUri: string): {
  fileName: string;
  fileType: string;
} {
  let fileName = 'image.jpg';
  let fileType = 'jpeg';

  if (imageUri.startsWith('content://')) {
    fileName = `image_${Date.now()}.jpg`;
    fileType = 'jpeg';
  } else if (imageUri.startsWith('file://')) {
    const pathParts = imageUri.split('/');
    fileName = pathParts.pop() || 'image.jpg';
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'png') {
      fileType = 'png';
    } else if (extension === 'gif') {
      fileType = 'gif';
    } else if (extension === 'webp') {
      fileType = 'webp';
    } else {
      fileType = 'jpeg';
      if (!fileName.includes('.')) {
        fileName = `${fileName}.jpg`;
      }
    }
  }

  return {fileName, fileType};
}

function throwImageUploadError(error: any): never {
  if (error.response?.status === 413) {
    throw new Error(
      'Image file is too large. Please select a smaller image.',
    );
  }
  if (error.response?.status === 415) {
    throw new Error(
      'Unsupported image format. Please select a JPG, PNG, or GIF image.',
    );
  }
  if (error.response?.status === 401) {
    throw new Error('Authentication failed. Please log in again.');
  }
  throw error;
}

/** Upload company logo — POST /api/company/upload-logo/ (field: logo). */
export const uploadCompanyLogo = async (imageUri: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const formData = new FormData();
    const {fileName, fileType} = imageFormFieldsFromUri(imageUri);

    formData.append('logo', {
      uri: imageUri,
      type: `image/${fileType}`,
      name: fileName,
    } as any);

    return await axiosInstance.post('/api/company/upload-logo/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } catch (error: any) {
    console.error('Error uploading company logo:', error);
    throwImageUploadError(error);
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

export type PostItemJournalLinesResult = {
  message?: string;
  error?: string;
  invalid_journals?: Array<{document_no?: string; errors?: string[]}>;
};

/** Post open item journal lines (backend: POST /api/item-journal/post, body `{ ids }`). */
export const postItemJournalLines = async (
  ids: number[],
): Promise<PostItemJournalLinesResult> => {
  const api = await getAxiosInstance();
  const response = await api.post<PostItemJournalLinesResult>(
    '/api/item-journal/post',
    {ids},
  );
  return response.data;
};

/** Shape of `company` from GET /api/sales/company-info/ (see web zentro-backend sales/views get_company_info). */
export type TenantCompanyApi = {
  name: string;
  displayName?: string;
  logo: string | null;
  address: string;
  phone: string;
  email: string;
  website?: string;
  city?: string | null;
  country?: string | null;
  tin: string;
};

export type UpdateCompanyInfoPayload = {
  displayName?: string;
  phone?: string;
  email?: string;
  website?: string;
  tin?: string;
  address?: string;
  city?: string;
  country?: string;
  localCurrencyCode?: string;
};

export type CurrencyCatalogEntry = {
  code: string;
  name: string;
  minor_units: number;
};

export const getCurrencies = async (): Promise<CurrencyCatalogEntry[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get<{results: CurrencyCatalogEntry[]}>(
      '/api/financials/currencies/',
    );
    return response.data?.results ?? [];
  } catch (error: any) {
    console.error('Error fetching currencies:', error);
    throw error;
  }
};

export type CompanyInfoApiResponse = {
  company: TenantCompanyApi;
};

// Get company information
export const getCompanyInfo = async (): Promise<
  AxiosResponse<CompanyInfoApiResponse>
> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get<CompanyInfoApiResponse>(
      '/api/sales/company-info/',
    );
    return response;
  } catch (error: any) {
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching company info:', error);
    }
    throw error;
  }
};

/** Update company contact fields — PUT /api/company/update-info/ */
export const updateCompanyInfo = async (
  payload: UpdateCompanyInfoPayload,
): Promise<AxiosResponse<{company: TenantCompanyApi; message?: string}>> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    return await axiosInstance.put('/api/company/update-info/', payload);
  } catch (error: any) {
    console.error('Error updating company info:', error);
    throw error;
  }
};

export type FetchItemJournalParams = {
  page?: number;
  q?: string;
  /** e.g. Open, Posted */
  status?: string;
  entry_type?: string;
  adjustment_type?: 'operational' | 'opening_balance';
};

export interface ItemJournalListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: unknown[];
}

export const fetchItemJournal = async (
  page: number = 1,
  searchQuery: string = '',
  extra?: Omit<FetchItemJournalParams, 'page' | 'q'>,
): Promise<ItemJournalListResponse> => {
  const {fetchPageDataPaginated, PAGE_IDS} = await import('./pageDataService');
  const {mapPageDataItemJournal} = await import('./pageDataMappers');

  let pageId = PAGE_IDS.InventoryAdjustmentJournalList;
  if (extra?.adjustment_type === 'opening_balance') {
    pageId = PAGE_IDS.OpeningBalanceJournalList;
  } else if (extra?.entry_type === 'stock_taking' || (extra as any)?.stock_taking) {
    pageId =
      extra?.status === 'Posted'
        ? PAGE_IDS.PostedStockTakingList
        : PAGE_IDS.StockTakingJournalList;
  } else if (extra?.status === 'Posted') {
    pageId = PAGE_IDS.PostedInventoryAdjustmentList;
  }

  const filters: Record<string, string> = {};
  if (extra?.entry_type && extra.entry_type !== 'stock_taking') {
    filters.entry_type = extra.entry_type;
  }
  if (extra?.status) {
    filters.status = extra.status;
  }
  if (extra?.adjustment_type) {
    filters.adjustment_type = extra.adjustment_type;
  }

  return fetchPageDataPaginated({
    pageId,
    page,
    pageSize: 50,
    search: searchQuery,
    filters,
    mapRow: mapPageDataItemJournal,
  });
};

function unwrapJournalPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const row = payload as Record<string, unknown>;
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    return row.data as Record<string, unknown>;
  }
  return row;
}

/** Fetch one journal line (item no + name) when the list payload omits them. */
export const fetchItemJournalById = async (id: number) => {
  const api = await getAxiosInstance();
  const response = await api.get(`/api/item-journals/${id}/`);
  return unwrapJournalPayload(response.data);
};

/** Card-first detail fetch. List pages omit `item` (item no); the card includes it. */
export const fetchItemJournalDetail = async (line: {
  id: number;
  system_id?: string;
}) => {
  const {fetchPageDataRecord, PAGE_IDS} = await import('./pageDataService');
  const {mapPageDataItemJournal} = await import('./pageDataMappers');
  const systemId = (line.system_id || '').trim();

  if (systemId) {
    try {
      const row = await fetchPageDataRecord(
        PAGE_IDS.ItemJournalCard,
        systemId,
      );
      return mapPageDataItemJournal(row) as Record<string, unknown>;
    } catch {
      // Fall through to classic REST retrieve.
    }
  }

  return fetchItemJournalById(line.id);
};

/** Create or update a journal line (parity with web upsert). */
export const upsertItemJournal = async (
  payload: ItemJournalUpsertPayload,
) => {
  const api = await getAxiosInstance();
  const response = await api.post('/api/item-journals/upsert/', payload);
  return response;
};

/** Delete an open journal line (parity with web apiDeleteItemJournal). */
export const deleteItemJournal = async (id: number) => {
  const api = await getAxiosInstance();
  return api.delete(`/api/item-journals/${id}/`);
};

export type UnitOfMeasure = {
  code: string;
  description: string;
  created_at?: string;
  system_id?: string;
};

export type ItemUnitOfMeasure = {
  id: number;
  system_id?: string;
  item: string;
  unit_of_measure: string;
  unit_of_measure_description?: string;
  quantity_per_unit: number;
  default: boolean;
  price?: number | null;
  effective_price?: number;
};

export const fetchUnitsOfMeasure = async (): Promise<UnitOfMeasure[]> => {
  const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
  const {mapPageDataUnitOfMeasure} = await import('./pageDataMappers');
  return fetchPageDataAll({
    pageId: PAGE_IDS.UnitOfMeasureList,
    mapRow: mapPageDataUnitOfMeasure,
  });
};

export const createUnitOfMeasure = async (payload: {
  code: string;
  description: string;
}) => {
  const api = await getAxiosInstance();
  return api.post('/api/units-of-measure/', payload);
};

export const updateUnitOfMeasure = async (
  code: string,
  payload: {code: string; description: string},
) => {
  const api = await getAxiosInstance();
  return api.put(`/api/units-of-measure/${encodeURIComponent(code)}/`, payload);
};

export const deleteUnitOfMeasure = async (code: string) => {
  const api = await getAxiosInstance();
  return api.delete(`/api/units-of-measure/${encodeURIComponent(code)}/`);
};

export const fetchItemUnitsOfMeasure = async (
  itemNo: string,
): Promise<ItemUnitOfMeasure[]> => {
  const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
  const rows = await fetchPageDataAll({
    pageId: PAGE_IDS.ItemUnitOfMeasureList,
    limit: 200,
    filters: {item: itemNo},
  });
  return rows.map(row => ({
    id: Number(row.id) || 0,
    system_id: String(row.SystemId ?? row.system_id ?? ''),
    item: String(row.item ?? itemNo),
    unit_of_measure: String(row.unit_of_measure ?? ''),
    unit_of_measure_description: String(
      row.unit_of_measure_description ?? row.unit_of_measure ?? '',
    ),
    quantity_per_unit: Number(row.quantity_per_unit) || 1,
    default: Boolean(row.default),
    price:
      row.price != null && row.price !== '' ? Number(row.price) : null,
    effective_price:
      row.effective_price != null ? Number(row.effective_price) : undefined,
  }));
};

/** Same as web POS: GET /api/sales/resolve-unit-price/ (Sales Price List → IUOM → item card). */
export type ResolveSalesUnitPriceParams = {
  item_no?: string;
  item_system_id?: string;
  unit_of_measure?: string;
  item_unit_of_measure_id?: number;
  customer_no?: string;
  quantity?: number;
};

export type ResolveSalesUnitPriceResult = {
  item_no: string;
  unit_of_measure: string | null;
  item_unit_of_measure_id: number | null;
  quantity: number | string;
  unit_price: string;
};

export const resolveSalesUnitPrice = async (
  params: ResolveSalesUnitPriceParams,
): Promise<ResolveSalesUnitPriceResult> => {
  const api = await getAxiosInstance();
  const response = await api.get<ResolveSalesUnitPriceResult>(
    '/api/sales/resolve-unit-price/',
    {params},
  );
  return response.data;
};

export const createItemUnitOfMeasure = async (payload: {
  item: string;
  unit_of_measure: string;
  quantity_per_unit: number;
  default: boolean;
  price?: number;
}) => {
  const api = await getAxiosInstance();
  return api.post('/api/item-units-of-measure/', payload);
};

export const updateItemUnitOfMeasure = async (
  id: number,
  payload: {
    item: string;
    unit_of_measure: string;
    quantity_per_unit: number;
    default: boolean;
    price?: number;
  },
) => {
  const api = await getAxiosInstance();
  return api.patch(`/api/item-units-of-measure/${id}/`, payload);
};

export const deleteItemUnitOfMeasure = async (id: number) => {
  const api = await getAxiosInstance();
  return api.delete(`/api/item-units-of-measure/${id}/`);
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
  requires_transaction_id?: boolean;
  blocked?: boolean;
}

/**
 * Fetch customers from API
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
  try {
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataCustomer} = await import('./pageDataMappers');
    const rows = await fetchPageDataAll({
      pageId: PAGE_IDS.CustomerList,
      limit: 200,
      mapRow: mapPageDataCustomer,
    });
    return rows.map(c => ({
      id: c.id,
      no: c.no,
      name: c.name,
      system_id: c.system_id,
    }));
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

/**
 * Fetch payment methods from API
 */
export const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const {
    filterCollectablePaymentMethods,
    withNormalizedTransactionIdFlag,
  } = await import('../utils/paymentMethodDefaults');
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axios = createAxiosInstance(tenant);
    const response = await axios.get<PaymentMethod[]>(
      '/api/financials/payment-methods/',
    );
    const list = Array.isArray(response.data) ? response.data : [];
    if (list.length) {
      return filterCollectablePaymentMethods(list).map(
        withNormalizedTransactionIdFlag,
      );
    }
  } catch (error: any) {
    console.error('Error fetching payment methods from REST:', error);
  }
  try {
    const {fetchPageDataAll, PAGE_IDS} = await import('./pageDataService');
    const {mapPageDataPaymentMethod} = await import('./pageDataMappers');
    const methods = await fetchPageDataAll({
      pageId: PAGE_IDS.PaymentMethodList,
      filters: {blocked: false},
      mapRow: mapPageDataPaymentMethod,
    });
    return filterCollectablePaymentMethods(methods).map(
      withNormalizedTransactionIdFlag,
    );
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

export type TopSellingItem = {
  item_no: string;
  name: string;
  quantity: number;
  total: number;
};

type HomeSnapshotDayTotals = {
  total_sales: number;
  total_products: number;
  total_invoices: number;
};

export type HomeSnapshotResponse = {
  today: HomeSnapshotDayTotals;
  yesterday: HomeSnapshotDayTotals;
  top_selling_items: TopSellingItem[];
  total_catalog_products: number;
};

function growthPercent(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function mapHomeSnapshotToKPI(
  snapshot: HomeSnapshotResponse,
): KPIMetrics {
  const todayRevenue = snapshot.today.total_sales;
  const yesterdayRevenue = snapshot.yesterday.total_sales;
  const todayOrders = snapshot.today.total_invoices;
  const yesterdayOrders = snapshot.yesterday.total_invoices;

  return {
    today_revenue: todayRevenue,
    yesterday_revenue: yesterdayRevenue,
    revenue_growth: growthPercent(todayRevenue, yesterdayRevenue),
    today_orders: todayOrders,
    yesterday_orders: yesterdayOrders,
    order_growth: growthPercent(todayOrders, yesterdayOrders),
    today_products_sold: snapshot.today.total_products,
    total_products: snapshot.total_catalog_products,
  };
}

function summaryAmount(s: SalesHistorySummary | null): number {
  if (!s) return 0;
  return Number(s.net_sales ?? s.total_sales ?? 0);
}

/**
 * Home KPIs from GET /api/sales/summary/ (same API as web POS / Sales History).
 * Uses posting_date for today/yesterday — Posted archive only.
 */
export const fetchHomeKpisFromSalesSummary = async (): Promise<KPIMetrics | null> => {
  const today = getLocalDateYmd();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = getLocalDateYmd(y);

  const [todaySum, yesterdaySum] = await Promise.all([
    fetchSalesSummary({startDate: today, endDate: today}),
    fetchSalesSummary({startDate: yesterday, endDate: yesterday}),
  ]);

  // Both null → permission/network failure (don't show fake zeros as success).
  if (!todaySum && !yesterdaySum) {
    return null;
  }

  const todayRevenue = summaryAmount(todaySum);
  const yesterdayRevenue = summaryAmount(yesterdaySum);
  const todayOrders = Number(todaySum?.total_invoices ?? 0);
  const yesterdayOrders = Number(yesterdaySum?.total_invoices ?? 0);

  return {
    today_revenue: todayRevenue,
    yesterday_revenue: yesterdayRevenue,
    revenue_growth: growthPercent(todayRevenue, yesterdayRevenue),
    today_orders: todayOrders,
    yesterday_orders: yesterdayOrders,
    order_growth: growthPercent(todayOrders, yesterdayOrders),
    today_products_sold: Number(todaySum?.total_products ?? 0),
    total_products: 0,
  };
};

/** @deprecated Prefer fetchHomeKpisFromSalesSummary — kept for top-sellers helper only. */
export const fetchHomeSnapshot = async (
  topItemsLimit: number = 5,
): Promise<HomeSnapshotResponse | null> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;

    const response = await api.get('/api/sales/home-snapshot/', {
      params: { top_items_limit: topItemsLimit },
    });

    return response?.data ?? null;
  } catch (error: any) {
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching home snapshot:', error);
    }
    return null;
  }
};

export const fetchKPIMetrics = async (): Promise<KPIMetrics | null> => {
  return fetchHomeKpisFromSalesSummary();
};

export type RecentTransactionsFetchOptions = {
  /** Same as Sales History own-sales filter (?user=). */
  userId?: number;
};

/**
 * Recent posted sales for Home (DRF pagination: page_size, not limit).
 */
export const fetchRecentTransactions = async (
  pageSize: number = 10,
  options?: RecentTransactionsFetchOptions,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;

    const params: Record<string, string | number> = {
      page: 1,
      page_size: pageSize,
      ordering: '-created_at',
      status: 'Posted',
      exclude_reversed: 'true',
    };
    const uid = options?.userId;
    if (uid != null && Number.isFinite(uid)) {
      params.user = uid;
    }

    const response = await api.get('/api/sales/', {params});

    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error: any) {
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching recent transactions:', error);
    }
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
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching low stock items:', error);
    }
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
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching outstanding receivables:', error);
    }
    // Return zero if endpoint doesn't exist or fails
    return { total_amount: 0, count: 0 };
  }
};

/**
 * Fetch today's top selling items (via home snapshot endpoint).
 */
export const fetchTopSellingItems = async (limit: number = 5) => {
  try {
    const snapshot = await fetchHomeSnapshot(limit);
    if (!snapshot?.top_selling_items) return [];
    return snapshot.top_selling_items.slice(0, limit);
  } catch (error: any) {
    if (!isSubscriptionExpiredError(error)) {
      console.error('Error fetching top selling items:', error);
    }
    return [];
  }
};
