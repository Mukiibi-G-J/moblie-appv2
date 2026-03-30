import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import {COLORS} from '../../constants/theme';
import icons from '../../constants/icons';
import {
  ItemCategory,
  createItemCategory,
  updateItemCategory,
} from '../../services/app.services';
import Toast from 'react-native-toast-message';

interface ItemCategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  category: ItemCategory | null; // null for create, ItemCategory for edit
  onSave: () => void;
  canCreate: boolean;
  canEdit: boolean;
  categories: ItemCategory[]; // For parent selection
}

const ItemCategoryFormModal: React.FC<ItemCategoryFormModalProps> = ({
  visible,
  onClose,
  category,
  onSave,
  canCreate,
  canEdit,
  categories,
}) => {
  const isEditMode = !!category;

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    parent_id: null as string | null,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parentPickerVisible, setParentPickerVisible] = useState(false);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  // Initialize form when category changes
  useEffect(() => {
    if (category) {
      setFormData({
        code: category.code || '',
        description: category.description || '',
        parent_id: category.parent_id || null,
      });
    } else {
      // Reset form for new category
      setFormData({
        code: '',
        description: '',
        parent_id: null,
      });
    }
    setErrors({});
  }, [category, visible]);

  // Filter out current category and its descendants from parent options
  const getParentOptions = () => {
    if (!isEditMode) {
      return categories;
    }
    // Exclude current category and its descendants
    const excludeCodes = new Set<string>([category.code]);
    // Simple check: exclude categories with this as parent (one level deep)
    // For deeper nesting, you'd need a more sophisticated check
    return categories.filter(
      cat => cat.code !== category.code && cat.parent_id !== category.code,
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code || !formData.code.trim()) {
      newErrors.code = 'Category name is required';
    } else if (formData.code.trim().length > 255) {
      newErrors.code = 'Category name must be 255 characters or less';
    }

    if (formData.description && formData.description.trim().length > 255) {
      newErrors.description =
        'Description must be 255 characters or less';
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
        'You do not have permission to edit item categories.',
      );
      return;
    }

    if (!isEditMode && !canCreate) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to create item categories.',
      );
      return;
    }

    setLoading(true);
    try {
      const categoryData: Partial<ItemCategory> = {
        code: formData.code.trim().toUpperCase(),
      };

      // Description is optional, but if provided, include it
      if (formData.description && formData.description.trim()) {
        categoryData.description = formData.description.trim();
      } else {
        // If description is empty, backend will handle it
        // But we can set it to code as default
        categoryData.description = formData.code.trim().toUpperCase();
      }

      // Parent ID is optional
      if (formData.parent_id) {
        categoryData.parent_id = formData.parent_id;
      } else {
        categoryData.parent_id = null;
      }

      if (isEditMode && category) {
        await updateItemCategory(category.code, categoryData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Category updated successfully',
        });
      } else {
        await createItemCategory(categoryData);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Category created successfully',
        });
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving category:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.code?.[0] ||
        error?.response?.data?.description?.[0] ||
        'Failed to save category';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const parentOptions = getParentOptions();

  // Filter parent options based on search
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
    return selected ? selected.description || selected.code : 'Select parent category';
  };

  const previewTitle = (formData.code || 'Ca').trim();
  const previewMonogram = previewTitle
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || previewTitle.slice(0, 2).toUpperCase() || 'CA';
  const previewLabel = (formData.description || formData.code || 'Category').trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.pageRoot}>
        <View style={styles.page}>
          <View style={styles.pageHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.headerIconButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Image
                source={icons.cross}
                style={styles.headerIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerSaveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.headerSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.pageTitle}>
              {isEditMode ? 'Edit category' : 'Create category'}
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
                style={styles.previewTileButton}
                onPress={() =>
                  Toast.show({
                    type: 'info',
                    text1: 'POS tile preview',
                    text2: 'Tile customization will be added in a later update.',
                  })
                }
                activeOpacity={0.8}>
                <Text style={styles.previewTileButtonText}>Edit POS tile</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>

              <TextInput
                style={[
                  styles.input,
                  errors.code && styles.inputError,
                  isEditMode && styles.inputDisabled,
                ]}
                placeholder="Category name"
                placeholderTextColor={COLORS.gray3}
                value={formData.code}
                onChangeText={text =>
                  setFormData({...formData, code: text.toUpperCase()})
                }
                editable={!isEditMode}
                autoCapitalize="characters"
                maxLength={255}
              />
              {errors.code ? (
                <Text style={styles.errorText}>{errors.code}</Text>
              ) : null}
              {isEditMode ? (
                <Text style={styles.helpText}>
                  Category name cannot be changed after creation.
                </Text>
              ) : null}

              <TextInput
                style={[styles.input, styles.inputSpaced, errors.description && styles.inputError]}
                placeholder="Description (optional)"
                placeholderTextColor={COLORS.gray3}
                value={formData.description}
                onChangeText={text =>
                  setFormData({...formData, description: text})
                }
                autoCapitalize="sentences"
                maxLength={255}
              />
              {errors.description ? (
                <Text style={styles.errorText}>{errors.description}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Add a clearer label for reporting and search.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Parent category</Text>
              <TouchableOpacity
                style={styles.parentRow}
                onPress={() => setParentPickerVisible(true)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.parentRowText,
                    !formData.parent_id && styles.parentRowPlaceholder,
                  ]}>
                  {getSelectedParentLabel()}
                </Text>
                <Text style={styles.parentRowChevron}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Channels</Text>
              <View style={styles.channelsCard}>
                <Text style={styles.channelsTitle}>Available in POS</Text>
                <Text style={styles.channelsText}>
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
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Parent Category</Text>
              <TouchableOpacity
                onPress={() => {
                  setParentPickerVisible(false);
                  setParentSearchQuery('');
                }}
                style={styles.pickerCloseButton}>
                <Image
                  source={icons.cross}
                  style={styles.pickerCloseIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.pickerSearchContainer}>
              <View style={styles.pickerSearchInputContainer}>
                <Image
                  source={icons.search}
                  style={styles.pickerSearchIcon}
                  resizeMode="contain"
                />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search categories..."
                  placeholderTextColor={COLORS.gray3}
                  value={parentSearchQuery}
                  onChangeText={setParentSearchQuery}
                  autoFocus={true}
                />
              </View>
            </View>

            {/* Categories List */}
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
                    formData.parent_id === item.code && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      parent_id: item.code || null,
                    });
                    setParentPickerVisible(false);
                    setParentSearchQuery('');
                  }}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.pickerItemText,
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
                  <Text style={styles.pickerEmptyText}>
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
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
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
  headerSaveButton: {
    minWidth: 108,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  headerSaveText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
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
    marginBottom: 28,
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
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ItemCategoryFormModal;

