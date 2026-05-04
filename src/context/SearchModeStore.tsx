import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
} from 'react';
import Toast from 'react-native-toast-message';
import {
  fetchMobileSettings,
  patchMobileSettings,
  SearchMode,
  MobileSettingsPatchPayload,
} from '../services/mobileSettings.service';

interface SearchModeState {
  searchMode: SearchMode;
  isLoading: boolean;
  barcodeScannerEnabled: boolean;
  barcodeBeepEnabled: boolean;
}

type SearchModeAction =
  | {type: 'SET_SEARCH_MODE'; payload: SearchMode}
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_BARCODE_SCANNER_ENABLED'; payload: boolean}
  | {type: 'SET_BARCODE_BEEP_ENABLED'; payload: boolean}
  | {
      type: 'SET_SETTINGS';
      payload: {
        searchMode: SearchMode;
        barcodeScannerEnabled: boolean;
        barcodeBeepEnabled: boolean;
      };
    };

const initialState: SearchModeState = {
  searchMode: 'barcode', // Default to barcode mode
  isLoading: true,
  barcodeScannerEnabled: false,
  barcodeBeepEnabled: false,
};

const SearchModeContext = createContext<{
  state: SearchModeState;
  dispatch: React.Dispatch<SearchModeAction>;
} | null>(null);

const searchModeReducer = (
  state: SearchModeState,
  action: SearchModeAction,
): SearchModeState => {
  switch (action.type) {
    case 'SET_SEARCH_MODE':
      return {
        ...state,
        searchMode: action.payload,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_BARCODE_SCANNER_ENABLED':
      return {
        ...state,
        barcodeScannerEnabled: action.payload,
      };
    case 'SET_BARCODE_BEEP_ENABLED':
      return {
        ...state,
        barcodeBeepEnabled: action.payload,
      };
    case 'SET_SETTINGS':
      return {
        ...state,
        ...action.payload,
        isLoading: false,
      };
    default:
      return state;
  }
};

export const SearchModeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(searchModeReducer, initialState);
  const lastUpdatedAtRef = useRef<string | undefined>(undefined);
  const lastSyncedRef = useRef<{
    searchMode: SearchMode;
    barcodeScannerEnabled: boolean;
    barcodeBeepEnabled: boolean;
  } | null>(null);
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    const loadSettingsFromBackend = async () => {
      try {
        const settings = await fetchMobileSettings();
        const normalized = {
          searchMode: settings.searchMode,
          barcodeScannerEnabled: settings.barcodeScannerEnabled,
          barcodeBeepEnabled: settings.barcodeBeepEnabled,
        };
        dispatch({type: 'SET_SETTINGS', payload: normalized});
        lastSyncedRef.current = normalized;
        lastUpdatedAtRef.current = settings.updatedAt;
      } catch (error) {
        console.error('Error loading mobile settings from backend:', error);
        dispatch({type: 'SET_LOADING', payload: false});
      }
    };

    loadSettingsFromBackend();
  }, []);

  useEffect(() => {
    if (state.isLoading) {
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const current = {
      searchMode: state.searchMode,
      barcodeScannerEnabled: state.barcodeScannerEnabled,
      barcodeBeepEnabled: state.barcodeBeepEnabled,
    };

    const last = lastSyncedRef.current;
    if (
      last &&
      last.searchMode === current.searchMode &&
      last.barcodeScannerEnabled === current.barcodeScannerEnabled &&
      last.barcodeBeepEnabled === current.barcodeBeepEnabled
    ) {
      return;
    }

    const syncSettingsToBackend = async () => {
      try {
        const payload: MobileSettingsPatchPayload = {
          searchMode: current.searchMode,
          barcodeScannerEnabled: current.barcodeScannerEnabled,
          barcodeBeepEnabled: current.barcodeBeepEnabled,
        };
        const updated = await patchMobileSettings(payload, lastUpdatedAtRef.current);
        lastSyncedRef.current = {
          searchMode: updated.searchMode,
          barcodeScannerEnabled: updated.barcodeScannerEnabled,
          barcodeBeepEnabled: updated.barcodeBeepEnabled,
        };
        lastUpdatedAtRef.current = updated.updatedAt;
      } catch (error: any) {
        const conflictCode = error?.response?.data?.code;
        if (error?.response?.status === 409 || conflictCode === 'settings_conflict') {
          try {
            const latest = await fetchMobileSettings();
            skipNextSyncRef.current = true;
            dispatch({
              type: 'SET_SETTINGS',
              payload: {
                searchMode: latest.searchMode,
                barcodeScannerEnabled: latest.barcodeScannerEnabled,
                barcodeBeepEnabled: latest.barcodeBeepEnabled,
              },
            });
            lastSyncedRef.current = {
              searchMode: latest.searchMode,
              barcodeScannerEnabled: latest.barcodeScannerEnabled,
              barcodeBeepEnabled: latest.barcodeBeepEnabled,
            };
            lastUpdatedAtRef.current = latest.updatedAt;
            Toast.show({
              type: 'info',
              text1: 'Settings updated',
              text2: 'Latest settings were loaded from server.',
              position: 'bottom',
            });
          } catch (refreshError) {
            console.error('Error refreshing settings after conflict:', refreshError);
          }
          return;
        }
        console.error('Error syncing mobile settings to backend:', error);
      }
    };

    syncSettingsToBackend();
  }, [
    state.searchMode,
    state.barcodeScannerEnabled,
    state.barcodeBeepEnabled,
    state.isLoading,
  ]);

  useEffect(() => {
    if (!state.isLoading && !lastSyncedRef.current) {
      lastSyncedRef.current = {
        searchMode: state.searchMode,
        barcodeScannerEnabled: state.barcodeScannerEnabled,
        barcodeBeepEnabled: state.barcodeBeepEnabled,
      };
    }
  }, [state.isLoading, state.searchMode, state.barcodeScannerEnabled, state.barcodeBeepEnabled]);

  return (
    <SearchModeContext.Provider value={{state, dispatch}}>
      {children}
    </SearchModeContext.Provider>
  );
};

export const useSearchMode = () => {
  const context = useContext(SearchModeContext);
  if (!context) {
    throw new Error('useSearchMode must be used within a SearchModeProvider');
  }
  return context;
};

