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
} from 'react-native';
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
} from '../../services/app.services';
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
  id: number;
  name: string;
}

const EditItemModal = ({
  visible,
  onClose,
  item,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (updatedItem: Item) => void;
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
      const response = await fetchCategories();
      if (response && response.results && Array.isArray(response.results)) {
        setCategories(response.results);
      } else {
        setCategories([]);
      }
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
        <View style={styles.modalContent}>
          {!editedItem ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading item data...</Text>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Item</Text>

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
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.buttonText}>Uploading...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Change Image</Text>
                    )}
                  </TouchableOpacity>

                  {editedItem.item_images &&
                    editedItem.item_images.length > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.deleteImageButton,
                          imageDeleteLoading && styles.disabledButton,
                        ]}
                        onPress={handleDeleteImage}
                        disabled={imageDeleteLoading}>
                        {imageDeleteLoading ? (
                          <View style={styles.uploadLoadingContainer}>
                            <ActivityIndicator size="small" color="#fff" />
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
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.categoryLoadingText}>
                      Loading categories...
                    </Text>
                  </View>
                ) : (
                  <Picker
                    selectedValue={editedItem.category_id || 0}
                    onValueChange={itemValue =>
                      setEditedItem({...editedItem, category_id: itemValue})
                    }
                    style={styles.picker}>
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

              {/* Price */}
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                value={editedItem.unit_price.toLocaleString()}
                onChangeText={text => {
                  // Remove commas and convert to number
                  const numericValue = parseFloat(text.replace(/,/g, '')) || 0;
                  setEditedItem({
                    ...editedItem,
                    unit_price: numericValue,
                  });
                }}
                keyboardType="numeric"
              />

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
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
  const [editModal, setEditModal] = useState(false);
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
  const itemsPerPage = 10;

  const loadItems = async () => {
    try {
      setLoading(true);
      const response: PaginatedResponse = await fetchItems(
        currentPage,
        searchQuery,
      );

      // Add safety checks for response data
      if (response && response.results && Array.isArray(response.results)) {
        setItems(response.results);
        setTotalPages(Math.ceil((response.count || 0) / itemsPerPage));
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
      );

      // Add safety checks for response data
      if (response && response.results && Array.isArray(response.results)) {
        setItems(response.results);
        setTotalPages(Math.ceil((response.count || 0) / itemsPerPage));
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
  }, [currentPage, searchQuery]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1); // Reset to first page when searching
    setSearchLoading(true);
  };

  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      <TouchableOpacity
        style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
        onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
        disabled={currentPage === 1}>
        <Text
          style={
            currentPage === 1
              ? styles.disabledButtonText
              : styles.pageButtonText
          }>
          ⟨ Previous
        </Text>
      </TouchableOpacity>

      <Text style={styles.pageInfo}>
        Page {currentPage} of {totalPages || 0}
      </Text>

      <TouchableOpacity
        style={[
          styles.pageButton,
          currentPage === (totalPages || 0) && styles.disabledButton,
        ]}
        onPress={() =>
          setCurrentPage(prev => Math.min(totalPages || 0, prev + 1))
        }
        disabled={currentPage === (totalPages || 0)}>
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

  const renderItemCard = ({item}: {item: Item}) => (
    <View style={styles.itemCard}>
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
        <Text style={styles.itemPrice}>
          UGX {(item?.unit_price || 0).toLocaleString()}
        </Text>
        <Text style={styles.itemInventory}>
          Stock: {item?.inventory || 0} units
        </Text>
      </View>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => {
          console.log('Edit button pressed for item:', item?.id || item?.no);
          handleEditItem(item);
        }}>
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  const handleItemSave = async (selectedItem: Item) => {
    const itemId = selectedItem.id || selectedItem.no;
    if (!selectedItem || !itemId) {
      console.warn('Invalid item data for saving');
      return;
    }

    try {
      const response = await updateItem(itemId, selectedItem);
      if (response.status === 200) {
        setSuccessMessage('Item updated successfully');
        setShowSuccessModal(true);
        setEditModal(false);
        setSelectedItem(null);
        loadItems();
      } else {
        Alert.alert('Error', 'Failed to update item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to save item');
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchLoading && (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
              <Text style={styles.emptyText}>No items found.</Text>
            </View>
          }
        />
      )}

      {/* Pagination */}
      {(totalPages || 0) > 1 && renderPagination()}

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
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  itemCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 2,
  },
  itemInventory: {
    fontSize: 12,
    color: '#666',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  pageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  pageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  pageInfo: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  productImageLarge: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  imagePickerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#007AFF',
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
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#ff3b30',
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
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    height: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#ff3b30',
  },
  saveButton: {
    backgroundColor: '#34c759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  categoryLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLoadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  searchLoadingContainer: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{translateY: -10}],
  },
  uploadLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  errorIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    color: '#c62828',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '400',
  },
  successContainer: {
    backgroundColor: '#f1f8e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#4caf50',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  successIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  successText: {
    color: '#388e3c',
    fontSize: 14,
    fontWeight: '400',
  },
  // Custom Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  successModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4caf50',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successModalIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  successModalButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#4caf50',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Items;
