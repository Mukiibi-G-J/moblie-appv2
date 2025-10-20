import React, {createContext, useContext, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loginUser} from '../services/auth.services';
import {jwtDecode} from 'jwt-decode';
import Toast from 'react-native-toast-message';

export interface AppContextType {
  auth: {
    user_id: string;
    username: string;
    full_name: string;
    email: string;
    authority: string[];
  };
  login: (userCredentials: {email: string; password: string}) => Promise<any>;
  logout: () => Promise<void>;
  clearAuthState: () => void;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}
interface DecodeToken {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  authority: string[];
}
const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({children}: {children: React.ReactNode}) => {
  const [auth, setAuth] = useState({
    user_id: '',
    username: '',
    full_name: '',
    email: '',
    authority: [] as string[],
  });
  const [cartItems, setCartItems] = useState([]);
  const [selectedTab, setSelectedTab] = useState('home');

  const clearAuthState = () => {
    // Clear auth state without clearing AsyncStorage (for token expiry scenarios)
    setAuth({
      user_id: '',
      username: '',
      full_name: '',
      email: '',
      authority: [],
    });

    // Clear cart items from state
    setCartItems([]);
  };

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
          const user: DecodeToken = {
            user_id:
              decodedToken.user_id || decodedToken.sub || decodedToken.id || '',
            username:
              decodedToken.username ||
              decodedToken.name ||
              decodedToken.user_name ||
              '',
            full_name:
              decodedToken.full_name ||
              decodedToken.name ||
              decodedToken.display_name ||
              '',
            email: decodedToken.email || '',
            authority:
              decodedToken.authority ||
              decodedToken.roles ||
              decodedToken.permissions ||
              decodedToken.groups ||
              [],
          };

          console.log('Found existing token, setting auth to:', user);
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
  }, []);

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

  const login = async (userCredentials: {email: string; password: string}) => {
    try {
      const userData = await loginUser(userCredentials);
      if (userData && userData.access) {
        const decodedToken = jwtDecode(userData.access) as any;
        console.log('Raw decoded token:', decodedToken);

        // Map the decoded token to our expected structure
        const user: DecodeToken = {
          user_id:
            decodedToken.user_id || decodedToken.sub || decodedToken.id || '',
          username:
            decodedToken.username ||
            decodedToken.name ||
            decodedToken.user_name ||
            '',
          full_name:
            decodedToken.full_name ||
            decodedToken.name ||
            decodedToken.display_name ||
            '',
          email: decodedToken.email || '',
          authority:
            decodedToken.authority ||
            decodedToken.roles ||
            decodedToken.permissions ||
            decodedToken.groups ||
            [],
        };

        console.log('Mapped user data:', user);

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
  };

  const logout = async () => {
    // Clear auth state
    setAuth({
      user_id: '',
      username: '',
      full_name: '',
      email: '',
      authority: [],
    });

    // Clear stored data
    await AsyncStorage.removeItem('accessToken');
    setCartItems([]);
    await AsyncStorage.removeItem('cartItems');

    // Force a re-render to trigger navigation changes
    setTimeout(() => {
      setAuth(prevAuth => ({...prevAuth}));
    }, 100);
  };

  return (
    <AppContext.Provider
      value={{
        auth,
        login,
        logout,
        clearAuthState,
        selectedTab,
        setSelectedTab,
      }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  return useContext(AppContext);
};

// New useAuth hook
export const useAuth = () => {
  const {auth} = useAppContext() as AppContextType;
  const hasAccessToken = auth.user_id && auth.username;
  return {accessToken: hasAccessToken, auth}; // Return accessToken status
};
