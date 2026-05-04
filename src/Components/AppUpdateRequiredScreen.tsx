import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES } from '../constants/theme';

type Props = { storeUrl: string };

export function AppUpdateRequiredScreen({ storeUrl }: Props) {
  const openStore = () => {
    Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.container}>
        <Text style={[FONTS.h2, styles.title]}>Update required</Text>
        <Text style={[FONTS.body4, styles.body]}>
          This version is no longer supported. Install the latest version from
          the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} to continue.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={openStore}>
          <Text style={[FONTS.button, styles.buttonText]}>Open store</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
  },
  title: {
    color: COLORS.black,
    marginBottom: SIZES.base * 2,
    textAlign: 'center',
  },
  body: {
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SIZES.padding * 1.5,
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.base * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: COLORS.white,
  },
});
