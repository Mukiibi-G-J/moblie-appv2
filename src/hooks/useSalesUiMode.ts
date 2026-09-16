import {useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAppContext} from '../context/Store';
import {useUserSetupQuery} from './useSalesQuery';
import {
  normalizeSalesUiMode,
  salesUiStorageKey,
  type SalesUiMode,
} from '../utils/salesUiMode';

export function useSalesUiMode() {
  const appContext = useAppContext();
  const userId = appContext?.auth?.user_id;
  const jwtDefault = normalizeSalesUiMode(
    appContext?.auth?.userPermissions?.defaultSalesUi,
  );
  const {data: userSetup} = useUserSetupQuery(true);
  const setupDefault = userSetup?.defaultSalesUi
    ? normalizeSalesUiMode(userSetup.defaultSalesUi)
    : jwtDefault;

  const [override, setOverride] = useState<SalesUiMode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = salesUiStorageKey(userId);
    AsyncStorage.getItem(key)
      .then(stored => {
        if (cancelled) {
          return;
        }
        setOverride(stored ? normalizeSalesUiMode(stored) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setOverride(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const mode: SalesUiMode = override ?? setupDefault;
  const isPosUi = mode === 'pos';

  const setMode = useCallback(
    (next: SalesUiMode) => {
      setOverride(next);
      AsyncStorage.setItem(salesUiStorageKey(userId), next).catch(() => {});
    },
    [userId],
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'pos' ? 'phone' : 'pos');
  }, [mode, setMode]);

  return {mode, isPosUi, ready, setMode, toggleMode};
}
