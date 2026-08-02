import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
  Alert,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {useCompanyInfo} from '../../hooks/useCompanyInfo';
import {resolveCompanyLogoUri} from '../../utils/companyLogoUrl';
import {
  TenantCompanyApi,
  getCurrencies,
  updateCompanyInfo,
  uploadCompanyLogo,
} from '../../services/app.services';
import {useAuth} from '../../context/Store';
import {CurrencyPickerModal} from '../../Components/CurrencyPickerModal';
import {
  DEFAULT_LOCAL_CURRENCY_CODE,
  mapCurrenciesToOptions,
  type CurrencyOption,
} from '../../utils/currency';
import {
  CompanyOverview,
  getCompanyOverview,
} from '../../services/SubscriptionService';
import {QuickIconPressable} from '../../Components';
import {SubscriptionOverviewPanel} from '../../Components/SubscriptionOverviewPanel';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
]);

function displayValue(v: string | null | undefined): string {
  const t = v?.trim();
  return t ? t : '—';
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as {response?: {data?: {error?: string}}}).response?.data;
    if (data?.error) {
      return data.error;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

type CompanyFormState = {
  displayName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  tin: string;
};

function formFromCompany(company: TenantCompanyApi): CompanyFormState {
  return {
    displayName: company.displayName?.trim() || company.name?.trim() || '',
    address: company.address?.trim() || '',
    city: company.city?.trim() || '',
    country: company.country?.trim() || '',
    phone: company.phone?.trim() || '',
    email: company.email?.trim() || '',
    website: company.website?.trim() || '',
    tin: company.tin?.trim() || '',
  };
}

const BusinessDetails: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {auth, updateLocalCurrencyCode} = useAuth();
  const {data, loading, error, refetch, storeLabel} = useCompanyInfo();
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [form, setForm] = useState<CompanyFormState>({
    displayName: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    tin: '',
  });
  const [subscriptionOverview, setSubscriptionOverview] =
    useState<CompanyOverview | null>(null);
  const [localCurrencyCode, setLocalCurrencyCodeState] = useState(
    auth.localCurrencyCode || DEFAULT_LOCAL_CURRENCY_CODE,
  );
  const [savedCurrencyCode, setSavedCurrencyCode] = useState(
    auth.localCurrencyCode || DEFAULT_LOCAL_CURRENCY_CODE,
  );
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const isCompanyAdmin =
    Boolean(auth.is_superuser) ||
    (Array.isArray(auth.authority) && auth.authority.includes('admin'));

  const refreshSubscriptionOverview = useCallback(async () => {
    const o = await getCompanyOverview();
    setSubscriptionOverview(o);
    const code =
      o?.settings?.localCurrencyCode ||
      auth.localCurrencyCode ||
      DEFAULT_LOCAL_CURRENCY_CODE;
    setLocalCurrencyCodeState(code);
    setSavedCurrencyCode(code);
  }, [auth.localCurrencyCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCurrencies(true);
      try {
        const rows = await getCurrencies();
        if (!cancelled) {
          setCurrencyOptions(mapCurrenciesToOptions(rows));
        }
      } catch {
        if (!cancelled) {
          setCurrencyOptions([
            {
              value: DEFAULT_LOCAL_CURRENCY_CODE,
              label: `${DEFAULT_LOCAL_CURRENCY_CODE}: Uganda Shilling`,
            },
          ]);
        }
      } finally {
        if (!cancelled) {
          setLoadingCurrencies(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    if (data) {
      setForm(formFromCompany(data));
    }
  }, [data]);

  const isFormDirty = useMemo(() => {
    if (!data || !isCompanyAdmin) {
      return false;
    }
    const baseline = formFromCompany(data);
    return (
      form.displayName !== baseline.displayName ||
      form.address !== baseline.address ||
      form.city !== baseline.city ||
      form.country !== baseline.country ||
      form.phone !== baseline.phone ||
      form.email !== baseline.email ||
      form.website !== baseline.website ||
      form.tin !== baseline.tin
    );
  }, [data, form, isCompanyAdmin]);

  const handleLogoPickerResponse = useCallback(
    async (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert(
          'Error',
          response.errorMessage || 'Could not open photo library.',
        );
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      const mime = (asset.type || '').toLowerCase();
      if (mime && !ALLOWED_LOGO_TYPES.has(mime)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid image',
          text2: 'Please upload a JPEG, PNG, or GIF image.',
        });
        return;
      }

      if (asset.fileSize != null && asset.fileSize > MAX_LOGO_BYTES) {
        Toast.show({
          type: 'error',
          text1: 'File too large',
          text2: 'Please upload an image smaller than 5MB.',
        });
        return;
      }

      setUploadingLogo(true);
      try {
        await uploadCompanyLogo(asset.uri);
        await refetch();
        Toast.show({
          type: 'success',
          text1: 'Logo updated',
          text2: 'Company logo saved successfully.',
        });
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Failed to upload company logo.';
        Toast.show({
          type: 'error',
          text1: 'Upload failed',
          text2: message,
        });
      } finally {
        setUploadingLogo(false);
      }
    },
    [refetch],
  );

  const handleSaveCompanyInfo = useCallback(async () => {
    if (!data || savingInfo || !isFormDirty) {
      return;
    }
    setSavingInfo(true);
    try {
      await updateCompanyInfo({
        displayName: form.displayName.trim() || data.name,
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim(),
        tin: form.tin.trim(),
      });
      await refetch();
      Toast.show({
        type: 'success',
        text1: 'Company info saved',
        text2: 'Your changes were updated successfully.',
      });
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: getApiErrorMessage(e, 'Could not update company info.'),
      });
    } finally {
      setSavingInfo(false);
    }
  }, [data, form, isFormDirty, refetch, savingInfo]);

  const isCurrencyDirty = localCurrencyCode !== savedCurrencyCode;

  const handleSaveCurrency = useCallback(async () => {
    if (!isCompanyAdmin || savingCurrency || !isCurrencyDirty) {
      return;
    }
    setSavingCurrency(true);
    try {
      await updateCompanyInfo({localCurrencyCode});
      setSavedCurrencyCode(localCurrencyCode);
      updateLocalCurrencyCode(localCurrencyCode);
      Toast.show({
        type: 'success',
        text1: 'Currency updated',
        text2: `Local currency set to ${localCurrencyCode}`,
      });
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: getApiErrorMessage(e, 'Could not update local currency.'),
      });
    } finally {
      setSavingCurrency(false);
    }
  }, [
    isCompanyAdmin,
    isCurrencyDirty,
    localCurrencyCode,
    savingCurrency,
    updateLocalCurrencyCode,
  ]);

  const pickCompanyLogo = useCallback(async () => {
    if (!isCompanyAdmin || uploadingLogo) {
      return;
    }
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85,
        includeBase64: false,
        selectionLimit: 1,
        maxWidth: 1024,
        maxHeight: 1024,
      });
      await handleLogoPickerResponse(response);
    } catch {
      Alert.alert('Error', 'Could not open photo library. Please try again.');
    }
  }, [handleLogoPickerResponse, isCompanyAdmin, uploadingLogo]);

  const readOnlyRows: {label: string; value: string}[] = data
    ? [{label: 'Business name', value: displayValue(data.name)}]
    : [];

  const readOnlyContactRows: {label: string; value: string}[] =
    !isCompanyAdmin && data
      ? [
          {
            label: 'Display name',
            value: displayValue(data.displayName || data.name),
          },
          {label: 'Address', value: displayValue(data.address)},
          {label: 'City', value: displayValue(data.city)},
          {label: 'Country', value: displayValue(data.country)},
          {label: 'Phone', value: displayValue(data.phone)},
          {label: 'Email', value: displayValue(data.email)},
          {label: 'Website', value: displayValue(data.website)},
          {label: 'TIN', value: displayValue(data.tin)},
          {
            label: 'Local currency',
            value: displayValue(
              subscriptionOverview?.settings?.localCurrencyCode ||
                auth.localCurrencyCode,
            ),
          },
        ]
      : [];

  const editableFields: {
    key: keyof CompanyFormState;
    label: string;
    keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
    autoCapitalize?: 'none' | 'sentences' | 'words';
  }[] = [
    {key: 'displayName', label: 'Display name', autoCapitalize: 'words'},
    {key: 'address', label: 'Address', autoCapitalize: 'words'},
    {key: 'city', label: 'City', autoCapitalize: 'words'},
    {key: 'country', label: 'Country', autoCapitalize: 'words'},
    {key: 'phone', label: 'Phone', keyboardType: 'phone-pad'},
    {
      key: 'email',
      label: 'Email',
      keyboardType: 'email-address',
      autoCapitalize: 'none',
    },
    {key: 'website', label: 'Website', keyboardType: 'url', autoCapitalize: 'none'},
    {key: 'tin', label: 'TIN', autoCapitalize: 'characters'},
  ];

  const cardTitle =
    data?.displayName?.trim() || data?.name?.trim() || storeLabel;

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
              {isCompanyAdmin ? (
                <TouchableOpacity
                  style={styles.logoTapArea}
                  onPress={() => void pickCompanyLogo()}
                  disabled={uploadingLogo}
                  accessibilityLabel="Change company logo"
                  accessibilityRole="button">
                  <View style={styles.logoWrap}>
                    {logoUri ? (
                      <Image
                        source={{uri: logoUri}}
                        style={styles.logo}
                        resizeMode="contain"
                        accessibilityLabel="Company logo"
                      />
                    ) : (
                      <View
                        style={[
                          styles.logoPlaceholder,
                          {borderColor: colors.border},
                        ]}>
                        <Text
                          style={[
                            styles.logoPlaceholderText,
                            {color: colors.textSecondary},
                          ]}>
                          Add logo
                        </Text>
                      </View>
                    )}
                    {uploadingLogo ? (
                      <View style={styles.logoOverlay}>
                        <ActivityIndicator color={COLORS.white} />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.logoEditBadge,
                          {backgroundColor: COLORS.primary},
                        ]}>
                        <Image
                          source={icons.plus as any}
                          style={styles.logoEditIcon}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.logoHint, {color: colors.textSecondary}]}>
                    Tap to change logo
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.logoTapArea}>
                  <View style={styles.logoWrap}>
                    {logoUri ? (
                      <Image
                        source={{uri: logoUri}}
                        style={styles.logo}
                        resizeMode="contain"
                        accessibilityLabel="Company logo"
                      />
                    ) : (
                      <View
                        style={[
                          styles.logoPlaceholder,
                          {borderColor: colors.border},
                        ]}>
                        <Text
                          style={[
                            styles.logoPlaceholderText,
                            {color: colors.textSecondary},
                          ]}>
                          No logo
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
                {cardTitle}
              </Text>
              <Text style={[styles.cardSubtitle, {color: colors.textSecondary}]}>
                {isCompanyAdmin
                  ? 'Edit company contact details and manage billing.'
                  : 'Company details, billing status, and remaining days.'}
              </Text>
            </View>

            {readOnlyRows.map(row => (
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

            {isCompanyAdmin ? (
              <View style={[styles.row, {backgroundColor: colors.card}]}>
                <Text style={[styles.rowLabel, {color: colors.textSecondary}]}>
                  Local currency
                </Text>
                <TouchableOpacity
                  style={[
                    styles.currencyPickerBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={() => setCurrencyModalVisible(true)}
                  activeOpacity={0.8}>
                  <Text style={[styles.rowValue, {color: colors.textPrimary}]}>
                    {currencyOptions.find(o => o.value === localCurrencyCode)
                      ?.label || localCurrencyCode}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isCompanyAdmin
              ? editableFields.map(field => (
                  <View
                    key={field.key}
                    style={[styles.row, {backgroundColor: colors.card}]}>
                    <Text
                      style={[styles.rowLabel, {color: colors.textSecondary}]}>
                      {field.label}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                      value={form[field.key]}
                      onChangeText={text =>
                        setForm(prev => ({...prev, [field.key]: text}))
                      }
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType={field.keyboardType || 'default'}
                      autoCapitalize={field.autoCapitalize || 'sentences'}
                      autoCorrect={false}
                    />
                  </View>
                ))
              : readOnlyContactRows.map(row => (
                  <View
                    key={row.label}
                    style={[styles.row, {backgroundColor: colors.card}]}>
                    <Text
                      style={[styles.rowLabel, {color: colors.textSecondary}]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.rowValue, {color: colors.textPrimary}]}>
                      {row.value}
                    </Text>
                  </View>
                ))}

            {isCompanyAdmin ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: isFormDirty
                        ? COLORS.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => void handleSaveCompanyInfo()}
                  disabled={!isFormDirty || savingInfo}
                  activeOpacity={0.85}>
                  {savingInfo ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save company info</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    styles.saveCurrencyBtn,
                    {
                      backgroundColor: isCurrencyDirty
                        ? COLORS.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => void handleSaveCurrency()}
                  disabled={!isCurrencyDirty || savingCurrency}
                  activeOpacity={0.85}>
                  {savingCurrency ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save currency</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {subscriptionOverview ? (
              <SubscriptionOverviewPanel overview={subscriptionOverview} />
            ) : null}

            <TouchableOpacity
              style={[
                styles.modulesLinkCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => navigation.navigate('AvailableModules')}
              activeOpacity={0.85}>
              <View style={styles.modulesLinkTextCol}>
                <Text style={[styles.modulesLinkTitle, {color: colors.textPrimary}]}>
                  All Available Modules
                </Text>
                <Text
                  style={[styles.modulesLinkHint, {color: colors.textSecondary}]}>
                  See what is included in your plan, trial modules, and add-ons
                </Text>
              </View>
              <Image
                source={icons.down_arrow as any}
                style={[
                  styles.modulesLinkChevron,
                  {tintColor: colors.textTertiary, transform: [{rotate: '-90deg'}]},
                ]}
              />
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
      <CurrencyPickerModal
        visible={currencyModalVisible}
        options={currencyOptions}
        loading={loadingCurrencies}
        selectedCode={localCurrencyCode}
        colors={colors}
        onClose={() => setCurrencyModalVisible(false)}
        onSelect={code => setLocalCurrencyCodeState(code)}
      />
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
  modulesLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginTop: 16,
  },
  modulesLinkTextCol: {flex: 1, paddingRight: 8},
  modulesLinkTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  modulesLinkHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  modulesLinkChevron: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
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
  logoTapArea: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoWrap: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 6,
  },
  logo: {
    width: 120,
    height: 120,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {...FONTS.body4},
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEditBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEditIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.white,
  },
  logoHint: {...FONTS.body5, fontSize: 12},
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
  input: {
    ...FONTS.body3,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 44,
  },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: SIZES.base,
  },
  saveCurrencyBtn: {
    marginTop: 0,
  },
  currencyPickerBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  saveBtnText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default BusinessDetails;
