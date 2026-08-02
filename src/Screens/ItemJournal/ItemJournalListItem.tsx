import React from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import {COLORS, FONTS, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';

export type ItemJournalLine = {
  id: number;
  system_id: string;
  item: string;
  item_name: string;
  entry_type: string;
  document_no: string;
  description: string;
  quantity: number;
  unit_cost: number | null;
  date: string;
  status: string;
  item_unit_of_measure?: number | null;
  unit_of_measure_code?: string;
};

const ENTRY_LABELS: Record<string, string> = {
  PositiveAdjustment: 'Increase',
  NegativeAdjustment: 'Decrease',
  Purchase: 'Purchase',
  Sales: 'Sales',
  DirectCost: 'Direct cost',
};

function entryTypeLabel(entryType: string): string {
  return ENTRY_LABELS[entryType] || entryType.replace(/([A-Z])/g, ' $1').trim();
}

type Props = {
  line: ItemJournalLine;
  onPress: () => void;
  onPost: () => void;
  onRemove?: () => void;
  canOpenLine: boolean;
  canPost: boolean;
  canRemove?: boolean;
};

const ItemJournalListItem: React.FC<Props> = ({
  line,
  onPress,
  onPost,
  onRemove,
  canOpenLine,
  canPost,
  canRemove = false,
}) => {
  const {colors} = useTheme();
  const isOpen = line.status === 'Open';
  const initials =
    line.item_name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'IJ';

  const secondaryLine = [
    line.document_no,
    entryTypeLabel(line.entry_type),
    line.date,
  ]
    .filter(Boolean)
    .join(' · ');

  const qtyText = `Qty ${line.quantity}${
    line.unit_of_measure_code ? ` ${line.unit_of_measure_code}` : ''
  }`;

  const handleOpenActions = () => {
    const options: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [];

    if (canOpenLine && isOpen) {
      options.push({
        text: 'Edit line',
        onPress: onPress,
      });
    }

    if (canPost && isOpen) {
      options.push({
        text: 'Post to inventory',
        onPress: onPost,
      });
    }

    if (canRemove && isOpen && onRemove) {
      options.push({
        text: 'Remove',
        style: 'destructive',
        onPress: onRemove,
      });
    }

    options.push({text: 'Cancel', style: 'cancel'});

    if (options.length === 1) {
      Alert.alert(line.document_no || 'Journal line', 'No actions available.', options);
      return;
    }

    Alert.alert(line.item_name || 'Journal line', 'Choose an action', options);
  };

  return (
    <TouchableOpacity
      activeOpacity={canOpenLine && isOpen ? 0.8 : 1}
      style={[styles.container, {borderBottomColor: colors.border}]}
      onPress={canOpenLine && isOpen ? onPress : undefined}>
      <View style={[styles.avatar, {backgroundColor: colors.backButtonBg}]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.itemName, {color: colors.textPrimary}]}
          numberOfLines={1}>
          {line.item_name}
        </Text>
        <Text
          style={[styles.secondaryText, {color: colors.textSecondary}]}
          numberOfLines={1}>
          {secondaryLine}
        </Text>
        <Text
          style={[
            styles.metaText,
            isOpen ? styles.metaTextOpen : {color: colors.textSecondary},
          ]}>
          {qtyText} · {line.status}
        </Text>
      </View>

      {(canOpenLine || canPost || (canRemove && isOpen)) && (
        <TouchableOpacity
          onPress={handleOpenActions}
          style={[styles.actionButton, {backgroundColor: colors.backButtonBg}]}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Image
            source={icons.menu}
            style={[styles.actionIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default ItemJournalListItem;

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
  itemName: {
    ...FONTS.body2,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  secondaryText: {
    ...FONTS.body4,
    fontSize: 13,
  },
  metaText: {
    ...FONTS.body4,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  metaTextOpen: {
    color: COLORS.primary2,
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
