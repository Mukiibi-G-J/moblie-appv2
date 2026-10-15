import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SIZES } from '../constants/theme';

type Props = { downloadUrl: string };

export function AppUpdateRequiredScreen({ downloadUrl }: Props) {
  const openDownload = () => {
    if (downloadUrl) {
      Linking.openURL(downloadUrl).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.container}>
        <Text style={[FONTS.h2, styles.title]}>Update required</Text>
        <Text style={[FONTS.body4, styles.body]}>
          This version is no longer supported. Please install the latest version
          from the link below to continue using the app.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={openDownload}>
          <Text style={[FONTS.button, styles.buttonText]}>
            Download latest version
          </Text>
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
