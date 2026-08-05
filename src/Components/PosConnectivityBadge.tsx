import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, FONTS} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {useOfflineOptional} from '../context/OfflineContext';

type PosConnectivityBadgeProps = {
  onPress?: () => void;
  /** Compact chip for embedding in the POS toolbar row (no outer margins). */
  compact?: boolean;
};

export function PosConnectivityBadge({
  onPress,
  compact = false,
}: PosConnectivityBadgeProps) {
  const {colors, isDark} = useTheme();
  const offline = useOfflineOptional();
  if (!offline) {
    return null;
  }

  const {isOnline, outboxCount, syncStatus, simulateOfflinePos} = offline;
  const isSyncing = syncStatus === 'syncing';
  const label = isOnline
    ? 'Online'
    : simulateOfflinePos
      ? 'Offline (test)'
      : 'Offline';
  const dotColor = isOnline ? '#22c55e' : '#f59e0b';
  const pendingLabel =
    outboxCount > 0 ? `${outboxCount} pending` : isSyncing ? 'Syncing…' : null;

  const content = (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.screenMuted,
          borderColor: colors.border,
        },
      ]}>
      <View style={[styles.dot, {backgroundColor: dotColor}]} />
      <Text style={[styles.label, {color: colors.textPrimary}]}>{label}</Text>
      {pendingLabel ? (
        <Text style={[styles.pending, {color: colors.textSecondary}]}>
          · {pendingLabel}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  wrapCompact: {
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  label: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  pending: {
    ...FONTS.body5,
    marginLeft: 4,
  },
});
