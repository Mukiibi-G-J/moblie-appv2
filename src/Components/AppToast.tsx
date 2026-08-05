import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  BaseToast,
  type ToastConfig,
  type ToastConfigParams,
} from 'react-native-toast-message';
import {COLORS, FONTS} from '../constants';

/** High-contrast toasts — errors use a solid red card so they are readable. */
function ErrorCard({text1, text2}: ToastConfigParams<any>) {
  return (
    <View style={styles.errorCard} accessibilityRole="alert">
      <Text style={styles.errorEyebrow}>Error</Text>
      {text1 ? (
        <Text style={styles.errorTitle} numberOfLines={2}>
          {text1}
        </Text>
      ) : null}
      {text2 ? (
        <Text style={styles.errorBody} numberOfLines={8}>
          {text2}
        </Text>
      ) : null}
    </View>
  );
}

export const appToastConfig: ToastConfig = {
  success: props => (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.content}
      text1Style={styles.successTitle}
      text2Style={styles.successBody}
      text1NumberOfLines={2}
      text2NumberOfLines={4}
    />
  ),
  info: props => (
    <BaseToast
      {...props}
      style={styles.infoToast}
      contentContainerStyle={styles.content}
      text1Style={styles.infoTitle}
      text2Style={styles.infoBody}
      text1NumberOfLines={2}
      text2NumberOfLines={4}
    />
  ),
  error: props => <ErrorCard {...props} />,
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
  },
  successToast: {
    borderLeftColor: COLORS.primary,
    borderLeftWidth: 6,
    minHeight: 64,
    width: '92%',
    backgroundColor: '#ECFDF3',
  },
  successTitle: {
    ...FONTS.body3,
    fontSize: 15,
    fontWeight: '700',
    color: '#067647',
  },
  successBody: {
    ...FONTS.body4,
    fontSize: 13,
    color: '#095C37',
  },
  infoToast: {
    borderLeftColor: '#2F53D8',
    borderLeftWidth: 6,
    minHeight: 64,
    width: '92%',
    backgroundColor: '#EFF4FF',
  },
  infoTitle: {
    ...FONTS.body3,
    fontSize: 15,
    fontWeight: '700',
    color: '#1D3B9C',
  },
  infoBody: {
    ...FONTS.body4,
    fontSize: 13,
    color: '#2F53D8',
  },
  errorCard: {
    width: '92%',
    minHeight: 72,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#B42318',
    borderWidth: 1,
    borderColor: '#912018',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  errorEyebrow: {
    ...FONTS.body5,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  errorTitle: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  errorBody: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 6,
  },
});
