import React, {ReactNode} from 'react';
import {
  Pressable,
  Platform,
  StyleProp,
  ViewStyle,
  Insets,
} from 'react-native';
import {
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
  ICON_BUTTON_QUICK_PRESS,
} from '../constants';

export type QuickIconPressableProps = {
  onPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  hitSlop?: Insets | typeof ICON_BUTTON_HIT_SLOP;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
};

/**
 * Back, close (X), and other small chrome: same instant tap behavior as POS / charge.
 */
export function QuickIconPressable({
  onPress,
  disabled,
  children,
  style,
  hitSlop,
  accessibilityRole = 'button',
  accessibilityLabel,
}: QuickIconPressableProps) {
  return (
    <Pressable
      {...ICON_BUTTON_QUICK_PRESS}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlop ?? ICON_BUTTON_HIT_SLOP}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      android_ripple={
        Platform.OS === 'android' && !disabled
          ? {color: 'rgba(0,0,0,0.14)', foreground: false}
          : undefined
      }
      style={({pressed}) => [
        style,
        pressed && !disabled && {opacity: ICON_BUTTON_ACTIVE_OPACITY},
      ]}>
      {children}
    </Pressable>
  );
}
