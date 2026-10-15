import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import {COLORS} from '../../constants/theme';
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import icons from '../../constants/icons';
import {
  ItemCategory,
  createItemCategory,
  updateItemCategory,
} from '../../services/app.services';
import Toast from 'react-native-toast-message';

type CategoryFormValues = {
  code: string;
  description: string;
  parent_id: string | null;
};

const emptyCategoryForm = (): CategoryFormValues => ({
  code: '',
  description: '',
  parent_id: null,
});

const categoryToForm = (category: ItemCategory): CategoryFormValues => ({
  code: category.code || '',
  description: category.description || '',
  parent_id: category.parent_id || null,
});

const OPTIONAL_CATEGORY_FIELDS = new Set<keyof CategoryFormValues>([
  'description',
  'parent_id',
]);

interface ItemCategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  category: ItemCategory | null; // null for create, ItemCategory for edit
  /** Called after a successful auto-save so the list can refresh (does not close). */
  onSave: () => void;
  /** Keeps parent selection in sync after create / update. */
  onRecordChange?: (category: ItemCategory) => void;
  canCreate: boolean;
  canEdit: boolean;
  categories: ItemCategory[]; // For parent selection
}

const ItemCategoryFormModal: React.FC<ItemCategoryFormModalProps> = ({
  visible,
  onClose,
  category,
  onSave,
  onRecordChange,
  canCreate,
  canEdit,
  categories,
}) => {
  const [formData, setFormData] = useState<CategoryFormValues>(emptyCategoryForm);
  const [currentRecord, setCurrentRecord] = useState<ItemCategory | null>(
    category,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parentPickerVisible, setParentPickerVisible] = useState(false);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  const formDataRef = useRef(formData);
  const currentRecordRef = useRef(currentRecord);
  const savingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formDataRef.current = formData;
  currentRecordRef.current = currentRecord;

  const isEditMode = !!currentRecord?.code;
  const canWrite = isEditMode ? canEdit : canCreate;

  const {colors} = useTheme();
  const topInset = useScreenTopInset();
  const catTheme = useMemo(
    () => ({
      pageRoot: {backgroundColor: colors.background},
      page: {backgroundColor: colors.background},
      pageTitle: {color: colors.textPrimary},
      autoSaveHint: {color: colors.textSecondary},
      sectionTitle: {color: colors.textPrimary},
      input: {
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      inputDisabled: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      parentRow: {borderBottomColor: colors.border},
      parentRowText: {color: colors.textPrimary},
      parentRowPlaceholder: {color: colors.textSecondary},
      sectionDivider: {backgroundColor: colors.border},
      channelsCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      channelsTitle: {color: colors.textPrimary},
      channelsText: {color: colors.textSecondary},
      previewTileButton: {backgroundColor: colors.screenMuted},
      previewTileButtonText: {color: colors.textPrimary},
      pickerModalContent: {backgroundColor: colors.surface},
      pickerModalHeader: {borderBottomColor: colors.border},
      pickerModalTitle: {color: colors.textPrimary},
      pickerSearchContainer: {borderBottomColor: colors.border},
      pickerSearchInputContainer: {backgroundColor: colors.inputBackground},
      pickerSearchIcon: {tintColor: colors.iconMuted},
      pickerSearchInput: {color: colors.textPrimary},
      pickerItem: {borderBottomColor: colors.border},
      pickerItemSelected: {backgroundColor: colors.screenMuted},
      pickerItemText: {color: colors.textPrimary},
      pickerEmptyText: {color: colors.textSecondary},
      helpText: {color: colors.textSecondary},
      headerIcon: {tintColor: colors.textPrimary},
      pickerCloseIcon: {tintColor: colors.textPrimary},
      headerSaveText: {color: colors.textSecondary},
    }),
    [colors],
  );

  useEffect(() => {
    if (!visible) {
      setCurrentRecord(null);
      setFormData(emptyCategoryForm());
      setErrors({});
      setShowSaved(false);
      return;
    }
    if (category?.code) {
      if (currentRecordRef.current?.code !== category.code) {
        setCurrentRecord(category);
        setFormData(categoryToForm(category));
      } else {
        setCurrentRecord(category);
      }
    } else if (!currentRecordRef.current?.code) {
      setCurrentRecord(null);
      setFormData(emptyCategoryForm());
    }
    setErrors({});
    setShowSaved(false);
  }, [category?.code, visible]);

  useEffect(() => {
    if (!visible) {
      setParentPickerVisible(false);
      setParentSearchQuery('');
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
    }
  }, [visible]);

  const flashSaved = useCallback(() => {
    setShowSaved(true);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => {
      setShowSaved(false);
      savedTimerRef.current = null;
    }, 2000);
  }, []);

  const buildCreatePayload = (
    values: CategoryFormValues,
  ): Partial<ItemCategory> => {
    const code = values.code.trim().toUpperCase();
    const payload: Partial<ItemCategory> = {
      code,
      description: values.description?.trim()
        ? values.description.trim()
        : code,
    };
    if (values.parent_id) {
      payload.parent_id = values.parent_id;
    } else {
      payload.parent_id = null;
    }
    return payload;
  };

  const getFieldError = (field: keyof CategoryFormValues, value: unknown) => {
    if (field === 'code') {
      const code = String(value || '').trim();
      if (!code) {
        return 'Category name is required';
      }
      if (code.length > 255) {
        return 'Category name must be 255 characters or less';
      }
    }
    if (field === 'description') {
      const description = String(value || '').trim();
      if (description.length > 255) {
        return 'Description must be 255 characters or less';
      }
    }
    return null;
  };

  const autoSaveField = useCallback(
    async (
      field: keyof CategoryFormValues,
      rawValue: CategoryFormValues[keyof CategoryFormValues],
    ) => {
      if (!visible || !canWrite || savingRef.current) {
        return;
      }

      // Code is immutable after create.
      if (field === 'code' && currentRecordRef.current?.code) {
        return;
      }

      const value =
        typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      const normalizedValue =
        field === 'code' && typeof value === 'string'
          ? value.toUpperCase()
          : value;
      const record = currentRecordRef.current;
      const values = {...formDataRef.current, [field]: rawValue};

      if (record?.code) {
        const existing = (record as any)[field];
        if (String(existing ?? '') === String(normalizedValue ?? '')) {
          return;
        }
      }

      const fieldError = getFieldError(field, normalizedValue);
      if (fieldError) {
        setErrors(prev => ({...prev, [field]: fieldError}));
        return;
      }

      if (
        !OPTIONAL_CATEGORY_FIELDS.has(field) &&
        (normalizedValue === '' ||
          normalizedValue === null ||
          normalizedValue === undefined)
      ) {
        return;
      }

      const codeForCreate =
        field === 'code'
          ? String(normalizedValue || '')
          : values.code || '';
      if (!record?.code && !codeForCreate.trim()) {
        return;
      }

      setErrors(prev => {
        const next = {...prev};
        delete next[field];
        return next;
      });

      savingRef.current = true;
      setIsSaving(true);
      try {
        if (!record?.code) {
          const created = await createItemCategory(
            buildCreatePayload({
              ...values,
              [field]: normalizedValue as any,
            }),
          );
          setCurrentRecord(created);
          setFormData(categoryToForm(created));
          onRecordChange?.(created);
          onSave();
          flashSaved();
        } else {
          const patch: Partial<ItemCategory> = {
            [field]:
              field === 'description' &&
              (normalizedValue === '' || normalizedValue == null)
                ? record.code
                : normalizedValue,
          } as Partial<ItemCategory>;
          const updated = await updateItemCategory(record.code, patch);
          setCurrentRecord(updated);
          if (field === 'description' || field === 'parent_id') {
            setFormData(prev => ({
              ...prev,
              description: updated.description || prev.description,
              parent_id: updated.parent_id ?? null,
            }));
          }
          onRecordChange?.(updated);
          onSave();
          flashSaved();
        }
      } catch (error: any) {
        console.error('Error auto-saving category:', error);
        const errorMessage =
          error?.response?.data?.errors?.[field]?.[0] ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          error?.response?.data?.[field]?.[0] ||
          `Failed to save ${field.replace(/_/g, ' ')}`;
        setErrors(prev => ({...prev, [field]: String(errorMessage)}));
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: String(errorMessage),
        });
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [visible, canWrite, onRecordChange, onSave, flashSaved],
  );

  // Filter out current category and its descendants from parent options
  const getParentOptions = () => {
    if (!isEditMode || !currentRecord?.code) {
      return categories;
    }
    return categories.filter(
      cat =>
        cat.code !== currentRecord.code &&
        cat.parent_id !== currentRecord.code,
    );
  };

  const parentOptions = getParentOptions();

  const filteredParentOptions = parentOptions.filter(cat => {
    if (!parentSearchQuery.trim()) return true;
    const searchLower = parentSearchQuery.toLowerCase();
    return (
      cat.code.toLowerCase().includes(searchLower) ||
      (cat.description && cat.description.toLowerCase().includes(searchLower))
    );
  });

  const getSelectedParentLabel = () => {
    if (!formData.parent_id) return 'No parent category';
    const selected = parentOptions.find(cat => cat.code === formData.parent_id);
    return selected
      ? selected.description || selected.code
      : 'Select parent category';
  };

  const previewTitle = (formData.code || 'Ca').trim();
  const previewMonogram =
    previewTitle
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    previewTitle.slice(0, 2).toUpperCase() ||
    'CA';
  const previewLabel = (
    formData.description ||
    formData.code ||
    'Category'
  ).trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.pageRoot, catTheme.pageRoot]}>
        <View style={[styles.page, catTheme.page]}>
          <View style={[styles.pageHeader, {paddingTop: topInset}]}>
            <QuickIconPressable
              onPress={onClose}
              style={styles.headerIconButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              accessibilityLabel="Close">
              <Image
                source={icons.cross}
                style={[styles.headerIcon, catTheme.headerIcon]}
                resizeMode="contain"
              />
            </QuickIconPressable>

            {canWrite && (isSaving || showSaved) ? (
              <View
                style={styles.headerSaveStatus}
                accessibilityRole="text"
                accessibilityLabel={isSaving ? 'Saving' : 'Saved'}>
                <Text style={[styles.headerSaveText, catTheme.headerSaveText]}>
                  {isSaving ? 'Saving...' : 'Saved'}
                </Text>
              </View>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <Text style={[styles.pageTitle, catTheme.pageTitle]}>
              {isEditMode ? 'Edit category' : 'Create category'}
            </Text>
            <Text style={[styles.autoSaveHint, catTheme.autoSaveHint]}>
              Changes save automatically when you leave a field
            </Text>

            <View style={styles.previewSection}>
              <View style={styles.previewTile}>
                <Text style={styles.previewTileIcon}>◈</Text>
                <Text style={styles.previewTileMonogram}>{previewMonogram}</Text>
                <Text
                  style={styles.previewTileLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {previewLabel}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.previewTileButton, catTheme.previewTileButton]}
                onPress={() =>
                  Toast.show({
                    type: 'info',
                    text1: 'POS tile preview',
                    text2: 'Tile customization will be added in a later update.',
                  })
                }
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.previewTileButtonText,
                    catTheme.previewTileButtonText,
                  ]}>
                  Edit POS tile
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, catTheme.sectionTitle]}>
                Details
              </Text>

              <TextInput
                style={[
                  styles.input,
                  catTheme.input,
                  errors.code && styles.inputError,
                  isEditMode && [styles.inputDisabled, catTheme.inputDisabled],
                ]}
                placeholder="Category name"
                placeholderTextColor={colors.placeholder}
                value={formData.code}
                onChangeText={text =>
                  setFormData({...formData, code: text.toUpperCase()})
                }
                onBlur={() =>
                  autoSaveField('code', formDataRef.current.code)
                }
                editable={!isEditMode && canWrite}
                autoCapitalize="characters"
                maxLength={255}
              />
              {errors.code ? (
                <Text style={styles.errorText}>{errors.code}</Text>
              ) : null}
              {isEditMode ? (
                <Text style={[styles.helpText, catTheme.helpText]}>
                  Category name cannot be changed after creation.
                </Text>
              ) : null}

              <TextInput
                style={[
                  styles.input,
                  catTheme.input,
                  styles.inputSpaced,
                  errors.description && styles.inputError,
                ]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.placeholder}
                value={formData.description}
                onChangeText={text =>
                  setFormData({...formData, description: text})
                }
                onBlur={() =>
                  autoSaveField(
                    'description',
                    formDataRef.current.description || '',
                  )
                }
                editable={canWrite}
                autoCapitalize="sentences"
                maxLength={255}
              />
              {errors.description ? (
                <Text style={styles.errorText}>{errors.description}</Text>
              ) : (
                <Text style={[styles.helpText, catTheme.helpText]}>
                  Add a clearer label for reporting and search.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, catTheme.sectionTitle]}>
                Parent category
              </Text>
              <TouchableOpacity
                style={[styles.parentRow, catTheme.parentRow]}
                onPress={() => {
                  if (canWrite) {
                    setParentPickerVisible(true);
                  }
                }}
                activeOpacity={0.7}
                disabled={!canWrite}>
                <Text
                  style={[
                    styles.parentRowText,
                    catTheme.parentRowText,
                    !formData.parent_id && [
                      styles.parentRowPlaceholder,
                      catTheme.parentRowPlaceholder,
                    ],
                  ]}>
                  {getSelectedParentLabel()}
                </Text>
                <Text style={styles.parentRowChevron}>›</Text>
              </TouchableOpacity>
              {errors.parent_id ? (
                <Text style={styles.errorText}>{errors.parent_id}</Text>
              ) : null}
            </View>

            <View style={[styles.sectionDivider, catTheme.sectionDivider]} />

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, catTheme.sectionTitle]}>
                Channels
              </Text>
              <View style={[styles.channelsCard, catTheme.channelsCard]}>
                <Text style={[styles.channelsTitle, catTheme.channelsTitle]}>
                  Available in POS
                </Text>
                <Text style={[styles.channelsText, catTheme.channelsText]}>
                  This category will appear in your product flow and can be used
                  across your selling channels.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Parent Category Picker Modal */}
      <Modal
        visible={parentPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setParentPickerVisible(false);
          setParentSearchQuery('');
        }}>
        <View style={styles.pickerModalOverlay}>
          <View
            style={[styles.pickerModalContent, catTheme.pickerModalContent]}>
            <View
              style={[styles.pickerModalHeader, catTheme.pickerModalHeader]}>
              <Text
                style={[styles.pickerModalTitle, catTheme.pickerModalTitle]}>
                Select Parent Category
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setParentPickerVisible(false);
                  setParentSearchQuery('');
                }}
                style={styles.pickerCloseButton}>
                <Image
                  source={icons.cross}
                  style={[styles.pickerCloseIcon, catTheme.pickerCloseIcon]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.pickerSearchContainer,
                catTheme.pickerSearchContainer,
              ]}>
              <View
                style={[
                  styles.pickerSearchInputContainer,
                  catTheme.pickerSearchInputContainer,
                ]}>
                <Image
                  source={icons.search}
                  style={[styles.pickerSearchIcon, catTheme.pickerSearchIcon]}
                  resizeMode="contain"
                />
                <TextInput
                  style={[styles.pickerSearchInput, catTheme.pickerSearchInput]}
                  placeholder="Search categories..."
                  placeholderTextColor={colors.placeholder}
                  value={parentSearchQuery}
                  onChangeText={setParentSearchQuery}
                  autoFocus={true}
                />
              </View>
            </View>

            <FlatList
              data={[
                {code: '', description: 'No parent category', isRoot: true},
                ...filteredParentOptions,
              ]}
              keyExtractor={item => item.code || 'root'}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    catTheme.pickerItem,
                    formData.parent_id === item.code && [
                      styles.pickerItemSelected,
                      catTheme.pickerItemSelected,
                    ],
                  ]}
                  onPress={() => {
                    const nextParentId = item.code || null;
                    setFormData({
                      ...formData,
                      parent_id: nextParentId,
                    });
                    setParentPickerVisible(false);
                    setParentSearchQuery('');
                    void autoSaveField('parent_id', nextParentId);
                  }}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.pickerItemText,
                      catTheme.pickerItemText,
                      formData.parent_id === item.code &&
                        styles.pickerItemTextSelected,
                    ]}>
                    {item.description || item.code || 'No parent category'}
                  </Text>
                  {formData.parent_id === item.code && (
                    <Image
                      source={icons.correct}
                      style={styles.pickerCheckIcon}
                      resizeMode="contain"
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmptyContainer}>
                  <Text
                    style={[styles.pickerEmptyText, catTheme.pickerEmptyText]}>
                    No categories found
                  </Text>
                </View>
              }
              style={styles.pickerList}
            />
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  page: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary3,
  },
  headerSaveStatus: {
    minWidth: 88,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  headerSaveText: {
    color: COLORS.gray2,
    fontSize: 15,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 108,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 22,
    marginBottom: 4,
  },
  autoSaveHint: {
    fontSize: 13,
    color: COLORS.gray2,
    marginBottom: 22,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  previewTile: {
    width: 202,
    height: 158,
    borderRadius: 12,
    backgroundColor: COLORS.primary3,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: 'space-between',
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  previewTileIcon: {
    color: COLORS.accent2,
    fontSize: 14,
    opacity: 0.9,
  },
  previewTileMonogram: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    marginTop: 10,
  },
  previewTileLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  previewTileButton: {
    marginTop: 16,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: COLORS.transparentPrimary,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTileButtonText: {
    color: COLORS.primary3,
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 17,
    color: COLORS.black,
    backgroundColor: COLORS.white,
    minHeight: 58,
  },
  inputSpaced: {
    marginTop: 14,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.lightGray2,
    color: COLORS.gray2,
  },
  parentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.transparentPrimary,
  },
  parentRowText: {
    flex: 1,
    fontSize: 17,
    color: COLORS.black,
  },
  parentRowPlaceholder: {
    color: COLORS.gray2,
  },
  parentRowChevron: {
    fontSize: 28,
    lineHeight: 28,
    color: COLORS.primary2,
    marginLeft: 12,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: COLORS.transparentPrimary,
    borderRadius: 999,
    marginTop: 10,
    marginBottom: 26,
  },
  channelsCard: {
    borderRadius: 16,
    backgroundColor: COLORS.transparentPrimary,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  channelsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 6,
  },
  channelsText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.secondary2,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
  },
  pickerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCloseIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary3,
  },
  pickerSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  pickerSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.transparentPrimary,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  pickerSearchIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.gray2,
    marginRight: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.black,
    paddingVertical: 0,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: COLORS.transparentPrimary,
  },
  pickerItemText: {
    fontSize: 15,
    color: COLORS.black,
    flex: 1,
  },
  pickerItemTextSelected: {
    fontWeight: '600',
    color: COLORS.primary2,
  },
  pickerCheckIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary2,
  },
  pickerEmptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    color: COLORS.gray2,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: 8,
  },
  helpText: {
    fontSize: 13,
    color: COLORS.gray2,
    marginTop: 8,
  },
});

export default ItemCategoryFormModal;
