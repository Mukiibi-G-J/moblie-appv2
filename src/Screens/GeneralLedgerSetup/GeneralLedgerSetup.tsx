import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {QuickIconPressable} from '../../Components';
import {CurrencyPickerModal} from '../../Components/CurrencyPickerModal';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {AppContextType, useAppContext} from '../../context/Store';
import {safeGoBack} from '../../hooks/NavigationService';
import {getCurrencies} from '../../services/app.services';
import {
  PAGE_IDS,
  fetchPageDataRecord,
  fetchPageRelations,
  getSetupSoloSystemId,
  resolvePageFieldRef,
  updatePageDataField,
  type PageDataRecord,
  type PageRelationOption,
} from '../../services/pageDataService';
import {getApiErrorMessage} from '../../utils/apiError';
import {
  DEFAULT_LOCAL_CURRENCY_CODE,
  mapCurrenciesToOptions,
  type CurrencyOption,
} from '../../utils/currency';

const PAGE_ID = PAGE_IDS.GeneralLedgerSetupCard;

const VAT_DATE_OPTIONS: PageRelationOption[] = [
  {value: 'posting_date', caption: 'Posting date'},
  {value: 'document_date', caption: 'Document date'},
];

type PickerState = {
  title: string;
  field: string;
  options: PageRelationOption[];
  selected: string;
  allowClear?: boolean;
};

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'True';
}

function asText(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value);
}

const GeneralLedgerSetup: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const app = useAppContext() as AppContextType;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [systemId, setSystemId] = useState<string | null>(null);
  const [record, setRecord] = useState<PageDataRecord>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const id = await getSetupSoloSystemId(PAGE_ID);
      const data = await fetchPageDataRecord(PAGE_ID, id);
      setSystemId(id);
      setRecord(data);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          fallback: 'Could not open general setup.',
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void getCurrencies()
      .then(rows => {
        if (!cancelled) {
          setCurrencyOptions(mapCurrenciesToOptions(rows));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrencyOptions([
            {
              value: DEFAULT_LOCAL_CURRENCY_CODE,
              label: `${DEFAULT_LOCAL_CURRENCY_CODE}: Uganda Shilling`,
            },
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      if (!systemId) {
        return;
      }
      const previous = record[field];
      setRecord(current => ({...current, [field]: value}));
      setSavingField(field);
      try {
        await updatePageDataField({
          pageId: PAGE_ID,
          systemId,
          field,
          value,
          currentRecordValues: record,
        });
        if (field === 'local_currency_code' && typeof value === 'string') {
          app.updateLocalCurrencyCode(value);
        }
        if (field === 'enable_multiple_branches') {
          void app.refreshBranchCapabilities();
        }
      } catch (error) {
        setRecord(current => ({...current, [field]: previous}));
        Toast.show({
          type: 'error',
          text1: 'Could not save',
          text2: getApiErrorMessage(error, {
            fallback: 'General setup was not updated.',
          }),
          position: 'top',
        });
      } finally {
        setSavingField(null);
      }
    },
    [app, record, systemId],
  );

  const openDimensionPicker = useCallback(
    async (field: string, title: string) => {
      if (!systemId) {
        return;
      }
      setPickerLoading(true);
      setPicker({
        title,
        field,
        options: [],
        selected: asText(record[field]),
        allowClear: true,
      });
      try {
        const ref = await resolvePageFieldRef(PAGE_ID, field);
        if (!ref) {
          throw new Error('This field is not on the general setup card.');
        }
        const options = await fetchPageRelations({
          pageId: PAGE_ID,
          pageControlId: ref.pageControlId,
          pageControlFieldId: ref.pageControlFieldId,
          currentRecordSystemId: systemId,
          currentRecordValues: record,
        });
        setPicker({
          title,
          field,
          options,
          selected: asText(record[field]),
          allowClear: true,
        });
      } catch (error) {
        setPicker(null);
        Toast.show({
          type: 'error',
          text1: 'Could not load dimensions',
          text2: getApiErrorMessage(error, {
            fallback: 'Try again in a moment.',
          }),
          position: 'top',
        });
      } finally {
        setPickerLoading(false);
      }
    },
    [record, systemId],
  );

  const currencyCode =
    asText(record.local_currency_code) || DEFAULT_LOCAL_CURRENCY_CODE;
  const currencyLabel =
    currencyOptions.find(option => option.value === currencyCode)?.label ||
    currencyCode;
  const vatDate = asText(record.default_vat_date) || 'posting_date';
  const vatDateLabel =
    VAT_DATE_OPTIONS.find(option => option.value === vatDate)?.caption ||
    vatDate;

  const renderSectionTitle = (title: string) => (
    <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
      {title}
    </Text>
  );

  const renderCard = (children: React.ReactNode) => (
    <View
      style={[
        styles.sectionCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      {children}
    </View>
  );

  const renderValueRow = (
    title: string,
    value: string,
    onPress: () => void,
    field: string,
    showDivider?: boolean,
  ) => (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        disabled={savingField != null}
        activeOpacity={0.65}>
        <View style={styles.rowTextCol}>
          <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
            {title}
          </Text>
          <Text
            style={[styles.rowSubtitle, {color: colors.textSecondary}]}
            numberOfLines={2}>
            {value || 'Not set'}
          </Text>
        </View>
        {savingField === field ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Image
            source={icons.down_arrow as any}
            style={[
              styles.chevron,
              {tintColor: colors.textTertiary, transform: [{rotate: '-90deg'}]},
            ]}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>
      {showDivider ? (
        <View style={[styles.divider, {backgroundColor: colors.border}]} />
      ) : null}
    </View>
  );

  const renderSwitchRow = (
    title: string,
    subtitle: string,
    field: string,
    showDivider?: boolean,
  ) => (
    <View>
      <View style={styles.row}>
        <View style={styles.rowTextCol}>
          <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
            {title}
          </Text>
          <Text style={[styles.rowSubtitle, {color: colors.textSecondary}]}>
            {subtitle}
          </Text>
        </View>
        {savingField === field ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Switch
            value={asBool(record[field])}
            onValueChange={next => {
              void saveField(field, next);
            }}
            disabled={savingField != null || !systemId}
            trackColor={{false: COLORS.lightGray2, true: COLORS.primary}}
            thumbColor={COLORS.white}
          />
        )}
      </View>
      {showDivider ? (
        <View style={[styles.divider, {backgroundColor: colors.border}]} />
      ) : null}
    </View>
  );

  const pickerOptions = picker
    ? picker.allowClear
      ? [{value: '', caption: 'None'}, ...picker.options]
      : picker.options
    : [];

  return (
    <SafeAreaView
      style={[styles.safeOuter, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.root, {backgroundColor: colors.background}]}>
        <View
          style={[
            styles.topHeader,
            {paddingTop: headerPaddingTop, borderBottomColor: colors.border},
          ]}>
          <QuickIconPressable
            style={[
              styles.headerRoundButton,
              {borderColor: colors.border, backgroundColor: colors.card},
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
            General setup
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Text style={[styles.errorText, {color: colors.textPrimary}]}>
              {loadError}
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, {backgroundColor: COLORS.primary}]}
              onPress={() => {
                void load();
              }}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.sectionBlock}>
              {renderSectionTitle('General')}
              {renderCard(
                <>
                  {renderValueRow(
                    'Local currency',
                    currencyLabel,
                    () => setCurrencyOpen(true),
                    'local_currency_code',
                    true,
                  )}
                  {renderSwitchRow(
                    'Multiple branches',
                    'Assign users to a branch and filter data by branch',
                    'enable_multiple_branches',
                    true,
                  )}
                  {renderSwitchRow(
                    'Sales line type',
                    'Let sales lines choose Item or Resource',
                    'enable_sales_line_type_selection',
                    true,
                  )}
                  {renderSwitchRow(
                    'VAT',
                    'Calculate and post VAT on sales and purchases',
                    'vat_enabled',
                    true,
                  )}
                  {renderValueRow(
                    'Default VAT date',
                    vatDateLabel,
                    () =>
                      setPicker({
                        title: 'Default VAT date',
                        field: 'default_vat_date',
                        options: VAT_DATE_OPTIONS,
                        selected: vatDate,
                      }),
                    'default_vat_date',
                  )}
                </>,
              )}
            </View>

            <View style={styles.sectionBlock}>
              {renderSectionTitle('Dimensions')}
              {renderCard(
                <>
                  {renderValueRow(
                    'Global dimension 1',
                    asText(record.global_dimension_1),
                    () => {
                      void openDimensionPicker(
                        'global_dimension_1',
                        'Global dimension 1',
                      );
                    },
                    'global_dimension_1',
                    true,
                  )}
                  {renderValueRow(
                    'Global dimension 2',
                    asText(record.global_dimension_2),
                    () => {
                      void openDimensionPicker(
                        'global_dimension_2',
                        'Global dimension 2',
                      );
                    },
                    'global_dimension_2',
                  )}
                </>,
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <CurrencyPickerModal
        visible={currencyOpen}
        options={currencyOptions}
        selectedCode={currencyCode}
        onClose={() => setCurrencyOpen(false)}
        onSelect={code => {
          setCurrencyOpen(false);
          if (code !== currencyCode) {
            void saveField('local_currency_code', code);
          }
        }}
        colors={colors}
      />

      <Modal
        visible={picker != null}
        animationType="slide"
        onRequestClose={() => setPicker(null)}>
        <View style={[styles.modalRoot, {backgroundColor: colors.background}]}>
          <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
            <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
              {picker?.title}
            </Text>
            <TouchableOpacity onPress={() => setPicker(null)} hitSlop={12}>
              <Text style={[styles.modalDone, {color: COLORS.primary}]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          {pickerLoading ? (
            <ActivityIndicator
              style={styles.modalSpinner}
              size="large"
              color={COLORS.primary}
            />
          ) : (
            <FlatList
              data={pickerOptions}
              keyExtractor={item => item.value || 'none'}
              renderItem={({item}) => {
                const selected = (picker?.selected ?? '') === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.optionRow, {borderBottomColor: colors.border}]}
                    onPress={() => {
                      const field = picker?.field;
                      setPicker(null);
                      if (field && item.value !== (picker?.selected ?? '')) {
                        void saveField(field, item.value || null);
                      }
                    }}>
                    <Text
                      style={[
                        styles.optionLabel,
                        {color: selected ? COLORS.primary : colors.textPrimary},
                      ]}>
                      {item.caption || item.value || 'None'}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
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
    gap: 20,
  },
  sectionBlock: {gap: 8},
  sectionTitle: {
    ...FONTS.body5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowTextCol: {flex: 1, minWidth: 0, marginRight: 12},
  rowTitle: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSubtitle: {...FONTS.body5, marginTop: 2, lineHeight: 18},
  chevron: {width: 16, height: 16},
  divider: {height: StyleSheet.hairlineWidth, marginLeft: 14},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {...FONTS.body3, textAlign: 'center'},
  retryBtn: {borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10},
  retryText: {...FONTS.body4, color: COLORS.white, fontWeight: '600'},
  modalRoot: {flex: 1},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {...FONTS.h3, fontSize: 17, fontWeight: '700'},
  modalDone: {...FONTS.body3, fontWeight: '600'},
  modalSpinner: {marginTop: 32},
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {...FONTS.body3},
});

export default GeneralLedgerSetup;
