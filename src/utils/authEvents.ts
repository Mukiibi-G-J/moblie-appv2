import {DeviceEventEmitter} from 'react-native';

export const AUTH_FORCE_LOGOUT_EVENT = 'AUTH_FORCE_LOGOUT_EVENT';

export function forceLogout() {
  DeviceEventEmitter.emit(AUTH_FORCE_LOGOUT_EVENT);
}

