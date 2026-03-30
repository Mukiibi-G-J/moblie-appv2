import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import {
  launchImageLibrary,
  launchCamera,
  ImageLibraryOptions,
  CameraOptions,
} from 'react-native-image-picker';
import {
  fetchItems,
  updateItem,
  createItem,
  fetchCategories,
  fetchAllItemLedgerEntries,
  uploadItemImage,
  deleteItemImage,
} from '../../services/app.services';
import { usePermissions } from '../../hooks/usePermissions';
import { PAGE_NAMES } from '../../constants/pageNames';
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import icons from '../../constants/icons';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import { useTheme } from '../../context/ThemeContext';
import { useTabContext } from '../../context/Store';
import Toast from 'react-native-toast-message';
// CameraRoll import removed - using native gallery picker instead

export interface Item {
  id?: number;
  no?: string;
  system_id: string;
  item_name: string;
  unit_price: number;
  item_images: {
    url: string;
    id: number;
  }[];
  inventory: number;
  category_id?: number | string | null;
  item_category?: any;
  description?: string;
  unit_cost?: number;
  unit_of_measure?: string;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Item[];
}

interface Category {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
}

interface InventoryEntry {
  lot_no?: string;
  remaining_quantity?: number;
  quantity?: number;
  document_no?: string;
  entry_type?: string;
  document_type?: string;
  expiry_date?: string;
  posting_date?: string;
  date?: string;
  location_name?: string;
}

const createEmptyItemDraft = (): Item => ({
  system_id: '',
  item_name: '',
  unit_price: 0,
  item_images: [],
  inventory: 0,
  description: '',
});

const EditItemModal = ({
  visible,
  onClose,
  item,
  onSave,
  canEdit,
  canCreate,
  canDelete,
  mode = 'edit',
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (updatedItem: Item) => void;
  canEdit: boolean;
  canCreate?: boolean;
  canDelete: boolean;
  mode?: 'edit' | 'create';
}) => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isCreateMode = mode === 'create';
  const [editedItem, setEditedItem] = useState < Item | null > (null);
  const [categories, setCategories] = useState < Category[] > ([]);
  const [selectedImage, setSelectedImage] = useState < any > (null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageDeleteLoading, setImageDeleteLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState < string | null > (null);
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  const [inventoryEntriesVisible, setInventoryEntriesVisible] = useState(false);
  const [inventoryEntriesLoading, setInventoryEntriesLoading] = useState(false);
  const [inventoryEntriesError, setInventoryEntriesError] = useState<string | null>(null);
  const [inventoryEntries, setInventoryEntries] = useState<InventoryEntry[]>([]);
  // Removed in-app gallery states since we're using native gallery

  const formatAmountWithCommas = (value: number | string | undefined | null) => {
    const numericValue =
      typeof value === 'number' ? value : parseFloat(String(value || 0));
    if (!Number.isFinite(numericValue)) {
      return '0';
    }
    return numericValue.toLocaleString('en-US');
  };

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

  useEffect(() => {
    if (item) {
      setEditedItem(item);
    } else if (visible && isCreateMode) {
      setEditedItem(createEmptyItemDraft());
    }
    setSelectedImage(null);
    setImageUploadError(null);
    setImageUploadSuccess(false);
    loadCategories();
  }, [item, visible, isCreateMode, loadCategories]);

  useEffect(() => {
    if (!visible) {
      setInventoryEntriesVisible(false);
      setInventoryEntries([]);
      setInventoryEntriesError(null);
    }
  }, [visible]);

  const getSelectedCategoryLabel = () => {
    if (!editedItem || !editedItem.category_id) {
      return 'Select category';
    }
    const selected = categories.find(
      cat => (cat.id || cat.code) === editedItem.category_id,
    );
    return selected?.name || selected?.description || selected?.code || 'Select category';
  };

  const getItemInitials = (name?: string) => {
    const words = (name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return 'IT';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  const formatInventoryEntryDate = (value?: string) => {
    if (!value) {
      return 'No date';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenInventoryEntries = async () => {
    if (isCreateMode || !editedItem) {
      return;
    }

    const itemId = editedItem.id || editedItem.no || editedItem.system_id;
    if (!itemId) {
      Alert.alert('Unavailable', 'Inventory details are not available for this item.');
      return;
    }

    setInventoryEntriesVisible(true);
    setInventoryEntriesLoading(true);
    setInventoryEntriesError(null);

    try {
      const entries = await fetchAllItemLedgerEntries(itemId);
      setInventoryEntries(entries || []);
    } catch (error: any) {
      console.error('Error loading inventory ledger entries:', error);
      setInventoryEntries([]);
      setInventoryEntriesError(
        error?.response?.data?.detail ||
          error?.message ||
          'Failed to load ledger entries.',
      );
    } finally {
      setInventoryEntriesLoading(false);
    }
  };

  const openCategoriesPicker = () => {
    if (!editedItem || categoriesLoading) {
      return;
    }

    const initialCodes: string[] = [];
    if (editedItem.category_id != null) {
      const match = categories.find(
        c => String(c.id || c.code) === String(editedItem.category_id),
      );
      if (match?.code) {
        initialCodes.push(String(match.code));
      }
    }

    (navigation as any).navigate('ItemCategories', {
      pickerMode: true,
      returnScreen: 'AllItems',
      returnMode: isCreateMode ? 'create' : 'edit',
      itemDraft: editedItem,
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
    setEditedItem(prev => {
      if (!prev) {
        return prev;
      }
      if (pick.code == null || pick.code === '') {
        return {...prev, category_id: null};
      }
      const cat = categories.find(c => c.code === pick.code);
      return {
        ...prev,
        category_id: (cat?.id ?? cat?.code ?? pick.code) as number | string | null,
      };
    });
  }, [visible, route.params?.categoryPick, navigation, categories]);

  // Map item_category to category_id when categories are loaded
  useEffect(() => {
    if (editedItem && categories.length > 0 && editedItem.item_category) {
      const categoryCode =
        typeof editedItem.item_category === 'string'
          ? editedItem.item_category
          : editedItem.item_category?.code;
      if (categoryCode && !editedItem.category_id) {
        const matchedCategory = categories.find(
          cat => cat.code === categoryCode,
        );
        if (matchedCategory) {
          setEditedItem({
            ...editedItem,
            category_id: (matchedCategory.id || matchedCategory.code) as any,
          });
        }
      }
    }
  }, [categories]);

  // Don't render anything if modal is not visible
  if (!visible) {
    return null;
  }

  const handleImagePick = async () => {
    console.log('handleImagePick called');

    if (isCreateMode) {
      Alert.alert('Save item first', 'Create the item before adding an image.');
      return;
    }

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 1 as const,
      includeBase64: false,
      maxHeight: 1024,
      maxWidth: 1024,
      selectionLimit: 1,
    };

    const cameraOptions: CameraOptions = {
      mediaType: 'photo',
      quality: 0.7, // Reduce quality to reduce file size
      includeBase64: false,
      maxHeight: 1024,
      maxWidth: 1024,
    };

    try {
      // Show action sheet to let user choose between camera and gallery
      Alert.alert(
        'Select Image Source',
        'Choose how you want to add an image (Camera is recommended)',
        [
          {
            text: '📷 Camera (Recommended)',
            onPress: async () => {
              try {
                console.log('User chose camera...');
                // Add a small delay to prevent conflicts
                await new Promise(resolve => setTimeout(resolve, 100));
                const response = await launchCamera(cameraOptions);
                handleImageResponse(response);
              } catch (cameraError) {
                console.error('Camera error:', cameraError);
                Alert.alert(
                  'Error',
                  'Failed to open camera. Please try again.',
                );
              }
            },
          },
          {
            text: '🖼️ Gallery',
            onPress: async () => {
              try {
                console.log('User chose gallery...');
                // Sunmi module disabled, gallery should work now
                await openNativeGallery();
              } catch (libraryError) {
                console.error('Gallery error:', libraryError);
                Alert.alert(
                  'Error',
                  'Gallery is unavailable. Please use camera.',
                );
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      );
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open image picker. Please try again.');
    }
  };

  const requestGalleryPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      // Try READ_MEDIA_IMAGES first (Android 13+)
      let granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      );

      // If that fails, try READ_EXTERNAL_STORAGE (Android 12 and below)
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
      }

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.error('Permission request error:', e);
      return false;
    }
  };

  const openNativeGallery = async () => {
    console.log('openNativeGallery called');

    try {
      const hasPermission = await requestGalleryPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Photo library access is required to select images. Please grant permission in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Settings',
              onPress: () => {
                Alert.alert(
                  'Settings',
                  'Please go to Settings > Apps > Zentroapp > Permissions and enable "Photos and videos"',
                );
              },
            },
          ],
        );
        return;
      }

      // Sunmi module has been disabled to fix gallery conflicts
      console.log('Opening native image library with minimal options...');

      // Use optimized options to reduce file size and conflicts
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7, // Reduce quality to reduce file size
        includeBase64: false,
        selectionLimit: 1,
        includeExtra: false,
        maxWidth: 1024, // Limit width
        maxHeight: 1024, // Limit height
      });

      console.log('Native gallery response:', response);
      await handleImageResponse(response);
    } catch (error) {
      console.error('Error opening native gallery:', error);

      // If native gallery fails, show user-friendly message and suggest camera
      Alert.alert(
        'Gallery Unavailable',
        'Gallery access is currently unavailable due to a system conflict. Please use the camera option instead.',
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Try Camera',
            onPress: async () => {
              try {
                const cameraOptions: CameraOptions = {
                  mediaType: 'photo',
                  quality: 1,
                  includeBase64: false,
                  maxHeight: 1024,
                  maxWidth: 1024,
                };
                const cameraResponse = await launchCamera(cameraOptions);
                await handleImageResponse(cameraResponse);
              } catch (cameraError) {
                console.error('Camera also failed:', cameraError);
                Alert.alert(
                  'Error',
                  'Camera is also unavailable. Please try again later.',
                );
              }
            },
          },
        ],
      );
    }
  };

  const handleImageResponse = async (response: any) => {
    console.log('Image picker response:', response);

    // Check if response is null or undefined (can happen with native module conflicts)
    if (!response) {
      console.error('No response received from image picker');
      Alert.alert('Error', 'Image picker failed to respond. Please try again.');
      return;
    }

    console.log('Checking response properties...');
    console.log('didCancel:', response.didCancel);
    console.log('errorCode:', response.errorCode);
    console.log('assets:', response.assets);
    console.log('assets[0]:', response.assets?.[0]);
    console.log('assets[0].uri:', response.assets?.[0]?.uri);

    if (response.didCancel) {
      console.log('Image picker cancelled');
      return;
    }

    if (response.errorCode) {
      console.error('Image picker error:', response.errorMessage);
      Alert.alert(
        'Error',
        `Image picker error: ${response.errorMessage || 'Unknown error'}`,
      );
      return;
    }

    console.log('Checking if assets exist...');
    console.log('response.assets:', response.assets);
    console.log('response.assets[0]:', response.assets?.[0]);
    console.log('editedItem:', editedItem);

    if (response.assets && response.assets[0] && editedItem) {
      console.log('All conditions met, proceeding with image processing...');

      const imageUri = response.assets[0].uri;
      console.log('Selected image URI:', imageUri);

      if (!imageUri) {
        console.error('No image URI received');
        return;
      }

      // For camera images, we might need to handle the URI differently
      let processedUri = imageUri;
      if (imageUri.startsWith('file://')) {
        console.log('Processing file URI for camera image');
        // Camera images are usually already in the correct format
        processedUri = imageUri;
      } else if (imageUri.startsWith('content://')) {
        console.log('Processing content URI for camera image');
        // Content URIs might need special handling
        processedUri = imageUri;
      }

      console.log('Processed URI:', processedUri);

      // Now let's upload the image to the server
      console.log('About to upload image to server...');
      setImageUploadLoading(true);

      try {
        const itemId = editedItem.id || editedItem.no;
        if (!itemId) {
          console.error('No item ID available for upload');
          return;
        }
        console.log('Uploading image for item ID:', itemId);

        const uploadResponse = await uploadItemImage(itemId, processedUri);
        console.log('Upload response:', uploadResponse);

        if (uploadResponse && uploadResponse.data) {
          const uploadedImage = uploadResponse.data;
          console.log('Uploaded image data:', uploadedImage);

          // Update the state with the server response
          setEditedItem({
            ...editedItem,
            item_images: [
              {
                url: uploadedImage.url,
                id: uploadedImage.id,
              },
            ],
          });

          // Clear any previous error state and show success
          setImageUploadError(null);
          setImageUploadSuccess(true);

          // Clear success message after 3 seconds
          setTimeout(() => {
            setImageUploadSuccess(false);
          }, 3000);

          console.log(
            'setEditedItem called successfully with server URL:',
            uploadedImage.url,
          );
        } else {
          console.error('Invalid upload response:', uploadResponse);
          // Fallback to local URI if upload fails
          setEditedItem({
            ...editedItem,
            item_images: [
              {
                url: processedUri,
                id: 0,
              },
            ],
          });
        }
      } catch (uploadError: any) {
        console.error('Error uploading image:', uploadError);

        // Show user-friendly error message
        let errorMessage = 'Failed to upload image. Please try again.';

        if (
          uploadError?.message?.includes('413') ||
          uploadError?.message?.includes('too large')
        ) {
          errorMessage =
            'Image file is too large. Please select a smaller image (under 5MB).';
        } else if (uploadError?.message?.includes('network')) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        } else if (
          uploadError?.message?.includes('401') ||
          uploadError?.message?.includes('403')
        ) {
          errorMessage = 'Permission denied. Please log in again.';
        }

        Alert.alert('Upload Failed', errorMessage, [
          { text: 'OK', style: 'default' },
          {
            text: 'Try Again',
            onPress: () => {
              // Option to retry with the same image
              handleImageResponse(response);
            },
          },
        ]);

        // Set error state for visual feedback
        setImageUploadError(errorMessage);
        setImageUploadSuccess(false);

        // Don't update the item with local URI if upload failed
        console.log('Upload failed - not updating item with local URI');

        // Clear error after 5 seconds
        setTimeout(() => {
          setImageUploadError(null);
        }, 5000);
      } finally {
        setImageUploadLoading(false);
      }

      // Log success message
      console.log('Image processing completed');
    }
  };

  const handleDeleteImage = async () => {
    if (
      !editedItem ||
      !editedItem.item_images ||
      editedItem.item_images.length === 0
    ) {
      Alert.alert('No Image', 'There is no image to delete.');
      return;
    }

    const imageId = editedItem.item_images[0].id;
    if (!imageId) {
      Alert.alert('Error', 'Cannot delete image: No image ID found.');
      return;
    }

    Alert.alert('Delete Image', 'Are you sure you want to delete this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setImageDeleteLoading(true);
            console.log('Deleting image with ID:', imageId);

            const response = await deleteItemImage(imageId);
            console.log('Delete response:', response);

            // Update the state to remove the image
            setEditedItem({
              ...editedItem,
              item_images: [],
            });

            Alert.alert('Success', 'Image deleted successfully');
          } catch (error) {
            console.error('Error deleting image:', error);
            Alert.alert('Error', 'Failed to delete image. Please try again.');
          } finally {
            setImageDeleteLoading(false);
          }
        },
      },
    ]);
  };

  const handleSave = () => {
    if (editedItem) {
      onSave(editedItem);
      // Don't close immediately - let the parent handle closing after successful save
    }
  };

  const previewUri =
    selectedImage?.uri ||
    (editedItem?.item_images?.[0]?.url
      ? editedItem.item_images[0].url
      : undefined);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}>
        <View style={styles.editItemModalRoot}>
          <KeyboardAvoidingView
            style={styles.editItemModalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            {!editedItem ? (
              <View style={styles.editItemLoadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary2} />
                <Text style={styles.editItemLoadingText}>Loading item…</Text>
                <TouchableOpacity
                  style={styles.editItemLoadingClose}
                  onPress={onClose}
                  activeOpacity={0.7}>
                  <Text style={styles.editItemLoadingCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.editItemHeader,
                    {
                      paddingTop: Math.max(insets.top, 12),
                      borderBottomColor: COLORS.lightGray1,
                    },
                  ]}>
                  <View style={styles.editItemHeaderSide}>
                    <TouchableOpacity
                      onPress={onClose}
                      style={styles.editItemCloseCircle}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Close">
                      <Image
                        source={icons.cross as any}
                        style={styles.editItemCloseIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.editItemHeaderTitle}>
                    {isCreateMode ? 'Create Item' : 'Edit Item'}
                  </Text>
                  <View style={[styles.editItemHeaderSide, styles.editItemHeaderSideEnd]}>
                    {(isCreateMode ? canCreate : canEdit) ? (
                      <TouchableOpacity
                        style={styles.editItemSavePill}
                        onPress={handleSave}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Save item">
                        <Text style={styles.editItemSavePillText}>Save</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.editItemHeaderSpacer} />
                    )}
                  </View>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={[
                    styles.editItemScrollContent,
                    { paddingBottom: Math.max(insets.bottom, 20) + 24 },
                  ]}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}>
                  {imageUploadError ? (
                    <View style={styles.errorContainer}>
                      <View style={styles.errorIconContainer}>
                        <Text style={styles.errorIcon}>⚠</Text>
                      </View>
                      <View style={styles.errorContent}>
                        <Text style={styles.errorTitle}>Upload Failed</Text>
                        <Text style={styles.errorText}>{imageUploadError}</Text>
                      </View>
                    </View>
                  ) : null}
                  {imageUploadSuccess ? (
                    <View style={styles.successContainer}>
                      <View style={styles.successIconContainer}>
                        <Text style={styles.successIcon}>✓</Text>
                      </View>
                      <View style={styles.successContent}>
                        <Text style={styles.successTitle}>Success!</Text>
                        <Text style={styles.successText}>
                          Image uploaded successfully
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.squareTileOuter}>
                    <View style={styles.squareTileInner}>
                      {previewUri ? (
                        <Image
                          source={{ uri: previewUri }}
                          style={styles.squareTileImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <>
                          <Text style={styles.squareTileInitials}>
                            {getItemInitials(
                              editedItem.item_name || (isCreateMode ? 'New Item' : 'Item'),
                            )}
                          </Text>
                          <Text style={styles.squareTileName} numberOfLines={2}>
                            {editedItem.item_name || (isCreateMode ? 'New Item' : 'Item')}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.squareChangeImagePill,
                      imageUploadLoading && { opacity: 0.6 },
                    ]}
                    onPress={handleImagePick}
                    disabled={imageUploadLoading}
                    activeOpacity={0.7}>
                    {imageUploadLoading ? (
                      <ActivityIndicator size="small" color={COLORS.gray2} />
                    ) : (
                      <Text style={styles.squareChangeImagePillText}>
                        {isCreateMode ? 'Add image later' : 'Change image'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {!isCreateMode &&
                    editedItem.item_images &&
                    editedItem.item_images.length > 0 &&
                    canDelete ? (
                    <TouchableOpacity
                      onPress={handleDeleteImage}
                      disabled={imageDeleteLoading}
                      style={styles.squareRemoveImage}>
                      <Text style={styles.squareRemoveImageText}>
                        {imageDeleteLoading ? 'Removing…' : 'Remove image'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.squareOutlineField}>
                    <Text style={styles.squareOutlineLabel}>Name</Text>
                    <TextInput
                      style={styles.squareOutlineInput}
                      value={editedItem.item_name}
                      onChangeText={text =>
                        setEditedItem({ ...editedItem, item_name: text })
                      }
                      placeholder="Item name"
                      placeholderTextColor={COLORS.gray3}
                    />
                  </View>

                  <View style={[styles.squareOutlineField, styles.squareOutlineFieldTall]}>
                    <Text style={styles.squareOutlineLabel}>Description</Text>
                    <TextInput
                      style={[styles.squareOutlineInput, styles.squareOutlineMultiline]}
                      value={editedItem.description ?? ''}
                      onChangeText={text =>
                        setEditedItem({ ...editedItem, description: text })
                      }
                      placeholder="Description"
                      placeholderTextColor={COLORS.gray3}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.editItemThickBar} />

                  <Text style={styles.editItemSectionHeading}>Categorization</Text>
                  <TouchableOpacity
                    style={styles.editItemCategoryRow}
                    onPress={openCategoriesPicker}
                    disabled={categoriesLoading}
                    activeOpacity={0.65}>
                    <View style={styles.editItemFolderIconWrap}>
                      <Image
                        source={icons.product as any}
                        style={styles.editItemFolderIcon}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.editItemCategoryRowText}>
                      <Text style={styles.editItemCategoryRowTitle}>Categories</Text>
                      <Text style={styles.editItemCategoryRowSubtitle}>
                        {categoriesLoading
                          ? 'Loading…'
                          : editedItem.category_id
                            ? getSelectedCategoryLabel()
                            : 'None selected'}
                      </Text>
                    </View>
                    <Image
                      source={icons.down_arrow as any}
                      style={styles.squareSettingsChevron}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>

                  <View style={styles.editItemThickBar} />

                  <Text style={styles.editItemSectionHeading}>Options</Text>
                  <Text style={styles.editItemOptionsCopy}>
                    Add a custom set of options to create variations for an item. For
                    example, add a size option set to create variations for small,
                    medium, and large.
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      Toast.show({
                        type: 'info',
                        text1: 'Learn more',
                        text2: 'Option sets will be available in a future update.',
                      })
                    }
                    activeOpacity={0.7}>
                    <Text style={styles.editItemLearnMore}>Learn more</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editItemAddOptionsPill}
                    onPress={() =>
                      Toast.show({
                        type: 'info',
                        text1: 'Add options',
                        text2: 'This will be available in a future update.',
                      })
                    }
                    activeOpacity={0.7}>
                    <Text style={styles.editItemAddOptionsPillText}>Add options</Text>
                  </TouchableOpacity>

                  <View style={styles.editItemThickBar} />

                  <Text style={styles.editItemSectionHeading}>Price and inventory</Text>
                  <View style={styles.squareOutlineField}>
                    <Text style={styles.squareOutlineLabel}>Price (UGX)</Text>
                    <View style={styles.squarePriceRow}>
                      <Text style={styles.squarePricePrefix}>UGX</Text>
                      <TextInput
                        style={styles.squarePriceInput}
                        value={formatAmountWithCommas(editedItem.unit_price)}
                        onChangeText={text => {
                          const numericValue =
                            parseFloat(text.replace(/,/g, '')) || 0;
                          setEditedItem({
                            ...editedItem,
                            unit_price: numericValue,
                          });
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.gray3}
                      />
                    </View>
                  </View>

                  {!isCreateMode ? (
                    <View style={styles.squareOutlineField}>
                      <Text style={styles.squareOutlineLabel}>Quantity</Text>
                      <TouchableOpacity
                        style={styles.squareOutlineStaticRow}
                        activeOpacity={0.7}
                        onPress={handleOpenInventoryEntries}>
                        <Text
                          style={[
                            styles.squareOutlineStaticValue,
                            styles.squareOutlineLinkValue,
                          ]}>
                          {String(
                            Math.max(0, Math.floor(Number(editedItem.inventory) || 0)),
                          )}
                        </Text>
                        <Text style={styles.squareOutlineStaticChevron}>v</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </ScrollView>
              </>
            )}
          </KeyboardAvoidingView>
        </View>

        {/* Native gallery picker is used instead of in-app modal */}
      </Modal>
      <Modal
        visible={inventoryEntriesVisible && visible}
        transparent
        animationType="slide"
        onRequestClose={() => setInventoryEntriesVisible(false)}>
        <View style={styles.inventoryEntriesOverlay}>
          <View style={styles.inventoryEntriesSheet}>
            <View style={styles.inventoryEntriesHeader}>
              <View style={styles.inventoryEntriesHeaderTextWrap}>
                <Text style={styles.inventoryEntriesTitle}>Inventory Details</Text>
                <Text style={styles.inventoryEntriesSubtitle} numberOfLines={1}>
                  {editedItem?.item_name || 'Item'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInventoryEntriesVisible(false)}
                activeOpacity={0.7}
                style={styles.inventoryEntriesCloseButton}>
                <Text style={styles.inventoryEntriesCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inventoryEntriesSummaryCard}>
              <Text style={styles.inventoryEntriesSummaryLabel}>Current Quantity</Text>
              <Text style={styles.inventoryEntriesSummaryValue}>
                {String(Math.max(0, Math.floor(Number(editedItem?.inventory) || 0)))}
              </Text>
            </View>

            {inventoryEntriesLoading ? (
              <View style={styles.inventoryEntriesStateWrap}>
                <ActivityIndicator size="small" color={COLORS.primary2} />
                <Text style={styles.inventoryEntriesStateText}>
                  Loading ledger entries...
                </Text>
              </View>
            ) : inventoryEntriesError ? (
              <View style={styles.inventoryEntriesStateWrap}>
                <Text style={styles.inventoryEntriesErrorText}>
                  {inventoryEntriesError}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.inventoryEntriesList}
                showsVerticalScrollIndicator={false}>
                {inventoryEntries.length > 0 ? (
                  inventoryEntries.map((entry, index) => (
                    <View
                      key={`${entry.document_no || 'entry'}-${entry.lot_no || index}-${index}`}
                      style={styles.inventoryEntryCard}>
                      <View style={styles.inventoryEntryTopRow}>
                        <Text style={styles.inventoryEntryType}>
                          {entry.entry_type || entry.document_type || 'Entry'}
                        </Text>
                        <Text style={styles.inventoryEntryDate}>
                          {formatInventoryEntryDate(
                            entry.posting_date || entry.date || entry.expiry_date,
                          )}
                        </Text>
                      </View>

                      <Text style={styles.inventoryEntryDocument}>
                        {entry.document_no || 'No document number'}
                      </Text>

                      <View style={styles.inventoryEntryMetaRow}>
                        <Text style={styles.inventoryEntryMetaText}>
                          Qty: {Number(entry.quantity ?? entry.remaining_quantity ?? 0)}
                        </Text>
                        <Text style={styles.inventoryEntryMetaText}>
                          Remaining: {Number(entry.remaining_quantity ?? 0)}
                        </Text>
                      </View>

                      <View style={styles.inventoryEntryMetaRow}>
                        <Text style={styles.inventoryEntryMetaText}>
                          Lot: {entry.lot_no || '-'}
                        </Text>
                        <Text style={styles.inventoryEntryMetaText}>
                          Location: {entry.location_name || '-'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.inventoryEntriesStateWrap}>
                    <Text style={styles.inventoryEntriesStateText}>
                      No ledger entries found.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const Items = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { selectedTab, setSelectedTab } = useTabContext();
  const { canRead, canCreate, canEdit, canDelete } = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEMS;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view items.
          </Text>
        </View>
      </View>
    );
  }

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createDraftItem, setCreateDraftItem] = useState<Item | null>(null);
  const [selectedItem, setSelectedItem] = useState < Item | null > (null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [items, setItems] = useState < Item[] > ([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filterModal, setFilterModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState < number | null > (null);
  const [stockFilter, setStockFilter] = useState <
    'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
    > ('all');
  const [categories, setCategories] = useState < Category[] > ([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const formatAmountWithCommas = (value: number | string | undefined | null) => {
    const numericValue =
      typeof value === 'number' ? value : parseFloat(String(value || 0));
    if (!Number.isFinite(numericValue)) {
      return '0';
    }
    return numericValue.toLocaleString('en-US');
  };

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

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const reopenMode = route.params?.reopenItemModal as 'create' | 'edit' | undefined;
    if (!reopenMode) {
      return;
    }

    const incomingDraft = (route.params?.itemDraft as Item | null | undefined) ?? null;
    const categoryCode = route.params?.categoryPick?.code as string | null | undefined;

    const resolvedCategoryValue =
      categoryCode === undefined
        ? incomingDraft?.category_id
        : categoryCode === null || categoryCode === ''
          ? null
          : (categories.find(cat => cat.code === categoryCode)?.id ??
              categories.find(cat => cat.code === categoryCode)?.code ??
              categoryCode);

    const nextDraft =
      incomingDraft != null
        ? {
            ...incomingDraft,
            category_id: resolvedCategoryValue,
          }
        : createEmptyItemDraft();

    if (reopenMode === 'create') {
      setEditModal(false);
      setSelectedItem(null);
      setCreateDraftItem(nextDraft);
      setCreateModal(true);
    } else {
      setCreateModal(false);
      setCreateDraftItem(null);
      setSelectedItem(nextDraft);
      setEditModal(true);
    }

    navigation.setParams({
      reopenItemModal: undefined,
      itemDraft: undefined,
      categoryPick: undefined,
    } as never);
  }, [
    route.params?.reopenItemModal,
    route.params?.itemDraft,
    route.params?.categoryPick,
    categories,
    navigation,
  ]);

  const applyStockFilter = useCallback(
    (results: Item[]) => {
      if (stockFilter === 'all') {
        return results;
      }

      return results.filter(item => {
        const inventory = item?.inventory || 0;
        if (stockFilter === 'out_of_stock') return inventory === 0;
        if (stockFilter === 'low_stock') return inventory > 0 && inventory < 10;
        if (stockFilter === 'in_stock') return inventory >= 10;
        return true;
      });
    },
    [stockFilter],
  );

  const mergeUniqueItems = useCallback((existing: Item[], incoming: Item[]) => {
    const seen = new Set<string>();
    return [...existing, ...incoming].filter(item => {
      const key = String(item?.id || item?.no || item?.system_id || '');
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, []);

  const loadItems = useCallback(
    async (pageToLoad: number = 1, replace: boolean = true) => {
      try {
        if (replace) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const response: PaginatedResponse = await fetchItems(
          pageToLoad,
          searchQuery,
          selectedCategory || undefined,
        );

        const pageResults = Array.isArray(response?.results) ? response.results : [];
        const filteredResults = applyStockFilter(pageResults);

        setItems(prev =>
          replace ? filteredResults : mergeUniqueItems(prev, filteredResults),
        );
        setCurrentPage(pageToLoad);
        setHasNextPage(Boolean(response?.next));
      } catch (error) {
        console.error('Error fetching items:', error);
        if (replace) {
          setItems([]);
        }
        setHasNextPage(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        setSearchLoading(false);
      }
    },
    [applyStockFilter, mergeUniqueItems, searchQuery, selectedCategory],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setHasNextPage(true);
    await loadItems(1, true);
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setHasNextPage(true);
      loadItems(1, true);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedCategory, stockFilter, loadItems]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setSearchLoading(true);
  };

  const handleApplyFilter = () => {
    setFilterModal(false);
    setHasNextPage(true);
    setSearchLoading(true);
    loadItems(1, true);
  };

  const handleClearFilter = () => {
    setSelectedCategory(null);
    setStockFilter('all');
    setFilterModal(false);
    setHasNextPage(true);
  };

  const hasActiveFilters = selectedCategory !== null || stockFilter !== 'all';

  const handleLoadMore = () => {
    if (loading || loadingMore || refreshing || !hasNextPage) {
      return;
    }

    loadItems(currentPage + 1, false);
  };

  const handleCreateItem = () => {
    if (!canCreate(PAGE_NAME)) {
      Alert.alert(
        'Access Denied',
        'You do not have permission to create items.',
      );
      return;
    }
    // Ensure only one form modal is open at a time.
    setEditModal(false);
    setSelectedItem(null);
    setCreateDraftItem(null);
    setCreateModal(true);
  };

  const handleEditItem = (item: Item) => {
    console.log('handleEditItem called with:', item);
    if (!item || (!item.id && !item.no)) {
      console.warn('Invalid item data for editing - missing id or no field');
      return;
    }
    console.log('Setting selectedItem and opening modal');
    // Ensure only one form modal is open at a time.
    setCreateModal(false);
    setSelectedItem(item);
    setEditModal(true);
  };

  const formatCurrencyLabel = (value: number | string | undefined | null) => {
    const numericValue =
      typeof value === 'number' ? value : parseFloat(String(value || 0));
    if (!Number.isFinite(numericValue)) {
      return 'USh0.00';
    }
    return `USh${numericValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getItemInitials = (name?: string) => {
    const words = (name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return 'IT';
    }

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  const renderItemCard = ({ item }: { item: Item }) => {
    const initials = getItemInitials(item?.item_name);
    return (
      <TouchableOpacity
        style={[styles.itemCard, { borderBottomColor: colors.border }]}
        activeOpacity={0.7}
        disabled={!canEdit(PAGE_NAME)}
        onPress={() => canEdit(PAGE_NAME) && handleEditItem(item)}>
        <View
          style={[
            styles.itemImageContainer,
            { backgroundColor: colors.screenMuted },
          ]}>
          {item?.item_images &&
            item.item_images.length > 0 &&
            item.item_images[0]?.url ? (
            <Image
              source={{ uri: item.item_images[0].url }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: colors.screenMuted },
              ]}>
              <Text style={[styles.itemInitials, { color: colors.textSecondary }]}>
                {initials}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemInfo}>
          <View style={styles.itemTopRow}>
            <Text
              style={[styles.itemName, { color: colors.textPrimary }]}
              numberOfLines={1}>
              {item?.item_name || 'Unnamed Item'}
            </Text>
            <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>
              {formatCurrencyLabel(item?.unit_price)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleItemSave = async (selectedItem: Item) => {
    // Check permission before saving
    if (!canEdit(PAGE_NAME)) {
      Alert.alert('Access Denied', 'You do not have permission to edit items.');
      return;
    }

    const itemId = selectedItem.id || selectedItem.no;
    if (!selectedItem || !itemId) {
      console.warn('Invalid item data for saving');
      return;
    }

    try {
      // Map category_id to item_category code for backend
      const itemToSave: any = {
        ...selectedItem,
        system_id:
          selectedItem.system_id || selectedItem.no || itemId.toString(),
      };

      // Convert category_id to item_category code if needed
      if (selectedItem.category_id) {
        const selectedCategory = categories.find(
          cat => (cat.id || cat.code) === selectedItem.category_id,
        );
        if (selectedCategory && selectedCategory.code) {
          itemToSave.item_category = selectedCategory.code;
          // Remove category_id as backend expects item_category
          delete itemToSave.category_id;
        }
      }

      const response = await updateItem(itemId, itemToSave);
      if (response.status === 200 || response.status === 201) {
        setSuccessMessage('Item updated successfully');
        setShowSuccessModal(true);
        setEditModal(false);
        setSelectedItem(null);
        loadItems();
      } else {
        Alert.alert('Error', 'Failed to update item');
      }
    } catch (error: any) {
      console.error('Error saving item:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save item';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleCreateSave = async (draftItem: Item) => {
    if (!canCreate(PAGE_NAME)) {
      Alert.alert('Access Denied', 'You do not have permission to create items.');
      return;
    }

    if (!draftItem.item_name || !draftItem.item_name.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }

    try {
      const itemToCreate: any = {
        item_name: draftItem.item_name.trim(),
      };

      if (draftItem.description && draftItem.description.trim()) {
        itemToCreate.description = draftItem.description.trim();
      }

      if ((Number(draftItem.unit_price) || 0) > 0) {
        itemToCreate.unit_price = Number(draftItem.unit_price) || 0;
      }

      if (draftItem.category_id) {
        const selectedCategory = categories.find(
          cat => (cat.id || cat.code) === draftItem.category_id,
        );
        if (selectedCategory?.code) {
          itemToCreate.item_category = selectedCategory.code;
        }
      }

      const response = await createItem(itemToCreate);
      if (response.status === 200 || response.status === 201) {
        setSuccessMessage('Item created successfully');
        setShowSuccessModal(true);
        setCreateModal(false);
        setCreateDraftItem(null);
        setSelectedItem(null);
        loadItems();
      } else {
        Alert.alert('Error', 'Failed to create item');
      }
    } catch (error: any) {
      console.error('Error creating item:', error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error?.response?.data?.item_name?.[0] ||
        error?.message ||
        'Failed to create item';
      Alert.alert('Error', errorMessage);
    }
  };

  const onSelectMainTab = (tab: string) => {
    setSelectedTab(tab);
    navigation.navigate('Home' as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.allItemsHeader,
          {
            paddingTop: Math.max(insets.top, 10),
            backgroundColor: colors.background,
          },
        ]}>
        <TouchableOpacity
          style={[
            styles.headerRoundButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Image
            source={icons.back as any}
            style={[styles.headerRoundIcon, { tintColor: colors.textPrimary }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={[styles.allItemsTitle, { color: colors.textPrimary }]}>
          All items
        </Text>
        <View style={styles.headerTrailing}>
          {canCreate(PAGE_NAME) ? (
            <TouchableOpacity
              onPress={handleCreateItem}
              style={styles.headerActionButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add item">
              <Image
                source={icons.plus as any}
                style={styles.headerActionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerTrailingSpacer} />
          )}
        </View>
      </View>

      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.background },
        ]}>
        <View
          style={[
            styles.searchPill,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.border,
            },
          ]}>
          <Image
            source={icons.search as any}
            style={[styles.searchIcon, { tintColor: colors.iconMuted }]}
            resizeMode="contain"
          />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search"
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading ? (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.filterInlineHit}
            onPress={() => setFilterModal(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Filter items">
            <Image
              source={icons.filter as any}
              style={[
                styles.filterIconInline,
                { tintColor: hasActiveFilters ? COLORS.primary2 : colors.iconMuted },
              ]}
              resizeMode="contain"
            />
            {hasActiveFilters ? <View style={styles.filterBadge} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading items...
          </Text>
        </View>
      ) : (
        <View style={styles.listFlex}>
          <FlatList
            style={styles.listFlex}
            data={items || []}
            renderItem={renderItemCard}
            keyExtractor={item =>
              item?.id?.toString() ||
              item?.no ||
              item?.system_id ||
              Math.random().toString()
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={
              (items?.length || 0) === 0 ? styles.listEmptyGrow : undefined
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.listFooterLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconContainer,
                    { backgroundColor: colors.screenMuted },
                  ]}>
                  <Text style={styles.emptyIcon}>📦</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  No items found
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : canCreate(PAGE_NAME)
                      ? 'Create your first item to get started.'
                      : 'No items available at the moment'}
                </Text>
                {canCreate(PAGE_NAME) && !searchQuery ? (
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={handleCreateItem}>
                    <Text style={styles.emptyButtonText}>Create Item</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
          />
        </View>
      )}

      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectMainTab}
      />

      {/* Create Item Modal */}
      <EditItemModal
        visible={createModal}
        onClose={() => {
          setCreateModal(false);
          setCreateDraftItem(null);
          setSelectedItem(null);
        }}
        item={createDraftItem}
        onSave={handleCreateSave}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
        mode="create"
      />

      {/* Edit Item Modal */}
      <EditItemModal
        visible={editModal}
        onClose={() => {
          console.log('Closing edit modal');
          setEditModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onSave={handleItemSave}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
      />

      {/* Custom Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successModalIconContainer}>
              <Text style={styles.successModalIcon}>✓</Text>
            </View>
            <Text style={styles.successModalTitle}>Success!</Text>
            <Text style={styles.successModalMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => setShowSuccessModal(false)}>
              <Text style={styles.successModalButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModal(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Items</Text>
              <TouchableOpacity
                onPress={() => setFilterModal(false)}
                style={styles.filterCloseButton}>
                <Text style={styles.filterCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScrollView}>
              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Category</Text>
                <View style={styles.pickerContainer}>
                  {categoriesLoading ? (
                    <View style={styles.categoryLoadingContainer}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.categoryLoadingText}>
                        Loading categories...
                      </Text>
                    </View>
                  ) : (
                    <Picker
                      selectedValue={selectedCategory || 0}
                      onValueChange={value =>
                        setSelectedCategory(value === 0 ? null : value)
                      }
                      style={styles.picker}>
                      <Picker.Item label="All Categories" value={0} />
                      {categories?.map(category => (
                        <Picker.Item
                          key={category.id}
                          label={category.name}
                          value={category.id}
                        />
                      ))}
                    </Picker>
                  )}
                </View>
              </View>

              {/* Stock Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Stock Status</Text>
                <View style={styles.stockFilterContainer}>
                  {[
                    { value: 'all', label: 'All Items' },
                    { value: 'in_stock', label: 'In Stock' },
                    { value: 'low_stock', label: 'Low Stock' },
                    { value: 'out_of_stock', label: 'Out of Stock' },
                  ].map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.stockFilterButton,
                        stockFilter === option.value &&
                        styles.stockFilterButtonActive,
                      ]}
                      onPress={() => setStockFilter(option.value as any)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.stockFilterText,
                          stockFilter === option.value &&
                          styles.stockFilterTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Filter Actions */}
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.filterActionButton, styles.clearFilterButton]}
                onPress={handleClearFilter}
                activeOpacity={0.7}>
                <Text style={styles.clearFilterText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterActionButton, styles.applyFilterButton]}
                onPress={handleApplyFilter}
                activeOpacity={0.7}>
                <Text style={styles.applyFilterText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debug info */}
      {/* {__DEV__ && (
        <View
          style={{
            position: 'absolute',
            top: 100,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 10,
            borderRadius: 5,
          }}>
          <Text style={{color: 'white', fontSize: 10}}>
            editModal: {editModal.toString()}
          </Text>
          <Text style={{color: 'white', fontSize: 10}}>
            selectedItem: {selectedItem ? 'yes' : 'no'}
          </Text>
        </View>
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  allItemsHeader: {
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
  allItemsTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailing: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    margin: SIZES.base * 2,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base * 1.5,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 12,
    minHeight: 48,
  },
  filterInlineHit: {
    position: 'relative',
    padding: 8,
    marginRight: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIconInline: {
    width: 20,
    height: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  listFlex: {
    flex: 1,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  listFooterLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
    marginHorizontal: SIZES.padding,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemImageContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: COLORS.lightGray2,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInitials: {
    ...FONTS.body3,
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemName: {
    ...FONTS.h3,
    flex: 1,
    marginRight: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  itemPrice: {
    ...FONTS.body3,
    fontWeight: '600',
    flexShrink: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
    paddingHorizontal: SIZES.padding,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 250,
  },
  emptyButton: {
    marginTop: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SIZES.padding,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.white,
  },
  pageButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray1,
  },
  pageButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 13,
  },
  disabledButtonText: {
    ...FONTS.button,
    color: COLORS.gray3,
    fontSize: 13,
  },
  pageInfoContainer: {
    paddingHorizontal: SIZES.base * 2,
  },
  pageInfo: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  editItemModalRoot: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  editItemModalFlex: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  editItemLoadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  editItemLoadingText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    marginTop: SIZES.base * 1.5,
  },
  editItemLoadingClose: {
    marginTop: SIZES.padding * 2,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  editItemLoadingCloseText: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  editItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.white,
  },
  editItemHeaderSide: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editItemHeaderSideEnd: {
    justifyContent: 'flex-end',
  },
  editItemHeaderSpacer: {
    width: 72,
    height: 36,
  },
  editItemCloseCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editItemCloseIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.black,
  },
  editItemHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
  editItemSavePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editItemSavePillText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  modalScrollView: {
    flex: 1,
    flexGrow: 1,
  },
  editItemScrollContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 1.25,
  },
  squareTileOuter: {
    alignSelf: 'center',
    width: '60%',
    maxWidth: 180,
    aspectRatio: 1,
    backgroundColor: '#ECECEC',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginBottom: 10,
  },
  squareTileInner: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: '66%',
    minHeight: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  squareTileImage: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: COLORS.lightGray2,
  },
  squareTileInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  squareTileName: {
    ...FONTS.body4,
    fontSize: 11,
    color: COLORS.gray2,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  squareChangeImagePill: {
    alignSelf: 'center',
    backgroundColor: '#E8EAED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginBottom: 6,
    minWidth: 124,
    alignItems: 'center',
  },
  squareChangeImagePillText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '600',
    fontSize: 13,
  },
  squareRemoveImage: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  squareRemoveImageText: {
    ...FONTS.body5,
    color: COLORS.error,
    fontWeight: '600',
  },
  squareOutlineField: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 18,
    backgroundColor: COLORS.white,
  },
  squareOutlineFieldTall: {
    minHeight: 120,
    paddingBottom: 14,
  },
  squareOutlineLabel: {
    ...FONTS.body5,
    fontSize: 12,
    color: COLORS.gray2,
    fontWeight: '600',
    marginBottom: 6,
  },
  squareOutlineInput: {
    ...FONTS.body3,
    fontSize: 16,
    color: COLORS.black,
    padding: 0,
    margin: 0,
  },
  squareOutlineStaticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  squareOutlineStaticValue: {
    ...FONTS.body3,
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
    marginRight: SIZES.base,
  },
  squareOutlineLinkValue: {
    textDecorationLine: 'underline',
  },
  squareOutlineStaticChevron: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '700',
  },
  inventoryEntriesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.32)',
    justifyContent: 'flex-end',
  },
  inventoryEntriesSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  inventoryEntriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inventoryEntriesHeaderTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  inventoryEntriesTitle: {
    ...FONTS.h2,
    color: COLORS.black,
    fontWeight: '700',
  },
  inventoryEntriesSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: 4,
  },
  inventoryEntriesCloseButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.lightGray2,
  },
  inventoryEntriesCloseText: {
    ...FONTS.body4,
    color: COLORS.black,
    fontWeight: '600',
  },
  inventoryEntriesSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inventoryEntriesSummaryLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginBottom: 6,
  },
  inventoryEntriesSummaryValue: {
    ...FONTS.h1,
    color: COLORS.black,
    fontWeight: '700',
  },
  inventoryEntriesList: {
    flexGrow: 0,
  },
  inventoryEntriesStateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inventoryEntriesStateText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: 10,
    textAlign: 'center',
  },
  inventoryEntriesErrorText: {
    ...FONTS.body4,
    color: COLORS.error,
    textAlign: 'center',
  },
  inventoryEntryCard: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  inventoryEntryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inventoryEntryType: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '700',
  },
  inventoryEntryDate: {
    ...FONTS.body5,
    color: COLORS.gray2,
  },
  inventoryEntryDocument: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
    marginBottom: 10,
  },
  inventoryEntryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  inventoryEntryMetaText: {
    ...FONTS.body5,
    color: COLORS.gray2,
    flex: 1,
  },
  squareOutlineMultiline: {
    minHeight: 72,
    paddingTop: 4,
  },
  squareSettingsChevron: {
    width: 14,
    height: 14,
    tintColor: COLORS.gray3,
    transform: [{ rotate: '-90deg' }],
  },
  editItemThickBar: {
    height: 8,
    backgroundColor: '#EBEBEB',
    borderRadius: 2,
    marginVertical: 22,
    marginHorizontal: -SIZES.padding,
  },
  editItemSectionHeading: {
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  editItemCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  editItemFolderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  editItemFolderIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.gray2,
  },
  editItemCategoryRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  editItemCategoryRowTitle: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  editItemCategoryRowSubtitle: {
    ...FONTS.body4,
    fontSize: 14,
    color: COLORS.gray2,
    marginTop: 4,
  },
  editItemOptionsCopy: {
    ...FONTS.body4,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.gray2,
    marginBottom: 10,
  },
  editItemLearnMore: {
    ...FONTS.body4,
    fontSize: 15,
    color: COLORS.black,
    textDecorationLine: 'underline',
    fontWeight: '500',
    marginBottom: 18,
  },
  editItemAddOptionsPill: {
    alignSelf: 'stretch',
    backgroundColor: '#E8EAED',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 4,
  },
  editItemAddOptionsPillText: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  squarePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  squarePricePrefix: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary2,
    marginRight: 8,
  },
  squarePriceInput: {
    flex: 1,
    ...FONTS.body3,
    fontSize: 16,
    color: COLORS.black,
    padding: 0,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: SIZES.padding,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  productImageLarge: {
    width: 130,
    height: 130,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 1.5,
    borderWidth: 2,
    borderColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
  },
  imagePickerButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 1.5,
    minHeight: 48,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: SIZES.base * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  imageButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  deleteImageButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SIZES.base * 1.5,
    minHeight: 48,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: SIZES.base * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  // Gallery styles
  galleryContainer: {
    flex: 1,
    padding: 10,
  },
  galleryInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  galleryItem: {
    width: '32%',
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedGalleryItem: {
    borderColor: '#007AFF',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyGallery: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyGalleryText: {
    fontSize: 16,
    color: '#666',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadMoreText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  label: {
    ...FONTS.h4,
    color: COLORS.black,
    marginBottom: SIZES.base,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 1.5,
    ...FONTS.body3,
    color: COLORS.black,
    marginBottom: SIZES.base * 2,
    backgroundColor: '#F8FAFC',
    minHeight: 48,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 1.5,
    minHeight: 48,
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
    paddingVertical: SIZES.base * 1.5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 10,
    marginBottom: SIZES.base * 2,
    backgroundColor: '#F8FAFC',
    // Picker dropdown can extend beyond the container bounds on Android.
    // If we clip it, the dropdown can appear as a black block.
    overflow: 'visible',
  },
  picker: {
    height: 50,
    color: COLORS.black,
  },
  pickerItem: {
    color: COLORS.black,
  },
  categoryPickerButton: {
    height: 50,
    paddingHorizontal: SIZES.base * 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPickerButtonText: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
    marginRight: SIZES.base,
  },
  categoryPickerButtonPlaceholder: {
    color: COLORS.gray3,
  },
  categoryPickerArrow: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  categoryPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.base * 2,
  },
  categoryPickerModalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    maxHeight: 320,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  categoryPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  categoryPickerModalTitle: {
    ...FONTS.h3,
    color: COLORS.black,
  },
  categoryPickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPickerCloseIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  categoryPickerModalList: {
    maxHeight: 240,
  },
  categoryPickerModalItem: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryPickerModalItemText: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
    marginRight: SIZES.base,
  },
  categoryPickerModalItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoryPickerCheckIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base * 1.5,
    paddingBottom: SIZES.base * 2,
    gap: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
    flexShrink: 0,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  imageActionButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '700',
  },
  cancelButtonText: {
    ...FONTS.button,
    color: COLORS.gray2,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
    minHeight: 200,
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    marginTop: SIZES.base * 1.5,
  },
  categoryLoadingContainer: {
    paddingVertical: SIZES.base * 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLoadingText: {
    ...FONTS.body4,
    color: COLORS.gray2,
    marginTop: SIZES.base,
  },
  searchLoadingContainer: {
    marginLeft: SIZES.base,
  },
  uploadLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorContainer: {
    backgroundColor: COLORS.error + '15',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
    marginBottom: SIZES.base * 2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base * 1.5,
  },
  errorIcon: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    ...FONTS.h4,
    color: COLORS.error,
    marginBottom: SIZES.base * 0.25,
  },
  errorText: {
    ...FONTS.body4,
    color: COLORS.error,
  },
  successContainer: {
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
    marginBottom: SIZES.base * 2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.base * 1.5,
  },
  successIcon: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    ...FONTS.h4,
    color: COLORS.success,
    marginBottom: SIZES.base * 0.25,
  },
  successText: {
    ...FONTS.body4,
    color: COLORS.success,
  },
  // Custom Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.base * 2.5,
  },
  successModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 1.5,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  successModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2.5,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successModalIcon: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: 'bold',
  },
  successModalTitle: {
    ...FONTS.h1,
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  successModalMessage: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    marginBottom: SIZES.base * 3,
    lineHeight: 22,
  },
  successModalButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SIZES.base * 4,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successModalButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay2,
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '80%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  filterModalTitle: {
    ...FONTS.h2,
    color: COLORS.black,
  },
  filterCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCloseIcon: {
    fontSize: 18,
    color: COLORS.gray2,
    fontWeight: 'bold',
  },
  filterScrollView: {
    maxHeight: 400,
  },
  filterSection: {
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  filterLabel: {
    ...FONTS.h4,
    color: COLORS.black,
    marginBottom: SIZES.base * 1.5,
  },
  stockFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.base,
  },
  stockFilterButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  stockFilterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stockFilterText: {
    ...FONTS.body4,
    color: COLORS.gray2,
  },
  stockFilterTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    padding: SIZES.base * 2,
    gap: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  filterActionButton: {
    flex: 1,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFilterButton: {
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  applyFilterButton: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearFilterText: {
    ...FONTS.button,
    color: COLORS.gray2,
    fontSize: 15,
  },
  applyFilterText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
  },
});

export default Items;
