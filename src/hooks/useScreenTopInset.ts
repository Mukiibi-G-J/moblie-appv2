import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getScreenBottomInset, getScreenTopInset} from '../utils/safeArea';

export function useScreenTopInset(minPadding = 12): number {
  const insets = useSafeAreaInsets();
  return getScreenTopInset(insets, minPadding);
}

export function useScreenBottomInset(minPadding = 0): number {
  const insets = useSafeAreaInsets();
  return getScreenBottomInset(insets, minPadding);
}
