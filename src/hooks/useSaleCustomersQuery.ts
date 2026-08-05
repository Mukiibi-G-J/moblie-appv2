import {useQuery, useQueryClient} from '@tanstack/react-query';
import {fetchCustomers, fetchPaymentMethods} from '../services/app.services';
import {getLocalPaymentMethods} from '../services/localData';
import {getEffectiveIsOnline} from '../utils/posConnectivity';
import {queryKeys} from '../query/keys';

/** Full first-page customer list for POS customer picker (cached). */
export function useSaleCustomersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.saleCustomers(),
    enabled,
    staleTime: 60_000,
    queryFn: () => fetchCustomers(),
  });
}

/**
 * POS payment methods: online API with React Query cache, SQLite fallback offline.
 */
export function usePosPaymentMethodsQuery(
  enabled = true,
  isOnline?: boolean,
) {
  const online = isOnline ?? getEffectiveIsOnline();
  return useQuery({
    queryKey: [...queryKeys.paymentMethods(), online ? 'online' : 'offline'],
    enabled,
    staleTime: online ? 5 * 60_000 : Infinity,
    queryFn: async () => {
      if (!online) {
        return getLocalPaymentMethods();
      }
      try {
        const methods = await fetchPaymentMethods();
        if (methods?.length) {
          return methods;
        }
        return getLocalPaymentMethods();
      } catch {
        return getLocalPaymentMethods();
      }
    },
  });
}

export function useInvalidateSaleCustomers() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: queryKeys.saleCustomers(),
    });
}
