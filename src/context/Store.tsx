import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter} from 'react-native';
import {loginUser} from '../services/auth.services';
import {jwtDecode} from 'jwt-decode';
import Toast from 'react-native-toast-message';
import {AuthState, DecodedToken} from '../types/auth';
import {AUTH_FORCE_LOGOUT_EVENT} from '../utils/authEvents';

export interface AppContextType {
  auth: AuthState;
  login: (userCredentials: {
    email: string;
    password: string;
    tenant?: string;
  }) => Promise<any>;
  logout: () => Promise<void>;
  clearAuthState: () => void;
}
const AppContext = createContext<AppContextType | null>(null);
const SelectedTabContext = createContext<string>('Home');
const SetSelectedTabContext = createContext<(tab: string) => void>(() => {});

const getEmptyAuthState = (): AuthState => ({
  user_id: '',
  username: '',
  full_name: '',
  email: '',
  phone: undefined,
  verified: undefined,
  is_superuser: false,
  authority: [],
  role_center_modules: [],
  roles: [],
  user_groups: [],
  permission_sets: [],
  page_permissions: {},
});

export const AppProvider = ({children}: {children: React.ReactNode}) => {
  const [auth, setAuth] = useState<AuthState>(getEmptyAuthState());
  const [cartItems, setCartItems] = useState([]);
  const [selectedTab, setSelectedTab] = useState('Home');

  const clearAuthState = useCallback(() => {
    // Clear auth state without clearing AsyncStorage (for token expiry scenarios)
    setAuth(getEmptyAuthState());

    // Clear cart items from state
    setCartItems([]);
  }, []);

  /**
   * Map decoded JWT token to AuthState
   * Extracts all permission fields from the token
   */
  const mapTokenToAuthState = useCallback((decodedToken: DecodedToken): AuthState => {
    return {
      user_id: decodedToken.user_id?.toString() || '',
      username: decodedToken.username || '',
      full_name: decodedToken.full_name || '',
      email: decodedToken.email || '',
      phone: decodedToken.phone,
      verified: decodedToken.verified,
      is_superuser: decodedToken.is_superuser || false,
      // Legacy authority (backward compatibility)
      authority: decodedToken.authority || [],
      // Layer 1: Role Center (Module Visibility)
      role_center_modules: decodedToken.role_center_modules || [],
      // Layer 2 & 3: Permission Sets & Page Permissions
      roles: decodedToken.roles || [],
      user_groups: decodedToken.user_groups || [],
      permission_sets: decodedToken.permission_sets || [],
      page_permissions: decodedToken.page_permissions || {},
    };
  }, []);

  // Check for accessToken in AsyncStorage on mount
  useEffect(() => {
    const checkAccessToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        try {
          const decodedToken = jwtDecode(token) as any;
          console.log('Raw existing token:', decodedToken);

          // Check if token is expired
          const currentTime = Date.now() / 1000;
          if (decodedToken.exp && decodedToken.exp < currentTime) {
            console.log('Token is expired, clearing auth state');
            clearAuthState();
            await AsyncStorage.removeItem('accessToken');
            return;
          }

          // Map the decoded token to our expected structure
          const user = mapTokenToAuthState(decodedToken as DecodedToken);

          console.log('Found existing token, setting auth to:', user);
          console.log('Permission data:', {
            role_center_modules: user.role_center_modules,
            permission_sets: user.permission_sets,
            page_permissions: Object.keys(user.page_permissions || {}),
          });
          setAuth(user);
        } catch (error) {
          console.log('Error decoding token, clearing auth state:', error);
          clearAuthState();
          await AsyncStorage.removeItem('accessToken');
        }
      } else {
        console.log('No existing token found');
      }
    };
    checkAccessToken();
  }, [clearAuthState, mapTokenToAuthState]);

  // Load cart items from AsyncStorage on mount
  useEffect(() => {
    const loadCartItems = async () => {
      const storedCartItems = await AsyncStorage.getItem('cartItems');
      if (storedCartItems) {
        setCartItems(JSON.parse(storedCartItems)); // Parse the JSON string
      }
    };
    loadCartItems();
  }, []);

  const login = useCallback(async (userCredentials: {
    email: string;
    password: string;
    tenant?: string;
  }) => {
    try {
      // Get tenant from credentials or from storage and trim it
      const tenant =
        userCredentials.tenant || (await AsyncStorage.getItem('tenant'));
      const cleanTenant = tenant?.trim();
      const userData = await loginUser({
        ...userCredentials,
        tenant: cleanTenant || undefined,
      });
      if (userData && userData.access) {
        const decodedToken = jwtDecode(userData.access) as DecodedToken;
        console.log('Raw decoded token:', decodedToken);

        // Map the decoded token to our expected structure
        const user = mapTokenToAuthState(decodedToken);

        console.log('Mapped user data:', user);
        console.log('Permission data:', {
          role_center_modules: user.role_center_modules,
          permission_sets: user.permission_sets,
          page_permissions: Object.keys(user.page_permissions || {}),
        });

        // Store token first
        await AsyncStorage.setItem('accessToken', userData.access);

        // Update auth state
        setAuth(user);
        console.log('Auth state set to:', user);

        // Force a re-render by updating state again
        setTimeout(() => {
          setAuth(prevAuth => ({...prevAuth, ...user}));
        }, 50);

        return userData; // Return userData for further checks in SignIn
      } else {
        throw new Error('Invalid login response'); // Throw an error if response is invalid
      }
    } catch (error) {
      throw error; // Rethrow the error to be caught in SignIn
    }
  }, [clearAuthState, mapTokenToAuthState]);

  const logout = useCallback(async () => {
    // Clear auth state
    setAuth(getEmptyAuthState());

    // Clear stored data
    await AsyncStorage.removeItem('accessToken');
    setCartItems([]);
    await AsyncStorage.removeItem('cartItems');

    // Force a re-render to trigger navigation changes
    setTimeout(() => {
      setAuth(prevAuth => ({...prevAuth}));
    }, 100);
  }, []);

  // Ensure axios/network layer can force logout (e.g. on 401).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_FORCE_LOGOUT_EVENT, () => {
      logout();
    });
    return () => {
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appContextValue = useMemo(
    () => ({
      auth,
      login,
      logout,
      clearAuthState,
    }),
    [auth, clearAuthState, login, logout],
  );

  return (
    <AppContext.Provider value={appContextValue}>
      <SelectedTabContext.Provider value={selectedTab}>
        <SetSelectedTabContext.Provider value={setSelectedTab}>
          {children}
        </SetSelectedTabContext.Provider>
      </SelectedTabContext.Provider>
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  return useContext(AppContext);
};

export const useSelectedTab = () => {
  return useContext(SelectedTabContext);
};

export const useSetSelectedTab = () => {
  return useContext(SetSelectedTabContext);
};

export const useTabContext = () => {
  return {
    selectedTab: useSelectedTab(),
    setSelectedTab: useSetSelectedTab(),
  };
};

// New useAuth hook
export const useAuth = () => {
  const {auth} = useAppContext() as AppContextType;
  const hasAccessToken = auth.user_id && auth.username;
  return {accessToken: hasAccessToken, auth}; // Return accessToken status
};
