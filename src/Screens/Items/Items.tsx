import React, {useState, useEffect, useCallback} from 'react';
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
import {useNavigation} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import {
  launchImageLibrary,
  launchCamera,
  ImageLibraryOptions,
  CameraOptions,
} from 'react-native-image-picker';
import Svg, {Rect, Path} from 'react-native-svg';
import {
  fetchItems,
  updateItem,
  fetchCategories,
  uploadItemImage,
  deleteItemImage,
  createItem,
} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {COLORS, SIZES, FONTS} from '../../constants/theme';
import icons from '../../constants/icons';
import ItemFormModal from './ItemFormModal';
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
  category_id?: number;
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

const EditItemModal = ({
  visible,
  onClose,
  item,
  onSave,
  canEdit,
  canDelete,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (updatedItem: Item) => void;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const [editedItem, setEditedItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageDeleteLoading, setImageDeleteLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  // Removed in-app gallery states since we're using native gallery

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
    }
    loadCategories();
  }, [item, loadCategories]);
  
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
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Settings',
              onPress: () => {
                Alert.alert(
                  'Settings',
                  'Please go to Settings > Apps > Zentro App > Permissions and enable "Photos and videos"',
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
          {text: 'OK', style: 'default'},
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
          {text: 'OK', style: 'default'},
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
      {text: 'Cancel', style: 'cancel'},
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

  console.log(
    'EditItemModal render - visible:',
    visible,
    'editedItem:',
    !!editedItem,
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalContent}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          {!editedItem ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading item data...</Text>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Item</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}>
                  <Image
                    source={icons.cross}
                    style={styles.modalCloseIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}>
                {/* Image Section */}
                <View style={styles.imageSection}>
                  {/* Error Message */}
                  {imageUploadError && (
                    <View style={styles.errorContainer}>
                      <View style={styles.errorIconContainer}>
                        <Text style={styles.errorIcon}>⚠</Text>
                      </View>
                      <View style={styles.errorContent}>
                        <Text style={styles.errorTitle}>Upload Failed</Text>
                        <Text style={styles.errorText}>{imageUploadError}</Text>
                      </View>
                    </View>
                  )}

                  {/* Success Message */}
                  {imageUploadSuccess && (
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
                  )}
                  <Image
                    source={{
                      uri:
                        selectedImage?.uri ||
                        (editedItem.item_images &&
                        editedItem.item_images.length > 0
                          ? editedItem.item_images[0].url
                          : undefined),
                    }}
                    style={styles.productImageLarge}
                    defaultSource={require('../../assets/icons/product.png')}
                    onError={error => {
                      console.log('Image loading error:', error);
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully');
                    }}
                    resizeMode="cover"
                  />
                  <View style={styles.imageButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.imagePickerButton,
                        imageUploadLoading && styles.disabledButton,
                      ]}
                      onPress={handleImagePick}
                      disabled={imageUploadLoading}>
                      {imageUploadLoading ? (
                        <View style={styles.uploadLoadingContainer}>
                          <ActivityIndicator
                            size="small"
                            color={COLORS.white}
                          />
                          <Text style={styles.buttonText}>Uploading...</Text>
                        </View>
                      ) : (
                        <Text style={styles.buttonText}>Change Image</Text>
                      )}
                    </TouchableOpacity>

                    {editedItem.item_images &&
                      editedItem.item_images.length > 0 &&
                      canDelete && (
                        <TouchableOpacity
                          style={[
                            styles.deleteImageButton,
                            imageDeleteLoading && styles.disabledButton,
                          ]}
                          onPress={handleDeleteImage}
                          disabled={imageDeleteLoading}>
                          {imageDeleteLoading ? (
                            <View style={styles.uploadLoadingContainer}>
                              <ActivityIndicator
                                size="small"
                                color={COLORS.white}
                              />
                              <Text style={styles.buttonText}>Deleting...</Text>
                            </View>
                          ) : (
                            <Text style={styles.buttonText}>Delete Image</Text>
                          )}
                        </TouchableOpacity>
                      )}
                  </View>
                </View>

                {/* Item Name */}
                <Text style={styles.label}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  value={editedItem.item_name}
                  onChangeText={text =>
                    setEditedItem({...editedItem, item_name: text})
                  }
                />

                {/* Category Dropdown */}
                <Text style={styles.label}>Category</Text>
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
                      selectedValue={editedItem.category_id || 0}
                      onValueChange={itemValue => {
                        // Handle 0 as "no category"
                        if (itemValue === 0) {
                          setEditedItem({...editedItem, category_id: null});
                        } else {
                          setEditedItem({...editedItem, category_id: itemValue});
                        }
                      }}
                      style={styles.picker}
                      itemStyle={styles.pickerItem}>
                      <Picker.Item label="Select category" value={0} color={COLORS.black} />
                      {categories?.map(category => (
                        <Picker.Item
                          key={category.id || category.code}
                          label={category.name || category.description || category.code}
                          value={category.id || category.code}
                          color={COLORS.black}
                        />
                      ))}
                    </Picker>
                  )}
                </View>

                {/* Price */}
                <Text style={styles.label}>Price (UGX)</Text>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.pricePrefix}>UGX</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={editedItem.unit_price.toLocaleString()}
                    onChangeText={text => {
                      // Remove commas and convert to number
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
              </ScrollView>

              {/* Buttons - Outside ScrollView so they're always visible */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  activeOpacity={0.7}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                {canEdit && (
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={handleSave}
                    activeOpacity={0.7}>
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>

      {/* Native gallery picker is used instead of in-app modal */}
    </Modal>
  );
};

// GalleryGrid component removed - using native gallery picker instead

// Simple package SVG icon
const PackageSVG = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Rect
      x="4"
      y="8"
      width="24"
      height="16"
      rx="3"
      stroke="#888"
      strokeWidth="2"
      fill="#fff"
    />
    <Path d="M4 12l12 8 12-8" stroke="#888" strokeWidth="2" fill="none" />
    <Path d="M16 20v6" stroke="#888" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const Items = () => {
  const navigation = useNavigation();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEMS;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={[styles.container, {flex: 1}]}>
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
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filterModal, setFilterModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<
    'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  >('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const itemsPerPage = 10;

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

  const loadItems = async () => {
    try {
      setLoading(true);
      const response: PaginatedResponse = await fetchItems(
        currentPage,
        searchQuery,
        selectedCategory || undefined,
      );

      // Add safety checks for response data
      let filteredResults = response?.results || [];

      // Apply stock filter on client side
      if (stockFilter !== 'all' && Array.isArray(filteredResults)) {
        filteredResults = filteredResults.filter(item => {
          const inventory = item?.inventory || 0;
          if (stockFilter === 'out_of_stock') return inventory === 0;
          if (stockFilter === 'low_stock')
            return inventory > 0 && inventory < 10;
          if (stockFilter === 'in_stock') return inventory >= 10;
          return true;
        });
      }

      if (response && Array.isArray(filteredResults)) {
        setItems(filteredResults);
        // Adjust total pages based on filtered results
        const totalCount =
          stockFilter !== 'all' ? filteredResults.length : response.count || 0;
        setTotalPages(Math.ceil(totalCount / itemsPerPage));
      } else {
        console.warn('Invalid response format from fetchItems');
        setItems([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      setItems([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const response: PaginatedResponse = await fetchItems(
        currentPage,
        searchQuery,
        selectedCategory || undefined,
      );

      // Add safety checks for response data
      let filteredResults = response?.results || [];

      // Apply stock filter on client side
      if (stockFilter !== 'all' && Array.isArray(filteredResults)) {
        filteredResults = filteredResults.filter(item => {
          const inventory = item?.inventory || 0;
          if (stockFilter === 'out_of_stock') return inventory === 0;
          if (stockFilter === 'low_stock')
            return inventory > 0 && inventory < 10;
          if (stockFilter === 'in_stock') return inventory >= 10;
          return true;
        });
      }

      if (response && Array.isArray(filteredResults)) {
        setItems(filteredResults);
        const totalCount =
          stockFilter !== 'all' ? filteredResults.length : response.count || 0;
        setTotalPages(Math.ceil(totalCount / itemsPerPage));
      } else {
        console.warn('Invalid response format from fetchItems in refresh');
        setItems([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('Error refreshing items:', error);
      setItems([]);
      setTotalPages(0);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadItems();
    }, 500); // Debounce search

    return () => clearTimeout(debounceTimer);
  }, [currentPage, searchQuery, selectedCategory, stockFilter]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1); // Reset to first page when searching
    setSearchLoading(true);
  };

  const handleApplyFilter = () => {
    setCurrentPage(1); // Reset to first page when filtering
    setFilterModal(false);
    loadItems();
  };

  const handleClearFilter = () => {
    setSelectedCategory(null);
    setStockFilter('all');
    setCurrentPage(1);
    setFilterModal(false);
  };

  const hasActiveFilters = selectedCategory !== null || stockFilter !== 'all';

  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      <TouchableOpacity
        style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
        onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
        activeOpacity={0.7}>
        <Text
          style={
            currentPage === 1
              ? styles.disabledButtonText
              : styles.pageButtonText
          }>
          ⟨ Previous
        </Text>
      </TouchableOpacity>

      <View style={styles.pageInfoContainer}>
        <Text style={styles.pageInfo}>
          Page {currentPage} of {totalPages || 0}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.pageButton,
          currentPage === (totalPages || 0) && styles.disabledButton,
        ]}
        onPress={() =>
          setCurrentPage(prev => Math.min(totalPages || 0, prev + 1))
        }
        disabled={currentPage === (totalPages || 0)}
        activeOpacity={0.7}>
        <Text
          style={
            currentPage === (totalPages || 0)
              ? styles.disabledButtonText
              : styles.pageButtonText
          }>
          Next ⟩
        </Text>
      </TouchableOpacity>
    </View>
  );

  const handleCreateItem = () => {
    if (!canCreate(PAGE_NAME)) {
      Alert.alert(
        'Access Denied',
        'You do not have permission to create items.',
      );
      return;
    }
    setSelectedItem(null);
    setCreateModal(true);
  };

  const handleEditItem = (item: Item) => {
    console.log('handleEditItem called with:', item);
    if (!item || (!item.id && !item.no)) {
      console.warn('Invalid item data for editing - missing id or no field');
      return;
    }
    console.log('Setting selectedItem and opening modal');
    setSelectedItem(item);
    setEditModal(true);
  };

  const getStockStatus = (inventory: number) => {
    if (inventory === 0) return {color: COLORS.error, label: 'Out of Stock'};
    if (inventory < 10) return {color: COLORS.warning, label: 'Low Stock'};
    return {color: COLORS.success, label: 'In Stock'};
  };

  const renderItemCard = ({item}: {item: Item}) => {
    const stockStatus = getStockStatus(item?.inventory || 0);
    return (
      <TouchableOpacity
        style={styles.itemCard}
        activeOpacity={0.7}
        onPress={() => canEdit(PAGE_NAME) && handleEditItem(item)}>
        <View style={styles.itemImageContainer}>
          {item?.item_images &&
          item.item_images.length > 0 &&
          item.item_images[0]?.url ? (
            <Image
              source={{uri: item.item_images[0].url}}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <PackageSVG />
            </View>
          )}
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item?.item_name || 'Unnamed Item'}
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.itemPrice}>
              UGX {(item?.unit_price || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.stockContainer}>
            <View
              style={[
                styles.stockIndicator,
                {backgroundColor: stockStatus.color + '20'},
              ]}>
              <View
                style={[styles.stockDot, {backgroundColor: stockStatus.color}]}
              />
              <Text
                style={[
                  styles.itemInventory,
                  {color: stockStatus.color, fontWeight: '600'},
                ]}>
                {item?.inventory || 0} units
              </Text>
            </View>
          </View>
        </View>

        {canEdit(PAGE_NAME) && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              console.log(
                'Edit button pressed for item:',
                item?.id || item?.no,
              );
              handleEditItem(item);
            }}
            activeOpacity={0.8}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
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

  const handleFormSave = (savedItem: Item) => {
    setCreateModal(false);
    setSelectedItem(null);
    loadItems();
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={styles.searchIconContainer}>
            <Image
              source={icons.search}
              style={styles.searchIcon}
              resizeMode="contain"
            />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchLoading && (
            <View style={styles.searchLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => navigation.navigate('ItemCategories' as never)}
          activeOpacity={0.7}>
          <Text style={styles.categoryButtonText}>📁</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            hasActiveFilters && styles.filterButtonActive,
          ]}
          onPress={() => setFilterModal(true)}
          activeOpacity={0.7}>
          <Image
            source={icons.filter}
            style={[
              styles.filterIcon,
              hasActiveFilters && styles.filterIconActive,
            ]}
            resizeMode="contain"
          />
          {hasActiveFilters && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      )}

      {/* Items List */}
      {!loading && (
        <FlatList
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
            (items?.length || 0) === 0 ? {flex: 1} : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>📦</Text>
              </View>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : canCreate(PAGE_NAME)
                  ? 'Create your first item to get started.'
                  : 'No items available at the moment'}
              </Text>
              {canCreate(PAGE_NAME) && !searchQuery && (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleCreateItem}>
                  <Text style={styles.emptyButtonText}>Create Item</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Pagination */}
      {(totalPages || 0) > 1 && renderPagination()}

      {/* Create Item FAB */}
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateItem}
          activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Create Item Modal */}
      <ItemFormModal
        visible={createModal}
        onClose={() => {
          setCreateModal(false);
          setSelectedItem(null);
        }}
        item={null}
        onSave={handleFormSave}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
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
                    {value: 'all', label: 'All Items'},
                    {value: 'in_stock', label: 'In Stock'},
                    {value: 'low_stock', label: 'Low Stock'},
                    {value: 'out_of_stock', label: 'Out of Stock'},
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
    backgroundColor: COLORS.lightGray2,
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
    shadowOffset: {width: 0, height: 2},
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
    padding: SIZES.base * 2,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    height: 48,
  },
  searchIconContainer: {
    marginRight: SIZES.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
    paddingVertical: 0,
  },
  categoryButton: {
    width: 48,
    height: 48,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    marginRight: SIZES.base,
  },
  categoryButtonText: {
    fontSize: 20,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  filterIconActive: {
    tintColor: COLORS.white,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.base * 2,
    marginVertical: SIZES.base,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 2,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  itemImageContainer: {
    width: 72,
    height: 72,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    marginRight: SIZES.base * 1.5,
    backgroundColor: COLORS.lightGray2,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: SIZES.base,
  },
  itemName: {
    ...FONTS.h4,
    color: COLORS.black,
    marginBottom: SIZES.base * 0.5,
  },
  priceContainer: {
    marginBottom: SIZES.base * 0.5,
  },
  itemPrice: {
    ...FONTS.h5,
    color: COLORS.primary,
    fontWeight: '600',
  },
  stockContainer: {
    marginTop: SIZES.base * 0.5,
  },
  stockIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base * 0.5,
    borderRadius: 12,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SIZES.base * 0.5,
  },
  itemInventory: {
    ...FONTS.body5,
    fontSize: 11,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 13,
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
    shadowOffset: {width: 0, height: 2},
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
  fab: {
    position: 'absolute',
    right: SIZES.base * 2,
    bottom: 130, // Position well above bottom navigation
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  fabText: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: '300',
    lineHeight: 32,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.base * 2.5,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    width: '100%',
    maxHeight: '90%',
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.black,
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalScrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.base * 2,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: SIZES.padding,
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.base * 2.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    marginTop: SIZES.base,
  },
  productImageLarge: {
    width: 160,
    height: 160,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    borderWidth: 2,
    borderColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
  },
  imagePickerButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    flex: 1,
    marginHorizontal: SIZES.base * 0.5,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
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
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    flex: 1,
    marginHorizontal: SIZES.base * 0.5,
    shadowColor: COLORS.error,
    shadowOffset: {width: 0, height: 2},
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
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base * 1.5,
    ...FONTS.body3,
    color: COLORS.black,
    marginBottom: SIZES.base * 2,
    backgroundColor: COLORS.lightGray2,
    minHeight: 48,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray2,
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
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    backgroundColor: COLORS.lightGray2,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: COLORS.black,
  },
  pickerItem: {
    color: COLORS.black,
  },
  picker: {
    height: 50,
    color: COLORS.black,
  },
  pickerItem: {
    color: COLORS.black,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SIZES.padding,
    paddingTop: SIZES.base * 2,
    gap: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
    backgroundColor: COLORS.white,
    flexShrink: 0,
  },
  button: {
    flex: 1,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: COLORS.error,
  },
  saveButton: {
    backgroundColor: COLORS.success,
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
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
    gap: 8,
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
    shadowOffset: {width: 0, height: 2},
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
    shadowOffset: {width: 0, height: 2},
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
    shadowOffset: {width: 0, height: 10},
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
    shadowOffset: {width: 0, height: 4},
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
    shadowOffset: {width: 0, height: 4},
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
    shadowOffset: {width: 0, height: -5},
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
    shadowOffset: {width: 0, height: 2},
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
