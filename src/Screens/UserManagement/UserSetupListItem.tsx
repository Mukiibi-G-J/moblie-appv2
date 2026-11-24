import React, {useMemo, useState} from 'react';
import {View, Text, Pressable, StyleSheet, Image} from 'react-native';
import {COLORS, FONTS, icons, ICON_BUTTON_QUICK_PRESS} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {UserSetup} from '../../@types/userSetup';
import ChooseActionSheet, {
  type ChooseActionItem,
} from '../../Components/ChooseActionSheet';

interface UserSetupListItemProps {
  setup: UserSetup;
  onEdit?: (setup: UserSetup) => void;
  onDelete?: (setup: UserSetup) => void;
}

function setupFlags(setup: UserSetup): string[] {
  const flags: string[] = [];
  if (!setup.canSeeBuyingPrice) {
    flags.push('No buying price');
  }
  if (!setup.canSeeProfitMargin) {
    flags.push('No profit');
  }
  if (setup.canEditSalesPrice) {
    flags.push('Edit price');
  }
  if (setup.canViewOnlyTheirSales) {
    flags.push('Own sales only');
  }
  if (setup.defaultSalesUi === 'pos') {
    flags.push('POS UI');
  }
  return flags;
}

const UserSetupListItem: React.FC<UserSetupListItemProps> = ({
  setup,
  onEdit,
  onDelete,
}) => {
  const {colors} = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const displayName = setup.fullName || setup.username || 'User';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'US';
  const secondaryLine = setup.email || setup.username || 'No email';
  const flags = setupFlags(setup);
  const hasActions = Boolean(onEdit || onDelete);

  const actionItems = useMemo(() => {
    const items: ChooseActionItem[] = [];
    if (onEdit) {
      items.push({
        key: 'edit',
        label: 'Edit setup',
        onPress: () => onEdit(setup),
      });
    }
    if (onDelete) {
      items.push({
        key: 'delete',
        label: 'Delete setup',
        destructive: true,
        onPress: () => onDelete(setup),
      });
    }
    return items;
  }, [onDelete, onEdit, setup]);

  return (
    <View>
      <Pressable
        {...ICON_BUTTON_QUICK_PRESS}
        style={({pressed}) => [
          styles.container,
          {borderBottomColor: colors.border},
          pressed && onEdit ? {opacity: 0.8} : null,
        ]}
        onPress={onEdit ? () => onEdit(setup) : undefined}>
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
          {flags.length > 0 ? (
            <View style={styles.flagsRow}>
              {flags.map(flag => (
                <View key={flag} style={styles.flag}>
                  <Text style={styles.flagText}>{flag}</Text>
                </View>
              ))}
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
        title={displayName}
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
  content: {flex: 1},
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
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  flag: {
    backgroundColor: COLORS.transparentPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  flagText: {
    ...FONTS.body5,
    color: COLORS.primary3,
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionIcon: {width: 16, height: 16},
});

export default UserSetupListItem;
