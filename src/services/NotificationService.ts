import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, {AndroidImportance, EventType} from '@notifee/react-native';
import {PermissionsAndroid, Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {navigate} from '../hooks/NavigationService';
import {createAxiosInstance} from '../axios/axios';
export const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
export const DEFAULT_NOTIFICATION_CHANNEL_ID = 'zentro-default';

let listenersRegistered = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return Boolean(await getStoredFcmToken());
      }
    }
    return true;
  }

  const authStatus = await messaging().requestPermission();  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function ensureDefaultChannel(): Promise<string> {
  if (Platform.OS !== 'android') {
    return DEFAULT_NOTIFICATION_CHANNEL_ID;
  }

  return notifee.createChannel({
    id: DEFAULT_NOTIFICATION_CHANNEL_ID,
    name: 'Zentro Alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function displayLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const channelId = await ensureDefaultChannel();

  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId,
      pressAction: {id: 'default'},
      smallIcon: 'ic_launcher',
    },
  });
}

async function persistFcmToken(token: string): Promise<void> {
  await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
}

export async function getStoredFcmToken(): Promise<string | null> {
  return AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
}

export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await persistFcmToken(token);
    }
    return token;
  } catch (error) {
    console.warn('[notifications] Failed to get FCM token:', error);
    return null;
  }
}

function navigateFromNotificationData(
  data?: FirebaseMessagingTypes.RemoteMessage['data'],
): void {
  if (!data) {
    return;
  }

  const screen = data.screen;
  if (typeof screen === 'string' && screen.length > 0) {
    navigate(screen);
  }
}

export async function registerPushTokenWithBackend(
  token: string,
  deviceId: string,
): Promise<void> {
  try {
    const tenant = await AsyncStorage.getItem('tenant');
    const api = createAxiosInstance(tenant || undefined);
    await api.post('/api/auth/device-push-token/', {
      fcm_token: token,
      device_id: deviceId,
      platform: Platform.OS,
    });
    console.log('[notifications] Registered FCM token with backend');
  } catch (error: any) {
    const status = error?.response?.status;
    const detail = error?.response?.data ?? error?.message;
    console.warn(
      '[notifications] Failed to register token with backend:',
      status,
      detail,
    );
  }
}

/** Sync stored FCM token to backend (safe to call after login / app reload). */
export async function syncDevicePushTokenWithBackend(): Promise<void> {
  const token = (await getFcmToken()) || (await getStoredFcmToken());
  if (!token) {
    return;
  }
  const deviceId = await DeviceInfo.getUniqueId();
  await registerPushTokenWithBackend(token, deviceId);
}

async function handleRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const title =
    remoteMessage.notification?.title ?? remoteMessage.data?.title ?? 'Zentro';
  const body =
    remoteMessage.notification?.body ?? remoteMessage.data?.body ?? '';

  if (title || body) {
    await displayLocalNotification(
      String(title),
      String(body),
      remoteMessage.data as Record<string, string> | undefined,
    );
  }
}

function registerNotificationListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  messaging().onMessage(async remoteMessage => {
    await handleRemoteMessage(remoteMessage);
  });

  messaging().onNotificationOpenedApp(remoteMessage => {
    navigateFromNotificationData(remoteMessage.data);
  });

  messaging().onTokenRefresh(async token => {
    await persistFcmToken(token);
    const deviceId = await DeviceInfo.getUniqueId();
    await registerPushTokenWithBackend(token, deviceId);
  });

  notifee.onForegroundEvent(({type, detail}) => {
    if (type === EventType.PRESS) {
      navigateFromNotificationData(detail.notification?.data);
    }
  });
}

export async function checkInitialNotification(): Promise<void> {
  const initialNotification = await messaging().getInitialNotification();
  if (initialNotification) {
    navigateFromNotificationData(initialNotification.data);
  }

  const initialNotifee = await notifee.getInitialNotification();
  if (initialNotifee?.notification?.data) {
    navigateFromNotificationData(initialNotifee.notification.data);
  }
}

export async function registerPushNotifications(): Promise<{
  granted: boolean;
  token: string | null;
}> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return {granted: false, token: null};
  }

  await ensureDefaultChannel();
  registerNotificationListeners();

  const token = await getFcmToken();
  if (token) {
    const deviceId = await DeviceInfo.getUniqueId();
    console.log('[notifications] FCM ready', {deviceId, token});
    await registerPushTokenWithBackend(token, deviceId);
  }

  await checkInitialNotification();
  return {granted: true, token};
}

export async function sendTestNotification(): Promise<void> {
  await displayLocalNotification(
    'Zentro test',
    'Phone notifications are working on this device.',
    {screen: 'Settings'},
  );
}

export async function clearPushToken(): Promise<void> {
  try {
    await messaging().deleteToken();
  } catch {
    // Ignore when Firebase is unavailable (e.g. emulator without Play Services).
  }
  await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
}
