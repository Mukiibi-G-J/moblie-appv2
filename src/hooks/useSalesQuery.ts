import {useMemo} from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchMyUserSetup,
  fetchSalesData,
  fetchSalesSummary,
  fetchSalesUserSummary,
} from '../services/app.services';
import {
  FALLBACK_CONTROL_IDS,
  PAGE_DATA_PAGE_SIZE,
  PAGE_IDS,
  fetchPageDataList,
  pageDataHasMore,
  resolveListControlId,
} from '../services/pageDataService';
import {mapPageDataSale, mapPageDataOpenSale} from '../services/pageDataMappers';
import {queryKeys, type SalesQueryFilters} from '../query/keys';

type UseSalesQueryOptions = SalesQueryFilters & {
  enabled?: boolean;
};

function isUnpostedStatus(status?: string) {
  return (
    status === 'Unposted' || status === 'Open' || status === 'Draft'
  );
}

function buildListFilters(filters: SalesQueryFilters) {
  const raw =
    filters.status && filters.status !== 'All' ? filters.status : undefined;
  // Treat Open/Draft as Unposted (combined list).
  const status =
    raw === 'Open' || raw === 'Draft' ? 'Unposted' : raw;
  // Unposted have no CLE ownership — never send ?user=.
  const includeUser = filters.user != null && !isUnpostedStatus(status);
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    status,
    paymentMethod: filters.paymentMethod || undefined,
    search: filters.search?.trim() || undefined,
    ...(includeUser ? {user: filters.user} : {}),
  };
}

/**
 * Posted/All → PostedSalesInvoiceList.
 * Unposted → REST (Open + Draft merged).
 * Cancelled or payment-method id → classic REST.
 */
function resolveSalesPageId(status?: string): number | null {
  if (!status || status === 'All' || status === 'Posted') {
    return PAGE_IDS.PostedSalesInvoiceList;
  }
  if (isUnpostedStatus(status)) {
    return null;
  }
  return null;
}

function canUseSalesPageData(filters: SalesQueryFilters): boolean {
  // Prefer REST for unposted so Open/Draft always list reliably
  // (page-data ownership/date filters can hide them).
  if (isUnpostedStatus(filters.status)) {
    return false;
  }
  if (resolveSalesPageId(filters.status) == null) {
    return false;
  }
  const pm = filters.paymentMethod;
  if (pm && pm !== 'not_paid') {
    return false;
  }
  return true;
}

function buildPageDataSaleFilters(
  filters: ReturnType<typeof buildListFilters>,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (filters.startDate) {
    out.posting_date_from = filters.startDate;
  }
  if (filters.endDate) {
    out.posting_date_to = filters.endDate;
  }
  if (filters.paymentMethod === 'not_paid') {
    out.closed = false;
  }
  // Unposted have no ledger owner — page-data ?user= would return empty.
  if (filters.user != null && !isUnpostedStatus(filters.status)) {
    out.user = String(filters.user);
  }
  return out;
}

export function useSalesQuery(options: UseSalesQueryOptions = {}) {
  const {enabled = true, ...filters} = options;
  const listFilters = buildListFilters(filters);
  const usePageData = canUseSalesPageData(filters);
  const pageId = resolveSalesPageId(filters.status) ?? PAGE_IDS.PostedSalesInvoiceList;
  const isPostedList = pageId === PAGE_IDS.PostedSalesInvoiceList;

  const query = useInfiniteQuery({
    queryKey: queryKeys.sales(filters),
    initialPageParam: usePageData ? 0 : 1,
    enabled,
    queryFn: async ({pageParam}) => {
      if (!usePageData) {
        const response = await fetchSalesData({
          ...listFilters,
          page: pageParam,
          pageSize: 20,
        });
        return {
          count: response?.count ?? 0,
          next: response?.next ?? null,
          previous: response?.previous ?? null,
          results: Array.isArray(response?.results) ? response.results : [],
        };
      }

      const controlId = await resolveListControlId(
        pageId,
        isPostedList
          ? FALLBACK_CONTROL_IDS[PAGE_IDS.PostedSalesInvoiceList]
          : undefined,
      );
      const rows = await fetchPageDataList({
        pageId,
        controlId,
        search: listFilters.search,
        limit: PAGE_DATA_PAGE_SIZE,
        offset: pageParam,
        filters: buildPageDataSaleFilters(listFilters),
      });
      const results = rows.map(isPostedList ? mapPageDataSale : mapPageDataOpenSale);
      const hasMore = pageDataHasMore(results.length);
      return {
        count: pageParam + results.length + (hasMore ? 1 : 0),
        next: hasMore ? 'more' : null,
        previous: pageParam > 0 ? 'prev' : null,
        results,
      };
    },
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (!lastPage?.next) {
        return undefined;
      }
      if (usePageData) {
        return lastPageParam + PAGE_DATA_PAGE_SIZE;
      }
      return lastPageParam + 1;
    },
  });

  const sales = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<number | string>();
    const merged: Record<string, unknown>[] = [];
    for (const page of pages) {
      for (const row of page.results) {
        const key = row?.id ?? row?.invoice_no ?? row?.system_id;
        if (key == null || seen.has(key as string | number)) {
          continue;
        }
        seen.add(key as string | number);
        merged.push(row);
      }
    }
    return merged;
  }, [query.data?.pages]);

  return {
    sales,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    hasNextPage: Boolean(query.hasNextPage),
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
  };
}

export function useSalesSummaryQuery(options: UseSalesQueryOptions = {}) {
  const {enabled = true, ...filters} = options;
  const listFilters = buildListFilters(filters);
  return useQuery({
    queryKey: queryKeys.salesSummary(filters),
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchSalesSummary(listFilters),
  });
}

export function useSalesUserSummaryQuery(options: UseSalesQueryOptions = {}) {
  const {enabled = true, ...filters} = options;
  const listFilters = buildListFilters(filters);
  return useQuery({
    queryKey: queryKeys.salesUserSummary(filters),
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchSalesUserSummary(listFilters),
  });
}

export function useUserSetupQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userSetup(),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => fetchMyUserSetup(),
  });
}

export function useInvalidateSales() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({queryKey: [...queryKeys.all, 'sales']}),
      qc.invalidateQueries({queryKey: [...queryKeys.all, 'salesSummary']}),
      qc.invalidateQueries({queryKey: [...queryKeys.all, 'salesUserSummary']}),
    ]);
}
