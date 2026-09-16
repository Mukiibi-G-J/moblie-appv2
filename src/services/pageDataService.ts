import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

/** Zentro page IDs from webV2 `ZENTRO_PAGE_REGISTRY` (ItemList=10201, not AutoField 7). */
export const PAGE_IDS = {
  SalesInvoiceList: 10003,
  PostedSalesInvoiceList: 10004,
  CustomerList: 10101,
  CustomerLedgerEntryList: 10103,
  ItemList: 10201,
  ItemCard: 10202,
  InventoryAdjustmentJournalList: 10203,
  OpeningBalanceJournalList: 10204,
  ItemJournalCard: 10210,
  ItemLedgerEntryList: 10205,
  ItemUnitOfMeasureList: 10206,
  UnitOfMeasureList: 10208,
  PostedInventoryAdjustmentList: 10215,
  ItemCategoryList: 10216,
  StockTakingJournalList: 10218,
  PostedStockTakingList: 10220,
  PurchaseInvoiceList: 10301,
  PostedPurchaseInvoiceList: 10302,
  VendorList: 10303,
  VendorLedgerEntryList: 10309,
  PaymentJournalList: 10401,
  PaymentMethodList: 10405,
  GLAccountList: 10501,
  FinancialReportList: 10510,
  FinancialReportOverview: 10511,
  ExpenseList: 10520,
  PaymentHistoryList: 10522,
  BankAccountList: 10601,
  BankAccountLedgerEntryList: 10603,
  UserSetupList: 10801,
  UsersList: 10802,
  UserSettingsList: 10804,
  UserSettingsCard: 10805,
  UserGroupsList: 10808,
} as const;

export type PageDataRecord = Record<string, unknown> & {
  SystemId?: string;
  system_id?: string;
  id?: number | string;
};

export type PageDataListParams = {
  pageId: number;
  controlId?: number;
  search?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, string | number | boolean | undefined | null>;
};

export type PaginatedPageData<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type PageControlLike = {
  ControlId?: number;
  PageControlId?: number;
  ControlType?: string;
  Name?: string;
};

type PageDefLike = {
  PageId?: number;
  PageControls?: PageControlLike[];
};

const controlIdCache = new Map<number, number>();

const PAGE_SIZE = 50;

function stripEmptyFilters(
  filters?: PageDataListParams['filters'],
): Record<string, string | number | boolean> {
  if (!filters) {
    return {};
  }
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    out[key] = value;
  }
  return out;
}

async function getAxios() {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  return createAxiosInstance(tenant);
}

/**
 * Page APIs use Zentro registry IDs (ItemList=10201, CustomerList=10101).
 * Do not remap to sequential AutoField PKs (demo3 historically used 7).
 * Backend `_resolve_page` still accepts 10xxx on older tenants until they are aligned.
 */
export async function resolveTenantPageId(requestedId: number): Promise<number> {
  return requestedId;
}

/**
 * Resolve the list Repeater control id for a page (cached per process).
 * Falls back to hardcoded known ids when the page def call fails.
 * Omitting ControlId is also valid — backend uses first Repeater/Group.
 */
export async function resolveListControlId(
  pageId: number,
  fallbackControlId?: number,
): Promise<number | undefined> {
  const resolvedPageId = await resolveTenantPageId(pageId);
  const cached = controlIdCache.get(resolvedPageId);
  if (cached != null) {
    return cached;
  }

  try {
    const axiosInstance = await getAxios();
    const response = await axiosInstance.get<PageDefLike>('/api/pages/page/', {
      params: {PageId: resolvedPageId},
    });
    const controls = response?.data?.PageControls ?? [];
    const repeater =
      controls.find(c => c.ControlType === 'Repeater') ||
      controls.find(
        c => c.ControlType === 'Repeater' || c.ControlType === 'Group',
      );
    const controlId = repeater?.PageControlId ?? repeater?.ControlId;
    if (typeof controlId === 'number' && Number.isFinite(controlId)) {
      controlIdCache.set(resolvedPageId, controlId);
      return controlId;
    }
  } catch (error) {
    console.warn(
      `[pageData] Failed to resolve ControlId for PageId=${resolvedPageId}`,
      error,
    );
  }

  // Primewise fallback ControlIds are only valid when PageId was not remapped.
  if (fallbackControlId != null && resolvedPageId === pageId) {
    controlIdCache.set(resolvedPageId, fallbackControlId);
    return fallbackControlId;
  }
  return undefined;
}

export async function fetchPageDataList(
  params: PageDataListParams,
): Promise<PageDataRecord[]> {
  const {
    pageId,
    controlId,
    search,
    limit = PAGE_SIZE,
    offset = 0,
    filters,
  } = params;
  const resolvedPageId = await resolveTenantPageId(pageId);

  const axiosInstance = await getAxios();
  const response = await axiosInstance.get('/api/pages/data/', {
    params: {
      PageId: resolvedPageId,
      ...(controlId != null ? {ControlId: controlId} : {}),
      limit,
      offset,
      ...(search?.trim() ? {search: search.trim()} : {}),
      ...stripEmptyFilters(filters),
    },
  });

  if (!Array.isArray(response.data)) {
    const msg =
      response.data &&
      typeof response.data === 'object' &&
      'error' in response.data
        ? String((response.data as {error: string}).error)
        : 'Page data request failed';
    throw new Error(msg);
  }

  return response.data as PageDataRecord[];
}

/**
 * Page-number pagination wrapper matching classic DRF list responses
 * so existing screens/services can swap endpoints without UI changes.
 */
export async function fetchPageDataPaginated<T = PageDataRecord>(options: {
  pageId: number;
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: PageDataListParams['filters'];
  fallbackControlId?: number;
  mapRow?: (row: PageDataRecord) => T;
}): Promise<PaginatedPageData<T>> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const controlId = await resolveListControlId(
    options.pageId,
    options.fallbackControlId,
  );
  const rows = await fetchPageDataList({
    pageId: options.pageId,
    controlId,
    search: options.search,
    limit: pageSize,
    offset,
    filters: options.filters,
  });
  const mapRow = options.mapRow ?? ((row: PageDataRecord) => row as T);
  const results = rows.map(mapRow);
  const hasMore = results.length >= pageSize;
  return {
    count: offset + results.length + (hasMore ? 1 : 0),
    next: hasMore ? 'more' : null,
    previous: page > 1 ? 'prev' : null,
    results,
  };
}

/** Fetch up to `limit` rows (lookups / pickers). */
export async function fetchPageDataAll<T = PageDataRecord>(options: {
  pageId: number;
  search?: string;
  limit?: number;
  filters?: PageDataListParams['filters'];
  fallbackControlId?: number;
  mapRow?: (row: PageDataRecord) => T;
}): Promise<T[]> {
  const controlId = await resolveListControlId(
    options.pageId,
    options.fallbackControlId,
  );
  const rows = await fetchPageDataList({
    pageId: options.pageId,
    controlId,
    search: options.search,
    limit: options.limit ?? 500,
    offset: 0,
    filters: options.filters,
  });
  const mapRow = options.mapRow ?? ((row: PageDataRecord) => row as T);
  return rows.map(mapRow);
}

/** Known ControlIds from primewise (used only as resolve fallback). */
export const FALLBACK_CONTROL_IDS: Partial<Record<number, number>> = {
  [PAGE_IDS.ItemList]: 11,
  [PAGE_IDS.PostedSalesInvoiceList]: 60,
};

export const PAGE_DATA_PAGE_SIZE = PAGE_SIZE;

export function pageDataHasMore(
  pageLength: number,
  pageSize: number = PAGE_SIZE,
): boolean {
  return pageLength >= pageSize;
}

export function clearPageControlIdCache(): void {
  controlIdCache.clear();
}

export type PageRelationOption = {
  value: string;
  caption: string;
  code?: string | null;
};

export type PageFieldRef = {
  pageControlId: number;
  pageControlFieldId: number;
  name: string;
};

type PageFieldLike = {
  Name?: string;
  PageControlId?: number;
  PageControlFieldId?: number;
  HasTableRelation?: boolean;
};

type PageControlWithFields = PageControlLike & {
  Fields?: PageFieldLike[];
  PageControlFields?: PageFieldLike[];
};

type PageDefWithFields = PageDefLike & {
  PageControls?: PageControlWithFields[];
};

/** GET /api/pages/setup-solo/?PageId= — own User Settings (or other singleton) SystemId. */
export async function getSetupSoloSystemId(pageId: number): Promise<string> {
  const resolvedPageId = await resolveTenantPageId(pageId);
  const axiosInstance = await getAxios();
  const response = await axiosInstance.get<{SystemId?: string; error?: string}>(
    '/api/pages/setup-solo/',
    {params: {PageId: resolvedPageId}},
  );
  if (response.data && typeof response.data === 'object' && response.data.error) {
    throw new Error(String(response.data.error));
  }
  const systemId = response.data?.SystemId;
  if (!systemId) {
    throw new Error('Could not open user settings');
  }
  return String(systemId);
}

export async function fetchPageDefinition(
  pageId: number,
): Promise<PageDefWithFields> {
  const resolvedPageId = await resolveTenantPageId(pageId);
  const axiosInstance = await getAxios();
  const response = await axiosInstance.get<PageDefWithFields>('/api/pages/page/', {
    params: {PageId: resolvedPageId},
  });
  return response.data ?? {};
}

/** Resolve a named field (and its control ids) from a page definition. */
export async function resolvePageFieldRef(
  pageId: number,
  fieldName: string,
): Promise<PageFieldRef | null> {
  const page = await fetchPageDefinition(pageId);
  const controls = page.PageControls ?? [];
  for (const control of controls) {
    const fields = control.Fields ?? control.PageControlFields ?? [];
    const field = fields.find(f => f.Name === fieldName);
    if (!field) {
      continue;
    }
    const pageControlId = field.PageControlId ?? control.PageControlId ?? control.ControlId;
    const pageControlFieldId = field.PageControlFieldId;
    if (
      typeof pageControlId !== 'number' ||
      typeof pageControlFieldId !== 'number'
    ) {
      return null;
    }
    return {
      pageControlId,
      pageControlFieldId,
      name: fieldName,
    };
  }
  return null;
}

export async function fetchPageDataRecord(
  pageId: number,
  systemId: string,
  controlId?: number,
): Promise<PageDataRecord> {
  const resolvedPageId = await resolveTenantPageId(pageId);
  const axiosInstance = await getAxios();
  const response = await axiosInstance.get<PageDataRecord | {error: string}>(
    `/api/pages/data/${systemId}/`,
    {
      params: {
        PageId: resolvedPageId,
        ...(controlId != null ? {ControlId: controlId} : {}),
      },
    },
  );
  if (
    response.data &&
    typeof response.data === 'object' &&
    'error' in response.data
  ) {
    throw new Error(String((response.data as {error: string}).error));
  }
  return response.data as PageDataRecord;
}

export async function updatePageDataField(options: {
  pageId: number;
  systemId: string;
  field: string;
  value: unknown;
  currentRecordValues?: Record<string, unknown>;
}): Promise<unknown> {
  const axiosInstance = await getAxios();
  const body: Record<string, unknown> = {
    PageId: await resolveTenantPageId(options.pageId),
    field: options.field,
    value: options.value,
  };
  if (
    options.currentRecordValues &&
    Object.keys(options.currentRecordValues).length > 0
  ) {
    body.CurrentRecordValues = options.currentRecordValues;
  }
  const response = await axiosInstance.patch(
    `/api/pages/data/${options.systemId}/`,
    body,
  );
  return response.data;
}

/** POST /api/pages/relations/ — lookup options (ApplicationProfile filtered for user). */
export async function fetchPageRelations(options: {
  pageId: number;
  pageControlId: number;
  pageControlFieldId: number;
  currentRecordSystemId?: string | null;
  currentRecordValues?: Record<string, unknown>;
}): Promise<PageRelationOption[]> {
  const axiosInstance = await getAxios();
  const response = await axiosInstance.post('/api/pages/relations/', {
    PageId: await resolveTenantPageId(options.pageId),
    PageControlId: options.pageControlId,
    PageControlFieldId: options.pageControlFieldId,
    CurrentRecordSystemId: options.currentRecordSystemId ?? null,
    CurrentRecordValues: options.currentRecordValues ?? {},
  });
  if (!Array.isArray(response.data)) {
    const msg =
      response.data &&
      typeof response.data === 'object' &&
      'error' in response.data
        ? String((response.data as {error: string}).error)
        : 'Failed to load options';
    throw new Error(msg);
  }
  return (response.data as Array<Record<string, unknown>>).map(row => {
    const value = String(row.Value ?? row.value ?? row.Code ?? row.code ?? '');
    const caption = String(
      row.Caption ?? row.caption ?? row.Name ?? row.name ?? value,
    );
    return {
      value,
      caption: caption || value,
      code: (row.Code ?? row.code ?? value) as string | null,
    };
  });
}
