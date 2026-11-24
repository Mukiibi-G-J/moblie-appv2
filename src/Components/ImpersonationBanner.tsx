import React, {useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS} from '../constants';
import {useAppContext} from '../context/Store';
import {navigationRef} from '../hooks/NavigationService';

const ImpersonationBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const app = useAppContext();
  const impersonation = app?.impersonation;
  const [exiting, setExiting] = useState(false);

  if (!impersonation?.active) {
    return null;
  }

  const targetName =
    impersonation.target.fullName || impersonation.target.username;
  const targetUsername = impersonation.target.username;

  const handleExit = async () => {
    if (exiting || !app?.stopImpersonation) {
      return;
    }
    setExiting(true);
    try {
      await app.stopImpersonation();
      Toast.show({
        type: 'success',
        text1: 'Returned to debug_admin',
      });
      if (navigationRef.current?.isReady()) {
        navigationRef.current.reset({index: 0, routes: [{name: 'Home'}]});
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not exit',
        text2: 'Stay on this session and try again.',
      });
      setExiting(false);
    }
  };

  return (
    <View style={[styles.bar, {paddingTop: Math.max(insets.top, 8)}]}>
      <Text style={styles.label} numberOfLines={2}>
        Viewing as {targetName}
        {targetUsername ? ` (${targetUsername})` : ''}
      </Text>
      <TouchableOpacity
        style={styles.exitBtn}
        onPress={() => {
          void handleExit();
        }}
        disabled={exiting}>
        {exiting ? (
          <ActivityIndicator size="small" color="#78350F" />
        ) : (
          <Text style={styles.exitText}>Exit</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  label: {
    ...FONTS.body4,
    flex: 1,
    color: '#78350F',
  },
  exitBtn: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: COLORS.white || '#FFFFFF',
  },
  exitText: {
    ...FONTS.body4,
    color: '#78350F',
    fontWeight: '600',
  },
});

export default ImpersonationBanner;
