import React, {useCallback, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import type {DrawerNavigationProp} from '@react-navigation/drawer';
import Toast from 'react-native-toast-message';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/Store';
import {useTenantContext} from '../../context/TenantContext';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {navigate} from '../../hooks/NavigationService';
import {getCompanyInfo} from '../../services/app.services';

export type MoreMenuProps = {
  navigation: DrawerNavigationProp<any, any>;
};

type MenuRow = {
  key: string;
  label: string;
  icon: number;
  onPress: () => void;
  visible: boolean;
};

function formatTenantLabel(slug: string | null): string {
  if (!slug?.trim()) {
    return 'Your business';
  }
  return slug
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const MoreMenu: React.FC<MoreMenuProps> = ({navigation}) => {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {auth} = useAuth();
  const {currentTenant} = useTenantContext();
  const {isModuleVisible, hasAnyPageAccess} = usePermissions();
  const [companyName, setCompanyName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await getCompanyInfo();
          const name = res?.data?.company?.name?.trim?.();
          if (!cancelled && name) {
            setCompanyName(name);
          }
        } catch {
          /* keep slug fallback; do not clear a previously loaded name */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const storeLabel = useMemo(() => {
    if (companyName?.trim()) {
      return companyName.trim();
    }
    return formatTenantLabel(currentTenant);
  }, [companyName, currentTenant]);

  const firstName = auth.full_name?.trim()?.split(/\s+/)[0];

  const rows: MenuRow[] = useMemo(
    () => [
      {
        key: 'salesHistory',
        label: 'Sales History',
        icon: icons.reports,
        visible:
          isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY),
        onPress: () => navigate('SalesHistory', undefined),
      },
      {
        key: 'reports',
        label: 'Reports',
        icon: icons.reports,
        visible: isModuleVisible('reports') && hasAnyPageAccess(PAGE_NAMES.REPORTS),
        onPress: () => navigate('Reports', undefined),
      },
      {
        key: 'items',
        label: 'Items',
        icon: icons.product,
        visible: isModuleVisible('items') && hasAnyPageAccess(PAGE_NAMES.ITEMS),
        onPress: () => navigate('Items', undefined),
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
        key: 'purchases',
        label: 'Purchases',
        icon: icons.cart,
        visible:
          isModuleVisible('purchases') &&
          hasAnyPageAccess(PAGE_NAMES.PURCHASES),
        onPress: () => navigate('Purchases', undefined),
      },
      {
        key: 'expenses',
        label: 'Expenses',
        icon: icons.coupon,
        visible:
          isModuleVisible('expenses') && hasAnyPageAccess(PAGE_NAMES.EXPENSES),
        onPress: () => navigate('Expenses', undefined),
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
    ],
    [isModuleVisible, hasAnyPageAccess],
  );

  const visibleRows = rows.filter(r => r.visible);

  return (
    <ScrollView
      style={[styles.scroll, {backgroundColor: colors.background}]}
      contentContainerStyle={{
        paddingBottom: SIZES.padding * 2,
        paddingTop: Math.max(insets.top, 12),
      }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          style={[
            styles.circleBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
          hitSlop={12}
          accessibilityLabel="Open menu">
          <Image
            source={icons.menu}
            style={[styles.topBarIcon, {tintColor: colors.textPrimary}]}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigate('Subscription', undefined)}
          style={[
            styles.circleBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
          hitSlop={12}
          accessibilityLabel="Subscription and perks">
          <Image
            source={icons.coupon}
            style={[styles.topBarIcon, {tintColor: colors.textPrimary}]}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.welcomeTitle, {color: colors.textPrimary}]}>
          Welcome back{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={[styles.storeName, {color: colors.textSecondary}]}>
          {storeLabel}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          Toast.show({
            type: 'info',
            text1: 'Mode',
            text2: 'Additional modes will be available in a future update.',
          });
        }}
        style={[
          styles.modeCard,
          {
            backgroundColor: colors.screenMuted,
            borderColor: colors.border,
          },
        ]}>
        <View style={[styles.modeIconWrap, {backgroundColor: colors.card}]}>
          {[0, 1, 2].map(row => (
            <View
              key={row}
              style={{
                flexDirection: 'row',
                marginBottom: row < 2 ? 3 : 0,
              }}>
              {[0, 1, 2].map(col => (
                <View
                  key={`${row}-${col}`}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.textTertiary,
                    marginRight: col < 2 ? 3 : 0,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.modeTextCol}>
          <Text style={[styles.modeTitle, {color: colors.textPrimary}]}>
            Mode
          </Text>
          <Text
            style={[styles.modeSubtitle, {color: colors.textSecondary}]}>
            Standard mode
          </Text>
        </View>
        <Image
          source={icons.down_arrow}
          style={[styles.chevron, {tintColor: colors.textTertiary}]}
        />
      </TouchableOpacity>

      <View style={styles.listWrap}>
        {visibleRows.map((row, index) => (
          <View key={row.key}>
            <TouchableOpacity
              style={styles.row}
              onPress={row.onPress}
              activeOpacity={0.65}>
              <Image
                source={row.icon}
                style={[styles.rowIcon, {tintColor: colors.textSecondary}]}
              />
              <Text style={[styles.rowLabel, {color: colors.textPrimary}]}>
                {row.label}
              </Text>
            </TouchableOpacity>
            {index < visibleRows.length - 1 ? (
              <View
                style={[styles.divider, {backgroundColor: colors.border}]}
              />
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export default MoreMenu;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 8,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  hero: {
    paddingHorizontal: SIZES.padding,
    marginBottom: 20,
  },
  welcomeTitle: {
    ...FONTS.h2,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  storeName: {
    ...FONTS.body3,
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modeCard: {
    marginHorizontal: SIZES.padding,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  modeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modeTextCol: {
    flex: 1,
  },
  modeTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    fontSize: 16,
  },
  modeSubtitle: {
    ...FONTS.body4,
    marginTop: 2,
    fontSize: 13,
  },
  chevron: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  listWrap: {
    marginHorizontal: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: SIZES.padding,
  },
  rowIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    marginRight: 16,
  },
  rowLabel: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
