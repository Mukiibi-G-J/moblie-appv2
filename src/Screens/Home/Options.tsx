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
import Toast from 'react-native-toast-message';
import {FONTS, SIZES, icons} from '../../constants';
import {PAGE_NAMES} from '../../constants/pageNames';
import {usePermissions} from '../../hooks/usePermissions';
import {useTheme} from '../../context/ThemeContext';
import {navigate} from '../../hooks/NavigationService';

type PrimaryAction = {
  key: string;
  icon: number;
  title: string;
  subtitle: string;
  onPress: () => void;
};

type LinkRow = {
  key: string;
  label: string;
  icon: number;
  onPress: () => void;
  visible: boolean;
};

function chunkIntoPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

const Options = () => {
  const navigation = useNavigation();
  const {isModuleVisible, hasAnyPageAccess, canRead} = usePermissions();
  const {colors} = useTheme();

  const t = useMemo(
    () => ({
      sectionTitle: {color: colors.textPrimary},
      tile: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      iconWrap: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      title: {color: colors.textPrimary},
      subtitle: {color: colors.textSecondary},
      listCard: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      linkRowBg: {backgroundColor: colors.background},
      linkLabel: {color: colors.textPrimary},
      linkIconTint: {tintColor: colors.textSecondary},
      linkChevron: {color: colors.textSecondary},
      rowDivider: {backgroundColor: colors.border},
    }),
    [colors],
  );

  const canOpenExpenseHistory =
    isModuleVisible('expenses') &&
    (hasAnyPageAccess(PAGE_NAMES.EXPENSE_HISTORY) ||
      hasAnyPageAccess(PAGE_NAMES.EXPENSES));

  const showSalesHistory =
    isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY);
  const showPrintLabels =
    isModuleVisible('items') && canRead('Items');

  const primaryDefs: PrimaryAction[] = [];

  if (isModuleVisible('items') && hasAnyPageAccess(PAGE_NAMES.ITEMS)) {
    primaryDefs.push({
      key: 'items',
      icon: icons.product,
      title: 'Items',
      subtitle: 'Inventory & stock',
      onPress: () => navigation.navigate('Items' as never),
    });
  }
  if (showPrintLabels) {
    primaryDefs.push({
      key: 'printLabels',
      icon: icons.printer,
      title: 'Print labels',
      subtitle: 'Barcode & tags',
      onPress: () => navigation.navigate('PrintLabels' as never),
    });
  }
  if (isModuleVisible('expenses') && hasAnyPageAccess(PAGE_NAMES.EXPENSES)) {
    primaryDefs.push({
      key: 'expenses',
      icon: icons.coupon,
      title: 'Expenses',
      subtitle: 'Record & manage',
      onPress: () => navigation.navigate('Expenses' as never),
    });
  }
  if (canOpenExpenseHistory) {
    primaryDefs.push({
      key: 'expenseHistory',
      icon: icons.reports,
      title: 'Expense history',
      subtitle: 'Posted expenses',
      onPress: () => navigation.navigate('ExpenseHistory' as never),
    });
  }

  const linkRows: LinkRow[] = [
    {
      key: 'salesHistory',
      label: 'Sales history',
      icon: icons.reports,
      visible: showSalesHistory,
      onPress: () => navigate('SalesHistory', undefined),
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: icons.reports,
      visible:
        isModuleVisible('reports') && hasAnyPageAccess(PAGE_NAMES.REPORTS),
      onPress: () => navigate('Reports', undefined),
    },
    {
      key: 'stockAdjustments',
      label: 'Stock adjustments',
      icon: icons.itemJournal,
      visible:
        isModuleVisible('inventory') &&
        hasAnyPageAccess(PAGE_NAMES.ITEM_JOURNAL),
      onPress: () => navigate('ItemJournal', undefined),
    },
    {
      key: 'customers',
      label: 'Customers',
      icon: icons.profile,
      visible:
        isModuleVisible('customers') &&
        hasAnyPageAccess(PAGE_NAMES.CUSTOMER_MANAGEMENT),
      onPress: () => navigate('Customers', undefined),
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      icon: icons.company,
      visible:
        isModuleVisible('suppliers') &&
        hasAnyPageAccess(PAGE_NAMES.SUPPLIERS),
      onPress: () => navigate('Suppliers', undefined),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: icons.setting,
      visible: hasAnyPageAccess(PAGE_NAMES.PROFILE_SETTINGS),
      onPress: () => navigate('Settings', undefined),
    },
    {
      key: 'addons',
      label: 'Add-ons',
      icon: icons.plus,
      visible: true,
      onPress: () => navigate('Subscription', undefined),
    },
    {
      key: 'referrals',
      label: 'Referrals',
      icon: icons.star,
      visible: true,
      onPress: () => {
        Toast.show({
          type: 'info',
          text1: 'Referrals',
          text2: 'Coming soon.',
        });
      },
    },
    {
      key: 'support',
      label: 'Help & Support',
      icon: icons.help,
      visible: true,
      onPress: () => {
        Toast.show({
          type: 'info',
          text1: 'Help & Support',
          text2: 'Coming soon.',
        });
      },
    },
  ];

  const visibleLinks = linkRows.filter(r => r.visible);
  const hasAnyContent = primaryDefs.length > 0 || visibleLinks.length > 0;

  if (!hasAnyContent) {
    return null;
  }

  const rows = chunkIntoPairs(primaryDefs);

  return (
    <View style={styles.container}>
      {primaryDefs.length > 0 ? (
        <>
          <View style={styles.header}>
            <Text style={[styles.headerText, t.sectionTitle, FONTS.h3]}>
              Quick actions
            </Text>
          </View>
          {rows.map((pair, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {pair.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.optionButton, t.tile]}
                  onPress={item.onPress}
                  activeOpacity={0.7}>
                  <View style={[styles.iconContainer, t.iconWrap]}>
                    <Image
                      source={item.icon as any}
                      style={[styles.icon, {tintColor: colors.iconMuted}]}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={[styles.title, t.title]}>{item.title}</Text>
                    <Text style={[styles.subtitle, t.subtitle]}>
                      {item.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </>
      ) : null}

      {visibleLinks.length > 0 ? (
        <View
          style={[
            styles.linksSection,
            primaryDefs.length > 0 ? styles.linksSectionSpaced : null,
          ]}>
          <View style={styles.header}>
            <Text style={[styles.headerText, t.sectionTitle, FONTS.h3]}>
              More actions
            </Text>
          </View>
          <View style={[styles.linkListCard, t.listCard]}>
            {visibleLinks.map((row, index) => (
              <View key={row.key}>
                <TouchableOpacity
                  style={[styles.linkRow, t.linkRowBg]}
                  onPress={row.onPress}
                  activeOpacity={0.65}>
                  <Image
                    source={row.icon as any}
                    style={[styles.linkRowIcon, t.linkIconTint]}
                    resizeMode="contain"
                  />
                  <Text style={[styles.linkRowLabel, t.linkLabel]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.linkChevron, t.linkChevron]}>›</Text>
                </TouchableOpacity>
                {index < visibleLinks.length - 1 ? (
                  <View style={[styles.fullDivider, t.rowDivider]} />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    marginBottom: 12,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionButton: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      android: {elevation: 0},
      default: {},
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  icon: {
    width: 24,
    height: 24,
  },
  textContainer: {
    marginTop: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  linksSection: {},
  linksSectionSpaced: {
    marginTop: 8,
  },
  linkListCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: SIZES.padding,
  },
  linkRowIcon: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  linkRowLabel: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  linkChevron: {
    ...FONTS.h3,
    fontSize: 22,
    fontWeight: '300',
  },
  fullDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SIZES.padding + 24 + 16,
  },
});

export default Options;
