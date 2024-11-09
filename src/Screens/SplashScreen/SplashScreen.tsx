import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

const SplashScreen = () => {
  const translateX = useRef(new Animated.Value(-500)).current; // Starting off-screen

  useEffect(() => {
    // Animation to move the logo text from left to right
    Animated.timing(translateX, {
      toValue: 0, // End position (center screen)
      duration: 2000, // Animation duration (2 seconds)
      useNativeDriver: true, // Enable native driver for better performance
    }).start();
  }, [translateX]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Image
          source={require('../../assets/images/icon.png')} // Add your image path here
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // White background
  },
  logo: {
    width: 300, // Adjust the logo size as needed
    height: 100, // Adjust the logo size as needed
  },
});

export default SplashScreen;