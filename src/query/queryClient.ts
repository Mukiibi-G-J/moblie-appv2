import {QueryClient} from '@tanstack/react-query';
import {clearPageControlIdCache} from '../services/pageDataService';

let appQueryClient: QueryClient | null = null;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        // Keep lists warm so reopening Screens feels instant while online.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}

export function getQueryClient(): QueryClient {
  if (!appQueryClient) {
    appQueryClient = createAppQueryClient();
  }
  return appQueryClient;
}

/** Clear all cached queries (logout / tenant switch). */
export function clearQueryCache(): void {
  clearPageControlIdCache();
  getQueryClient().clear();
}

/** Invalidate after branch switch so lists refetch for the new branch. */
export function invalidateQueryCache(): void {
  getQueryClient().invalidateQueries();
}
