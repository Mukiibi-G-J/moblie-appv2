import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {COLORS, FONTS, SIZES, icons} from '../constants';

interface HeaderProps {
  title: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  onBackPress?: () => void;
  showBack?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  leftComponent,
  rightComponent,
  containerStyle,
  titleStyle,
  onBackPress,
  showBack = false,
}) => {
  return (
    <View style={[styles.headerSection,containerStyle]}>
      <View style={[styles.headerCard, containerStyle]}>
        <View style={styles.headerMain}>
          {/* Left Component */}
          <View style={styles.leftComponent}>
            {showBack ? (
              <TouchableOpacity style={styles.menuButton} onPress={onBackPress}>
                <Image source={icons.back} style={styles.menuIcon} />
              </TouchableOpacity>
            ) : (
              leftComponent
            )}
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
          </View>

          {/* Right Component */}
          <View style={styles.rightComponent}>{rightComponent}</View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerSection: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: COLORS.white,
    paddingBottom: 16,
    // borderBottomLeftRadius: 24,
    // borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerCard: {
    marginTop: 8,
    paddingHorizontal: SIZES.padding,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    // height: 56,
  },
  leftComponent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  menuIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.black,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...FONTS.h3,
    color: COLORS.black,
  },
  rightComponent: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});

export default Header;
