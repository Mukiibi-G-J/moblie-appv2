import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {PAGE_NAMES} from '../../constants/pageNames';
import {usePermissions} from '../../hooks/usePermissions';
import MainBottomTabBar from '../../Components/MainBottomTabBar';

type MenuItem = {
  key: string;
  label: string;
  visible: boolean;
  onPress: () => void;
};

const PurchasesMenu = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {canRead, canCreate} = usePermissions();
  const {selectedTab, setSelectedTab} = useTabContext();

  const menuItems = useMemo<MenuItem[]>(
    () => [
      {
        key: 'purchase-history',
        label: 'Purchase history',
        visible: canRead(PAGE_NAMES.PURCHASES),
        onPress: () => navigation.navigate('PurchaseHistory' as never),
      },
      {
        key: 'new-purchase',
        label: 'New purchase',
        visible: canCreate(PAGE_NAMES.PURCHASES),
        onPress: () => navigation.navigate('PurchaseCreation' as never),
      },
    ],
    [canRead, canCreate, navigation],
  );

  const visibleItems = menuItems.filter(item => item.visible);

  const onSelectTab = (tab: string) => {
    setSelectedTab(tab);
    navigation.navigate('Home' as never);
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View
        style={[
          styles.titleBlock,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingHorizontal: SIZES.padding,
          },
        ]}>
        <Text style={[styles.screenTitle, {color: colors.textPrimary}]}>
          Purchases
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.listWrap}>
          {visibleItems.map((item, index) => (
            <View key={item.key}>
              <TouchableOpacity
                activeOpacity={0.65}
                style={styles.row}
                onPress={item.onPress}>
                <Text style={[styles.rowLabel, {color: colors.textPrimary}]}>
                  {item.label}
                </Text>
                <Image
                  source={icons.down_arrow}
                  style={[
                    styles.chevronImg,
                    {tintColor: colors.textTertiary},
                  ]}
                />
              </TouchableOpacity>
              {index < visibleItems.length - 1 ? (
                <View
                  style={[styles.divider, {backgroundColor: colors.border}]}
                />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectTab}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleBlock: {
    paddingBottom: 12,
  },
  screenTitle: {
    ...FONTS.h2,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 40,
    textAlign: 'left',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  listWrap: {
    marginHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: SIZES.padding,
    minHeight: 56,
  },
  rowLabel: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
    paddingRight: 12,
  },
  chevronImg: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    transform: [{rotate: '-90deg'}],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});

export default PurchasesMenu;
