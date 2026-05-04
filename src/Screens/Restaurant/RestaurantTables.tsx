import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';

export default function RestaurantTables() {
  const {colors} = useTheme();
  return (
    <RestaurantScreenLayout title="Table management">
      <View style={styles.box}>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Floor plan editing works best on a large screen. Use Restaurant POS
          on this device for table checks; floor plan tools remain on web for
          now.
        </Text>
      </View>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  box: {padding: SIZES.padding * 1.5},
  body: {...FONTS.body3, lineHeight: 22},
});
