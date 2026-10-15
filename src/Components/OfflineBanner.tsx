import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS} from '../constants';
import {
  OFFLINE_BANNER_MESSAGE,
  OFFLINE_SIMULATED_BANNER_MESSAGE,
} from '../utils/posConnectivity';
import {useOfflineOptional} from '../context/OfflineContext';

type OfflineBannerProps = {
  extraBottom?: number;
};

export function OfflineBanner({extraBottom = 0}: OfflineBannerProps) {
  const insets = useSafeAreaInsets();
  const offline = useOfflineOptional();
  const isOffline = offline ? !offline.isOnline : false;
  const isSimulated = offline?.simulateOfflinePos ?? false;
  const pending = offline?.outboxCount ?? 0;

  if (!isOffline && pending === 0) {
    return null;
  }

  const message = isOffline
    ? isSimulated
      ? OFFLINE_SIMULATED_BANNER_MESSAGE
      : OFFLINE_BANNER_MESSAGE
    : pending > 0
      ? `${pending} sale${pending === 1 ? '' : 's'} pending sync`
      : '';

  if (!message) return null;

  return (
    <View
      style={[
        styles.banner,
        {paddingTop: Math.max(insets.top, 4) + extraBottom},
      ]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 100,
  },
  text: {
    ...FONTS.body4,
    color: COLORS.white,
    textAlign: 'center',
  },
});
