import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES, icons, constants} from '../constants';

export type BottomTabDef = (typeof constants.bottom_tabs)[number];
import {useTheme} from '../context/ThemeContext';

type TabButtonProps = {
  label: string;
  icon: any;
  isFocused: boolean;
  onPress: () => void;
};

const TabButton: React.FC<TabButtonProps> = ({
  label,
  icon,
  isFocused,
  onPress,
}) => {
  const {colors, isDark} = useTheme();
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : '#E8EAED';
  const accent = COLORS.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={onPress}
      style={styles.tabTouchable}
      accessibilityRole="tab"
      accessibilityState={{selected: isFocused}}
      accessibilityLabel={label}>
      <View
        style={[
          styles.tabInner,
          {backgroundColor: isFocused ? activeBg : 'transparent'},
        ]}>
        <Image
          source={icon}
          style={[
            styles.tabIcon,
            {
              tintColor: isFocused ? accent : colors.iconMuted,
            },
          ]}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? accent : colors.textSecondary,
              fontWeight: isFocused ? '600' : '400',
            },
          ]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export type MainBottomTabBarProps = {
  selectedTab: string;
  onSelectTab: (tab: string) => void;
  /** When omitted, uses `constants.bottom_tabs` (all three tabs). */
  tabs?: BottomTabDef[];
};

const MainBottomTabBar: React.FC<MainBottomTabBarProps> = ({
  selectedTab,
  onSelectTab,
  tabs,
}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const tabList = tabs?.length ? tabs : constants.bottom_tabs;

  return (
    <View
      style={[
        styles.tabBarWrap,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 4),
        },
      ]}>
      <View style={styles.tabBarRow}>
        {tabList.map(tab => {
          const label = tab.label;
          const icon =
            label === constants.screens.home
              ? icons.home
              : label === constants.screens.makeSale
                ? icons.cart
                : icons.menu;
          return (
            <TabButton
              key={tab.id}
              label={label}
              icon={icon}
              isFocused={selectedTab === label}
              onPress={() => onSelectTab(label)}
            />
          );
        })}
      </View>
    </View>
  );
};

export default MainBottomTabBar;

const styles = StyleSheet.create({
  tabBarWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 2,
    paddingHorizontal: 0,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    minHeight: 50,
  },
  tabTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 72,
    maxWidth: '92%',
  },
  tabIcon: {
    width: 22,
    height: 22,
    marginBottom: 5,
  },
  tabLabel: {
    ...FONTS.body5,
    fontSize: 10,
    letterSpacing: 0,
    textAlign: 'center',
    fontWeight: '400',
  },
});
