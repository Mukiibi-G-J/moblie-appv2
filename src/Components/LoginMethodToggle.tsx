import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {authOnboarding} from '../design-system/authOnboardingTokens';
import {useTheme} from '../context/ThemeContext';

export type LoginMethod = 'email' | 'phone' | 'pin';

type Props = {
  value: LoginMethod;
  onChange: (method: LoginMethod) => void;
};

const ao = authOnboarding;
const BRAND = '#005151';

const LoginMethodToggle = ({value, onChange}: Props) => {
  const {colors, isDark} = useTheme();
  const trackBg = isDark ? colors.inputBackground : '#f3f4f6';
  const thumbBg = colors.surface;

  return (
    <View
      style={[styles.track, {backgroundColor: trackBg}]}
      accessibilityRole="tablist"
      accessibilityLabel="Sign in method">
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{selected: value === 'email'}}
        style={[
          styles.tab,
          value === 'email' && {
            backgroundColor: thumbBg,
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 1},
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 2,
          },
        ]}
        onPress={() => onChange('email')}
        activeOpacity={0.85}>
        <Text
          style={[
            styles.tabText,
            {
              color: value === 'email' ? BRAND : colors.textSecondary,
            },
          ]}>
          Email
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{selected: value === 'phone'}}
        style={[
          styles.tab,
          value === 'phone' && {
            backgroundColor: thumbBg,
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 1},
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 2,
          },
        ]}
        onPress={() => onChange('phone')}
        activeOpacity={0.85}>
        <Text
          style={[
            styles.tabText,
            {
              color: value === 'phone' ? BRAND : colors.textSecondary,
            },
          ]}>
          Phone
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{selected: value === 'pin'}}
        style={[
          styles.tab,
          value === 'pin' && {
            backgroundColor: thumbBg,
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 1},
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 2,
          },
        ]}
        onPress={() => onChange('pin')}
        activeOpacity={0.85}>
        <Text
          style={[
            styles.tabText,
            {
              color: value === 'pin' ? BRAND : colors.textSecondary,
            },
          ]}>
          PIN
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: ao.sectionSpacing.betweenFields,
    position: 'relative',
    minHeight: 44,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabText: {
    fontSize: ao.typo.caption,
    fontWeight: '600',
  },
});

export default LoginMethodToggle;
