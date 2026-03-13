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
import {COLORS, FONTS, SIZES} from '../../constants/theme';
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
      newErrors.code = 'Category code is required';
    } else if (formData.code.trim().length > 255) {
      newErrors.code = 'Category code must be 255 characters or less';
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
    if (!formData.parent_id) return 'No Parent (Root Category)';
    const selected = parentOptions.find(cat => cat.code === formData.parent_id);
    return selected ? selected.description || selected.code : 'Select Parent';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditMode ? 'Edit Category' : 'Create Category'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.formContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Code Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Category Code <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  errors.code && styles.inputError,
                  isEditMode && styles.inputDisabled,
                ]}
                placeholder="Enter category code (e.g., CAT001)"
                placeholderTextColor={COLORS.gray3}
                value={formData.code}
                onChangeText={text =>
                  setFormData({...formData, code: text.toUpperCase()})
                }
                editable={!isEditMode}
                autoCapitalize="characters"
                maxLength={255}
              />
              {errors.code && (
                <Text style={styles.errorText}>{errors.code}</Text>
              )}
              {isEditMode && (
                <Text style={styles.helpText}>
                  Code cannot be changed after creation
                </Text>
              )}
            </View>

            {/* Description Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, errors.description && styles.inputError]}
                placeholder="Enter category description (optional)"
                placeholderTextColor={COLORS.gray3}
                value={formData.description}
                onChangeText={text =>
                  setFormData({...formData, description: text})
                }
                autoCapitalize="characters"
                maxLength={255}
                multiline={false}
              />
              {errors.description && (
                <Text style={styles.errorText}>{errors.description}</Text>
              )}
              <Text style={styles.helpText}>
                Description will be auto-uppercased by the system
              </Text>
            </View>

            {/* Parent Category Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Parent Category</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setParentPickerVisible(true)}
                activeOpacity={0.7}>
                <Text style={styles.pickerButtonText}>
                  {getSelectedParentLabel()}
                </Text>
                <Image
                  source={icons.down_arrow}
                  style={styles.pickerArrow}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <Text style={styles.helpText}>
                Select a parent category to create a subcategory (optional)
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditMode ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
                {code: '', description: 'No Parent (Root Category)', isRoot: true},
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
                    {item.description || item.code || 'No Parent (Root Category)'}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : SIZES.padding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: SIZES.h2,
    fontFamily: FONTS.bold,
    color: COLORS.black,
  },
  closeButton: {
    padding: SIZES.base,
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.gray,
  },
  formContainer: {
    padding: SIZES.padding,
  },
  formGroup: {
    marginBottom: SIZES.padding,
  },
  label: {
    fontSize: SIZES.body3,
    fontFamily: FONTS.medium,
    color: COLORS.black,
    marginBottom: SIZES.base,
  },
  required: {
    color: COLORS.error,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    fontSize: SIZES.body3,
    fontFamily: FONTS.regular,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.lightGray2,
    color: COLORS.gray,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  pickerButtonText: {
    fontSize: SIZES.body3,
    fontFamily: FONTS.regular,
    color: COLORS.black,
    flex: 1,
  },
  pickerArrow: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : SIZES.padding,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  pickerModalTitle: {
    fontSize: SIZES.h3,
    fontFamily: FONTS.bold,
    color: COLORS.black,
  },
  pickerCloseButton: {
    padding: SIZES.base * 0.5,
  },
  pickerCloseIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray,
  },
  pickerSearchContainer: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  pickerSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    height: 44,
  },
  pickerSearchIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.gray2,
    marginRight: SIZES.base * 0.75,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.black,
    paddingVertical: 0,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    padding: SIZES.base * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  pickerItemText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.black,
    flex: 1,
  },
  pickerItemTextSelected: {
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  pickerCheckIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary,
  },
  pickerEmptyContainer: {
    padding: SIZES.padding * 2,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.gray2,
  },
  errorText: {
    fontSize: SIZES.body4,
    fontFamily: FONTS.regular,
    color: COLORS.error,
    marginTop: 4,
  },
  helpText: {
    fontSize: SIZES.body4,
    fontFamily: FONTS.regular,
    color: COLORS.gray3,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: SIZES.base,
  },
  button: {
    flex: 1,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray2,
  },
  cancelButtonText: {
    fontSize: SIZES.body2,
    fontFamily: FONTS.medium,
    color: COLORS.black,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: SIZES.body2,
    fontFamily: FONTS.medium,
    color: COLORS.white,
  },
});

export default ItemCategoryFormModal;

