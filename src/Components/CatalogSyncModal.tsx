import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONTS} from '../constants';

type CatalogSyncModalProps = {
  visible: boolean;
  message: string;
  progress?: number;
};

export function CatalogSyncModal({
  visible,
  message,
  progress,
}: CatalogSyncModalProps) {
  const [displayMessage, setDisplayMessage] = useState(message);

  useEffect(() => {
    if (message) setDisplayMessage(message);
  }, [message]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.title}>Preparing offline POS</Text>
          <Text style={styles.message}>{displayMessage}</Text>
          {typeof progress === 'number' ? (
            <Text style={styles.progress}>{Math.round(progress)}%</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    ...FONTS.h3,
    marginTop: 16,
    color: COLORS.black,
  },
  message: {
    ...FONTS.body4,
    marginTop: 8,
    textAlign: 'center',
    color: COLORS.gray,
  },
  progress: {
    ...FONTS.body4,
    marginTop: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
