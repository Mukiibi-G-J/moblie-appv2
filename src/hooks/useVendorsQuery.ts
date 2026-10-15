import {useMemo} from 'react';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
import {
  PAGE_DATA_PAGE_SIZE,
  PAGE_IDS,
  fetchPageDataList,
  pageDataHasMore,
  resolveListControlId,
} from '../services/pageDataService';
import {mapPageDataVendor} from '../services/pageDataMappers';
import {queryKeys, type VendorsQueryFilters} from '../query/keys';
import type {Vendor} from '../@types/vendor';

type UseVendorsQueryOptions = {
  searchQuery?: string;
  enabled?: boolean;
};

export function useVendorsQuery(options: UseVendorsQueryOptions = {}) {
  const {searchQuery = '', enabled = true} = options;
  const filters: VendorsQueryFilters = {
    search: searchQuery.trim(),
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.vendors(filters),
    initialPageParam: 0,
    enabled,
    queryFn: async ({pageParam}) => {
      try {
        const controlId = await resolveListControlId(PAGE_IDS.VendorList);
        const rows = await fetchPageDataList({
          pageId: PAGE_IDS.VendorList,
          controlId,
          search: filters.search,
          limit: PAGE_DATA_PAGE_SIZE,
          offset: pageParam,
        });
        const results = rows.map(mapPageDataVendor);
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

  const vendors = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<number | string>();
    const merged: Vendor[] = [];
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
    vendors,
    totalCount: query.data?.pages?.[0]?.count ?? 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    hasNextPage: Boolean(query.hasNextPage),
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
  };
}

export function useInvalidateVendors() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: [...queryKeys.all, 'vendors'],
    });
}
