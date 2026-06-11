// NavigationService.js
import { createRef } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createRef<NavigationContainerRef<any>>();

export function navigate(name: string, params?: any) {
  const dispatch = () => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.navigate(name as never, params as never);
      return true;
    }
    return false;
  };

  if (dispatch()) {
    return;
  }

  // NavigationContainer may not be ready on the first 402 after login.
  setTimeout(() => {
    dispatch();
  }, 100);
}

/** Avoids dispatching GO_BACK when there is no previous screen (dev warning + no-op). */
export function safeGoBack(
  navigation: {
    canGoBack(): boolean;
    goBack(): void;
    navigate(name: string, params?: object): void;
  },
  fallbackRoute?: string,
): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  if (fallbackRoute) {
    navigation.navigate(fallbackRoute);
  }
}
