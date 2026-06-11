import {useCallback, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {getCompanyInfo, TenantCompanyApi} from '../services/app.services';
import {useTenantContext} from '../context/TenantContext';
import {formatTenantLabel} from '../utils/tenantLabel';
import {isSubscriptionExpiredError} from '../utils/subscriptionExpired';

/**
 * Loads tenant company from GET /api/sales/company-info/ on screen focus.
 * On error, keeps the last successful payload so Home/More labels do not flicker away.
 */
export function useCompanyInfo() {
  const {currentTenant} = useTenantContext();
  const [data, setData] = useState<TenantCompanyApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (getCancelled?: () => boolean) => {
    const isCancelled = () => getCancelled?.() === true;
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyInfo();
      if (isCancelled()) {
        return;
      }
      if (res?.data?.company) {
        setData(res.data.company);
      }
    } catch (e: unknown) {
      if (isCancelled()) {
        return;
      }
      if (isSubscriptionExpiredError(e)) {
        return;
      }
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as {message?: string}).message)
          : 'Failed to load company info';
      setError(message);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const refetch = useCallback(() => load(), [load]);

  const storeLabel = useMemo(() => {
    const name = data?.name?.trim();
    if (name) {
      return name;
    }
    return formatTenantLabel(currentTenant);
  }, [data, currentTenant]);

  return {data, loading, error, storeLabel, refetch};
}
