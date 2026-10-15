import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';

export default function RestaurantReservations() {
  const {colors} = useTheme();
  return (
    <RestaurantScreenLayout title="Reservations">
      <View style={styles.box}>
        <Text style={[styles.body, {color: colors.textSecondary}]}>
          Reservation calendar and booking flows are not on mobile yet. Open
          the web app to manage reservations.
        </Text>
      </View>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  box: {padding: SIZES.padding * 1.5},
  body: {...FONTS.body3, lineHeight: 22},
});
