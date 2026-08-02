import React, {ReactNode} from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import {icons, FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {QuickIconPressable} from '../QuickIconPressable';
import {safeGoBack} from '../../hooks/NavigationService';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';

type Props = {
  title: string;
  children: ReactNode;
  onBack?: () => void;
  headerRight?: ReactNode;
  headerBottom?: ReactNode;
  edges?: Edge[];
  showBack?: boolean;
};

export default function StackScreenLayout({
  title,
  children,
  onBack,
  headerRight,
  headerBottom,
  edges = ['left', 'right', 'bottom'],
  showBack = true,
}: Props) {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const topInset = useScreenTopInset();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      safeGoBack(navigation, 'Home');
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: colors.background}]}
      edges={edges}>
      <View
        style={[
          styles.headerSection,
          {backgroundColor: colors.background, paddingTop: topInset},
        ]}>
        <View
          style={[
            styles.titleRow,
            headerBottom ? styles.titleRowWithBottom : null,
          ]}>
          {showBack ? (
            <QuickIconPressable
              style={[styles.backButton, {backgroundColor: colors.backButtonBg}]}
              onPress={handleBack}
              accessibilityLabel="Go back">
              <Image
                source={icons.back}
                style={[styles.backIcon, {tintColor: colors.textPrimary}]}
                resizeMode="contain"
              />
            </QuickIconPressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          <Text style={[styles.title, {color: colors.textPrimary}]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerTrailing}>
            {headerRight ?? <View style={styles.backPlaceholder} />}
          </View>
        </View>
        {headerBottom}
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleRowWithBottom: {
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  title: {
    ...FONTS.h1,
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerTrailing: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
