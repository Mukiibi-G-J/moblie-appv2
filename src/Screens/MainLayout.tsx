import React, {useEffect, useRef} from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  FlatList,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  useAnimatedReaction,
  interpolateColor,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {
  useDrawerProgress,
  DrawerNavigationProp,
} from '@react-navigation/drawer';
import {useAppContext} from '../context/Store';
import {COLORS, FONTS, SIZES, icons, constants, dummyData} from '../constants';
import Header from '../Components/Header';
import Home from './Home/Home';
import SalesHistory from './Sales/SalesHistory';
import Items from './Items/Items';
import Customers from './Customers/Customers';
import Reports from './Reports/Reports';

// Define types for props
type TabButtonProps = {
  label: string;
  icon: any;
  isFocused: boolean;
  outerContainerStyle: any;
  innerContainerStyle: any;
  onPress: () => void;
};

const TabButton: React.FC<TabButtonProps> = ({
  label,
  icon,
  isFocused,
  outerContainerStyle,
  innerContainerStyle,
  onPress,
}) => {
  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          },
          outerContainerStyle,
        ]}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              width: '80%',
              height: 50,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 25,
            },
            innerContainerStyle,
          ]}>
          <Image
            source={icon}
            style={{
              width: 20,
              height: 20,
              tintColor: isFocused ? COLORS.white : COLORS.gray,
            }}
          />
          {isFocused && (
            <Text
              numberOfLines={1}
              style={{
                marginLeft: SIZES.base,
                color: COLORS.white,
                ...FONTS.h3,
              }}>
              {label}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

type MainLayoutProps = {
  navigation: DrawerNavigationProp<any, any>;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
};

const MainLayout: React.FC<MainLayoutProps> = ({
  navigation,
  selectedTab,
  setSelectedTab,
}) => {
  const flatListRef = useRef<FlatList>(null);
  // const { selectedTab, setSelectedTab } = useAppContext() ?? { selectedTab: '', setSelectedTab: () => { } };
  // const {}

  const progress = useDrawerProgress();

  // Drawer Animation
  const scale = useSharedValue(1);
  const borderRadius = useSharedValue(0);

  useAnimatedReaction(
    () => progress.value,
    value => {
      scale.value = interpolate(value, [0, 1], [1, 0.8]);
      borderRadius.value = interpolate(value, [0, 1], [0, 26]);
    },
    [progress],
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderRadius: borderRadius.value,
      transform: [{scale: scale.value}],
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [COLORS.white, COLORS.primary],
      ),
    };
  });

  // Reanimated Shared Value
  const homeTabFlex = useSharedValue(1);
  const homeTabColor = useSharedValue(COLORS.white);
  const salesTabFlex = useSharedValue(1);
  const salesTabColor = useSharedValue(COLORS.white);
  const itemsTabFlex = useSharedValue(1);
  const itemsTabColor = useSharedValue(COLORS.white);
  const customersTabFlex = useSharedValue(1);
  const customersTabColor = useSharedValue(COLORS.white);
  const reportsTabFlex = useSharedValue(1);
  const reportsTabColor = useSharedValue(COLORS.white);

  // Reanimated Animated Style
  const homeFlexStyle = useAnimatedStyle(() => ({flex: homeTabFlex.value}));
  const homeColorStyle = useAnimatedStyle(() => ({
    backgroundColor: homeTabColor.value,
  }));
  const salesFlexStyle = useAnimatedStyle(() => ({flex: salesTabFlex.value}));
  const salesColorStyle = useAnimatedStyle(() => ({
    backgroundColor: salesTabColor.value,
  }));
  const itemsFlexStyle = useAnimatedStyle(() => ({flex: itemsTabFlex.value}));
  const itemsColorStyle = useAnimatedStyle(() => ({
    backgroundColor: itemsTabColor.value,
  }));
  const customersFlexStyle = useAnimatedStyle(() => ({
    flex: customersTabFlex.value,
  }));
  const customersColorStyle = useAnimatedStyle(() => ({
    backgroundColor: customersTabColor.value,
  }));
  const reportsFlexStyle = useAnimatedStyle(() => ({
    flex: reportsTabFlex.value,
  }));
  const reportsColorStyle = useAnimatedStyle(() => ({
    backgroundColor: reportsTabColor.value,
  }));

  useEffect(() => {
    const tabIndexMap: {[key: string]: number} = {
      [constants.screens.home]: 0,
      [constants.screens.sales]: 1,
      [constants.screens.items]: 2,
      [constants.screens.customers]: 3,
      [constants.screens.reports]: 4,
    };

    const currentIndex = tabIndexMap[selectedTab] ?? 0;
    const offset = SIZES.width * currentIndex;

    // Use scrollToOffset instead of scrollToIndex for better reliability
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({offset, animated: false});
    }

    // Update tab animations
    if (selectedTab === constants.screens.home) {
      homeTabFlex.value = withTiming(4, {duration: 500});
      homeTabColor.value = withTiming(COLORS.primary2, {duration: 500});
    } else {
      homeTabFlex.value = withTiming(1, {duration: 500});
      homeTabColor.value = withTiming(COLORS.white, {duration: 500});
    }

    if (selectedTab === constants.screens.sales) {
      salesTabFlex.value = withTiming(4, {duration: 500});
      salesTabColor.value = withTiming(COLORS.primary2, {duration: 500});
    } else {
      salesTabFlex.value = withTiming(1, {duration: 500});
      salesTabColor.value = withTiming(COLORS.white, {duration: 500});
    }

    if (selectedTab === constants.screens.items) {
      itemsTabFlex.value = withTiming(4, {duration: 500});
      itemsTabColor.value = withTiming(COLORS.primary2, {duration: 500});
    } else {
      itemsTabFlex.value = withTiming(1, {duration: 500});
      itemsTabColor.value = withTiming(COLORS.white, {duration: 500});
    }

    if (selectedTab === constants.screens.customers) {
      customersTabFlex.value = withTiming(4, {duration: 500});
      customersTabColor.value = withTiming(COLORS.primary2, {duration: 500});
    } else {
      customersTabFlex.value = withTiming(1, {duration: 500});
      customersTabColor.value = withTiming(COLORS.white, {duration: 500});
    }

    if (selectedTab === constants.screens.reports) {
      reportsTabFlex.value = withTiming(4, {duration: 500});
      reportsTabColor.value = withTiming(COLORS.primary2, {duration: 500});
    } else {
      reportsTabFlex.value = withTiming(1, {duration: 500});
      reportsTabColor.value = withTiming(COLORS.white, {duration: 500});
    }
  }, [selectedTab]);

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          overflow: 'hidden',
          zIndex: 1000,
        },
        animatedStyle,
      ]}>
      <View style={{flex: 1, backgroundColor: COLORS.white}}>
        {/* Header */}
        <Header
          title={selectedTab.toUpperCase()}
          leftComponent={
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => navigation.openDrawer()}>
              <Image source={icons.menu} style={styles.menuIcon} />
            </TouchableOpacity>
          }
          rightComponent={
            <TouchableOpacity style={styles.profileButton}>
              <Image
                source={dummyData?.myProfile?.profile_image}
                style={styles.profileImage}
              />
            </TouchableOpacity>
          }
        />
        {/* Content */}
        <View style={{flex: 1}}>
          <FlatList
            ref={flatListRef}
            horizontal
            scrollEnabled={false}
            pagingEnabled
            snapToAlignment="center"
            snapToInterval={SIZES.width}
            showsHorizontalScrollIndicator={false}
            data={constants.bottom_tabs}
            keyExtractor={item => `${item.id}`}
            getItemLayout={(data, index) => ({
              length: SIZES.width,
              offset: SIZES.width * index,
              index,
            })}
            onScrollToIndexFailed={info => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                });
              });
            }}
            renderItem={({item}) => {
              return (
                <View
                  style={{
                    height: SIZES.height,
                    width: SIZES.width,
                  }}>
                  {item.label === constants.screens.home && <Home />}
                  {item.label === constants.screens.sales && <SalesHistory />}
                  {item.label === constants.screens.items && <Items />}
                  {item.label === constants.screens.customers && <Customers />}
                  {item.label === constants.screens.reports && <Reports />}
                </View>
              );
            }}
          />
        </View>

        {/* Footer */}
        <View style={{height: 60, justifyContent: 'flex-end'}}>
          {/* Shadow */}
          <LinearGradient
            start={{x: 0, y: 0}}
            end={{x: 0, y: 1}}
            colors={[COLORS.transparent, COLORS.lightGray1]}
            style={{
              position: 'absolute',
              top: -15,
              left: 0,
              right: 0,
              height: 100,
              borderTopLeftRadius: 15,
              borderTopRightRadius: 15,
            }}
          />

          {/* Tabs */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              paddingHorizontal: SIZES.radius,
              paddingBottom: 10,
              paddingTop: 4,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundColor: COLORS.white,
            }}>
            <TabButton
              label={constants.screens.home}
              icon={icons.home}
              isFocused={selectedTab === constants.screens.home}
              outerContainerStyle={homeFlexStyle}
              innerContainerStyle={homeColorStyle}
              onPress={() => setSelectedTab(constants.screens.home)}
            />

            <TabButton
              label={constants.screens.sales}
              icon={icons.cart}
              isFocused={selectedTab === constants.screens.sales}
              outerContainerStyle={salesFlexStyle}
              innerContainerStyle={salesColorStyle}
              onPress={() => setSelectedTab(constants.screens.sales)}
            />

            <TabButton
              label={constants.screens.items}
              icon={icons.product}
              isFocused={selectedTab === constants.screens.items}
              outerContainerStyle={itemsFlexStyle}
              innerContainerStyle={itemsColorStyle}
              onPress={() => setSelectedTab(constants.screens.items)}
            />

            <TabButton
              label={constants.screens.customers}
              icon={icons.profile}
              isFocused={selectedTab === constants.screens.customers}
              outerContainerStyle={customersFlexStyle}
              innerContainerStyle={customersColorStyle}
              onPress={() => setSelectedTab(constants.screens.customers)}
            />

            <TabButton
              label={constants.screens.reports}
              icon={icons.reports}
              isFocused={selectedTab === constants.screens.reports}
              outerContainerStyle={reportsFlexStyle}
              innerContainerStyle={reportsColorStyle}
              onPress={() => setSelectedTab(constants.screens.reports)}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default MainLayout;

const styles = StyleSheet.create({
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
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});
