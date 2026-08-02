import {useEffect, useRef} from 'react';
import {useAuth, useAppContext} from '../context/Store';
import {registerPushNotifications} from '../services/NotificationService';

/**
 * Initializes FCM + local notification handlers once the user is authenticated.
 */
export default function NotificationBootstrap() {
  const {accessToken} = useAuth();
  const {sessionHydrated} = useAppContext()!;
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!sessionHydrated) {
      return;
    }

    if (!accessToken) {
      initializedRef.current = false;
      return;
    }

    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void registerPushNotifications();
  }, [accessToken, sessionHydrated]);

  return null;
}
