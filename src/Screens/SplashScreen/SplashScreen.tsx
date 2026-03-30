import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import images from '../../constants/images';
import {gradientBrand} from '../../design-system/theme';

const { width, height } = Dimensions.get('window');

const SplashScreen = () => {
  // Animation values
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    // Sequence of animations
    Animated.sequence([
      // 1. Fade in and scale up the main logo
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. Fade in and scale up the icon
      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={[...gradientBrand.colors]}
      style={styles.container}
      start={gradientBrand.start}
      end={gradientBrand.end}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      {/* Main Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeIn,
            transform: [{ scale }],
          },
        ]}>
        <Image
          source={images.logo_zentro}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}>
        <Image
          source={images.logo_icon}
          style={styles.logoIcon}
          resizeMode="contain"
        />
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: width * 0.7,
    height: height * 0.15,
    tintColor: '#FFFFFF', // Make logo white, remove if your logo has colors
  },
  iconContainer: {
    position: 'absolute',
    bottom: height * 0.1,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: '#FFFFFF', // Make icon white, remove if your icon has colors
  },
  logoIcon: {
    width: 40,
    height: 40,
    tintColor: '#FFFFFF', // Make icon white, remove if your icon has colors
  },
});

export default SplashScreen;
