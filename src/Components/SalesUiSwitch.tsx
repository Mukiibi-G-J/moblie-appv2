import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONTS, ICON_BUTTON_HIT_SLOP} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {QuickIconPressable} from './QuickIconPressable';
import type {SalesUiMode} from '../utils/salesUiMode';

type SalesUiSwitchProps = {
  mode: SalesUiMode;
  onChange: (mode: SalesUiMode) => void;
};

export function SalesUiSwitch({mode, onChange}: SalesUiSwitchProps) {
  const {colors, isDark} = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.screenMuted,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="tablist">
      <QuickIconPressable
        accessibilityRole="tab"
        accessibilityState={{selected: mode === 'phone'}}
        accessibilityLabel="Phone sales layout"
        hitSlop={ICON_BUTTON_HIT_SLOP}
        onPress={() => onChange('phone')}
        style={[
          styles.option,
          mode === 'phone' && {
            backgroundColor: colors.surface,
            borderColor: COLORS.primary2,
          },
        ]}>
        <Text
          style={[
            styles.label,
            {color: mode === 'phone' ? COLORS.primary2 : colors.textSecondary},
          ]}>
          Phone
        </Text>
      </QuickIconPressable>
      <QuickIconPressable
        accessibilityRole="tab"
        accessibilityState={{selected: mode === 'pos'}}
        accessibilityLabel="Point of sale layout"
        hitSlop={ICON_BUTTON_HIT_SLOP}
        onPress={() => onChange('pos')}
        style={[
          styles.option,
          mode === 'pos' && {
            backgroundColor: colors.surface,
            borderColor: COLORS.primary2,
          },
        ]}>
        <Text
          style={[
            styles.label,
            {color: mode === 'pos' ? COLORS.primary2 : colors.textSecondary},
          ]}>
          POS
        </Text>
      </QuickIconPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  option: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  label: {
    ...FONTS.body5,
    fontWeight: '700',
  },
});
