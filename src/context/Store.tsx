import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../services/auth.services';
import { jwtDecode } from 'jwt-decode';
import Toast from 'react-native-toast-message';

export interface AppContextType {
    auth: { user_id: string, username: string, first_name: string, email: string };
    login: (userCredentials: { email: string, password: string }) => Promise<any>;
    logout: () => Promise<void>;
    selectedTab: string;
    setSelectedTab: (tab: string) => void;
}
interface DecodeToken {
    user_id: string
    username: string;
    first_name: string;
    email: string;
}
const AppContext = createContext < AppContextType | null > (null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const [auth, setAuth] = useState({ user_id: '', username: '', first_name: '', email: '' });
    const [cartItems, setCartItems] = useState([]);
    const [selectedTab, setSelectedTab] = useState('home');

    // Check for accessToken in AsyncStorage on mount
    useEffect(() => {
        const checkAccessToken = async () => {
            const token = await AsyncStorage.getItem('accessToken');
            if (token) {
                const user = jwtDecode(token) as DecodeToken;
                setAuth(user);
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


    const login = async (userCredentials: { email: string, password: string }) => {
        try {
            const userData = await loginUser(userCredentials);
            if (userData && userData.access) {
                const user = jwtDecode(userData.access) as DecodeToken
                setAuth(user);
                await AsyncStorage.setItem('accessToken', userData.access);
                return userData; // Return userData for further checks in SignIn
            } else {
                throw new Error('Invalid login response'); // Throw an error if response is invalid
            }
        } catch (error) {
            throw error; // Rethrow the error to be caught in SignIn
        }
    };

    const logout = async () => {
        setAuth({ user_id: '', username: '', first_name: '', email: '' });
        await AsyncStorage.removeItem('accessToken');
        setCartItems([]);
        await AsyncStorage.removeItem('cartItems')
    };

    return (
        <AppContext.Provider value={{ auth, login, logout, selectedTab, setSelectedTab }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    return useContext(AppContext);
};

// New useAuth hook
export const useAuth = () => {
    const { auth } = useAppContext() as AppContextType;
    return { accessToken: auth.user_id ? true : false, auth }; // Return accessToken status
};

