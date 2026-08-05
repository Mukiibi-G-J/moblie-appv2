import {useMemo} from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {ExpenseServices} from '../services/ExpenseServices';
import {
  PAGE_DATA_PAGE_SIZE,
  PAGE_IDS,
  fetchPageDataList,
  pageDataHasMore,
  resolveListControlId,
} from '../services/pageDataService';
import {mapPageDataExpense} from '../services/pageDataMappers';
import {queryKeys, type ExpensesQueryFilters} from '../query/keys';
import type {Expense} from '../@types/expense';

type UseExpensesQueryOptions = ExpensesQueryFilters & {
  enabled?: boolean;
};

function resolveExpensePageId(status?: string): number {
  if (status === 'Posted') {
    return PAGE_IDS.PaymentHistoryList;
  }
  return PAGE_IDS.ExpenseList;
}

/**
 * Open expenses → ExpenseList (10520).
 * Posted → PaymentHistoryList (10522).
 * Reversed / All → classic REST (no dedicated page).
 */
function canUseExpensePageData(filters: ExpensesQueryFilters): boolean {
  return !filters.status || filters.status === 'Open' || filters.status === 'Posted';
}

function buildExpensePageFilters(
  filters: ExpensesQueryFilters,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (filters.startDate) {
    out.posting_date_from = filters.startDate;
  }
  if (filters.endDate) {
    out.posting_date_to = filters.endDate;
  }
  if (filters.expenseType != null) {
    out.expense_type = filters.expenseType;
  }
  if (filters.paymentMethod != null) {
    out.payment_method = filters.paymentMethod;
  }
  return out;
}

export function useExpensesQuery(options: UseExpensesQueryOptions = {}) {
  const {enabled = true, ...filters} = options;
  const usePageData = canUseExpensePageData(filters);

  const query = useInfiniteQuery({
    queryKey: queryKeys.expenses(filters),
    initialPageParam: usePageData ? 0 : 1,
    enabled,
    queryFn: async ({pageParam}) => {
      try {
        if (!usePageData) {
          const params: Record<string, unknown> = {
            page: pageParam,
            page_size: 20,
          };
          if (filters.search?.trim()) {
            params.search = filters.search.trim();
          }
          if (filters.status && filters.status !== 'All') {
            params.status = filters.status;
          }
          if (filters.startDate) {
            params.start_date = filters.startDate;
          }
          if (filters.endDate) {
            params.end_date = filters.endDate;
          }
          if (filters.expenseType) {
            params.expense_type = filters.expenseType;
          }
          if (filters.paymentMethod) {
            params.payment_method = filters.paymentMethod;
          }

          const response = await ExpenseServices.getExpenses(params as any);
          return {
            count: response?.count ?? 0,
            next: response?.next ?? null,
            previous: response?.previous ?? null,
            results: Array.isArray(response?.results) ? response.results : [],
          };
        }

        const pageId = resolveExpensePageId(filters.status);
        const controlId = await resolveListControlId(pageId);
        const rows = await fetchPageDataList({
          pageId,
          controlId,
          search: filters.search?.trim(),
          limit: PAGE_DATA_PAGE_SIZE,
          offset: pageParam,
          filters: buildExpensePageFilters(filters),
        });
        const results = rows.map(mapPageDataExpense);
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
        if (invalidPage && pageParam > (usePageData ? 0 : 1)) {
          return {count: 0, next: null, previous: null, results: []};
        }
        throw error;
      }
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

  const expenses = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<number | string>();
    const merged: Expense[] = [];
    for (const page of pages) {
      for (const row of page.results) {
        const key = row?.id || row?.document_no;
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
    expenses,
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

export function useExpenseTypesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.expenseTypes(),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => ExpenseServices.getExpenseTypes(),
  });
}

export function useInvalidateExpenses() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: [...queryKeys.all, 'expenses'],
    });
}
