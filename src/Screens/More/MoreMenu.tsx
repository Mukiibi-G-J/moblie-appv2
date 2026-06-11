import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  constants,
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import { AppContextType, useAppContext, useAuth, useTabContext } from '../../context/Store';
import { usePermissions } from '../../hooks/usePermissions';
import { PAGE_NAMES, RESTAURANT_MODULE_ENTRY_PAGE_NAMES } from '../../constants/pageNames';
import { navigate } from '../../hooks/NavigationService';
import { useCompanyInfo } from '../../hooks/useCompanyInfo';
import {
  fetchCompanyBranches,
  fetchUserProfileBranchFields,
  resolveEffectiveBranchCode,
  type BranchListRow,
} from '../../services/branchProfile.service';

type MenuRow = {
  key: string;
  label: string;
  icon: any;
  onPress: () => void;
  visible: boolean;
};

type MenuSection = {
  key: string;
  title: string;
  rows: MenuRow[];
};

const quickPressProps = {
  delayPressIn: 0 as const,
  delayHoverIn: 0 as const,
  unstable_pressDelay: 0 as const,
};

const SUPPORT_NUMBERS = ['+256750440865', '+256779899789'] as const;

const MoreMenu: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const app = useAppContext() as AppContextType;
  const { logout } = app;
  const { setSelectedTab } = useTabContext();
  const { isModuleVisible, hasAnyPageAccess } = usePermissions();
  const { storeLabel } = useCompanyInfo();
  const [profileBranchCode, setProfileBranchCode] = useState <
    string | null | undefined
    > (undefined);
  const [profileBranchDescription, setProfileBranchDescription] = useState <
    string | null
    > (null);
  const [branches, setBranches] = useState < BranchListRow[] > ([]);
  const [branchLoadState, setBranchLoadState] = useState <
    'idle' | 'loading' | 'error'
    > ('idle');
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [switchSelectedId, setSwitchSelectedId] = useState<number | null>(null);
  const [switchConfirming, setSwitchConfirming] = useState(false);
  const loadBranchContext = useCallback(async () => {
    if (!auth.user_id) {
      setProfileBranchCode(null);
      setProfileBranchDescription(null);
      setBranches([]);
      setBranchLoadState('idle');
      return;
    }
    setBranchLoadState('loading');
    try {
      const [profile, branchList] = await Promise.all([
        fetchUserProfileBranchFields(),
        fetchCompanyBranches(),
      ]);
      setProfileBranchCode(profile.dimension_1);
      setProfileBranchDescription(profile.dimension_1_description);
      setBranches(branchList);
      setBranchLoadState('idle');
    } catch {
      setBranchLoadState('error');
      setProfileBranchCode(null);
      setProfileBranchDescription(null);
      setBranches([]);
    }
  }, [auth.user_id]);

  useFocusEffect(
    useCallback(() => {
      loadBranchContext();
    }, [loadBranchContext]),
  );

  const firstName = auth.full_name?.trim()?.split(/\s+/)[0];

  const effectiveBranchCode = useMemo(() => {
    // Prefer the explicit working branch chosen via branchSession (active_branch).
    const sessionCode = app?.branchSession?.active_branch?.code;
    if (sessionCode) {
      return sessionCode;
    }

    const sessionId = app?.branchSession?.active_branch_id ?? null;
    if (sessionId != null) {
      const matchById = branches.find((b) => b.id === sessionId);
      if (matchById?.code) {
        return matchById.code;
      }
    }

    // Fallback to assigned branch logic from the profile.
    if (profileBranchCode === undefined) {
      return undefined;
    }
    return resolveEffectiveBranchCode(profileBranchCode, branches);
  }, [
    app?.branchSession?.active_branch?.code,
    app?.branchSession?.active_branch_id,
    profileBranchCode,
    branches,
  ]);

  const branchSubtitle = useMemo(() => {
    if (!auth.user_id) {
      return 'Sign in to see your branch';
    }
    if (
      branchLoadState === 'loading' ||
      profileBranchCode === undefined ||
      effectiveBranchCode === undefined
    ) {
      return 'Loading…';
    }
    if (branchLoadState === 'error') {
      return 'Unable to load branch';
    }
    if (!effectiveBranchCode) {
      return 'No branch assigned';
    }
    if (
      profileBranchDescription &&
      profileBranchCode &&
      profileBranchCode === effectiveBranchCode
    ) {
      return `${profileBranchDescription} (${effectiveBranchCode})`;
    }
    const match = branches.find(v => v.code === effectiveBranchCode);
    if (match) {
      return `${match.description} (${match.code})`;
    }
    return effectiveBranchCode;
  }, [
    auth.user_id,
    branchLoadState,
    profileBranchCode,
    profileBranchDescription,
    branches,
    effectiveBranchCode,
  ]);

  const modalBranchRows = useMemo(() => {
    if (!effectiveBranchCode || branches.length === 0) {
      return branches;
    }
    const primary = branches.filter(v => v.code === effectiveBranchCode);
    const rest = branches.filter(v => v.code !== effectiveBranchCode);
    return [...primary, ...rest];
  }, [effectiveBranchCode, branches]);

  const canSwitchBranch =
    app?.branchSession?.enable_multiple_branches === true &&
    app?.branchSession?.can_switch_branch !== false;

  useEffect(() => {
    if (!switchModalVisible) return;
    if (branches.length === 0) return;
    // Default selection: current active branch if present, otherwise first branch.
    const activeId = app?.branchSession?.active_branch_id ?? null;
    const defaultId =
      (activeId && branches.some((b) => b.id === activeId) ? activeId : null) ??
      branches[0]!.id;
    setSwitchSelectedId(defaultId);
  }, [switchModalVisible, branches, app?.branchSession?.active_branch_id]);

  const handleConfirmSwitchBranch = useCallback(async () => {
    if (!app) return;
    if (switchSelectedId == null) return;
    const b = branches.find((x) => x.id === switchSelectedId);
    if (!b) return;

    setSwitchConfirming(true);
    try {
      await app.setActiveBranch({
        id: b.id,
        code: b.code,
        description: b.description ?? b.code,
      });
      await app.setBranchSelectionPending(false);
      setSwitchModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Branch switched',
        text2: `${b.description ?? b.code} (${b.code})`,
      });
      // Bring user back home so lists refresh with the new branch header.
      setSelectedTab(constants.screens.home);
      navigate('Home', undefined);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not switch branch',
        text2: e?.message || 'Please try again.',
      });
    } finally {
      setSwitchConfirming(false);
    }
  }, [app, branches, setSelectedTab, switchSelectedId]);

  const handleSupportPress = useCallback(async () => {
    const normalizeDigits = (raw: string) => raw.replace(/[^\d]/g, '');

    const callNumber = async (raw: string) => {
      const telUrl = `tel:${raw}`;
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Toast.show({
          type: 'error',
          text1: 'Unable to place call',
          text2: `This device cannot call ${raw}.`,
        });
        return;
      }
      await Linking.openURL(telUrl);
    };

    const openWhatsApp = async (raw: string) => {
      const digits = normalizeDigits(raw);
      const waUrl = `https://wa.me/${digits}`;
      const canOpen = await Linking.canOpenURL(waUrl);
      if (!canOpen) {
        Toast.show({
          type: 'error',
          text1: 'Unable to open WhatsApp',
          text2: `Could not open WhatsApp for ${raw}.`,
        });
        return;
      }
      await Linking.openURL(waUrl);
    };

    Alert.alert(
      'Help & Support',
      'Choose support channel:',
      [
        {
          text: `Call ${SUPPORT_NUMBERS[0]}`,
          onPress: () => {
            void callNumber(SUPPORT_NUMBERS[0]);
          },
        },
        {
          text: `WhatsApp ${SUPPORT_NUMBERS[0]}`,
          onPress: () => {
            void openWhatsApp(SUPPORT_NUMBERS[0]);
          },
        },
        {
          text: `Call ${SUPPORT_NUMBERS[1]}`,
          onPress: () => {
            void callNumber(SUPPORT_NUMBERS[1]);
          },
        },
        {
          text: `WhatsApp ${SUPPORT_NUMBERS[1]}`,
          onPress: () => {
            void openWhatsApp(SUPPORT_NUMBERS[1]);
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ],
      {cancelable: true},
    );
  }, []);

  const menuSections: MenuSection[] = useMemo(() => {
    const sectionDefs: MenuSection[] = [
      {
        key: 'sales',
        title: 'Sales & reports',
        rows: [
          {
            key: 'salesHistory',
            label: 'Sales History',
            icon: icons.reports,
            visible:
              isModuleVisible('sales') &&
              hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY),
            onPress: () => navigate('SalesHistory', undefined),
          },
          {
            key: 'reports',
            label: 'Reports',
            icon: icons.reports,
            visible:
              isModuleVisible('reports') &&
              hasAnyPageAccess(PAGE_NAMES.REPORTS),
            onPress: () => navigate('Reports', undefined),
          },
        ],
      },
      {
        key: 'inventory',
        title: 'Inventory',
        rows: [
          {
            key: 'items',
            label: 'Items',
            icon: icons.product,
            visible:
              isModuleVisible('items') && hasAnyPageAccess(PAGE_NAMES.ITEMS),
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
            key: 'openingBalance',
            label: 'Opening balance',
            icon: icons.itemJournal,
            visible:
              isModuleVisible('inventory') &&
              hasAnyPageAccess(PAGE_NAMES.ITEM_JOURNAL),
            onPress: () => navigate('OpeningBalanceJournal', undefined),
          },
        ],
      },
      {
        key: 'people',
        title: 'Customers & suppliers',
        rows: [
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
        ],
      },
      {
        key: 'expenses',
        title: 'Expenses',
        rows: [
          {
            key: 'expenses',
            label: 'Expenses',
            icon: icons.coupon,
            visible:
              isModuleVisible('expenses') &&
              hasAnyPageAccess(PAGE_NAMES.EXPENSES),
            onPress: () => navigate('Expenses', undefined),
          },
        ],
      },
      {
        key: 'payments',
        title: 'Payments & banking',
        rows: [
          {
            key: 'bankAccounts',
            label: constants.screens.bankAccounts,
            icon: icons.wallet,
            visible:
              isModuleVisible('payments') &&
              hasAnyPageAccess(PAGE_NAMES.BANK_ACCOUNT_MANAGEMENT),
            onPress: () => navigate('BankAccounts', undefined),
          },
          {
            key: 'payments',
            label: constants.screens.payments,
            icon: icons.wallet,
            visible:
              isModuleVisible('payments') &&
              hasAnyPageAccess(PAGE_NAMES.PAYMENTS),
            onPress: () => navigate('Payments', undefined),
          },
          {
            key: 'prepayments',
            label: constants.screens.prepayments,
            icon: icons.coupon,
            visible:
              isModuleVisible('payments') &&
              hasAnyPageAccess(PAGE_NAMES.PREPAYMENTS),
            onPress: () => navigate('Prepayments', undefined),
          },
          {
            key: 'loans',
            label: constants.screens.loans,
            icon: icons.wallet,
            visible:
              isModuleVisible('payments') &&
              hasAnyPageAccess(PAGE_NAMES.LOAN_REGISTRATION),
            onPress: () => navigate('Loans', undefined),
          },
          {
            key: 'loanRepayments',
            label: constants.screens.loanRepayments,
            icon: icons.wallet,
            visible:
              isModuleVisible('payments') &&
              hasAnyPageAccess(PAGE_NAMES.LOAN_REPAYMENT),
            onPress: () => navigate('LoanRepayments', undefined),
          },
        ],
      },
      {
        key: 'restaurant',
        title: 'Restaurant',
        rows: [
          {
            key: 'restaurant',
            label: 'Restaurant',
            icon: icons.tray,
            visible:
              isModuleVisible('restaurant') &&
              RESTAURANT_MODULE_ENTRY_PAGE_NAMES.some(p =>
                hasAnyPageAccess(p),
              ),
            onPress: () => navigate('RestaurantHub', undefined),
          },
        ],
      },
      {
        key: 'company',
        title: 'Company',
        rows: [
          {
            key: 'companyBilling',
            label: 'Company & Billing',
            icon: icons.company,
            visible: true,
            onPress: () => navigate('BusinessDetails', undefined),
          },
          {
            key: 'userManagement',
            label: constants.screens.userManagement,
            icon: icons.profile,
            visible:
              isModuleVisible('userManagement') &&
              hasAnyPageAccess(PAGE_NAMES.USER_MANAGEMENT),
            onPress: () => navigate('UserManagement', undefined),
          },
        ],
      },
      {
        key: 'app',
        title: 'App',
        rows: [
          {
            key: 'settings',
            label: 'Settings',
            icon: icons.setting,
            visible: true,
            onPress: () => navigate('Settings', undefined),
          },
          {
            key: 'support',
            label: 'Help & Support',
            icon: icons.help,
            visible: true,
            onPress: () => {
              void handleSupportPress();
            },
          },
          {
            key: 'logout',
            label: 'Logout',
            icon: icons.logout,
            visible: true,
            onPress: () => {
              logout();
            },
          },
        ],
      },
    ];

    return sectionDefs
      .map(section => ({
        ...section,
        rows: section.rows.filter(row => row.visible),
      }))
      .filter(section => section.rows.length > 0);
  }, [isModuleVisible, hasAnyPageAccess, logout, handleSupportPress]);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: SIZES.padding * 2,
        paddingTop: Math.max(insets.top, 12),
      }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable
          {...quickPressProps}
          onPress={() => setSelectedTab(constants.screens.home)}
          style={({ pressed }) => [
            styles.circleBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              opacity: pressed ? ICON_BUTTON_ACTIVE_OPACITY : 1,
            },
          ]}
          android_ripple={
            Platform.OS === 'android'
              ? { color: 'rgba(0,0,0,0.12)', foreground: true }
              : undefined
          }
          hitSlop={12}
          accessibilityLabel="Go to Home">
          <Image
            source={icons.home as any}
            style={[styles.topBarIcon, { tintColor: colors.textPrimary }]}
          />
        </Pressable>
        <Pressable
          {...quickPressProps}
          onPress={() => navigate('Subscription', undefined)}
          style={({ pressed }) => [
            styles.circleBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
              opacity: pressed ? ICON_BUTTON_ACTIVE_OPACITY : 1,
            },
          ]}
          android_ripple={
            Platform.OS === 'android'
              ? { color: 'rgba(0,0,0,0.12)', foreground: true }
              : undefined
          }
          hitSlop={ICON_BUTTON_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Subscription and perks">
          <Image
            source={icons.coupon as any}
            style={[styles.topBarIcon, { tintColor: colors.textPrimary }]}
          />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
          Welcome back{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={[styles.companySectionLabel, { color: colors.textSecondary }]}>
          Company
        </Text>
        <Pressable
          {...quickPressProps}
          onPress={() => navigate('BusinessDetails', undefined)}
          android_ripple={
            Platform.OS === 'android'
              ? { color: 'rgba(0,0,0,0.08)' }
              : undefined
          }
          style={({ pressed }) => [
            styles.companyInfoCard,
            {
              backgroundColor: colors.screenMuted,
              borderColor: colors.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Business details">
          <View style={[styles.companyInfoIconWrap, { backgroundColor: colors.card }]}>
            <Image
              source={icons.company as any}
              style={[styles.companyInfoIcon, { tintColor: colors.textSecondary }]}
            />
          </View>
          <View style={styles.companyInfoTextCol}>
            <Text
              style={[styles.companyInfoName, { color: colors.textPrimary }]}
              numberOfLines={2}>
              {storeLabel}
            </Text>
            <Text style={[styles.companyInfoHint, { color: colors.textSecondary }]}>
              Business details
            </Text>
          </View>
          <Image
          source={icons.down_arrow as any}
            style={[
              styles.companyInfoChevron,
              { tintColor: colors.textTertiary, transform: [{ rotate: '-90deg' }] },
            ]}
          />
        </Pressable>
      </View>

      <Pressable
        {...quickPressProps}
        onPress={() => {
          if (canSwitchBranch) {
            setSwitchModalVisible(true);
            return;
          }
          setBranchModalVisible(true);
        }}
        android_ripple={
          Platform.OS === 'android'
            ? { color: 'rgba(0,0,0,0.08)' }
            : undefined
        }
        style={({ pressed }) => [
          styles.modeCard,
          {
            backgroundColor: colors.screenMuted,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={canSwitchBranch ? 'Current branch' : 'Your assigned branch'}
        accessibilityHint={
          canSwitchBranch
            ? 'Opens branch switcher'
            : 'Opens details for your current branch'
        }>
        <View style={[styles.modeIconWrap, { backgroundColor: colors.card }]}>
          <Image
            source={icons.map as any}
            style={[styles.branchIcon, { tintColor: colors.textSecondary }]}
          />
        </View>
        <View style={styles.modeTextCol}>
          <Text style={[styles.modeTitle, { color: colors.textPrimary }]}>
            {canSwitchBranch ? 'Branch' : 'Current branch'}
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.modeSubtitle, { color: colors.textSecondary }]}>
            {branchSubtitle}
          </Text>
        </View>
        <Image
          source={icons.down_arrow as any}
          style={[
            styles.chevron,
            {
              tintColor: colors.textTertiary,
              transform: [{ rotate: canSwitchBranch ? '0deg' : '-90deg' }],
            },
          ]}
        />
      </Pressable>

      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setBranchModalVisible(false)}
          accessibilityLabel="Close assigned branch dialog">
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
            onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Your assigned branch
            </Text>
            <Text
              style={[styles.modalHint, { color: colors.textSecondary }]}>
              The branch below is the one assigned to your account—your current
              working branch (same as on the web app). An administrator can
              change it in user settings.
            </Text>
            {branchLoadState === 'loading' ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : branchLoadState === 'error' ? (
              <View style={styles.modalLoading}>
                <Text style={{ color: colors.textSecondary }}>
                  Could not load branches.
                </Text>
                <Pressable
                  {...quickPressProps}
                  onPress={() => {
                    loadBranchContext();
                  }}
                  style={styles.modalRetry}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : branches.length === 0 ? (
              <Text style={[styles.modalEmpty, { color: colors.textSecondary }]}>
                {effectiveBranchCode
                  ? profileBranchDescription
                    ? `${profileBranchDescription} (${effectiveBranchCode})`
                    : `Your branch: ${effectiveBranchCode}`
                  : 'No branches are set up for this company.'}
              </Text>
            ) : (
              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled>
                {modalBranchRows.map(row => {
                  const isEffective = effectiveBranchCode === row.code;
                  const isProfileAssigned =
                    !!profileBranchCode && profileBranchCode === row.code;
                  return (
                    <View
                      key={row.code}
                      style={[
                        styles.modalRow,
                        { borderBottomColor: colors.border },
                      ]}>
                      <View style={styles.modalRowText}>
                        <Text
                          style={[
                            styles.modalRowTitle,
                            { color: colors.textPrimary },
                          ]}>
                          {row.description}
                        </Text>
                        <Text
                          style={[
                            styles.modalRowCode,
                            { color: colors.textSecondary },
                          ]}>
                          {row.code}
                        </Text>
                      </View>
                      {isEffective ? (
                        <Text
                          style={[
                            styles.modalCurrentBadge,
                            { color: colors.textSecondary },
                          ]}>
                          {isProfileAssigned ? 'Assigned' : 'In use'}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <Pressable
              {...quickPressProps}
              onPress={() => setBranchModalVisible(false)}
              style={[
                styles.modalCloseBtn,
                { backgroundColor: colors.screenMuted },
              ]}>
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={switchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => (switchConfirming ? null : setSwitchModalVisible(false))}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => (switchConfirming ? null : setSwitchModalVisible(false))}
          accessibilityLabel="Close switch branch dialog">
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
            onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Switch branch
            </Text>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              This sets your working branch for the whole app. Reports can still
              override this per report.
            </Text>

            {branchLoadState === 'loading' ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : branchLoadState === 'error' ? (
              <View style={styles.modalLoading}>
                <Text style={{ color: colors.textSecondary }}>
                  Could not load branches.
                </Text>
                <Pressable
                  {...quickPressProps}
                  onPress={() => {
                    loadBranchContext();
                  }}
                  style={styles.modalRetry}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : branches.length === 0 ? (
              <Text style={[styles.modalEmpty, { color: colors.textSecondary }]}>
                No branches are set up for this company.
              </Text>
            ) : (
              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled>
                {branches.map(row => {
                  const selected = switchSelectedId === row.id;
                  return (
                    <Pressable
                      key={String(row.id)}
                      {...quickPressProps}
                      onPress={() => setSwitchSelectedId(row.id)}
                      style={[
                        styles.modalRow,
                        {
                          borderBottomColor: colors.border,
                          opacity: switchConfirming ? 0.7 : 1,
                        },
                      ]}>
                      <View style={styles.modalRowText}>
                        <Text
                          style={[
                            styles.modalRowTitle,
                            { color: colors.textPrimary },
                          ]}>
                          {row.description}
                        </Text>
                        <Text
                          style={[
                            styles.modalRowCode,
                            { color: colors.textSecondary },
                          ]}>
                          {row.code}
                        </Text>
                      </View>
                      {selected ? (
                        <Text
                          style={[
                            styles.modalCurrentBadge,
                            { color: colors.textSecondary },
                          ]}>
                          Selected
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              {...quickPressProps}
              onPress={() => void handleConfirmSwitchBranch()}
              disabled={switchConfirming || switchSelectedId == null}
              style={[
                styles.modalCloseBtn,
                {
                  backgroundColor: COLORS.primary2,
                  opacity: switchConfirming || switchSelectedId == null ? 0.7 : 1,
                },
              ]}>
              {switchConfirming ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={[styles.modalCloseBtnText, { color: COLORS.white }]}>
                  Continue
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.menuSections}>
        {menuSections.map(section => (
          <View key={section.key} style={styles.sectionBlock}>
            <Text
              style={[styles.sectionTitle, {color: colors.textSecondary}]}>
              {section.title}
            </Text>
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}>
              {section.rows.map((row, index) => (
                <View key={row.key}>
                  <Pressable
                    {...quickPressProps}
                    style={({pressed}) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={row.onPress}
                    android_ripple={
                      Platform.OS === 'android'
                        ? {color: 'rgba(0,0,0,0.1)'}
                        : undefined
                    }>
                    <Image
                      source={row.icon as any}
                      style={[
                        styles.rowIcon,
                        {tintColor: colors.textSecondary},
                      ]}
                    />
                    <Text
                      style={[styles.rowLabel, {color: colors.textPrimary}]}>
                      {row.label}
                    </Text>
                  </Pressable>
                  {index < section.rows.length - 1 ? (
                    <View
                      style={[
                        styles.divider,
                        {backgroundColor: colors.border},
                      ]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
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
  companySectionLabel: {
    ...FONTS.body5,
    marginTop: 14,
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  companyInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  companyInfoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  companyInfoIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  companyInfoTextCol: {
    flex: 1,
    minWidth: 0,
  },
  companyInfoName: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  companyInfoHint: {
    ...FONTS.body5,
    marginTop: 2,
  },
  companyInfoChevron: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
    marginLeft: 8,
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
  branchIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  menuSections: {
    paddingHorizontal: SIZES.padding,
    gap: 20,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    ...FONTS.body5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SIZES.padding + 24 + 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  rowPressed: {
    opacity: 0.65,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '72%',
  },
  modalTitle: {
    ...FONTS.h3,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalHint: {
    ...FONTS.body4,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  modalLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  modalRetry: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalEmpty: {
    ...FONTS.body4,
    fontSize: 14,
    paddingVertical: 16,
  },
  modalList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalRowText: {
    flex: 1,
    paddingRight: 8,
  },
  modalRowTitle: {
    ...FONTS.h3,
    fontSize: 15,
    fontWeight: '600',
  },
  modalRowCode: {
    ...FONTS.body4,
    fontSize: 12,
    marginTop: 2,
  },
  modalCurrentBadge: {
    ...FONTS.body4,
    fontSize: 12,
    fontWeight: '600',
  },
  modalCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  modalCloseBtnText: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '600',
  },
});
