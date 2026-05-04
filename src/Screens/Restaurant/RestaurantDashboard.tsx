import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';

export default function RestaurantDashboard() {
  const {colors} = useTheme();
  return (
    <RestaurantScreenLayout title="Restaurant dashboard">
      <View style={styles.box}>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Dashboard KPIs and charts are available in the browser. A native
          summary will be added in a later release.
        </Text>
      </View>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  box: {padding: SIZES.padding * 1.5},
  body: {...FONTS.body3, lineHeight: 22},
});
