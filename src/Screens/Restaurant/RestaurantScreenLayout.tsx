import React, {ReactNode} from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {icons, FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {QuickIconPressable} from '../../Components/QuickIconPressable';
import {safeGoBack} from '../../hooks/NavigationService';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';

type Props = {
  title: string;
  children: ReactNode;
};

export default function RestaurantScreenLayout({title, children}: Props) {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const topInset = useScreenTopInset();

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.header, {paddingTop: topInset}]}>
        <QuickIconPressable
          onPress={() => safeGoBack(navigation, 'Home')}
          style={[styles.back, {backgroundColor: colors.backButtonBg}]}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityLabel="Go back">
          <Image
            source={icons.back}
            style={[styles.backIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.title, {color: colors.textPrimary}]}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {width: 20, height: 20},
  title: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h2,
    fontWeight: '700',
  },
  headerSpacer: {width: 40},
});
