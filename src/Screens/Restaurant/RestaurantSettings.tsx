import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';

export default function RestaurantSettings() {
  const {colors} = useTheme();
  return (
    <RestaurantScreenLayout title="Restaurant settings">
      <View style={styles.box}>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Location defaults, service modes, and related setup are configured on
          web. Mobile will surface key toggles here in a future update.
        </Text>
      </View>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  box: {padding: SIZES.padding * 1.5},
  body: {...FONTS.body3, lineHeight: 22},
});
