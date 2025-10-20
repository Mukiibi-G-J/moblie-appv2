import {View, Text, TouchableOpacity, StyleSheet, Switch} from 'react-native';
import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSearchMode} from '../../context/SearchModeStore';
import {Image} from 'react-native';
import {TenantSettings} from '../../Components/TenantSettings';

const Settings = () => {
  const navigation = useNavigation();
  const {state, dispatch} = useSearchMode();

  const toggleSearchMode = () => {
    const newMode = state.searchMode === 'barcode' ? 'realtime' : 'barcode';
    dispatch({type: 'SET_SEARCH_MODE', payload: newMode});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        {/* Search Mode Setting */}
        <View style={styles.menuItem}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.search} style={styles.settingIcon} />
              <Text style={styles.menuItemTitle}>Search Mode</Text>
            </View>
            <Text style={styles.menuItemSubtitle}>
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

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('PrinterTest' as never)}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.printer} style={styles.settingIcon} />
              <Text style={styles.menuItemTitle}>Printer Test</Text>
            </View>
            <Text style={styles.menuItemSubtitle}>
              Test and configure printer settings
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Tenant Settings */}
        <TenantSettings />

        {/* App Version */}
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemContent}>
            <View style={styles.settingHeader}>
              <Image source={icons.info} style={styles.settingIcon} />
              <Text style={styles.menuItemTitle}>App Version</Text>
            </View>
            <Text style={styles.menuItemSubtitle}>Version 1.0.0</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.darkGray,
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
    backgroundColor: COLORS.white,
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
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  menuItemSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  arrow: {
    ...FONTS.h3,
    color: COLORS.gray,
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
});

export default Settings;
