import {useMemo} from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchCategories,
  fetchItems,
  fetchItemsFromRest,
  isInvalidPageError,
  type ItemListFilters,
} from '../services/app.services';
import {
  FALLBACK_CONTROL_IDS,
  PAGE_DATA_PAGE_SIZE,
  PAGE_IDS,
  fetchPageDataList,
  pageDataHasMore,
  resolveListControlId,
} from '../services/pageDataService';
import {mapPageDataItem} from '../services/pageDataMappers';
import {queryKeys, type ItemsQueryFilters} from '../query/keys';

export type ItemRow = {
  id?: number;
  no?: string;
  system_id: string;
  item_name: string;
  unit_price: number;
  item_images: {url: string; id: number}[];
  inventory: number;
  minimum_stock?: number | null;
  type?: string;
  category_id?: number | string | null;
  item_category?: any;
  description?: string;
  bar_code_no?: string;
  unit_cost?: number;
  unit_of_measure?: string;
  created_at?: string;
  updated_at?: string;
};

type PaginatedItems = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ItemRow[];
};

type UseItemsQueryOptions = {
  searchQuery?: string;
  categoryId?: number | string | null;
  stockFilter?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  /** When true, keep only Service / Non-Inventory rows (All Services screen). */
  servicesOnly?: boolean;
  enabled?: boolean;
};

function toApiFilters(
  stockFilter: UseItemsQueryOptions['stockFilter'],
): ItemListFilters | undefined {
  if (stockFilter === 'low_stock') {
    return {lowStock: true};
  }
  if (stockFilter === 'out_of_stock') {
    return {inventoryStatus: 'OUT_OF_STOCK'};
  }
  return undefined;
}

function applyClientFilters(
  results: ItemRow[],
  stockFilter: UseItemsQueryOptions['stockFilter'],
  servicesOnly: boolean,
): ItemRow[] {
  const scoped = servicesOnly
    ? results.filter(
        item => item?.type === 'Service' || item?.type === 'Non-Inventory',
      )
    : results;

  if (
    !stockFilter ||
    stockFilter === 'all' ||
    stockFilter === 'low_stock' ||
    stockFilter === 'out_of_stock'
  ) {
    return scoped;
  }

  return scoped.filter(item => {
    const inventory = item?.inventory || 0;
    const min = item?.minimum_stock;
    const isLow =
      min != null && min > 0 && inventory > 0 && inventory <= min;
    if (stockFilter === 'in_stock') {
      return inventory > 0 && !isLow;
    }
    return true;
  });
}

function mergeUniqueItems(existing: ItemRow[], incoming: ItemRow[]): ItemRow[] {
  const seen = new Set<string>();
  return [...existing, ...incoming].filter(item => {
    const key = String(item?.id || item?.no || item?.system_id || '');
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** Stock filters that classic /api/items/ understands but page-data may not. */
function needsClassicItemApi(apiFilters: ItemListFilters | undefined): boolean {
  return Boolean(apiFilters?.lowStock || apiFilters?.inventoryStatus);
}

async function fetchItemsViaPageData(
  offset: number,
  searchQuery: string,
  categoryId?: number | string | null,
): Promise<PaginatedItems> {
  const controlId = await resolveListControlId(
    PAGE_IDS.ItemList,
    FALLBACK_CONTROL_IDS[PAGE_IDS.ItemList],
  );
  const filters: Record<string, string> = {};
  if (categoryId != null && categoryId !== '') {
    filters.item_category = String(categoryId);
  }
  const rows = await fetchPageDataList({
    pageId: PAGE_IDS.ItemList,
    controlId,
    search: searchQuery,
    limit: PAGE_DATA_PAGE_SIZE,
    offset,
    filters,
  });
  const omitsBarcode =
    rows.length > 0 && rows.every(row => !('bar_code_no' in row));
  if (omitsBarcode) {
    const page = Math.floor(offset / PAGE_DATA_PAGE_SIZE) + 1;
    const data = await fetchItemsFromRest(page, searchQuery, categoryId);
    const restRows = Array.isArray(data?.results) ? data.results : [];
    return {
      count: data?.count ?? restRows.length,
      next: data?.next ?? null,
      previous: data?.previous ?? null,
      results: restRows.map(mapPageDataItem),
    };
  }
  const results = rows.map(mapPageDataItem);
  const hasMore = pageDataHasMore(results.length);
  return {
    count: offset + results.length + (hasMore ? 1 : 0),
    next: hasMore ? 'more' : null,
    previous: offset > 0 ? 'prev' : null,
    results,
  };
}

export function useItemsQuery(options: UseItemsQueryOptions = {}) {
  const {
    searchQuery = '',
    categoryId = null,
    stockFilter = 'all',
    servicesOnly = false,
    enabled = true,
  } = options;

  const apiFilters = toApiFilters(stockFilter);
  const useClassic = needsClassicItemApi(apiFilters);
  const filters: ItemsQueryFilters = {
    search: searchQuery.trim(),
    categoryId,
    lowStock: apiFilters?.lowStock,
    inventoryStatus: apiFilters?.inventoryStatus,
    scope: servicesOnly ? 'services' : 'items',
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.items(filters),
    initialPageParam: useClassic ? 1 : 0,
    enabled,
    queryFn: async ({pageParam}): Promise<PaginatedItems> => {
      try {
        if (useClassic) {
          const data = await fetchItems(
            pageParam,
            searchQuery,
            categoryId != null && categoryId !== '' ? categoryId : undefined,
            apiFilters,
          );
          return {
            count: data?.count ?? 0,
            next: data?.next ?? null,
            previous: data?.previous ?? null,
            results: Array.isArray(data?.results) ? data.results : [],
          };
        }
        return await fetchItemsViaPageData(pageParam, searchQuery, categoryId);
      } catch (error) {
        if (isInvalidPageError(error) && pageParam > (useClassic ? 1 : 0)) {
          return {count: 0, next: null, previous: null, results: []};
        }
        throw error;
      }
    },
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (!lastPage?.next) {
        return undefined;
      }
      if (useClassic) {
        return lastPageParam + 1;
      }
      return lastPageParam + PAGE_DATA_PAGE_SIZE;
    },
  });

  const items = useMemo(() => {
    const pages = query.data?.pages ?? [];
    let merged: ItemRow[] = [];
    for (const page of pages) {
      const filtered = applyClientFilters(
        page.results,
        stockFilter,
        servicesOnly,
      );
      merged = mergeUniqueItems(merged, filtered);
    }
    return merged;
  }, [query.data?.pages, servicesOnly, stockFilter]);

  return {
    items,
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

export function useCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories(),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const categoriesData = await fetchCategories();
      if (!Array.isArray(categoriesData)) {
        return [];
      }
      return categoriesData.map((cat: any, index: number) => ({
        id: cat.id || cat.code || `cat_${index}`,
        code: cat.code,
        name: cat.name || cat.description || cat.code,
        description: cat.description || cat.code,
      }));
    },
  });
}

export function useInvalidateItems() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: [...queryKeys.all, 'items'],
    });
}
