import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import React, {useCallback, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {QuickIconPressable} from '../../Components';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePreference} from '../../context/ThemeContext';
import {useSearchMode} from '../../context/SearchModeStore';
import {safeGoBack} from '../../hooks/NavigationService';
import {useOffline} from '../../context/OfflineContext';
import {openPosDatabase} from '../../db/persistence';
import {runOfflineBootstrapIfNeeded} from '../../services/offline/offlineBootstrap';
import {USE_TEST_ENV} from '../../config/api.config';
import {isSimulateOfflineSettingAvailable} from '../../utils/simulatedOfflineGate';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import {useAuth} from '../../context/Store';
import {DEFAULT_LOCAL_CURRENCY_CODE} from '../../utils/currency';
import {
  requestNotificationPermission,
  sendTestNotification,
} from '../../services/NotificationService';

type SettingsRowProps = {
  icon: number;
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress?: () => void;
  trailing?: React.ReactNode;
  showDivider?: boolean;
};

const SettingsRow = ({
  icon,
  title,
  subtitle,
  colors,
  onPress,
  trailing,
  showDivider,
}: SettingsRowProps) => {
  const content = (
    <>
      <Image
        source={icon}
        style={[styles.rowIcon, {tintColor: colors.textSecondary}]}
        resizeMode="contain"
      />
      <View style={styles.rowTextCol}>
        <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, {color: colors.textSecondary}]}
            numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  return (
    <View>
      {onPress ? (
        <TouchableOpacity
          style={styles.row}
          onPress={onPress}
          activeOpacity={0.65}>
          {content}
        </TouchableOpacity>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
      {showDivider ? (
        <View
          style={[styles.divider, {backgroundColor: colors.border}]}
        />
      ) : null}
    </View>
  );
};

const Settings = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors, preference, setPreference} = useTheme();
  const {state, dispatch} = useSearchMode();
  const offline = useOffline();
  const {auth} = useAuth();
  const [downloadingCatalog, setDownloadingCatalog] = useState(false);
  const localCurrencyCode =
    auth.localCurrencyCode || DEFAULT_LOCAL_CURRENCY_CODE;

  const handleDownloadCatalog = useCallback(async () => {
    if (!getEffectiveIsOnline()) {
      Toast.show({
        type: 'info',
        text1: 'Offline',
        text2: 'Connect to the internet to download the catalog.',
        position: 'top',
      });
      return;
    }
    setDownloadingCatalog(true);
    try {
      await openPosDatabase();
      await runOfflineBootstrapIfNeeded(
        {
          setSyncStatus: offline.setSyncStatus,
          setLastSyncAt: offline.setLastSyncAt,
          setSyncError: offline.setSyncError,
          setOutboxCount: offline.applyOutboxCount,
        },
        undefined,
        {force: true},
      );
      await offline.refreshOutboxCount();
      Toast.show({
        type: 'success',
        text1: 'Catalog updated',
        text2: 'Items and customers are ready for offline sales.',
        position: 'top',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Download failed',
        text2: 'Could not refresh the offline catalog.',
        position: 'top',
      });
    } finally {
      setDownloadingCatalog(false);
    }
  }, [offline]);

  const lastSyncLabel = offline.lastSyncAt
    ? new Date(offline.lastSyncAt).toLocaleString()
    : 'Not synced yet';

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const toggleSearchMode = () => {
    const newMode = state.searchMode === 'barcode' ? 'realtime' : 'barcode';
    dispatch({type: 'SET_SEARCH_MODE', payload: newMode});
  };

  const handleTestNotification = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Toast.show({
        type: 'error',
        text1: 'Notifications blocked',
        text2: 'Allow notifications in Android settings to receive alerts.',
        position: 'top',
      });
      return;
    }

    await sendTestNotification();
    Toast.show({
      type: 'success',
      text1: 'Test sent',
      text2: 'Check your phone notification tray.',
      position: 'top',
    });
  }, []);

  const themeOptions: {key: ThemePreference; label: string}[] = [
    {key: 'system', label: 'System'},
    {key: 'light', label: 'Light'},
    {key: 'dark', label: 'Dark'},
  ];

  const renderSectionTitle = (title: string) => (
    <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
      {title}
    </Text>
  );

  const renderSectionCard = (children: React.ReactNode) => (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}>
      {children}
    </View>
  );

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
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
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
            Settings
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.sectionBlock}>
            {renderSectionTitle('Appearance')}
            {renderSectionCard(
              <View style={styles.appearanceBody}>
                <Text style={[styles.appearanceHint, {color: colors.textSecondary}]}>
                  Match system or choose light or dark
                </Text>
                <View style={styles.themeChips}>
                  {themeOptions.map(opt => {
                    const active = preference === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setPreference(opt.key)}
                        style={[
                          styles.themeChip,
                          {
                            backgroundColor: active
                              ? COLORS.primary
                              : colors.screenMuted,
                            borderColor: colors.border,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.themeChipText,
                            {
                              color: active ? COLORS.white : colors.textPrimary,
                            },
                          ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>,
            )}
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionTitle('Regional')}
            {renderSectionCard(
              <SettingsRow
                icon={icons.dollar}
                title="Local currency"
                subtitle={`${localCurrencyCode} — tenant-wide for all branches. Admins can change this in Company & Billing.`}
                colors={colors}
              />,
            )}
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionTitle('Search & scan')}
            {renderSectionCard(
              <>
                <SettingsRow
                  icon={icons.search}
                  title="Search mode"
                  subtitle={
                    state.searchMode === 'barcode'
                      ? 'Manual barcode entry with submit button'
                      : 'Real-time search as you type'
                  }
                  colors={colors}
                  showDivider
                  trailing={
                    <Switch
                      value={state.searchMode === 'realtime'}
                      onValueChange={toggleSearchMode}
                      trackColor={{
                        false: COLORS.lightGray2,
                        true: COLORS.primary,
                      }}
                      thumbColor={COLORS.white}
                      ios_backgroundColor={COLORS.lightGray2}
                    />
                  }
                />
                <SettingsRow
                  icon={icons.focus}
                  title="Barcode scanner"
                  subtitle="Allow camera scanning in sales and item search"
                  colors={colors}
                  showDivider
                  trailing={
                    <Switch
                      value={state.barcodeScannerEnabled}
                      onValueChange={value =>
                        dispatch({
                          type: 'SET_BARCODE_SCANNER_ENABLED',
                          payload: value,
                        })
                      }
                      trackColor={{
                        false: COLORS.lightGray2,
                        true: COLORS.primary,
                      }}
                      thumbColor={COLORS.white}
                      ios_backgroundColor={COLORS.lightGray2}
                    />
                  }
                />
                <SettingsRow
                  icon={icons.notification}
                  title="Barcode beep"
                  subtitle="Play a sound when a barcode is detected"
                  colors={colors}
                  trailing={
                    <Switch
                      value={state.barcodeBeepEnabled}
                      onValueChange={value =>
                        dispatch({
                          type: 'SET_BARCODE_BEEP_ENABLED',
                          payload: value,
                        })
                      }
                      trackColor={{
                        false: COLORS.lightGray2,
                        true: COLORS.primary,
                      }}
                      thumbColor={COLORS.white}
                      ios_backgroundColor={COLORS.lightGray2}
                    />
                  }
                />
              </>,
            )}
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionTitle('Offline POS')}
            {renderSectionCard(
              <>
                <SettingsRow
                  icon={icons.notification}
                  title="Sync queue"
                  subtitle={
                    offline.outboxCount > 0
                      ? `${offline.outboxCount} sale(s) waiting to sync`
                      : 'View pending offline sales'
                  }
                  colors={colors}
                  showDivider
                  onPress={() => navigation.navigate('SyncQueue' as never)}
                  trailing={
                    <Image
                      source={icons.down_arrow as any}
                      style={[
                        styles.rowChevron,
                        {
                          tintColor: colors.textTertiary,
                          transform: [{rotate: '-90deg'}],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  }
                />
                <SettingsRow
                  icon={icons.update}
                  title="Download catalog"
                  subtitle={`Last sync: ${lastSyncLabel}`}
                  colors={colors}
                  showDivider={isSimulateOfflineSettingAvailable()}
                  onPress={() => {
                    void handleDownloadCatalog();
                  }}
                  trailing={
                    downloadingCatalog ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : undefined
                  }
                />
                {isSimulateOfflineSettingAvailable() ? (
                  <SettingsRow
                    icon={icons.globe}
                    title="Simulate offline POS"
                    subtitle="Test offline sales without airplane mode (Wi‑Fi stays on)"
                    colors={colors}
                    trailing={
                      <Switch
                        value={offline.simulateOfflinePos}
                        onValueChange={value => {
                          void offline.setSimulateOfflinePos(value);
                        }}
                        trackColor={{
                          false: COLORS.lightGray2,
                          true: COLORS.primary,
                        }}
                        thumbColor={COLORS.white}
                        ios_backgroundColor={COLORS.lightGray2}
                      />
                    }
                  />
                ) : null}
              </>,
            )}
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionTitle('Notifications')}
            {renderSectionCard(
              <SettingsRow
                icon={icons.notification}
                title="Test phone notification"
                subtitle="Send a sample alert to the Android notification tray"
                colors={colors}
                onPress={() => {
                  void handleTestNotification();
                }}
                trailing={
                  <Image
                    source={icons.down_arrow as any}
                    style={[
                      styles.rowChevron,
                      {
                        tintColor: colors.textTertiary,
                        transform: [{rotate: '-90deg'}],
                      },
                    ]}
                    resizeMode="contain"
                  />
                }
              />,
            )}
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionTitle('Printing')}
            {renderSectionCard(
              <SettingsRow
                icon={icons.printer}
                title="Printer configuration"
                subtitle="Configure and test Sunmi and Bluetooth printers"
                colors={colors}
                onPress={() => navigation.navigate('PrinterConfig' as never)}
                trailing={
                  <Image
                    source={icons.down_arrow as any}
                    style={[
                      styles.rowChevron,
                      {
                        tintColor: colors.textTertiary,
                        transform: [{rotate: '-90deg'}],
                      },
                    ]}
                    resizeMode="contain"
                  />
                }
              />,
            )}
          </View>

          <View style={styles.sectionBlock}>
            {renderSectionTitle('About')}
            {renderSectionCard(
              <SettingsRow
                icon={icons.info}
                title="App version"
                colors={colors}
                trailing={
                  <Text style={[styles.versionText, {color: colors.textSecondary}]}>
                    1.0.0
                  </Text>
                }
              />,
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeOuter: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
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
  headerRoundIcon: {
    width: 20,
    height: 20,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
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
  appearanceBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  appearanceHint: {
    ...FONTS.body5,
    marginBottom: 12,
    lineHeight: 18,
  },
  themeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeChipText: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowIcon: {
    width: 24,
    height: 24,
    marginRight: 14,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  rowTitle: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    ...FONTS.body5,
    marginTop: 2,
    lineHeight: 18,
  },
  rowChevron: {
    width: 16,
    height: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14 + 24 + 14,
  },
  versionText: {
    ...FONTS.body4,
    fontWeight: '600',
  },
});

export default Settings;
