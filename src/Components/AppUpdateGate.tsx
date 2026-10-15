import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  checkAppUpdatePolicy,
  type AppUpdateStatus,
} from '../services/appUpdatePolicy.service';
import { AppUpdateRequiredScreen } from './AppUpdateRequiredScreen';
import { AppUpdateModal } from './AppUpdateModal';
import { COLORS } from '../constants/theme';

type Props = { children: React.ReactNode };

export function AppUpdateGate({ children }: Props) {
  const [phase, setPhase] = useState<AppUpdateStatus | null>(null);
  const [modalDismissed, setModalDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await checkAppUpdatePolicy();
      if (active) {
        setPhase(result);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (phase === null) {
    return (
      <View style={styles.checking}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (phase.status === 'hard_block') {
    return <AppUpdateRequiredScreen downloadUrl={phase.downloadUrl} />;
  }

  return (
    <>
      {children}
      {phase.status === 'soft_update' && !modalDismissed && (
        <AppUpdateModal
          latestVersion={phase.latestVersion}
          downloadUrl={phase.downloadUrl}
          releaseNotes={phase.releaseNotes}
          gracePeriodEndsAt={phase.gracePeriodEndsAt}
          onDismiss={() => setModalDismissed(true)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  checking: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightGray2,
  },
});
