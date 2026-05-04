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
} from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuickIconPressable } from '../../Components';
import { COLORS, FONTS, SIZES, icons } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import type { ThemePreference } from '../../context/ThemeContext';
import { useSearchMode } from '../../context/SearchModeStore';
import { safeGoBack } from '../../hooks/NavigationService';

const Settings = () => {
  const navigation = useNavigation < any > ();
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference } = useTheme();
  const { state, dispatch } = useSearchMode();

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const toggleSearchMode = () => {
    const newMode = state.searchMode === 'barcode' ? 'realtime' : 'barcode';
    dispatch({ type: 'SET_SEARCH_MODE', payload: newMode });
  };

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  return (
    <SafeAreaView
      style={[styles.safeOuter, { backgroundColor: colors.background }]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
              style={[styles.headerRoundIcon, { tintColor: colors.textPrimary }]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.topTitle, { color: colors.textPrimary }]}>
            Settings
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
            <View style={styles.menuItemContent}>
              <View style={styles.settingHeader}>
                <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                  Appearance
                </Text>
              </View>
              <Text
                style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
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

          <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
            <View style={styles.menuItemContent}>
              <View style={styles.settingHeader}>
                <Image
                  source={icons.search}
                  style={[styles.settingIcon, { tintColor: COLORS.primary2 }]}
                />
                <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                  Search mode
                </Text>
              </View>
              <Text
                style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                {state.searchMode === 'barcode'
                  ? 'Manual barcode entry with submit button'
                  : 'Real-time search as you type'}
              </Text>
            </View>
            <Switch
              value={state.searchMode === 'realtime'}
              onValueChange={toggleSearchMode}
              trackColor={{ false: COLORS.lightGray2, true: COLORS.primary }}
              thumbColor={COLORS.white}
              ios_backgroundColor={COLORS.lightGray2}
            />
          </View>

          <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
            <View style={styles.menuItemContent}>
              <View style={styles.settingHeader}>
                <Image
                  source={icons.focus}
                  style={[styles.settingIcon, { tintColor: COLORS.primary2 }]}
                />
                <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                  Enable barcode scanner
                </Text>
              </View>
              <Text
                style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                Allow camera scanning in sales and item search screens
              </Text>
            </View>
            <Switch
              value={state.barcodeScannerEnabled}
              onValueChange={value =>
                dispatch({ type: 'SET_BARCODE_SCANNER_ENABLED', payload: value })
              }
              trackColor={{ false: COLORS.lightGray2, true: COLORS.primary }}
              thumbColor={COLORS.white}
              ios_backgroundColor={COLORS.lightGray2}
            />
          </View>

          <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
            <View style={styles.menuItemContent}>
              <View style={styles.settingHeader}>
                <Image
                  source={icons.notification}
                  style={[styles.settingIcon, { tintColor: COLORS.primary2 }]}
                />
                <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                  Barcode beep sound
                </Text>
              </View>
              <Text
                style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                Play a sound when a barcode is detected
              </Text>
            </View>
            <Switch
              value={state.barcodeBeepEnabled}
              onValueChange={value =>
                dispatch({ type: 'SET_BARCODE_BEEP_ENABLED', payload: value })
              }
              trackColor={{ false: COLORS.lightGray2, true: COLORS.primary }}
              thumbColor={COLORS.white}
              ios_backgroundColor={COLORS.lightGray2}
            />
          </View>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate('PrinterConfig' as never)}
            activeOpacity={0.65}>
            <View style={styles.menuItemContent}>
              <View style={styles.settingHeader}>
                <Image
                  source={icons.printer}
                  style={[styles.settingIcon, { tintColor: COLORS.primary2 }]}
                />
                <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                  Printer configuration
                </Text>
              </View>
              <Text
                style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                Configure and test Sunmi and Bluetooth printers
              </Text>
            </View>
            <Text style={[styles.arrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
            <View style={styles.menuItemContent}>
              <View style={styles.settingHeader}>
                <Image
                  source={icons.info}
                  style={[styles.settingIcon, { tintColor: COLORS.primary2 }]}
                />
                <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>
                  App version
                </Text>
              </View>
              <Text
                style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                Version 1.0.0
              </Text>
            </View>
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.radius,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
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
    fontSize: 22,
    fontWeight: '300',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
});

export default Settings;
