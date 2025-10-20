import React, {createContext, useContext, useReducer, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SearchMode = 'barcode' | 'realtime';

interface SearchModeState {
  searchMode: SearchMode;
  isLoading: boolean;
}

type SearchModeAction =
  | {type: 'SET_SEARCH_MODE'; payload: SearchMode}
  | {type: 'SET_LOADING'; payload: boolean};

const initialState: SearchModeState = {
  searchMode: 'barcode', // Default to barcode mode
  isLoading: true,
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
    default:
      return state;
  }
};

export const SearchModeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(searchModeReducer, initialState);

  // Load search mode from AsyncStorage on app start
  useEffect(() => {
    const loadSearchMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('searchMode');
        if (
          savedMode &&
          (savedMode === 'barcode' || savedMode === 'realtime')
        ) {
          dispatch({type: 'SET_SEARCH_MODE', payload: savedMode as SearchMode});
        } else {
          dispatch({type: 'SET_SEARCH_MODE', payload: 'barcode'});
        }
      } catch (error) {
        console.error('Error loading search mode:', error);
        dispatch({type: 'SET_SEARCH_MODE', payload: 'barcode'});
      }
    };

    loadSearchMode();
  }, []);

  // Save search mode to AsyncStorage when it changes
  useEffect(() => {
    if (!state.isLoading) {
      const saveSearchMode = async () => {
        try {
          await AsyncStorage.setItem('searchMode', state.searchMode);
        } catch (error) {
          console.error('Error saving search mode:', error);
        }
      };

      saveSearchMode();
    }
  }, [state.searchMode, state.isLoading]);

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

