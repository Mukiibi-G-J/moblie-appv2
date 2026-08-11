import React, {useMemo} from 'react';
import {View, Text, StyleSheet, ScrollView, Pressable} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import RestaurantScreenLayout from './RestaurantScreenLayout';

type Tile = {
  key: string;
  label: string;
  subtitle?: string;
  route:
    | 'RestaurantPOS'
    | 'RestaurantOrders'
    | 'RestaurantKitchen'
    | 'RestaurantDashboard'
    | 'RestaurantTables'
    | 'RestaurantReservations'
    | 'RestaurantMenus'
    | 'RestaurantSettings'
    | 'PrinterConfig';
  pageNames: string[];
};

const TILES: Tile[] = [
  {
    key: 'pos',
    label: 'Restaurant POS',
    subtitle: 'Tables, checks, menu',
    route: 'RestaurantPOS',
    pageNames: [PAGE_NAMES.RESTAURANT_POS],
  },
  {
    key: 'printer',
    label: 'Printer settings',
    subtitle: 'Configure receipt printer',
    route: 'PrinterConfig',
    pageNames: [PAGE_NAMES.RESTAURANT_POS],
  },
  {
    key: 'orders',
    label: 'Orders',
    subtitle: 'Open checks & service',
    route: 'RestaurantOrders',
    pageNames: [PAGE_NAMES.RESTAURANT_ORDERS],
  },
  {
    key: 'kitchen',
    label: 'Kitchen display',
    subtitle: 'KDS tickets',
    route: 'RestaurantKitchen',
    pageNames: [PAGE_NAMES.RESTAURANT_KITCHEN_DISPLAY],
  },
  {
    key: 'dash',
    label: 'Dashboard',
    route: 'RestaurantDashboard',
    pageNames: [PAGE_NAMES.RESTAURANT_DASHBOARD],
  },
  {
    key: 'tables',
    label: 'Floor plan',
    subtitle: 'Table management',
    route: 'RestaurantTables',
    pageNames: [PAGE_NAMES.RESTAURANT_TABLE_MANAGEMENT],
  },
  {
    key: 'res',
    label: 'Reservations',
    route: 'RestaurantReservations',
    pageNames: [PAGE_NAMES.RESTAURANT_RESERVATIONS],
  },
  {
    key: 'menus',
    label: 'Menus & builder',
    route: 'RestaurantMenus',
    pageNames: [
      PAGE_NAMES.RESTAURANT_MENUS,
      PAGE_NAMES.RESTAURANT_MENU_MANAGEMENT,
      PAGE_NAMES.RESTAURANT_MENU_LAYOUT_EDITOR,
    ],
  },
  {
    key: 'settings',
    label: 'Restaurant settings',
    route: 'RestaurantSettings',
    pageNames: [PAGE_NAMES.RESTAURANT_SETTINGS],
  },
];

const BRAND = '#005151';

const RestaurantHub = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const {isModuleVisible, hasAnyPageAccess} = usePermissions();

  const visibleTiles = useMemo(() => {
    if (!isModuleVisible('restaurant')) {
      return [];
    }
    return TILES.filter(t => t.pageNames.some(p => hasAnyPageAccess(p)));
  }, [isModuleVisible, hasAnyPageAccess]);

  return (
    <RestaurantScreenLayout title="Restaurant">
      {visibleTiles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
            No access
          </Text>
          <Text style={[styles.emptyBody, {color: colors.textSecondary}]}>
            Restaurant module is off or your role has no restaurant pages
            assigned.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          {visibleTiles.map(t => (
            <Pressable
              key={t.key}
              onPress={() => navigation.navigate(t.route)}
              style={({pressed}) => [
                styles.tile,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}>
              <View
                style={[styles.tileAccent, {backgroundColor: BRAND + '22'}]}
              />
              <View style={styles.tileText}>
                <Text
                  style={[styles.tileLabel, {color: colors.textPrimary}]}
                  numberOfLines={2}>
                  {t.label}
                </Text>
                {t.subtitle ? (
                  <Text
                    style={[styles.tileSub, {color: colors.textSecondary}]}
                    numberOfLines={2}>
                    {t.subtitle}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.chevron, {color: BRAND}]}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </RestaurantScreenLayout>
  );
};

export default RestaurantHub;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 32,
    gap: 12,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 16,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  tileAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  tileText: {flex: 1},
  tileLabel: {
    ...FONTS.h3,
    fontWeight: '700',
  },
  tileSub: {
    ...FONTS.body4,
    marginTop: 4,
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
    marginLeft: 8,
  },
  empty: {
    flex: 1,
    padding: SIZES.padding * 2,
    justifyContent: 'center',
  },
  emptyTitle: {
    ...FONTS.h2,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    ...FONTS.body3,
    lineHeight: 22,
  },
});
