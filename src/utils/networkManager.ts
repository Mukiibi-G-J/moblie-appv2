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
            text1: 'You’re offline',
            text2: 'Check your connection and try again.',
            visibilityTime: 5000,
        });
    }

    private handleApiError(error: any) {
        if (error?.code === 'SIMULATED_OFFLINE') {
            return;
        }
        if (!error.response) {
            // Network error
            Toast.show({
                type: 'error',
                text1: 'Can’t reach the server',
                text2: 'Check your connection and try again.',
                visibilityTime: 5000,
            });
            return;
        }

        // Handle different error status codes
        switch (error.response.status) {
            case 401:
                Toast.show({
                    type: 'error',
                    text1: 'Your session ended',
                    text2: 'Sign in again.',
                    visibilityTime: 5000,
                });
                break;
            case 402:
                // Subscription expired is handled by the axios interceptor navigation.
                // Avoid showing a generic error toast here (would conflict with redirect).
                break;
            case 403:
                Toast.show({
                    type: 'error',
                    text1: 'You don’t have permission for this',
                    visibilityTime: 5000,
                });
                break;
            case 404:
                Toast.show({
                    type: 'error',
                    text1: 'That record wasn’t found',
                    visibilityTime: 5000,
                });
                break;
            case 500:
                Toast.show({
                    type: 'error',
                    text1: 'Something went wrong on the server',
                    text2: 'Try again in a moment.',
                    visibilityTime: 5000,
                });
                break;
            default:
                Toast.show({
                    type: 'error',
                    text1: 'Something went wrong',
                    text2: 'Try again.',
                    visibilityTime: 5000,
                });
        }
    }
}

export default NetworkManager;