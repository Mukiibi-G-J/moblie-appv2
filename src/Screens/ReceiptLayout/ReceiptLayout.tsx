import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {QuickIconPressable} from '../../Components';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {
  listReceiptTemplates,
  saveReceiptTemplateSections,
  type ReceiptTemplateRecord,
} from '../../services/ReceiptTemplateService';
import {
  SECTION_CATALOG,
  createSectionFromCatalog,
  sectionLabel,
  type SectionCatalogEntry,
} from '../../shared/receipt/sectionCatalog';
import type {ReceiptType, TemplateSection} from '../../shared/receipt/types';
import {getApiErrorMessage} from '../../utils/apiError';
import PrintService from '../../services/PrintService';

const RECEIPT_TYPES: {id: ReceiptType; label: string}[] = [
  {id: 'sale', label: 'Sale'},
  {id: 'prepayment', label: 'Prepayment'},
  {id: 'payment_journal', label: 'Payment'},
  {id: 'kot', label: 'Kitchen'},
  {id: 'bar', label: 'Bar'},
];

function preferTemplate(
  rows: ReceiptTemplateRecord[],
): ReceiptTemplateRecord | null {
  if (!rows.length) {
    return null;
  }
  return (
    rows.find(
      row =>
        row.layout_preset === 'standard' || row.code.endsWith('_standard'),
    ) || rows[0]
  );
}

function optionValue(
  section: TemplateSection,
  key: string,
  fallback: boolean | string,
): boolean | string {
  const config = section.config || {};
  if (config[key] === undefined || config[key] === null) {
    return fallback;
  }
  return config[key] as boolean | string;
}

const ReceiptLayout: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const [receiptType, setReceiptType] = useState<ReceiptType>('sale');
  const [templates, setTemplates] = useState<ReceiptTemplateRecord[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const applyTemplate = useCallback((row: ReceiptTemplateRecord | null) => {
    setTemplateId(row?.id ?? null);
    const next = [...(row?.sections || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    setSections(next);
    setSelectedId(next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listReceiptTemplates(receiptType)
      .then(rows => {
        if (cancelled) {
          return;
        }
        setTemplates(rows);
        applyTemplate(preferTemplate(rows));
      })
      .catch(err => {
        if (!cancelled) {
          setTemplates([]);
          applyTemplate(null);
          setError(
            getApiErrorMessage(err, {
              fallback: 'Could not load receipt templates.',
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyTemplate, receiptType]);

  const catalog = SECTION_CATALOG[receiptType] || [];
  const selected = sections.find(section => section.id === selectedId) || null;
  const selectedEntry: SectionCatalogEntry | undefined = catalog.find(
    entry => entry.id === selected?.id,
  );
  const unused = useMemo(
    () => catalog.filter(entry => !sections.some(section => section.id === entry.id)),
    [catalog, sections],
  );
  const template = templates.find(row => row.id === templateId) || null;

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) {
      return;
    }
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(
      next.map((section, index) => ({...section, order: (index + 1) * 10})),
    );
  };

  const updateSection = (id: string, patch: Partial<TemplateSection>) => {
    setSections(current =>
      current.map(section =>
        section.id === id ? {...section, ...patch} : section,
      ),
    );
  };

  const updateConfig = (id: string, key: string, value: boolean | string) => {
    setSections(current =>
      current.map(section => {
        if (section.id !== id) {
          return section;
        }
        return {
          ...section,
          config: {...(section.config || {}), [key]: value},
        };
      }),
    );
  };

  const addBlock = (sectionId: string) => {
    const created = createSectionFromCatalog(
      receiptType,
      sectionId,
      (sections.length + 1) * 10,
    );
    if (!created) {
      return;
    }
    setSections(current => [...current, created]);
    setSelectedId(created.id);
  };

  const save = async () => {
    if (templateId == null) {
      return;
    }
    setSaving(true);
    try {
      await saveReceiptTemplateSections(templateId, sections);
      setTemplates(current =>
        current.map(row =>
          row.id === templateId
            ? {...row, sections, editor_mode: 'visual'}
            : row,
        ),
      );
      Toast.show({
        type: 'success',
        text1: 'Receipt layout saved',
        text2: 'The next print uses this layout.',
        position: 'top',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: getApiErrorMessage(err, {
          fallback: 'This receipt layout was not saved.',
        }),
        position: 'top',
      });
    } finally {
      setSaving(false);
    }
  };

  const testPrint = async () => {
    setPrinting(true);
    try {
      const ok = await PrintService.getInstance().printLayoutSample({
        code: template?.code || 'preview',
        name: template?.name || 'Preview',
        receiptType,
        layoutPreset: 'standard',
        paperProfile: {widthMm: 58, charsPerLine: 32},
        sections,
        editorMode: 'visual',
      });
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok ? 'Test receipt printed' : 'Test print failed',
        text2: ok
          ? 'Check the slip. Save when later sales should use this layout.'
          : 'Connect a printer in Printer configuration and try again.',
        position: 'top',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Test print failed',
        text2: getApiErrorMessage(err, {
          fallback: 'Could not print this layout.',
        }),
        position: 'top',
      });
    } finally {
      setPrinting(false);
    }
  };

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
            Receipt layout
          </Text>
          <TouchableOpacity
            onPress={() => {
              void save();
            }}
            disabled={saving || templateId == null}
            hitSlop={8}>
            <Text
              style={[
                styles.saveAction,
                {
                  color:
                    saving || templateId == null
                      ? colors.textTertiary
                      : COLORS.primary,
                },
              ]}>
              {saving ? 'Saving' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.hint, {color: colors.textSecondary}]}>
            Show, hide, and reorder the blocks on each receipt. Payee numbers
            come from Payment Methods.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {RECEIPT_TYPES.map(type => {
              const active = receiptType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setReceiptType(type.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? COLORS.primary : colors.card,
                      borderColor: active ? COLORS.primary : colors.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      {color: active ? COLORS.white : colors.textPrimary},
                    ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => {
              void testPrint();
            }}
            disabled={printing || loading || sections.length === 0}
            style={[
              styles.testButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: printing || loading || sections.length === 0 ? 0.5 : 1,
              },
            ]}>
            <Text style={[styles.testButtonText, {color: COLORS.primary}]}>
              {printing ? 'Printing' : 'Test print'}
            </Text>
          </TouchableOpacity>

          {error ? (
            <Text style={[styles.error, {color: COLORS.red}]}>{error}</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator
              style={styles.spinner}
              size="large"
              color={COLORS.primary}
            />
          ) : templates.length === 0 ? (
            <Text style={[styles.hint, {color: colors.textSecondary}]}>
              No template is saved for this receipt yet.
            </Text>
          ) : (
            <>
              {templates.length > 1 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
                    Template
                  </Text>
                  <View
                    style={[
                      styles.card,
                      {backgroundColor: colors.card, borderColor: colors.border},
                    ]}>
                    {templates.map((row, index) => (
                      <View key={row.id}>
                        <TouchableOpacity
                          style={styles.row}
                          onPress={() => applyTemplate(row)}>
                          <Text
                            style={[
                              styles.rowTitle,
                              {
                                color:
                                  row.id === templateId
                                    ? COLORS.primary
                                    : colors.textPrimary,
                              },
                            ]}>
                            {row.name}
                          </Text>
                        </TouchableOpacity>
                        {index < templates.length - 1 ? (
                          <View
                            style={[
                              styles.divider,
                              {backgroundColor: colors.border},
                            ]}
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : template ? (
                <Text style={[styles.templateName, {color: colors.textSecondary}]}>
                  {template.name}
                </Text>
              ) : null}

              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
                  Blocks
                </Text>
                <View
                  style={[
                    styles.card,
                    {backgroundColor: colors.card, borderColor: colors.border},
                  ]}>
                  {sections.map((section, index) => {
                    const active = selectedId === section.id;
                    return (
                      <View key={`${section.id}-${index}`}>
                        <View
                          style={[
                            styles.blockRow,
                            active && {backgroundColor: colors.screenMuted},
                          ]}>
                          <TouchableOpacity
                            style={styles.blockLabel}
                            onPress={() => setSelectedId(section.id)}>
                            <Text
                              style={[
                                styles.rowTitle,
                                {color: colors.textPrimary},
                              ]}>
                              {sectionLabel(receiptType, section.id)}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => reorder(index, index - 1)}
                            disabled={index === 0}
                            hitSlop={6}>
                            <Text
                              style={[
                                styles.moveText,
                                {
                                  color:
                                    index === 0
                                      ? colors.textTertiary
                                      : colors.textSecondary,
                                },
                              ]}>
                              Up
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => reorder(index, index + 1)}
                            disabled={index === sections.length - 1}
                            hitSlop={6}>
                            <Text
                              style={[
                                styles.moveText,
                                {
                                  color:
                                    index === sections.length - 1
                                      ? colors.textTertiary
                                      : colors.textSecondary,
                                },
                              ]}>
                              Down
                            </Text>
                          </TouchableOpacity>
                          <Switch
                            value={section.enabled !== false}
                            onValueChange={enabled =>
                              updateSection(section.id, {enabled})
                            }
                            trackColor={{
                              false: COLORS.lightGray2,
                              true: COLORS.primary,
                            }}
                            thumbColor={COLORS.white}
                          />
                        </View>
                        {index < sections.length - 1 ? (
                          <View
                            style={[
                              styles.divider,
                              {backgroundColor: colors.border},
                            ]}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>

              {selected && selectedEntry?.options?.length ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
                    {selectedEntry.label}
                  </Text>
                  <View
                    style={[
                      styles.card,
                      {backgroundColor: colors.card, borderColor: colors.border},
                    ]}>
                    {selectedEntry.options.map((option, index) => {
                      const value = optionValue(
                        selected,
                        option.key,
                        option.defaultValue,
                      );
                      return (
                        <View key={option.key}>
                          {option.kind === 'boolean' ? (
                            <View style={styles.row}>
                              <Text
                                style={[
                                  styles.rowTitle,
                                  {color: colors.textPrimary, flex: 1},
                                ]}>
                                {option.label}
                              </Text>
                              <Switch
                                value={Boolean(value)}
                                onValueChange={next =>
                                  updateConfig(selected.id, option.key, next)
                                }
                                trackColor={{
                                  false: COLORS.lightGray2,
                                  true: COLORS.primary,
                                }}
                                thumbColor={COLORS.white}
                              />
                            </View>
                          ) : (
                            <View style={styles.textOption}>
                              <Text
                                style={[
                                  styles.optionLabel,
                                  {color: colors.textSecondary},
                                ]}>
                                {option.label}
                              </Text>
                              <TextInput
                                value={String(value)}
                                onChangeText={text =>
                                  updateConfig(selected.id, option.key, text)
                                }
                                style={[
                                  styles.input,
                                  {
                                    color: colors.textPrimary,
                                    borderColor: colors.border,
                                    backgroundColor: colors.background,
                                  },
                                ]}
                                placeholderTextColor={colors.textTertiary}
                              />
                            </View>
                          )}
                          {index < (selectedEntry.options?.length || 0) - 1 ? (
                            <View
                              style={[
                                styles.divider,
                                {backgroundColor: colors.border},
                              ]}
                            />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                  {selectedEntry.description ? (
                    <Text style={[styles.hint, {color: colors.textSecondary}]}>
                      {selectedEntry.description}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {unused.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
                    Add a block
                  </Text>
                  <View
                    style={[
                      styles.card,
                      {backgroundColor: colors.card, borderColor: colors.border},
                    ]}>
                    {unused.map((entry, index) => (
                      <View key={entry.id}>
                        <TouchableOpacity
                          style={styles.row}
                          onPress={() => addBlock(entry.id)}>
                          <Text
                            style={[styles.rowTitle, {color: COLORS.primary}]}>
                            {entry.label}
                          </Text>
                        </TouchableOpacity>
                        {index < unused.length - 1 ? (
                          <View
                            style={[
                              styles.divider,
                              {backgroundColor: colors.border},
                            ]}
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
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
  saveAction: {...FONTS.body3, fontWeight: '700', minWidth: 52, textAlign: 'right'},
  scroll: {flex: 1},
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 3,
    gap: 16,
  },
  hint: {...FONTS.body5, lineHeight: 18},
  chips: {gap: 8, paddingVertical: 2},
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {...FONTS.body4, fontWeight: '600'},
  testButton: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  testButtonText: {...FONTS.body3, fontWeight: '700'},
  error: {...FONTS.body4},
  spinner: {marginTop: 24},
  templateName: {...FONTS.body5},
  sectionBlock: {gap: 8},
  sectionTitle: {
    ...FONTS.body5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
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
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  blockLabel: {flex: 1, minWidth: 0},
  rowTitle: {...FONTS.h3, fontSize: 16, fontWeight: '600'},
  moveText: {...FONTS.body5, fontWeight: '600'},
  divider: {height: StyleSheet.hairlineWidth, marginLeft: 14},
  textOption: {paddingHorizontal: 14, paddingVertical: 12, gap: 6},
  optionLabel: {...FONTS.body5},
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...FONTS.body3,
  },
});

export default ReceiptLayout;
