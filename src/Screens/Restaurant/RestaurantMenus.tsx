import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';

export default function RestaurantMenus() {
  const {colors} = useTheme();
  return (
    <RestaurantScreenLayout title="Menus">
      <View style={styles.box}>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Menu catalog, layout editor, and builder are available on web. POS on
          this device uses the same published menus.
        </Text>
      </View>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  box: {padding: SIZES.padding * 1.5},
  body: {...FONTS.body3, lineHeight: 22},
});
