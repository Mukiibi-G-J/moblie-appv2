import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  useAnimatedReaction,
  interpolateColor,
} from 'react-native-reanimated';
import {
  useDrawerProgress,
  DrawerNavigationProp,
} from '@react-navigation/drawer';
import {useTheme} from '../context/ThemeContext';
import {COLORS, icons, constants, dummyData} from '../constants';
import Header from '../Components/Header';
import MainBottomTabBar from '../Components/MainBottomTabBar';
import Home from './Home/Home';
import Cart from './Cart/Cart';
import MoreMenu from './More/MoreMenu';

type MainLayoutProps = {
  navigation: DrawerNavigationProp<any, any>;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
};

const MemoHome = React.memo(Home);
const MemoCart = React.memo(Cart);
const MemoMoreMenu = React.memo(MoreMenu);

const MainLayout: React.FC<MainLayoutProps> = ({
  navigation,
  selectedTab,
  setSelectedTab,
}) => {
  const {colors} = useTheme();
  const [mountedTabs, setMountedTabs] = useState<Record<string, boolean>>({
    [selectedTab]: true,
  });

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
      transform: [{ scale: scale.value }],
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [colors.background, COLORS.primary],
      ),
    };
  });

  useEffect(() => {
    setMountedTabs(prev =>
      prev[selectedTab] ? prev : {...prev, [selectedTab]: true},
    );
  }, [selectedTab]);

  const renderTabScreen = useCallback(
    (tabLabel: string) => {
      switch (tabLabel) {
        case constants.screens.home:
          return <MemoHome />;
        case constants.screens.makeSale:
          return <MemoCart navigation={navigation} isTabMode />;
        case constants.screens.more:
          return <MemoMoreMenu navigation={navigation} />;
        default:
          return null;
      }
    },
    [navigation],
  );

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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {selectedTab !== constants.screens.home &&
        selectedTab !== constants.screens.more &&
        selectedTab !== constants.screens.makeSale ? (
          <Header
            title={selectedTab.toUpperCase()}
            leftComponent={
              <TouchableOpacity
                style={[
                  styles.menuButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => navigation.openDrawer()}>
                <Image
                  source={icons.menu}
                  style={[styles.menuIcon, { tintColor: colors.textPrimary }]}
                />
              </TouchableOpacity>
            }
            rightComponent={
              <TouchableOpacity
                style={[styles.profileButton, { backgroundColor: colors.card }]}>
                <Image
                  source={dummyData?.myProfile?.profile_image}
                  style={styles.profileImage}
                />
              </TouchableOpacity>
            }
          />
        ) : null}
        {/* Content */}
        <View style={styles.content}>
          {constants.bottom_tabs.map(item => (
            <View
              key={item.id}
              pointerEvents={selectedTab === item.label ? 'auto' : 'none'}
              style={[
                styles.tabPane,
                selectedTab === item.label
                  ? styles.tabPaneVisible
                  : styles.tabPaneHidden,
              ]}>
              {mountedTabs[item.label] ? renderTabScreen(item.label) : null}
            </View>
          ))}
        </View>

        <MainBottomTabBar
          selectedTab={selectedTab}
          onSelectTab={setSelectedTab}
        />
      </View>
    </Animated.View>
  );
};

export default MainLayout;

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  tabPane: {
    ...StyleSheet.absoluteFillObject,
  },
  tabPaneVisible: {
    opacity: 1,
  },
  tabPaneHidden: {
    opacity: 0,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  menuIcon: {
    width: 20,
    height: 20,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
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
