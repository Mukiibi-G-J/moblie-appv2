import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { checkAppUpdatePolicy } from '../services/appUpdatePolicy.service';
import { AppUpdateRequiredScreen } from './AppUpdateRequiredScreen';
import { COLORS } from '../constants/theme';

type Props = { children: React.ReactNode };

export function AppUpdateGate({ children }: Props) {
  const [phase, setPhase] = useState<'checking' | 'ok' | 'blocked'>(
    'checking',
  );
  const [storeUrl, setStoreUrl] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await checkAppUpdatePolicy();
      if (!active) {
        return;
      }
      if (result.status === 'allowed') {
        setPhase('ok');
      } else {
        setStoreUrl(result.storeUrl);
        setPhase('blocked');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (phase === 'checking') {
    return (
      <View style={styles.checking}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (phase === 'blocked') {
    return <AppUpdateRequiredScreen storeUrl={storeUrl} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  checking: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightGray2,
  },
});
