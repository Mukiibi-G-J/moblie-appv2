import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import {OfflineBanner} from '../Components/OfflineBanner';
import {setNetInfoConnected} from '../utils/posConnectivity';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: null,
  type: null,
});

export function NetworkProvider({children}: {children: React.ReactNode}) {
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
  });

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const newState = {
        isConnected: !!state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      };
      setNetworkState(newState);
      setNetInfoConnected(newState.isConnected);

      if (!state.isConnected) {
        setWasOffline(true);
      } else if (wasOffline) {
        setWasOffline(false);
        Toast.show({
          type: 'success',
          text1: 'Connected',
          text2: 'Internet connection restored',
          position: 'top',
          visibilityTime: 2000,
        });
      }
    });

    return () => unsubscribe();
  }, [wasOffline]);

  return (
    <NetworkContext.Provider value={networkState}>
      <OfflineBanner />
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
