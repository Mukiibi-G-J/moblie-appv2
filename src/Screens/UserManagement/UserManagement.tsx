import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES} from '../../constants';
import icons from '../../constants/icons';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

const UserManagement: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {isModuleVisible, canAccessMobileNav} = usePermissions();

  const showUsers =
    isModuleVisible('userManagement') &&
    canAccessMobileNav('userManagement', PAGE_NAMES.USER_MANAGEMENT);
  const showUserSetup =
    isModuleVisible('userManagement') &&
    canAccessMobileNav('userManagement', [
      PAGE_NAMES.USER_SETUP,
      PAGE_NAMES.USER_MANAGEMENT,
    ]);

  const items = [
    showUsers
      ? {
          key: 'users',
          title: 'Users',
          subtitle: 'Create and manage company users',
          icon: icons.profile,
          onPress: () => navigation.navigate('Users'),
        }
      : null,
    showUserSetup
      ? {
          key: 'userSetup',
          title: 'User Setup',
          subtitle: 'Control pricing visibility and user permissions',
          icon: icons.setting,
          onPress: () => navigation.navigate('UserSetupList'),
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    title: string;
    subtitle: string;
    icon: any;
    onPress: () => void;
  }[];

  return (
    <View style={[styles.container, {backgroundColor: colors.screenMuted}]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}>
        <TouchableOpacity
          onPress={() => safeGoBack(navigation, 'Home')}
          style={styles.backBtn}>
          <Image
            source={icons.back}
            style={[styles.backIcon, {tintColor: colors.textPrimary}]}
          />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, {color: colors.textPrimary}]}>
          User Management
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <View style={[styles.emptyCard, {backgroundColor: colors.surface}]}>
            <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
              Access Denied
            </Text>
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              You do not have permission to manage users or user setup.
            </Text>
          </View>
        ) : (
          items.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.card,
                {backgroundColor: colors.surface, borderColor: colors.border},
              ]}
              onPress={item.onPress}>
              <Image
                source={item.icon}
                style={[styles.cardIcon, {tintColor: COLORS.primary}]}
              />
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.cardSubtitle, {color: colors.textSecondary}]}>
                  {item.subtitle}
                </Text>
              </View>
              <Image
                source={icons.down_arrow}
                style={[
                  styles.chevron,
                  {tintColor: colors.textSecondary, transform: [{rotate: '-90deg'}]},
                ]}
              />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center'},
  backIcon: {width: 20, height: 20},
  screenTitle: {...FONTS.h3},
  content: {padding: SIZES.padding},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardIcon: {width: 28, height: 28, marginRight: 14},
  cardBody: {flex: 1},
  cardTitle: {...FONTS.h4, marginBottom: 4},
  cardSubtitle: {...FONTS.body4},
  chevron: {width: 16, height: 16},
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {...FONTS.h3, marginBottom: 8},
  emptyText: {...FONTS.body3, textAlign: 'center'},
});

export default UserManagement;
