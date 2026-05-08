import React, { useMemo } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/theme';

type Props = {
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  gracePeriodEndsAt: Date;
  onDismiss: () => void;
};

function daysRemaining(endsAt: Date): number {
  const ms = endsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function AppUpdateModal({
  latestVersion,
  downloadUrl,
  releaseNotes,
  gracePeriodEndsAt,
  onDismiss,
}: Props) {
  const days = useMemo(() => daysRemaining(gracePeriodEndsAt), [
    gracePeriodEndsAt,
  ]);

  const openDownload = () => {
    if (downloadUrl) {
      Linking.openURL(downloadUrl).catch(() => {});
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={[FONTS.h3, styles.title]}>Update available</Text>
          {latestVersion ? (
            <Text style={[FONTS.body4, styles.version]}>
              Version {latestVersion}
            </Text>
          ) : null}

          {releaseNotes ? (
            <ScrollView
              style={styles.notesScroll}
              showsVerticalScrollIndicator={false}>
              <Text style={[FONTS.body4, styles.notes]}>{releaseNotes}</Text>
            </ScrollView>
          ) : null}

          <Text style={[FONTS.body4, styles.deadline]}>
            {days > 1
              ? `Required in ${days} days. Update at your convenience.`
              : days === 1
                ? 'Required tomorrow. Please update today.'
                : 'Required today. Please update now.'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={openDownload}>
            <Text style={[FONTS.button, styles.primaryBtnText]}>
              Update now
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={onDismiss}>
            <Text style={[FONTS.body4, styles.secondaryBtnText]}>
              Remind me later
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 1.5,
    alignItems: 'stretch',
  },
  title: {
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 4,
  },
  version: {
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SIZES.base * 2,
  },
  notesScroll: {
    maxHeight: 140,
    marginBottom: SIZES.base * 2,
  },
  notes: {
    color: COLORS.black,
    lineHeight: 20,
  },
  deadline: {
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SIZES.padding,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.base * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  primaryBtnText: {
    color: COLORS.white,
  },
  secondaryBtn: {
    paddingVertical: SIZES.base * 1.5,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.gray,
  },
  pressed: {
    opacity: 0.75,
  },
});
