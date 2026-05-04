import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import {QuickIconPressable} from '../../Components';
import {ICON_BUTTON_HIT_SLOP} from '../../constants';
import {Item} from './Items';
import icons from '../../constants/icons';
import {createItem, updateItem, fetchCategories} from '../../services/app.services';
import Toast from 'react-native-toast-message';
import {useTheme} from '../../context/ThemeContext';

interface Category {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
}

interface ItemFormModalProps {
  visible: boolean;
  onClose: () => void;
  item: Item | null; // null for create, Item for edit
  onSave: (savedItem: Item) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface ItemFormValues {
  item_name: string;
  description: string;
  unit_price: number; // Store as number
  category_id: number | null;
}

const ItemFormModal: React.FC<ItemFormModalProps> = ({
  visible,
  onClose,
  item,
  onSave,
  canCreate,
  canEdit,
  canDelete,
}) => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const isEditMode = !!item;

  const {colors} = useTheme();
  const formTheme = useMemo(
    () => ({
      modalContent: {backgroundColor: colors.surface},
      header: {borderBottomColor: colors.border},
      title: {color: colors.textPrimary},
      closeButton: {backgroundColor: colors.backButtonBg},
      closeButtonText: {color: colors.textSecondary},
      formCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      label: {color: colors.textPrimary},
      input: {
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
      },
      disabledInput: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      loadingText: {color: colors.textSecondary},
      pickerContainer: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      pickerButtonText: {color: colors.textPrimary},
      pickerButtonPlaceholder: {color: colors.placeholder},
      pickerArrow: {tintColor: colors.iconMuted},
      priceInputContainer: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      priceInput: {color: colors.textPrimary},
      footer: {borderTopColor: colors.border},
      cancelButton: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      cancelButtonText: {color: colors.textSecondary},
    }),
    [colors],
  );

  // Form state
  const [formData, setFormData] = useState<ItemFormValues>({
    item_name: '',
    description: '',
    unit_price: 0,
    category_id: null,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const categoriesData = await fetchCategories();
      
      // fetchCategories now returns an array directly (handles both array and paginated responses)
      if (!Array.isArray(categoriesData)) {
        console.warn('Categories response is not an array:', categoriesData);
        setCategories([]);
        return;
      }
      
      // Map categories to expected format (code/description -> id/name)
      const mappedCategories = categoriesData.map((cat: any, index: number) => ({
        id: cat.id || cat.code || `cat_${index}`, // Use code as id if no id exists
        code: cat.code,
        name: cat.name || cat.description || cat.code,
        description: cat.description || cat.code,
      }));
      
      setCategories(mappedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      // Map item_category (code) to category_id for form
      let mappedCategoryId = null;
      if (item.item_category) {
        // item_category might be an object with code, or just a code string
        const categoryCode =
          typeof item.item_category === 'string'
            ? item.item_category
            : item.item_category?.code;
        if (categoryCode && categories.length > 0) {
          // Find matching category in our list
          const matchedCategory = categories.find(
            cat => cat.code === categoryCode,
          );
          mappedCategoryId = matchedCategory
            ? matchedCategory.id || matchedCategory.code
            : categoryCode;
        } else if (categoryCode) {
          // If categories not loaded yet, store the code temporarily
          mappedCategoryId = categoryCode;
        }
      } else if (item.category_id) {
        mappedCategoryId = item.category_id;
      }

      setFormData({
        item_name: item.item_name || '',
        description: item.description || '',
        unit_price: item.unit_price || 0,
        category_id: mappedCategoryId,
      });
    } else {
      // Reset form for new item
      setFormData({
        item_name: '',
        description: '',
        unit_price: 0,
        category_id: null,
      });
    }
    setErrors({});
  }, [item, visible, categories]);

  // Load categories when modal opens
  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [visible, loadCategories]);

  const getSelectedCategoryLabel = () => {
    if (!formData.category_id) {
      return 'Select category';
    }
    const selected = categories.find(
      cat => (cat.id || cat.code) === formData.category_id,
    );
    return selected?.name || selected?.description || selected?.code || 'Select category';
  };

  const openCategoriesPickerForForm = () => {
    const initialCodes: string[] = [];
    if (formData.category_id != null) {
      const match = categories.find(
        c => String(c.id || c.code) === String(formData.category_id),
      );
      if (match?.code) {
        initialCodes.push(String(match.code));
      }
    }
    (navigation as any).navigate('ItemCategories', {
      pickerMode: true,
      returnScreen: 'AllItems',
      initialSelectedCodes: initialCodes,
    });
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    const pick = route.params?.categoryPick;
    if (pick === undefined) {
      return;
    }
    navigation.setParams({categoryPick: undefined} as never);
    setFormData(prev => {
      if (pick.code == null || pick.code === '') {
        return {...prev, category_id: null};
      }
      const cat = categories.find(c => c.code === pick.code);
      return {
        ...prev,
        category_id: (cat?.id ?? cat?.code ?? pick.code) as number | null,
      };
    });
  }, [visible, route.params?.categoryPick, navigation, categories]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.item_name || !formData.item_name.trim()) {
      newErrors.item_name = 'Item name is required';
    }

    // Validate unit_price if provided
    if (formData.unit_price && formData.unit_price < 0) {
      newErrors.unit_price = 'Price must be a valid positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // Check permissions
    if (isEditMode && !canEdit) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to edit items.',
      );
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to create items.',
      );
      return;
    }

    setLoading(true);
    try {
      const itemData: Partial<Item> = {
        item_name: formData.item_name.trim(),
      };

      // Only include optional fields if they have values
      if (formData.description && formData.description.trim()) {
        itemData.description = formData.description.trim();
      }

      if (formData.unit_price && formData.unit_price > 0) {
        itemData.unit_price = formData.unit_price;
      }

      // Map category_id to item_category code for backend
      if (formData.category_id) {
        const selectedCategory = categories.find(
          cat => (cat.id || cat.code) === formData.category_id,
        );
        if (selectedCategory && selectedCategory.code) {
          // Backend expects item_category as code (string), not category_id
          (itemData as any).item_category = selectedCategory.code;
        } else if (formData.category_id) {
          // Fallback: use the value directly if it's already a code
          (itemData as any).item_category = formData.category_id;
        }
      }

      let response;
      if (isEditMode && item) {
        // For edit, use updateItem (which uses upsert with system_id)
        const itemId = item.id || item.no;
        if (!itemId) {
          throw new Error('Item ID is required for editing');
        }
        const updateData: Item = {
          ...item,
          ...itemData,
        };
        response = await updateItem(itemId, updateData);
      } else {
        // For create, use createItem (upsert without system_id)
        response = await createItem(itemData);
      }

      if (response && response.data) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: isEditMode
            ? 'Item updated successfully'
            : 'Item created successfully',
        });
        onSave(response.data);
        onClose();
      }
    } catch (error: any) {
      console.error('Error saving item:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.item_name?.[0] ||
        'Failed to save item';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render if modal is not visible
  if (!visible) {
    return null;
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={[styles.modalContent, formTheme.modalContent]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          {/* Header */}
          <View style={[styles.header, formTheme.header]}>
            <Text style={[styles.title, formTheme.title]}>
              {isEditMode ? 'Edit Item' : 'Create Item'}
            </Text>
            <QuickIconPressable
              onPress={onClose}
              style={[styles.closeButton, formTheme.closeButton]}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Close">
              <Text style={[styles.closeButtonText, formTheme.closeButtonText]}>✕</Text>
            </QuickIconPressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={[styles.formCard, formTheme.formCard]}>
              {/* Item No (Read-only, only for edit) */}
              {isEditMode && item?.no && (
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, formTheme.label]}>Item No</Text>
                  <TextInput
                    style={[
                      styles.input,
                      formTheme.input,
                      styles.disabledInput,
                      formTheme.disabledInput,
                    ]}
                    value={item.no}
                    editable={false}
                  />
                </View>
              )}

              {/* Item Name */}
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, formTheme.label]}>Item Name *</Text>
                <TextInput
                  style={[
                    styles.input,
                    formTheme.input,
                    errors.item_name && styles.inputError,
                  ]}
                  value={formData.item_name}
                  onChangeText={text =>
                    setFormData({...formData, item_name: text})
                  }
                  placeholder="Enter item name"
                  placeholderTextColor={colors.placeholder}
                />
                {errors.item_name && (
                  <Text style={styles.errorText}>{errors.item_name}</Text>
                )}
              </View>

              {/* Description */}
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, formTheme.label]}>Description</Text>
                <TextInput
                  style={[styles.input, formTheme.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={text =>
                    setFormData({...formData, description: text})
                  }
                  placeholder="Enter item description"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Category */}
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, formTheme.label]}>Category</Text>
                {categoriesLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={[styles.loadingText, formTheme.loadingText]}>
                      Loading categories...
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.pickerContainer, formTheme.pickerContainer]}
                    activeOpacity={0.7}
                    onPress={openCategoriesPickerForForm}>
                    <View style={styles.pickerButtonInner}>
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formTheme.pickerButtonText,
                          !formData.category_id && [
                            styles.pickerButtonPlaceholder,
                            formTheme.pickerButtonPlaceholder,
                          ],
                        ]}>
                        {getSelectedCategoryLabel()}
                      </Text>
                      <Image
                        source={icons.down_arrow}
                        style={[styles.pickerArrow, formTheme.pickerArrow]}
                        resizeMode="contain"
                      />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Price */}
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, formTheme.label]}>Price (UGX)</Text>
                <View style={[styles.priceInputContainer, formTheme.priceInputContainer]}>
                  <Text style={styles.pricePrefix}>UGX</Text>
                  <TextInput
                    style={[
                      styles.priceInput,
                      formTheme.priceInput,
                      errors.unit_price && styles.inputError,
                    ]}
                    value={
                      formData.unit_price > 0
                        ? formData.unit_price.toLocaleString()
                        : ''
                    }
                    onChangeText={text => {
                      // Remove commas and non-numeric characters except decimal point
                      const cleanedText = text.replace(/[^0-9.]/g, '');
                      // Remove commas that might be in the input
                      const numericValue = parseFloat(
                        cleanedText.replace(/,/g, ''),
                      ) || 0;
                      setFormData({...formData, unit_price: numericValue});
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                </View>
                {errors.unit_price && (
                  <Text style={styles.errorText}>{errors.unit_price}</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={[styles.footer, formTheme.footer]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, formTheme.cancelButton]}
              onPress={onClose}
              disabled={loading}>
              <Text style={[styles.cancelButtonText, formTheme.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            {((isEditMode && canEdit) || (!isEditMode && canCreate)) && (
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.buttonText}>
                    {isEditMode ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.32)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.black,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.gray2,
  },
  scrollView: {
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: SIZES.base * 2,
  },
  formCard: {
    marginHorizontal: SIZES.padding,
    marginTop: SIZES.base * 1.5,
    marginBottom: SIZES.base,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    paddingBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  fieldContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.black,
    marginBottom: SIZES.base / 2,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    paddingHorizontal: SIZES.base * 1.5,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: SIZES.base,
  },
  disabledInput: {
    backgroundColor: COLORS.lightGray1,
    color: COLORS.gray2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    ...FONTS.body5,
    color: COLORS.error,
    marginTop: SIZES.base / 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
  },
  loadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginLeft: SIZES.base,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    // Picker dropdown can extend beyond the container bounds on Android.
    // If we clip it, the dropdown can appear as a black block.
    overflow: 'visible',
  },
  pickerButtonInner: {
    height: 50,
    paddingHorizontal: SIZES.base * 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: {
    ...FONTS.body3,
    color: COLORS.black,
  },
  pickerButtonPlaceholder: {
    color: COLORS.gray3,
  },
  pickerArrow: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: SIZES.base * 1.5,
    height: 48,
  },
  pricePrefix: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: SIZES.base,
  },
  priceInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
    paddingVertical: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base * 1.5,
    paddingBottom: SIZES.base * 2,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SIZES.base / 2,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  cancelButtonText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default ItemFormModal;

