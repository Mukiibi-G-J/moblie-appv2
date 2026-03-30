import {View, Text, TouchableOpacity, StyleSheet, Switch} from 'react-native';
import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePreference} from '../../context/ThemeContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSearchMode} from '../../context/SearchModeStore';
import {Image} from 'react-native';
import {TenantSettings} from '../../Components/TenantSettings';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import Header from '../../Components/Header';

const Settings = () => {
  const {canRead} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PROFILE_SETTINGS;
  const {colors, preference, setPreference} = useTheme();

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <SafeAreaView
        style={[styles.container, {backgroundColor: colors.screenMuted}]}>
        <View
          style={[
            styles.accessDeniedContainer,
            {backgroundColor: colors.card},
          ]}>
          <Text style={[styles.accessDeniedTitle, {color: COLORS.error}]}>
            Access Denied
          </Text>
          <Text
            style={[styles.accessDeniedMessage, {color: colors.textSecondary}]}>
            You don't have permission to view settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const navigation = useNavigation<any>();
  const {state, dispatch} = useSearchMode();

  const toggleSearchMode = () => {
    const newMode = state.searchMode === 'barcode' ? 'realtime' : 'barcode';
    dispatch({type: 'SET_SEARCH_MODE', payload: newMode});
  };

  const themeOptions: {key: ThemePreference; label: string}[] = [
    {key: 'system', label: 'System'},
    {key: 'light', label: 'Light'},
    {key: 'dark', label: 'Dark'},
  ];

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.screenMuted}]}>
      <Header title="Settings" showBack onBackPress={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={[styles.menuItem, {backgroundColor: colors.card}]}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Text style={[styles.menuItemTitle, {color: colors.textPrimary}]}>
                Appearance
              </Text>
            </View>
            <Text
              style={[styles.menuItemSubtitle, {color: colors.textSecondary}]}>
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
          </View>
        </View>

        {/* Search Mode Setting */}
        <View style={[styles.menuItem, {backgroundColor: colors.card}]}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.search} style={styles.settingIcon} />
              <Text style={[styles.menuItemTitle, {color: colors.textPrimary}]}>
                Search Mode
              </Text>
            </View>
            <Text
              style={[styles.menuItemSubtitle, {color: colors.textSecondary}]}>
              {state.searchMode === 'barcode'
                ? 'Manual barcode entry with submit button'
                : 'Real-time search as you type'}
            </Text>
          </View>
          <Switch
            value={state.searchMode === 'realtime'}
            onValueChange={toggleSearchMode}
            trackColor={{false: COLORS.lightGray2, true: COLORS.primary}}
            thumbColor={COLORS.white}
            ios_backgroundColor={COLORS.lightGray2}
          />
        </View>

        <View style={[styles.menuItem, {backgroundColor: colors.card}]}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.focus} style={styles.settingIcon} />
              <Text style={[styles.menuItemTitle, {color: colors.textPrimary}]}>
                Enable Barcode Scanner
              </Text>
            </View>
            <Text
              style={[styles.menuItemSubtitle, {color: colors.textSecondary}]}>
              Allow camera scanning in sales and item search screens
            </Text>
          </View>
          <Switch
            value={state.barcodeScannerEnabled}
            onValueChange={value =>
              dispatch({type: 'SET_BARCODE_SCANNER_ENABLED', payload: value})
            }
            trackColor={{false: COLORS.lightGray2, true: COLORS.primary}}
            thumbColor={COLORS.white}
            ios_backgroundColor={COLORS.lightGray2}
          />
        </View>

        <View style={[styles.menuItem, {backgroundColor: colors.card}]}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.notification} style={styles.settingIcon} />
              <Text style={[styles.menuItemTitle, {color: colors.textPrimary}]}>
                Barcode Beep Sound
              </Text>
            </View>
            <Text
              style={[styles.menuItemSubtitle, {color: colors.textSecondary}]}>
              Play a bip sound when a barcode is detected
            </Text>
          </View>
          <Switch
            value={state.barcodeBeepEnabled}
            onValueChange={value =>
              dispatch({type: 'SET_BARCODE_BEEP_ENABLED', payload: value})
            }
            trackColor={{false: COLORS.lightGray2, true: COLORS.primary}}
            thumbColor={COLORS.white}
            ios_backgroundColor={COLORS.lightGray2}
          />
        </View>

        <TouchableOpacity
          style={[styles.menuItem, {backgroundColor: colors.card}]}
          onPress={() => navigation.navigate('PrinterConfig' as never)}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.printer} style={styles.settingIcon} />
              <Text style={[styles.menuItemTitle, {color: colors.textPrimary}]}>
                Printer Configuration
              </Text>
            </View>
            <Text
              style={[styles.menuItemSubtitle, {color: colors.textSecondary}]}>
              Configure and test printer settings (Sunmi & Bluetooth)
            </Text>
          </View>
          <Text style={[styles.arrow, {color: colors.textSecondary}]}>›</Text>
        </TouchableOpacity>

        {/* Tenant Settings */}
        <TenantSettings />

        {/* App Version */}
        <TouchableOpacity style={[styles.menuItem, {backgroundColor: colors.card}]}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.info} style={styles.settingIcon} />
              <Text style={[styles.menuItemTitle, {color: colors.textPrimary}]}>
                App Version
              </Text>
            </View>
            <Text style={[styles.menuItemSubtitle, {color: colors.textSecondary}]}>
              Version 1.0.0
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  themeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
  content: {
    padding: SIZES.padding,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    ...FONTS.h4,
    marginBottom: 4,
  },
  menuItemSubtitle: {
    ...FONTS.body4,
  },
  arrow: {
    ...FONTS.h3,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary,
    marginRight: 8,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 16,
    borderRadius: SIZES.radius,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
  },
});

export default Settings;
