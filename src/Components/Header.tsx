import React from 'react';
import {View, Text, StyleSheet, Platform} from 'react-native';
import {COLORS, FONTS, SIZES} from '../constants';

const Header = ({
  containerStyle,
  title,
  titleStyle,
  leftComponent,
  rightComponent,
}) => {
  return (
    <View style={styles.headerContainer}>
      <View style={[styles.header, containerStyle]}>
        {/* Left Component */}
        <View style={styles.leftComponent}>{leftComponent}</View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.titleText, titleStyle]}>{title}</Text>
        </View>

        {/* Right Component */}
        <View style={styles.rightComponent}>{rightComponent}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'ios' ? 44 : 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  leftComponent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.base,
  },
  titleText: {
    ...FONTS.h3,
    fontSize: 18,
    color: COLORS.black,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif-medium',
  },
  rightComponent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});

export default Header;
