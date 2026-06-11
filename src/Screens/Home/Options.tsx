import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {constants, COLORS, FONTS, icons} from '../../constants';
import {PAGE_NAMES, RESTAURANT_MODULE_ENTRY_PAGE_NAMES} from '../../constants/pageNames';
import {usePermissions} from '../../hooks/usePermissions';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {navigate} from '../../hooks/NavigationService';

const COLUMNS = 4;

type ShortcutColor = {
  bg: string;
  tint: string;
};

type ShortcutAction = {
  key: string;
  icon: number;
  label: string;
  color: ShortcutColor;
  onPress: () => void;
};

const SHORTCUT_PALETTE: ShortcutColor[] = [
  {bg: 'rgba(2, 134, 255, 0.14)', tint: COLORS.primary},
  {bg: 'rgba(0, 184, 148, 0.14)', tint: COLORS.success},
  {bg: 'rgba(255, 161, 51, 0.16)', tint: COLORS.warning},
  {bg: 'rgba(46, 134, 222, 0.14)', tint: COLORS.info},
  {bg: 'rgba(0, 102, 204, 0.14)', tint: COLORS.primary2},
  {bg: 'rgba(255, 71, 87, 0.12)', tint: COLORS.error},
  {bg: 'rgba(0, 163, 255, 0.14)', tint: COLORS.accent},
  {bg: 'rgba(44, 62, 80, 0.12)', tint: COLORS.secondary},
];

const SHORTCUT_COLOR_BY_KEY: Partial<Record<string, ShortcutColor>> = {
  makeSale: {bg: 'rgba(2, 134, 255, 0.16)', tint: COLORS.primary},
  items: {bg: 'rgba(0, 184, 148, 0.16)', tint: COLORS.success},
  printLabels: {bg: 'rgba(46, 134, 222, 0.14)', tint: COLORS.info},
  expenses: {bg: 'rgba(255, 161, 51, 0.16)', tint: COLORS.warning},
  restaurant: {bg: 'rgba(255, 71, 87, 0.12)', tint: COLORS.error},
  salesHistory: {bg: 'rgba(0, 163, 255, 0.14)', tint: COLORS.accent},
  reports: {bg: 'rgba(44, 62, 80, 0.12)', tint: COLORS.secondary},
  stockAdjustments: {bg: 'rgba(0, 184, 148, 0.12)', tint: COLORS.success},
  openingBalance: {bg: 'rgba(0, 102, 204, 0.14)', tint: COLORS.primary2},
  customers: {bg: 'rgba(2, 134, 255, 0.12)', tint: COLORS.primary},
  suppliers: {bg: 'rgba(255, 161, 51, 0.14)', tint: COLORS.warning},
  payments: {bg: 'rgba(0, 102, 204, 0.14)', tint: COLORS.primary2},
};

function chunkByColumns<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

function colorForShortcut(key: string, index: number): ShortcutColor {
  return (
    SHORTCUT_COLOR_BY_KEY[key] ??
    SHORTCUT_PALETTE[index % SHORTCUT_PALETTE.length]
  );
}

const Options = () => {
  const navigation = useNavigation();
  const {setSelectedTab} = useTabContext();
  const {isModuleVisible, hasAnyPageAccess, canRead} = usePermissions();
  const {colors} = useTheme();

  const t = useMemo(
    () => ({
      sectionTitle: {color: colors.textPrimary},
      card: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      label: {color: colors.textPrimary},
    }),
    [colors],
  );

  const showSalesHistory =
    isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY);
  const showPrintLabels =
    isModuleVisible('items') && canRead(PAGE_NAMES.ITEMS);
  const canMakeSale =
    isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES);

  const showRestaurantQuick =
    isModuleVisible('restaurant') &&
    RESTAURANT_MODULE_ENTRY_PAGE_NAMES.some(p => hasAnyPageAccess(p));

  const shortcuts: ShortcutAction[] = useMemo(() => {
    const defs: Omit<ShortcutAction, 'color'>[] = [];

    if (canMakeSale) {
      defs.push({
        key: 'makeSale',
        icon: icons.cart,
        label: 'Make sale',
        onPress: () => setSelectedTab(constants.screens.makeSale),
      });
    }
    if (isModuleVisible('items') && hasAnyPageAccess(PAGE_NAMES.ITEMS)) {
      defs.push({
        key: 'items',
        icon: icons.product,
        label: 'Items',
        onPress: () => navigation.navigate('Items' as never),
      });
    }
    if (showPrintLabels) {
      defs.push({
        key: 'printLabels',
        icon: icons.printer,
        label: 'Print labels',
        onPress: () => navigation.navigate('PrintLabels' as never),
      });
    }
    if (isModuleVisible('expenses') && hasAnyPageAccess(PAGE_NAMES.EXPENSES)) {
      defs.push({
        key: 'expenses',
        icon: icons.coupon,
        label: 'Expenses',
        onPress: () => navigation.navigate('Expenses' as never),
      });
    }
    if (
      isModuleVisible('payments') &&
      hasAnyPageAccess(PAGE_NAMES.PAYMENTS)
    ) {
      defs.push({
        key: 'payments',
        icon: icons.wallet,
        label: 'Payments',
        onPress: () => navigate('Payments', undefined),
      });
    }
    if (showRestaurantQuick) {
      defs.push({
        key: 'restaurant',
        icon: icons.tray,
        label: 'Restaurant',
        onPress: () => navigate('RestaurantHub', undefined),
      });
    }
    if (showSalesHistory) {
      defs.push({
        key: 'salesHistory',
        icon: icons.reports,
        label: 'Sales history',
        onPress: () => navigate('SalesHistory', undefined),
      });
    }
    if (isModuleVisible('reports') && hasAnyPageAccess(PAGE_NAMES.REPORTS)) {
      defs.push({
        key: 'reports',
        icon: icons.reports,
        label: 'Reports',
        onPress: () => navigate('Reports', undefined),
      });
    }
    if (
      isModuleVisible('inventory') &&
      hasAnyPageAccess(PAGE_NAMES.ITEM_JOURNAL)
    ) {
      defs.push({
        key: 'stockAdjustments',
        icon: icons.itemJournal,
        label: 'Stock adj.',
        onPress: () => navigate('ItemJournal', undefined),
      });
      defs.push({
        key: 'openingBalance',
        icon: icons.itemJournal,
        label: 'Opening bal.',
        onPress: () => navigate('OpeningBalanceJournal', undefined),
      });
    }
    if (
      isModuleVisible('customers') &&
      hasAnyPageAccess(PAGE_NAMES.CUSTOMER_MANAGEMENT)
    ) {
      defs.push({
        key: 'customers',
        icon: icons.profile,
        label: 'Customers',
        onPress: () => navigate('Customers', undefined),
      });
    }
    if (
      isModuleVisible('suppliers') &&
      hasAnyPageAccess(PAGE_NAMES.SUPPLIERS)
    ) {
      defs.push({
        key: 'suppliers',
        icon: icons.company,
        label: 'Suppliers',
        onPress: () => navigate('Suppliers', undefined),
      });
    }

    return defs.map((item, index) => ({
      ...item,
      color: colorForShortcut(item.key, index),
    }));
  }, [
    canMakeSale,
    showPrintLabels,
    showRestaurantQuick,
    showSalesHistory,
    isModuleVisible,
    hasAnyPageAccess,
    navigation,
    setSelectedTab,
  ]);

  if (shortcuts.length === 0) {
    return null;
  }

  const rows = chunkByColumns(shortcuts, COLUMNS);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerText, t.sectionTitle, FONTS.h3]}>
          Quick actions
        </Text>
      </View>
      <View style={[styles.card, t.card]}>
        {rows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={[
              styles.gridRow,
              rowIndex < rows.length - 1 ? styles.gridRowSpaced : null,
            ]}>
            {row.map(item => (
              <TouchableOpacity
                key={item.key}
                style={styles.shortcut}
                onPress={item.onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.label}>
                <View
                  style={[
                    styles.iconContainer,
                    {backgroundColor: item.color.bg},
                  ]}>
                  <Image
                    source={item.icon as any}
                    style={[styles.icon, {tintColor: item.color.tint}]}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.label, t.label]} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  header: {
    marginBottom: 10,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  gridRowSpaced: {
    marginBottom: 14,
  },
  shortcut: {
    width: `${100 / COLUMNS}%`,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  icon: {
    width: 20,
    height: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default Options;
