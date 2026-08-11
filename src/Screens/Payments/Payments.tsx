import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {QuickIconPressable} from '../../Components';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import {usePermissions} from '../../hooks/usePermissions';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';
import QuickPaymentModal from './QuickPaymentModal';

const Payments: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {selectedTab, setSelectedTab} = useTabContext();
  const {canCreate, hasAnyPageAccess} = usePermissions();

  const canQuickPay =
    canCreate(PAGE_NAMES.QUICK_PAYMENT) ||
    canCreate(PAGE_NAMES.PAYMENTS) ||
    hasAnyPageAccess(PAGE_NAMES.QUICK_PAYMENT) ||
    hasAnyPageAccess(PAGE_NAMES.PAYMENTS);

  const [isQuickPayVisible, setIsQuickPayVisible] = useState(false);

  const onSelectTab = useCallback(
    (tab: string) => {
      setSelectedTab(tab);
      navigation.navigate('Home' as never);
    },
    [navigation, setSelectedTab],
  );

  useFocusEffect(
    useCallback(() => {
      if (canQuickPay) {
        setIsQuickPayVisible(true);
      }
    }, [canQuickPay]),
  );

  const handleQuickPay = () => {
    if (!canQuickPay) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to record payments.',
      );
      return;
    }
    setIsQuickPayVisible(true);
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 10),
            backgroundColor: colors.background,
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
            source={icons.back}
            style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.title, {color: colors.textPrimary}]}>
          Quick Payment
        </Text>
        <View style={styles.headerTrailingSpacer} />
      </View>

      {!canQuickPay ? (
        <View
          style={[
            styles.accessDeniedContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}>
          <Text style={[styles.accessDeniedTitle, {color: COLORS.error}]}>
            Access Denied
          </Text>
          <Text
            style={[styles.accessDeniedMessage, {color: colors.textSecondary}]}>
            You don't have permission to record payments.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View
            style={[
              styles.emptyIconContainer,
              {backgroundColor: colors.screenMuted},
            ]}>
            <Image
              source={icons.wallet}
              style={[styles.emptyStateIcon, {tintColor: colors.iconMuted}]}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
            Collect a payment
          </Text>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            Record a customer payment or pay a vendor against their oldest open
            invoice.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleQuickPay}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Quick payment">
            <Text style={styles.primaryButtonText}>Quick payment</Text>
          </TouchableOpacity>
        </View>
      )}

      <MainBottomTabBar selectedTab={selectedTab} onSelectTab={onSelectTab} />

      <QuickPaymentModal
        visible={isQuickPayVisible}
        onClose={() => setIsQuickPayVisible(false)}
        canPost={canQuickPay}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 10,
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
  title: {
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding * 1.5,
    paddingBottom: 80,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateIcon: {
    width: 32,
    height: 32,
  },
  emptyTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    ...FONTS.body4,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.primary2,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    ...FONTS.h4,
    fontWeight: '700',
  },
  accessDeniedContainer: {
    margin: SIZES.padding,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  accessDeniedTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    marginBottom: 8,
  },
  accessDeniedMessage: {
    ...FONTS.body4,
    textAlign: 'center',
  },
});

export default Payments;
