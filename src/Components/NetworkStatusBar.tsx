import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {COLORS, FONTS} from '../constants';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const {width} = Dimensions.get('window');

export const NetworkStatusBar = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [animation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const insets = useSafeAreaInsets();

  // Pulsing animation
  useEffect(() => {
    if (!isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isConnected, pulseAnimation]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = !!state.isConnected;
      setIsConnected(isConnected);

      // Animate the bar
      Animated.spring(animation, {
        toValue: isConnected ? 0 : 1,
        useNativeDriver: true,
        tension: 30,
        friction: 7,
      }).start();
    });

    return () => unsubscribe();
  }, [animation]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{translateY}],
          top: Platform.OS === 'ios' ? insets.top : 0,
        },
      ]}>
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{scale: pulseAnimation}],
          },
        ]}>
        <View style={styles.indicator} />
        <Text style={styles.text}>No Internet Connection</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: COLORS.red,
    width: width,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.select({ios: 6, android: 8}),
    paddingHorizontal: 16,
    minHeight: Platform.select({ios: 30, android: 36}),
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: 8,
    opacity: 0.9,
  },
  text: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: Platform.select({ios: '600', android: '700'}),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
});
