import React, {useMemo} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {constants, COLORS} from '../../constants';
import {PAGE_NAMES} from '../../constants/pageNames';
import {usePermissions} from '../../hooks/usePermissions';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';

type AttentionCard = {
  key: string;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
  tone?: 'default' | 'warning';
};

type OptionsProps = {
  lowStockCount?: number;
};

const quickPressProps = {
  delayPressIn: 0 as const,
  delayHoverIn: 0 as const,
  unstable_pressDelay: 0 as const,
};

/**
 * Home attention cards only (QuickBooks-style).
 * Module shortcuts live in More — keep Home breathable.
 */
const Options = ({lowStockCount = 0}: OptionsProps) => {
  const navigation = useNavigation();
  const {setSelectedTab} = useTabContext();
  const {isModuleVisible, hasAnyPageAccess} = usePermissions();
  const {colors, isDark} = useTheme();

  const canMakeSale =
    isModuleVisible('sales') && hasAnyPageAccess(PAGE_NAMES.SALES);

  const cards: AttentionCard[] = useMemo(() => {
    const next: AttentionCard[] = [];

    if (
      lowStockCount > 0 &&
      isModuleVisible('items') &&
      hasAnyPageAccess(PAGE_NAMES.ITEMS)
    ) {
      next.push({
        key: 'low-stock',
        title: 'Low stock',
        body: `${lowStockCount} item${
          lowStockCount === 1 ? '' : 's'
        } need attention before you run out.`,
        cta: 'Review stock',
        tone: 'warning',
        onPress: () =>
          navigation.navigate(
            'AllItems' as never,
            {stockFilter: 'low_stock'} as never,
          ),
      });
    }

    // Empty-state nudge only when nothing else needs attention
    if (next.length === 0 && canMakeSale) {
      next.push({
        key: 'make-sale',
        title: 'Ready to sell?',
        body: 'Start a sale for a walk-in or customer and get paid faster.',
        cta: 'Make sale',
        onPress: () => setSelectedTab(constants.screens.makeSale),
      });
    }

    return next.slice(0, 2);
  }, [
    canMakeSale,
    lowStockCount,
    isModuleVisible,
    hasAnyPageAccess,
    navigation,
    setSelectedTab,
  ]);

  if (cards.length === 0) {
    return null;
  }

  const cardSurface = {
    backgroundColor: colors.card,
    borderColor: isDark ? colors.border : 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: isDark ? 0.25 : 0.07,
        shadowRadius: 10,
      },
      android: {elevation: isDark ? 0 : 2},
      default: {},
    }),
  };

  return (
    <View style={styles.container}>
      {cards.map(card => {
        const accent =
          card.tone === 'warning' ? COLORS.warning : COLORS.primary;
        return (
          <View key={card.key} style={[styles.card, cardSurface]}>
            <Text
              style={[styles.title, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {card.title}
            </Text>
            <Text
              style={[styles.body, {color: colors.textSecondary}]}
              numberOfLines={3}>
              {card.body}
            </Text>
            <Pressable
              {...quickPressProps}
              onPress={card.onPress}
              style={({pressed}) => [
                styles.cta,
                {
                  borderColor: accent,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={card.cta}>
              <Text style={[styles.ctaLabel, {color: accent}]}>{card.cta}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  cta: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default Options;
