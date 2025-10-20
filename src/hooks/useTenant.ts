import {useState, useEffect, useCallback} from 'react';
import {
  getCurrentTenant,
  setCurrentTenant,
  validateTenantURL,
  getFallbackTenant,
} from '../utils/tenantHelper';
import Toast from 'react-native-toast-message';

export function useTenant() {
  const [currentTenant, setTenant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize tenant
  useEffect(() => {
    initializeTenant();
  }, []);

  const initializeTenant = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to get current tenant
      const tenant = await getCurrentTenant();

      if (tenant) {
        // Validate existing tenant
        const isValid = await validateTenantURL(tenant);
        if (isValid) {
          setTenant(tenant);
          return;
        }
      }

      // Try fallback tenant
      const fallbackTenant = await getFallbackTenant();
      if (fallbackTenant) {
        setTenant(fallbackTenant);
      } else {
        setError(new Error('Unable to connect to any tenant'));
        Toast.show({
          type: 'error',
          text1: 'Connection Error',
          text2: 'Unable to connect to server',
          position: 'bottom',
        });
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeTenant = useCallback(async (newTenant: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate new tenant
      const isValid = await validateTenantURL(newTenant);
      if (!isValid) {
        throw new Error('Unable to connect to specified tenant');
      }

      // Update tenant
      await setCurrentTenant(newTenant);
      setTenant(newTenant);

      Toast.show({
        type: 'success',
        text1: 'Tenant Updated',
        text2: 'Successfully connected to new tenant',
        position: 'bottom',
      });
    } catch (err) {
      setError(err as Error);
      Toast.show({
        type: 'error',
        text1: 'Tenant Update Failed',
        text2: (err as Error).message,
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    currentTenant,
    isLoading,
    error,
    changeTenant,
    retryConnection: initializeTenant,
  };
}
