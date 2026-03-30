import NetInfo from "@react-native-community/netinfo";
import Toast from 'react-native-toast-message';
import { axiosInstance } from '../axios/axios';

class NetworkManager {
    private static instance: NetworkManager;
    private isConnected: boolean = true;

    private constructor() {
        this.setupNetworkListeners();
        this.setupAxiosInterceptors();
    }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    private setupNetworkListeners() {
        NetInfo.addEventListener(state => {
            if (!state.isConnected && this.isConnected) {
                this.showNetworkError();
            }
            this.isConnected = !!state.isConnected;
        });
    }

    private setupAxiosInterceptors() {
        // Request Interceptor
        axiosInstance.interceptors.request.use(
            async config => {
                const networkState = await NetInfo.fetch();
                if (!networkState.isConnected) {
                    throw new Error('No Internet Connection');
                }
                return config;
            },
            error => {
                return Promise.reject(error);
            }
        );

        // Response Interceptor
        axiosInstance.interceptors.response.use(
            response => response,
            error => {
                this.handleApiError(error);
                return Promise.reject(error);
            }
        );
    }

    private showNetworkError() {
        Toast.show({
            type: 'error',
            text1: 'No Internet Connection',
            text2: 'Please check your connection and try again',
            position: 'bottom',
            visibilityTime: 4000,
        });
    }

    private handleApiError(error: any) {
        if (!error.response) {
            // Network error
            Toast.show({
                type: 'error',
                text1: 'Connection Error',
                text2: 'Unable to connect to the server. Please check your internet connection.',
                position: 'bottom',
                visibilityTime: 4000,
            });
            return;
        }

        // Handle different error status codes
        switch (error.response.status) {
            case 401:
                Toast.show({
                    type: 'error',
                    text1: 'Session Expired',
                    text2: 'Please sign in again',
                    position: 'bottom',
                });
                break;
            case 402:
                // Subscription expired is handled by the axios interceptor navigation.
                // Avoid showing a generic error toast here (would conflict with redirect).
                break;
            case 403:
                Toast.show({
                    type: 'error',
                    text1: 'Access Denied',
                    text2: 'You don\'t have permission to perform this action',
                    position: 'bottom',
                });
                break;
            case 404:
                Toast.show({
                    type: 'error',
                    text1: 'Not Found',
                    text2: 'The requested resource was not found',
                    position: 'bottom',
                });
                break;
            case 500:
                Toast.show({
                    type: 'error',
                    text1: 'Server Error',
                    text2: 'Something went wrong on our end. Please try again later.',
                    position: 'bottom',
                });
                break;
            default:
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'An unexpected error occurred. Please try again.',
                    position: 'bottom',
                });
        }
    }
}

export default NetworkManager;