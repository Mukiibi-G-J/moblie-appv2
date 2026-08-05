import React, {useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {constants, COLORS, icons} from '../../constants';
import {
  PAGE_NAMES,
  RESTAURANT_MODULE_ENTRY_PAGE_NAMES,
} from '../../constants/pageNames';
import {usePermissions} from '../../hooks/usePermissions';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {navigate} from '../../hooks/NavigationService';

type ModuleItem = {
  code: string;
  title: string;
  icon: number;
  onPress: () => void;
  visible: boolean;
};

type FeedCard = {
  key: string;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
};

const quickPressProps = {
  delayPressIn: 0 as const,
  delayHoverIn: 0 as const,
  unstable_pressDelay: 0 as const,
};

type OptionsProps = {
  /** Open + Draft count combined */
  unpostedCount?: number;
  lowStockCount?: number;
};

/**
 * QuickBooks-inspired Home launcher:
 * - Business Feed (horizontal tip/action cards)
 * - Shortcuts (role-centre modules as soft tiles)
 */
const Options = ({
  unpostedCount = 0,
  lowStockCount = 0,
}: OptionsProps) => {
  const navigation = useNavigation();
  const {setSelectedTab} = useTabContext();
  const {isModuleVisible, hasAnyPageAccess} = usePermissions();
  const {colors, isDark} = useTheme();

  const canMakeSale =
    isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES);
  const canViewSalesHistory =
    isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY);

  const showRestaurant =
    isModuleVisible('restaurant') &&
    RESTAURANT_MODULE_ENTRY_PAGE_NAMES.some(p => hasAnyPageAccess(p));

  const cardSurface = {
    backgroundColor: colors.card,
    borderColor: isDark ? colors.border : 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: isDark ? 0.25 : 0.07,
        shadowRadius: 8,
      },
      android: {elevation: isDark ? 0 : 2},
      default: {},
    }),
  };

  const feedCards: FeedCard[] = useMemo(() => {
    const cards: FeedCard[] = [];

    if (canMakeSale) {
      cards.push({
        key: 'make-sale',
        title: 'Ready to sell?',
        body: 'Open the register and start a new sale for a walk-in or customer.',
        cta: 'Make sale',
        onPress: () => setSelectedTab(constants.screens.makeSale),
      });
    }

    if ((canViewSalesHistory || canMakeSale) && unpostedCount > 0) {
      cards.push({
        key: 'unposted',
        title: 'Unposted sales',
        body: `${unpostedCount} open or draft sale${
          unpostedCount === 1 ? '' : 's'
        } waiting to be finished or posted.`,
        cta: 'View unposted',
        onPress: () =>
          navigate('SalesHistory', {
            status: 'Unposted',
            dateFilter: 'alltime',
          }),
      });
    }

    if (
      lowStockCount > 0 &&
      isModuleVisible('items') &&
      hasAnyPageAccess(PAGE_NAMES.ITEMS)
    ) {
      cards.push({
        key: 'low-stock',
        title: 'Stock needs attention',
        body: `${lowStockCount} item${
          lowStockCount === 1 ? '' : 's'
        } are running low. Review inventory soon.`,
        cta: 'Review stock',
        onPress: () =>
          navigation.navigate(
            'AllItems' as never,
            {stockFilter: 'low_stock'} as never,
          ),
      });
    }

    if (
      isModuleVisible('reports') &&
      hasAnyPageAccess(PAGE_NAMES.REPORTS)
    ) {
      cards.push({
        key: 'reports',
        title: 'Business trends',
        body: 'Review sales performance and reports for your store.',
        cta: 'Take a look',
        onPress: () => navigate('Reports', undefined),
      });
    }

    return cards;
  }, [
    canMakeSale,
    canViewSalesHistory,
    unpostedCount,
    lowStockCount,
    isModuleVisible,
    hasAnyPageAccess,
    navigation,
    setSelectedTab,
  ]);

  const modules: ModuleItem[] = useMemo(() => {
    const defs: ModuleItem[] = [
      {
        code: 'salesHistory',
        title: 'History',
        icon: icons.reports,
        visible: canViewSalesHistory,
        onPress: () => navigate('SalesHistory', undefined),
      },
      {
        code: 'unpostedSales',
        title: unpostedCount > 0 ? `Unposted (${unpostedCount})` : 'Unposted',
        icon: icons.cart,
        visible: canViewSalesHistory || canMakeSale,
        onPress: () =>
          navigate('SalesHistory', {
            status: 'Unposted',
            dateFilter: 'alltime',
          }),
      },
      {
        code: 'customers',
        title: 'Customers',
        icon: icons.profile,
        visible:
          isModuleVisible('customers') &&
          hasAnyPageAccess(PAGE_NAMES.CUSTOMER_MANAGEMENT),
        onPress: () => navigate('Customers', undefined),
      },
      {
        code: 'items',
        title: 'Items',
        icon: icons.product,
        visible:
          isModuleVisible('items') && hasAnyPageAccess(PAGE_NAMES.ITEMS),
        onPress: () => navigation.navigate('Items' as never),
      },
      {
        code: 'purchases',
        title: 'Purchases',
        icon: icons.product2,
        visible:
          isModuleVisible('purchases') &&
          hasAnyPageAccess(PAGE_NAMES.PURCHASES),
        onPress: () => navigate('Purchases', undefined),
      },
      {
        code: 'suppliers',
        title: 'Suppliers',
        icon: icons.company,
        visible:
          isModuleVisible('suppliers') &&
          hasAnyPageAccess(PAGE_NAMES.SUPPLIERS),
        onPress: () => navigate('Suppliers', undefined),
      },
      {
        code: 'payments',
        title: 'Payments',
        icon: icons.wallet,
        visible:
          isModuleVisible('payments') &&
          hasAnyPageAccess(PAGE_NAMES.PAYMENTS),
        onPress: () => navigate('Payments', undefined),
      },
      {
        code: 'expenses',
        title: 'Expenses',
        icon: icons.coupon,
        visible:
          isModuleVisible('expenses') &&
          hasAnyPageAccess(PAGE_NAMES.EXPENSES),
        onPress: () => navigation.navigate('Expenses' as never),
      },
      {
        code: 'reports',
        title: 'Reports',
        icon: icons.reports,
        visible:
          isModuleVisible('reports') && hasAnyPageAccess(PAGE_NAMES.REPORTS),
        onPress: () => navigate('Reports', undefined),
      },
      {
        code: 'restaurant',
        title: 'Restaurant',
        icon: icons.tray,
        visible: showRestaurant,
        onPress: () => navigate('RestaurantHub', undefined),
      },
      {
        code: 'company',
        title: 'Company',
        icon: icons.company,
        visible:
          isModuleVisible('company') &&
          hasAnyPageAccess(PAGE_NAMES.COMPANY_MANAGEMENT),
        onPress: () => navigate('BusinessDetails', undefined),
      },
      {
        code: 'userManagement',
        title: 'Users',
        icon: icons.profile,
        visible:
          isModuleVisible('userManagement') &&
          hasAnyPageAccess(PAGE_NAMES.USER_MANAGEMENT),
        onPress: () => navigate('UserManagement', undefined),
      },
    ];

    return defs.filter(m => m.visible);
  }, [
    showRestaurant,
    canViewSalesHistory,
    canMakeSale,
    unpostedCount,
    isModuleVisible,
    hasAnyPageAccess,
    navigation,
  ]);

  if (feedCards.length === 0 && modules.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {feedCards.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Business feed
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.feedScroll}
            decelerationRate="fast"
            snapToInterval={276}
            snapToAlignment="start">
            {feedCards.map(card => (
              <Pressable
                key={card.key}
                {...quickPressProps}
                onPress={card.onPress}
                style={({pressed}) => [
                  styles.feedCard,
                  cardSurface,
                  {opacity: pressed ? 0.92 : 1},
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${card.title}. ${card.cta}`}>
                <Text
                  style={[styles.feedTitle, {color: colors.textPrimary}]}
                  numberOfLines={1}>
                  {card.title}
                </Text>
                <Text
                  style={[styles.feedBody, {color: colors.textSecondary}]}
                  numberOfLines={3}>
                  {card.body}
                </Text>
                <Text style={[styles.feedCta, {color: COLORS.primary2}]}>
                  {card.cta}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {modules.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
            Shortcuts
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortcutScroll}>
            {modules.map(item => (
              <Pressable
                key={item.code}
                {...quickPressProps}
                onPress={item.onPress}
                style={({pressed}) => [
                  styles.shortcutTile,
                  cardSurface,
                  {opacity: pressed ? 0.9 : 1},
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.title}>
                <View
                  style={[
                    styles.shortcutIconWell,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#EEF2F6',
                    },
                  ]}>
                  <Image
                    source={item.icon as any}
                    style={[
                      styles.shortcutIcon,
                      {tintColor: COLORS.primary2},
                    ]}
                  />
                </View>
                <Text
                  style={[styles.shortcutLabel, {color: colors.textPrimary}]}
                  numberOfLines={1}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  feedScroll: {
    paddingRight: 16,
    gap: 12,
  },
  feedCard: {
    width: 260,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    minHeight: 132,
    justifyContent: 'space-between',
  },
  feedTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  feedBody: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  feedCta: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  shortcutScroll: {
    paddingRight: 16,
    gap: 10,
  },
  shortcutTile: {
    width: 88,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  shortcutIconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shortcutIcon: {
    width: 20,
    height: 20,
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Options;
