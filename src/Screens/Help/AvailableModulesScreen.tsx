import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {QuickIconPressable} from '../../Components';
import {safeGoBack} from '../../hooks/NavigationService';
import {
  CompanyModule,
  CompanyModulesResponse,
  getCompanyModules,
  toggleCompanyModule,
} from '../../services/companyModules.service';

function moduleSourceLabel(
  mod: CompanyModule,
  isTrial: boolean,
): string {
  if (mod.from_plan && mod.from_override) {
    return 'Plan + Trial';
  }
  if (mod.from_plan) {
    return 'Subscription Plan';
  }
  if (mod.from_override) {
    return isTrial ? 'Trial (enabled by you)' : 'Manual Override';
  }
  return '—';
}

function moduleExtraNote(
  mod: CompanyModule,
  planBranches: string | null | undefined,
  enabledModules: string[],
): string | null {
  if (mod.identifier === 'item_tracking' && planBranches) {
    return `Same branch allowance as your package: ${planBranches}. Tracking is maintained per branch.`;
  }
  if (mod.identifier === 'multi_branch') {
    return 'When included, your company can have up to 3 branch locations (if your plan allows fewer, this raises the cap to 3). Add branches under Setup, then use branch switching to work and post Stock Taking per location.';
  }
  if (
    mod.identifier === 'stock_taking' &&
    enabledModules.includes('multi_branch')
  ) {
    return 'With Multi-Branch enabled, create physical inventory journals for each branch you have access to.';
  }
  return null;
}

type StatusKind =
  | 'included'
  | 'enabled'
  | 'trial_disable'
  | 'try_it'
  | 'not_included';

function moduleStatusKind(
  mod: CompanyModule,
  allowManual: boolean,
  isTrial: boolean,
): StatusKind {
  const canDisable = allowManual && mod.from_override && !mod.from_plan;
  const canEnable = allowManual && !mod.enabled;

  if (mod.enabled && mod.from_plan) {
    return 'included';
  }
  if (mod.enabled && canDisable) {
    return 'trial_disable';
  }
  if (mod.enabled) {
    return 'enabled';
  }
  if (canEnable) {
    return 'try_it';
  }
  void isTrial;
  return 'not_included';
}

const AvailableModulesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const [data, setData] = useState<CompanyModulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const res = await getCompanyModules();
    setData(res);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const subtitle = useMemo(() => {
    if (!data?.plan_name) {
      return 'Full list of modules and their status for your company.';
    }
    const branches =
      data.plan_branches != null && data.plan_branches !== ''
        ? ` (branches: ${data.plan_branches})`
        : '';
    return `Full list of modules and their status for your company on the ${data.plan_name} plan${branches}.`;
  }, [data]);

  const handleToggle = async (mod: CompanyModule, action: 'enable' | 'disable') => {
    setTogglingId(mod.identifier);
    const result = await toggleCompanyModule(mod.identifier, action);
    setTogglingId(null);
    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Module update failed',
        text2: result.error || 'Please try again.',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: action === 'enable' ? 'Module enabled' : 'Module disabled',
      text2:
        action === 'enable'
          ? 'Log out and back in to refresh your menu.'
          : 'Log out and back in to update the app menu.',
    });
    await load(true);
  };

  const renderStatus = (mod: CompanyModule) => {
    if (!data) {
      return null;
    }
    const kind = moduleStatusKind(
      mod,
      data.allow_manual_module_toggle,
      data.is_trial,
    );
    const busy = togglingId === mod.identifier;

    if (kind === 'trial_disable') {
      return (
        <TouchableOpacity
          style={[styles.statusBtn, styles.statusBtnAmber]}
          onPress={() => void handleToggle(mod, 'disable')}
          disabled={busy}
          activeOpacity={0.85}>
          {busy ? (
            <ActivityIndicator size="small" color="#B45309" />
          ) : (
            <Text style={styles.statusBtnAmberText}>
              {data.is_trial ? 'Trial — Disable' : 'Remove override'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }
    if (kind === 'try_it') {
      return (
        <TouchableOpacity
          style={[styles.statusBtn, styles.statusBtnBlue]}
          onPress={() => void handleToggle(mod, 'enable')}
          disabled={busy}
          activeOpacity={0.85}>
          {busy ? (
            <ActivityIndicator size="small" color="#1D4ED8" />
          ) : (
            <Text style={styles.statusBtnBlueText}>
              {data.is_trial ? 'Try it' : 'Include module'}
            </Text>
          )}
        </TouchableOpacity>
      );
    }
    if (kind === 'included') {
      return (
        <View style={[styles.statusPill, styles.statusPillGreen]}>
          <Text style={styles.statusPillGreenText}>Included in Plan</Text>
        </View>
      );
    }
    if (kind === 'enabled') {
      return (
        <View style={[styles.statusPill, styles.statusPillGreen]}>
          <Text style={styles.statusPillGreenText}>Enabled</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusPill, styles.statusPillGray]}>
        <Text style={styles.statusPillGrayText}>Not Included</Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeOuter, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.root, {backgroundColor: colors.background}]}>
        <View
          style={[
            styles.topHeader,
            {
              paddingTop: headerPaddingTop,
              borderBottomColor: colors.border,
            },
          ]}>
          <QuickIconPressable
            style={[
              styles.headerRoundButton,
              {borderColor: colors.border, backgroundColor: colors.card},
            ]}
            onPress={() => safeGoBack(navigation, 'Home')}
            accessibilityLabel="Go back">
            <Image
              source={icons.back as any}
              style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.topTitle, {color: colors.textPrimary}]}>
            All modules
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        {loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={[styles.hint, {color: colors.textSecondary}]}>
              Loading modules…
            </Text>
          </View>
        ) : !data?.modules?.length ? (
          <View style={styles.centered}>
            <Text style={[styles.errorText, {color: colors.textSecondary}]}>
              Could not load modules. Pull to refresh or try again later.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, {backgroundColor: COLORS.primary}]}
              onPress={() => void load()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load(true)}
                tintColor={COLORS.primary}
              />
            }
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.pageTitle, {color: colors.textPrimary}]}>
              All Available Modules
            </Text>
            <Text style={[styles.pageSubtitle, {color: colors.textSecondary}]}>
              {subtitle}
            </Text>

            {data.is_trial && data.allow_manual_module_toggle ? (
              <View style={[styles.trialBanner, {borderColor: '#BFDBFE'}]}>
                <Text style={styles.trialBannerText}>
                  On a free trial you can tap Try it on Business+ and add-on
                  modules. Log out and back in after enabling to see new menu
                  items.
                </Text>
              </View>
            ) : null}

            {data.modules.map((mod, idx) => {
              const extra = moduleExtraNote(
                mod,
                data.plan_branches,
                data.enabled_modules,
              );
              const source = moduleSourceLabel(mod, data.is_trial);

              return (
                <View
                  key={mod.identifier}
                  style={[
                    styles.moduleCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    idx % 2 === 1 && {backgroundColor: colors.screenMuted},
                  ]}>
                  <Text style={[styles.moduleName, {color: colors.textPrimary}]}>
                    {mod.display_name}
                  </Text>
                  <Text
                    style={[styles.moduleDesc, {color: colors.textSecondary}]}>
                    {mod.description}
                  </Text>
                  {extra ? (
                    <Text style={[styles.moduleExtra, {color: colors.textSecondary}]}>
                      {extra}
                    </Text>
                  ) : null}

                  <View style={styles.metaRow}>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaLabel, {color: colors.textSecondary}]}>
                        Category
                      </Text>
                      <Text style={[styles.metaValue, {color: colors.textPrimary}]}>
                        {mod.category}
                      </Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaLabel, {color: colors.textSecondary}]}>
                        Source
                      </Text>
                      <Text style={[styles.metaValue, {color: colors.textPrimary}]}>
                        {source}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>{renderStatus(mod)}</View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

export default AvailableModulesScreen;

const styles = StyleSheet.create({
  safeOuter: {flex: 1},
  root: {flex: 1},
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRoundIcon: {width: 20, height: 20},
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
  },
  headerTrailingSpacer: {width: 40, height: 40},
  scroll: {flex: 1},
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    gap: 12,
  },
  hint: {...FONTS.body4, marginTop: 8},
  errorText: {...FONTS.body3, textAlign: 'center'},
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryBtnText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    ...FONTS.body4,
    lineHeight: 20,
    marginBottom: 16,
  },
  trialBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  trialBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1E40AF',
  },
  moduleCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  moduleName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  moduleDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  moduleExtra: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  metaCell: {flex: 1},
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    alignItems: 'flex-start',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillGreen: {
    backgroundColor: '#D1FAE5',
  },
  statusPillGreenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  statusPillGray: {
    backgroundColor: '#F3F4F6',
  },
  statusPillGrayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  statusBtnBlue: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  statusBtnBlueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  statusBtnAmber: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  statusBtnAmberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
});
