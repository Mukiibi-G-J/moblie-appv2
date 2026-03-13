import React, {useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  Image,
  Animated,
  useWindowDimensions,
} from 'react-native';

import TextButton from '../Components/TextButton';
import {COLORS, constants, FONTS, images, SIZES} from '../constants';

const LARGE_SCREEN_BREAKPOINT = 600;
const MAX_CONTENT_WIDTH = 900;

const OnBoarding = ({navigation}: {navigation: any}) => {
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const isLargeScreen = screenWidth >= LARGE_SCREEN_BREAKPOINT;
  const contentWidth = isLargeScreen
    ? Math.min(screenWidth * 0.88, MAX_CONTENT_WIDTH)
    : screenWidth;

  const scrollX = React.useRef(new Animated.Value(0)).current;
  const flatListRef = React.useRef(null);

  const [currentIndex, setCurrentIndex] = React.useState(0);

  const onViewChangeRef = React.useRef(
    ({viewableItems, changed}: {viewableItems: any; changed: any}) => {
      setCurrentIndex(viewableItems[0].index);
    },
  );

  const Dots = () => {
    const dotPosition = Animated.divide(scrollX, screenWidth);

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {constants.onboarding_screens.map((item, index) => {
          const dotColor = dotPosition.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [
              COLORS.lightOrange,
              COLORS.primary,
              COLORS.lightOrange,
            ],
            extrapolate: 'clamp',
          });

          const dotWidth = dotPosition.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [10, 30, 10],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={`dot-${index}`}
              style={{
                borderRadius: 5,
                marginHorizontal: 6,
                width: dotWidth,
                height: 10,
                backgroundColor: dotColor,
              }}
            />
          );
        })}
      </View>
    );
  };

  function renderHeaderLogo() {
    const logoWidth = isLargeScreen
      ? Math.min(screenWidth * 0.35, 220)
      : screenWidth * 0.5;
    return (
      <View
        style={{
          position: 'absolute',
          top: screenHeight > 800 ? 50 : 25,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }}>
        <Image
          source={images.logo_zentro}
          resizeMode="contain"
          style={{
            width: logoWidth,
            height: 80,
            opacity: 0.9,
          }}
        />
      </View>
    );
  }

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const value = await AsyncStorage.getItem('@onboarding_complete');
      if (value !== null && value === 'true') {
        // Onboarding has been completed before, navigate to SignIn
        navigation.replace('SignIn');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_complete', 'true');
      navigation.replace('SignIn');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  function renderFooter() {
    const footerContent = (
      <>
        <View style={{flex: 1, justifyContent: 'center'}}>
          <Dots />
        </View>

        {currentIndex < constants.onboarding_screens.length - 1 && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: isLargeScreen ? SIZES.padding * 2 : SIZES.padding,
              marginVertical: SIZES.padding,
            }}>
            <TextButton
              label="Skip"
              buttonContainerStyle={{
                backgroundColor: null,
              }}
              labelStyle={{
                color: COLORS.darkGray2,
              }}
              onPress={() => navigation.replace('SignIn')}
            />

            <TextButton
              label="Next"
              buttonContainerStyle={{
                height: 60,
                width: 200,
                borderRadius: SIZES.radius,
                backgroundColor: COLORS.primary,
                shadowColor: '#000',
                shadowOffset: {width: 0, height: 4},
                shadowOpacity: 0.2,
                shadowRadius: 5,
                elevation: 5,
              }}
              labelStyle={{
                ...FONTS.h3,
                color: COLORS.white,
              }}
              onPress={() => {
                flatListRef?.current?.scrollToIndex({
                  index: currentIndex + 1,
                  animated: true,
                });
              }}
            />
          </View>
        )}

        {currentIndex == constants.onboarding_screens.length - 1 && (
          <View
            style={{
              paddingHorizontal: isLargeScreen ? SIZES.padding * 2 : SIZES.padding,
              marginVertical: SIZES.padding,
            }}>
            <TextButton
              label="Let's Get Started"
              buttonContainerStyle={{
                height: 60,
                borderRadius: SIZES.radius,
              }}
              onPress={completeOnboarding}
            />
          </View>
        )}
      </>
    );

    return (
      <View style={{height: 160}}>
        {isLargeScreen ? (
          <View
            style={{
              maxWidth: contentWidth,
              width: '100%',
              alignSelf: 'center',
              flex: 1,
            }}>
            {footerContent}
          </View>
        ) : (
          footerContent
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.white,
      }}>
      {renderHeaderLogo()}

      <Animated.FlatList
        ref={flatListRef}
        horizontal
        pagingEnabled
        data={constants.onboarding_screens}
        scrollEventThrottle={16}
        snapToAlignment="center"
        snapToInterval={screenWidth}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {x: scrollX}}}],
          {useNativeDriver: false},
        )}
        onViewableItemsChanged={onViewChangeRef.current}
        viewabilityConfig={{viewAreaCoveragePercentThreshold: 50}}
        getItemLayout={(_: any, index: number) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        keyExtractor={item => `${item.id}`}
        renderItem={({item, index}) => {
          const titleSize = isLargeScreen ? 28 : 24;
          const descSize = isLargeScreen ? 16 : 14;
          const lineHeight = isLargeScreen ? 24 : 20;

          if (isLargeScreen) {
            return (
              <View
                style={{
                  width: screenWidth,
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: SIZES.padding,
                }}>
                <View
                  style={{
                    width: contentWidth,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flex: 1,
                    maxHeight: screenHeight * 0.7,
                  }}>
                  <View
                    style={{
                      flex: 0.48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Image
                      source={item.bannerImage}
                      resizeMode="contain"
                      style={{
                        width: contentWidth * 0.45,
                        maxWidth: 320,
                        height: contentWidth * 0.45,
                        maxHeight: 320,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      flex: 0.52,
                      paddingLeft: SIZES.padding * 1.5,
                      justifyContent: 'center',
                    }}>
                    <Text
                      style={{
                        ...FONTS.h1,
                        fontSize: titleSize,
                        color: COLORS.primary,
                        marginBottom: 12,
                        fontWeight: '600',
                        textAlign: 'left',
                      }}>
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        marginTop: SIZES.base,
                        textAlign: 'left',
                        color: COLORS.darkGray,
                        lineHeight,
                        fontSize: descSize,
                        ...FONTS.body3,
                      }}>
                      {item.description}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }

          return (
            <View
              style={{
                width: screenWidth,
              }}>
              <View style={{flex: 3}}>
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: index == 1 ? '86%' : '100%',
                    width: '100%',
                  }}>
                  <Image
                    source={item.bannerImage}
                    resizeMode="contain"
                    style={{
                      width:
                        screenHeight > 800 ? screenWidth * 0.8 : screenWidth * 0.7,
                      height:
                        screenHeight > 800 ? screenWidth * 0.8 : screenWidth * 0.7,
                      marginBottom: -SIZES.padding,
                    }}
                  />
                </View>
              </View>

              <View
                style={{
                  flex: 1,
                  marginTop: 25,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: SIZES.radius,
                }}>
                <Text
                  style={{
                    ...FONTS.h1,
                    fontSize: titleSize,
                    color: COLORS.primary,
                    marginBottom: 8,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}>
                  {item.title}
                </Text>
                <Text
                  style={{
                    marginTop: SIZES.base,
                    textAlign: 'center',
                    color: COLORS.darkGray,
                    paddingHorizontal: SIZES.padding,
                    lineHeight,
                    fontSize: descSize,
                    ...FONTS.body3,
                  }}>
                  {item.description}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {renderFooter()}
    </View>
  );
};

export default OnBoarding;
