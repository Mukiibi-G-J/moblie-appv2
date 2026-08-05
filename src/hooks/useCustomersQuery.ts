import {useMemo} from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {CustomerServices} from '../services/CustomerServices';
import {
  PAGE_DATA_PAGE_SIZE,
  PAGE_IDS,
  fetchPageDataList,
  pageDataHasMore,
  resolveListControlId,
} from '../services/pageDataService';
import {mapPageDataCustomer} from '../services/pageDataMappers';
import {queryKeys, type CustomersQueryFilters} from '../query/keys';
import type {Customer} from '../@types/customer';

type PaginatedCustomers = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
};

type UseCustomersQueryOptions = {
  searchQuery?: string;
  enabled?: boolean;
};

export function useCustomersQuery(options: UseCustomersQueryOptions = {}) {
  const {searchQuery = '', enabled = true} = options;
  const filters: CustomersQueryFilters = {
    search: searchQuery.trim(),
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.customers(filters),
    initialPageParam: 0,
    enabled,
    queryFn: async ({pageParam}): Promise<PaginatedCustomers> => {
      try {
        const controlId = await resolveListControlId(PAGE_IDS.CustomerList);
        const rows = await fetchPageDataList({
          pageId: PAGE_IDS.CustomerList,
          controlId,
          search: filters.search,
          limit: PAGE_DATA_PAGE_SIZE,
          offset: pageParam,
        });
        const results = rows.map(mapPageDataCustomer);
        const hasMore = pageDataHasMore(results.length);
        return {
          count: pageParam + results.length + (hasMore ? 1 : 0),
          next: hasMore ? 'more' : null,
          previous: pageParam > 0 ? 'prev' : null,
          results,
        };
      } catch (error: any) {
        const invalidPage =
          error?.response?.data?.detail === 'Invalid page.' ||
          error?.response?.data?.error === 'Invalid page.';
        if (invalidPage && pageParam > 0) {
          return {count: 0, next: null, previous: null, results: []};
        }
        throw error;
      }
    },
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (!lastPage?.next) {
        return undefined;
      }
      return lastPageParam + PAGE_DATA_PAGE_SIZE;
    },
  });

  const customers = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<number | string>();
    const merged: Customer[] = [];
    for (const page of pages) {
      for (const row of page.results) {
        const key = row?.id || row?.no || row?.system_id;
        if (key == null || seen.has(key)) {
          continue;
        }
        seen.add(key);
        merged.push(row);
      }
    }
    return merged;
  }, [query.data?.pages]);

  return {
    customers,
    totalCount: query.data?.pages?.[0]?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    hasNextPage: Boolean(query.hasNextPage),
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
  };
}

export function usePaymentMethodsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.paymentMethods(),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => CustomerServices.getPaymentMethods(),
  });
}

export function useInvalidateCustomers() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: [...queryKeys.all, 'customers'],
    });
}
