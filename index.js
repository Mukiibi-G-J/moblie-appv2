/**
 * @format
 */

// jwt-decode depends on a global atob() implementation.
if (typeof global.atob !== 'function') {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  global.atob = function atob(input) {
    const str = String(input).replace(/=+$/, '');
    if (str.length % 4 === 1) {
      throw new Error('Invalid base64 string.');
    }

    let output = '';
    let bc = 0;
    let bs;
    let buffer;
    let idx = 0;

    while ((buffer = str.charAt(idx++))) {
      buffer = chars.indexOf(buffer);
      if (buffer === -1) {
        continue;
      }
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }

    return output;
  };
}

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Firebase Messaging requires GoogleService-Info.plist + FirebaseApp.configure().
// Without that (common on fresh iOS builds), calling messaging() crashes startup.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {getApps} = require('@react-native-firebase/app');
  if (getApps().length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messaging = require('@react-native-firebase/messaging').default;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {displayLocalNotification} = require('./src/services/NotificationService');

    messaging().setBackgroundMessageHandler(async remoteMessage => {
      const title =
        remoteMessage.notification?.title ??
        remoteMessage.data?.title ??
        'Zentro';
      const body =
        remoteMessage.notification?.body ?? remoteMessage.data?.body ?? '';

      if (title || body) {
        await displayLocalNotification(
          String(title),
          String(body),
          remoteMessage.data,
        );
      }
    });
  } else {
    console.warn(
      '[FCM] Skipped background handler — Firebase app is not configured on iOS yet.',
    );
  }
} catch (error) {
  console.warn('[FCM] Background handler unavailable:', error);
}

AppRegistry.registerComponent(appName, () => App);
