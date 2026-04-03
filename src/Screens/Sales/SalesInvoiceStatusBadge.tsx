import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {COLORS, FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';

type InvoiceStatus = 'Draft' | 'Open' | 'Posted' | 'Cancelled' | string;

interface SalesInvoiceStatusBadgeProps {
  status?: InvoiceStatus;
}

const SalesInvoiceStatusBadge: React.FC<SalesInvoiceStatusBadgeProps> = ({
  status = '',
}) => {
  const {isDark} = useTheme();
  const palette = useMemo(() => {
    const s = status || '—';
    if (isDark) {
      switch (s) {
        case 'Posted':
          return {
            background: 'rgba(34, 197, 94, 0.2)',
            text: '#4ADE80',
            border: 'rgba(74, 222, 128, 0.45)',
          };
        case 'Open':
          return {
            background: 'rgba(255, 193, 7, 0.18)',
            text: '#FCD34D',
            border: 'rgba(252, 211, 77, 0.4)',
          };
        case 'Draft':
          return {
            background: 'rgba(59, 130, 246, 0.2)',
            text: '#93C5FD',
            border: 'rgba(147, 197, 253, 0.45)',
          };
        case 'Cancelled':
          return {
            background: 'rgba(244, 63, 94, 0.18)',
            text: '#FB7185',
            border: 'rgba(251, 113, 133, 0.45)',
          };
        default:
          return {
            background: 'rgba(255,255,255,0.08)',
            text: COLORS.gray3,
            border: 'rgba(255,255,255,0.12)',
          };
      }
    }
    switch (s) {
      case 'Posted':
        return {
          background: '#ECFDF3',
          text: '#167C3D',
          border: '#BCE3C7',
        };
      case 'Open':
        return {
          background: '#FFF7E6',
          text: '#B96D00',
          border: '#F5D5A5',
        };
      case 'Draft':
        return {
          background: '#EFF6FF',
          text: '#1D4ED8',
          border: '#BFDBFE',
        };
      case 'Cancelled':
        return {
          background: '#FEECEC',
          text: '#B42318',
          border: '#F5B1AB',
        };
      default:
        return {
          background: COLORS.lightGray1,
          text: COLORS.gray2,
          border: COLORS.lightGray2,
        };
    }
  }, [isDark, status]);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}>
      <Text style={[styles.badgeText, {color: palette.text}]}>
        {status || '—'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SIZES.base * 1.25,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    ...FONTS.body5,
    fontWeight: '600',
    fontSize: 11,
  },
});

export default SalesInvoiceStatusBadge;
