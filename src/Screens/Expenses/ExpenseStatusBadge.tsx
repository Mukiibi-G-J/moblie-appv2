import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {COLORS, FONTS, SIZES} from '../../constants';

interface ExpenseStatusBadgeProps {
  status: 'Open' | 'Posted' | 'Reversed';
}

const ExpenseStatusBadge: React.FC<ExpenseStatusBadgeProps> = ({status}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return COLORS.warning || '#FFA500';
      case 'Posted':
        return COLORS.success || '#4CAF50';
      case 'Reversed':
        return COLORS.error || '#F44336';
      default:
        return COLORS.gray;
    }
  };

  return (
    <View
      style={[
        styles.badge,
        {backgroundColor: getStatusColor(status)},
      ]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 2,
    borderRadius: SIZES.base / 2,
  },
  badgeText: {
    ...FONTS.body5,
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 10,
  },
});

export default ExpenseStatusBadge;

