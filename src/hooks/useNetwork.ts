import {useState, useEffect, useCallback} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {AxiosError, AxiosResponse} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import {axiosInstance} from '../axios/axios';
import {
  validateTenantURL,
  getFallbackTenant,
  extractTenantFromURL,
  setCurrentTenant,
} from '../utils/tenantHelper';

interface UseNetworkOptions {
  cacheKey?: string;
  retryCount?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

interface NetworkState {
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
}

export function useNetwork<T>(
  apiCall: () => Promise<AxiosResponse<T>>,
  options: UseNetworkOptions = {},
): NetworkState & {data: T | null} {
  const {
    cacheKey,
    retryCount = 3,
    retryDelay = 1000,
    onError,
    onOffline,
    onOnline,
  } = options;

  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Cache management
  const saveToCache = async (data: T) => {
    if (cacheKey) {
      try {
        await AsyncStorage.setItem(
          `network_cache_${cacheKey}`,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          }),
        );
      } catch (e) {
        console.error('Cache save error:', e);
      }
    }
  };

  const loadFromCache = async (): Promise<T | null> => {
    if (!cacheKey) return null;
    try {
      const cached = await AsyncStorage.getItem(`network_cache_${cacheKey}`);
      if (cached) {
        const {data, timestamp} = JSON.parse(cached);
        // Cache expires after 1 hour
        if (Date.now() - timestamp < 3600000) {
          return data;
        }
      }
    } catch (e) {
      console.error('Cache load error:', e);
    }
    return null;
  };

  // Network status monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = !!state.isConnected;
      setIsConnected(isConnected);

      if (isConnected) {
        onOnline?.();
      } else {
        onOffline?.();
        Toast.show({
          type: 'error',
          text1: 'No Internet Connection',
          text2: 'Using cached data if available',
          position: 'bottom',
        });
      }
    });

    return () => unsubscribe();
  }, [onOffline, onOnline]);

  // Handle tenant validation and fallback
  const handleTenantValidation = async (): Promise<boolean> => {
    const currentURL = axiosInstance.defaults.baseURL || '';
    const currentTenant = extractTenantFromURL(currentURL);

    if (!currentTenant) {
      const fallbackTenant = await getFallbackTenant();
      if (fallbackTenant) {
        await setCurrentTenant(fallbackTenant);
        return true;
      }
      return false;
    }

    const isValid = await validateTenantURL(currentTenant);
    if (!isValid) {
      const fallbackTenant = await getFallbackTenant();
      if (fallbackTenant) {
        await setCurrentTenant(fallbackTenant);
        return true;
      }
    }

    return isValid;
  };

  // Main fetch function
  const fetchData = async (isRetry = false): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate tenant URL and try fallback if needed
      const isValidTenant = await handleTenantValidation();
      if (!isValidTenant) {
        throw new Error(
          'Unable to connect to server. Please check your tenant configuration.',
        );
      }

      const response = await apiCall();
      setData(response.data);
      await saveToCache(response.data);
      setRetryAttempt(0);
    } catch (err) {
      const error = err as AxiosError;
      console.error('Network request failed:', error);

      // Handle offline and DNS resolution scenarios
      if (
        !isConnected ||
        error.message === 'Network Error' ||
        error.message?.includes('Unable to resolve host')
      ) {
        // Show appropriate error message based on error type
        let errorMessage = '';
        let errorDetail = '';

        if (!isConnected) {
          errorMessage = 'You are offline';
          errorDetail = 'Please check your internet connection';
        } else if (error.message?.includes('Unable to resolve host')) {
          errorMessage = 'Unable to connect to server';
          errorDetail = 'Please check your tenant URL';
        } else {
          errorMessage = 'Network connection lost';
          errorDetail = 'Attempting to use cached data';
        }

        Toast.show({
          type: 'error',
          text1: errorMessage,
          text2: errorDetail,
          position: 'bottom',
          visibilityTime: 4000,
          autoHide: false,
        });

        // Try to use cached data
        const cachedData = await loadFromCache();
        if (cachedData) {
          setData(cachedData);
          Toast.show({
            type: 'info',
            text1: 'Offline Mode',
            text2: 'Showing cached data',
            position: 'bottom',
          });
        } else {
          setError(
            new Error(
              'No cached data available. Please check your connection and tenant URL.',
            ),
          );
        }
        return;
      }

      // Handle retry logic
      if (isRetry && retryAttempt < retryCount) {
        setTimeout(() => {
          setRetryAttempt(prev => prev + 1);
          fetchData(true);
        }, retryDelay * (retryAttempt + 1));
        return;
      }

      setError(error as Error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Retry function
  const retry = useCallback(async () => {
    setRetryAttempt(0);
    await fetchData(true);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    data,
    retry,
  };
}

// Helper hook for simple GET requests
export function useNetworkGet<T>(url: string, options?: UseNetworkOptions) {
  return useNetwork<T>(() => axiosInstance.get(url), options);
}

// Helper hook for POST requests
export function useNetworkPost<T, D>(
  url: string,
  data: D,
  options?: UseNetworkOptions,
) {
  return useNetwork<T>(() => axiosInstance.post(url, data), options);
}
