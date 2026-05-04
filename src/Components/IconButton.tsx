import React from 'react';
import {Image} from 'react-native';
import {COLORS} from '../constants';
import {QuickIconPressable} from './QuickIconPressable';

const IconButton = ({ containerStyle, icon, iconStyle, onPress }) => {
  return (
    <QuickIconPressable
      onPress={onPress}
      style={containerStyle}
      accessibilityRole="button">
      <Image
        source={icon}
        style={{
          width: 30,
          height: 30,
          tintColor: COLORS.white,
          ...iconStyle,
        }}
      />
    </QuickIconPressable>
  );
};

export default IconButton;