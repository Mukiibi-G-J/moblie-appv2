import {Platform, StatusBar} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';

export function getScreenTopInset(
  insets: EdgeInsets,
  minPadding = 12,
): number {
  return Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    minPadding,
  );
}

export function getScreenBottomInset(
  insets: EdgeInsets,
  minPadding = 0,
): number {
  return Math.max(insets.bottom, minPadding);
}
