import React, {useMemo, useState} from 'react';
import {View, Text, Pressable, StyleSheet, Image} from 'react-native';
import {COLORS, FONTS, icons, ICON_BUTTON_QUICK_PRESS} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {User} from '../../@types/userManagement';
import ChooseActionSheet, {
  type ChooseActionItem,
} from '../../Components/ChooseActionSheet';

interface UserListItemProps {
  user: User;
  onEdit?: (user: User) => void;
  onDeactivate?: (user: User) => void;
  onLoginAs?: (user: User) => void;
}

const UserListItem: React.FC<UserListItemProps> = ({
  user,
  onEdit,
  onDeactivate,
  onLoginAs,
}) => {
  const {colors} = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const displayName = user.full_name || user.username;
  const initials =
    displayName
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'US';
  const secondaryLine =
    user.email || user.phone_number || user.username || 'No contact info';
  const hasActions = Boolean(onEdit || onDeactivate || onLoginAs);

  const actionItems = useMemo(() => {
    const items: ChooseActionItem[] = [];
    if (onEdit) {
      items.push({
        key: 'edit',
        label: 'Edit user',
        onPress: () => onEdit(user),
      });
    }
    if (onLoginAs) {
      items.push({
        key: 'login-as',
        label: 'Login as',
        onPress: () => onLoginAs(user),
      });
    }
    if (onDeactivate) {
      items.push({
        key: 'deactivate',
        label: 'Deactivate user',
        destructive: true,
        onPress: () => onDeactivate(user),
      });
    }
    return items;
  }, [onDeactivate, onEdit, onLoginAs, user]);

  return (
    <View>
      <Pressable
        {...ICON_BUTTON_QUICK_PRESS}
        style={({pressed}) => [
          styles.container,
          {borderBottomColor: colors.border},
          pressed && onEdit ? {opacity: 0.8} : null,
        ]}
        onPress={onEdit ? () => onEdit(user) : undefined}>
        <View style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.content}>
          <Text
            style={[styles.name, {color: colors.textPrimary}]}
            numberOfLines={1}>
            {displayName}
          </Text>
          <Text
            style={[styles.secondaryText, {color: colors.textSecondary}]}
            numberOfLines={1}>
            {secondaryLine}
          </Text>
          {!user.is_active ? (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactive</Text>
            </View>
          ) : null}
        </View>

        {hasActions ? (
          <Pressable
            {...ICON_BUTTON_QUICK_PRESS}
            onPress={() => setActionsVisible(true)}
            style={({pressed}) => [
              styles.actionButton,
              {backgroundColor: colors.backButtonBg},
              pressed && {opacity: 0.7},
            ]}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel="Choose an action">
            <Image
              source={icons.menu1}
              style={[styles.actionIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </Pressable>
        ) : null}
      </Pressable>

      <ChooseActionSheet
        visible={actionsVisible}
        title={displayName || 'User'}
        actions={actionItems}
        onClose={() => setActionsVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: COLORS.primary3,
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  name: {
    ...FONTS.body2,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  secondaryText: {
    ...FONTS.body4,
    fontSize: 13,
  },
  inactiveBadge: {
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  inactiveBadgeText: {
    ...FONTS.body5,
    color: COLORS.error,
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 16,
    height: 16,
  },
});

export default UserListItem;
