import React, {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {useCompanyInfo} from '../../hooks/useCompanyInfo';
import {resolveCompanyLogoUri} from '../../utils/companyLogoUrl';
import {
  CompanyOverview,
  getCompanyOverview,
} from '../../services/SubscriptionService';
import {QuickIconPressable} from '../../Components';
import {SubscriptionOverviewPanel} from '../../Components/SubscriptionOverviewPanel';

function displayValue(v: string | null | undefined): string {
  const t = v?.trim();
  return t ? t : '—';
}

const BusinessDetails: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {data, loading, error, refetch, storeLabel} = useCompanyInfo();
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [subscriptionOverview, setSubscriptionOverview] =
    useState<CompanyOverview | null>(null);

  const refreshSubscriptionOverview = useCallback(async () => {
    const o = await getCompanyOverview();
    setSubscriptionOverview(o);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSubscriptionOverview();
    }, [refreshSubscriptionOverview]),
  );

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uri = await resolveCompanyLogoUri(data?.logo);
      if (!cancelled) {
        setLogoUri(uri);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.logo]);

  const rows: {label: string; value: string}[] = data
    ? [
        {label: 'Business name', value: displayValue(data.name)},
        {label: 'Address', value: displayValue(data.address)},
        {label: 'City', value: displayValue(data.city)},
        {label: 'Country', value: displayValue(data.country)},
        {label: 'Phone', value: displayValue(data.phone)},
        {label: 'Email', value: displayValue(data.email)},
        {label: 'TIN', value: displayValue(data.tin)},
      ]
    : [];

  return (
    <SafeAreaView
      style={[styles.safeOuter, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.root, {backgroundColor: colors.background}]}>
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
              style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.topTitle, {color: colors.textPrimary}]}>
            Company & Billing
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        {loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.hint, {color: colors.textSecondary}]}>
              Loading…
            </Text>
          </View>
        ) : error && !data ? (
          <View style={[styles.centered, styles.errorBox]}>
            <Text style={[styles.errorText, {color: colors.textPrimary}]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, {backgroundColor: COLORS.primary}]}
              onPress={() => refetch()}
              activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading && !!data}
                onRefresh={() => {
                  refetch();
                  void refreshSubscriptionOverview();
                }}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }>
            {error && data ? (
              <Text style={[styles.banner, {color: COLORS.error}]}>
                Could not refresh: {error}
              </Text>
            ) : null}

            <View style={[styles.card, {backgroundColor: colors.card}]}>
              {logoUri ? (
                <Image
                  source={{uri: logoUri}}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityLabel="Company logo"
                />
              ) : null}
              <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
                {data?.name?.trim() || storeLabel}
              </Text>
              <Text style={[styles.cardSubtitle, {color: colors.textSecondary}]}>
                Company details, billing status, and remaining days.
              </Text>
            </View>

            {rows.map(row => (
              <View
                key={row.label}
                style={[styles.row, {backgroundColor: colors.card}]}>
                <Text style={[styles.rowLabel, {color: colors.textSecondary}]}>
                  {row.label}
                </Text>
                <Text style={[styles.rowValue, {color: colors.textPrimary}]}>
                  {row.value}
                </Text>
              </View>
            ))}

            {subscriptionOverview ? (
              <SubscriptionOverviewPanel overview={subscriptionOverview} />
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeOuter: {flex: 1},
  root: {flex: 1},
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
  headerRoundIcon: {width: 20, height: 20},
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailingSpacer: {width: 40, height: 40},
  scroll: {flex: 1},
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  hint: {...FONTS.body4, marginTop: 12},
  errorBox: {gap: 16},
  errorText: {...FONTS.body3, textAlign: 'center'},
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  banner: {...FONTS.body4, marginBottom: SIZES.base, textAlign: 'center'},
  card: {
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    ...FONTS.h3,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    ...FONTS.body4,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.radius,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rowLabel: {...FONTS.body4, marginBottom: 4, fontWeight: '600'},
  rowValue: {...FONTS.body3},
});

export default BusinessDetails;
