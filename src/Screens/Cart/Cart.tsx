import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Modal,
  Button,
  Alert,
} from 'react-native';
import {SwipeListView} from 'react-native-swipe-list-view';
import {
  createSales,
  postItemJournal,
  searchItems,
  fetchDraftSales,
  getSalesInvoice,
  updateSalesInvoice,
  createSalesInvoice,
  fetchCustomers,
  fetchPaymentMethods,
  Customer,
  PaymentMethod,
} from '../../services/app.services';
import Toast from 'react-native-toast-message';
import ReactNativeModal from 'react-native-modal';
import {Animated} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useColorScheme} from 'react-native';

import {FONTS, SIZES, COLORS, icons, dummyData} from '../../constants';
import {
  CartQuantityButton,
  FooterTotal,
  Header,
  IconButton,
  StepperInput,
} from '../../Components';
import {useAppContext} from '../../context/Store';
import {useCart} from '../../context/CartStore';
import {useIsFocused} from '@react-navigation/native';
import {handlePrint} from '../../Components/HandlePrint';
import {SalesPostData, CartItem} from '../../@types/types.dto';
import SearchBar from '../../Components/SearchBar';
import SalesCompletionModal from '../../Components/SalesCompletionModal';
// import {SaleResult} from '../../services/SalesService';
// PrinterTestButton import removed - keeping test code in PrintService

const formatDate = (date: Date | string | undefined) => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const Cart = ({navigation}: {navigation: any}) => {
  const [myCartList, setMyCartList] = React.useState(dummyData.myCart);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalItems, setModalItems] = useState<CartItem[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isPriceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const colorScheme = useColorScheme();

  const searchInputRef = useRef<TextInput>(null);
  const {state, dispatch} = useCart();
  const appContext = useAppContext();
  const {cartItems} = state;
  const auth = appContext?.auth;
  const isFocused = useIsFocused();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [globalSellingDate, setGlobalSellingDate] = useState(new Date());
  const [showGlobalDatePicker, setShowGlobalDatePicker] = useState(false);
  
  // Drafts state
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showDraftsSection, setShowDraftsSection] = useState(true);
  const [loadingDraftIntoCart, setLoadingDraftIntoCart] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null); // Track loaded draft
  const [currentDraftSystemId, setCurrentDraftSystemId] = useState<string | null>(null); // Track loaded draft system_id

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Load drafts when screen is focused
  useEffect(() => {
    if (isFocused) {
      loadDrafts();
    }
  }, [isFocused]);

  // Handle modal visibility with keyboard
  useEffect(() => {
    if (isModalVisible && isKeyboardVisible) {
      // Keep modal open when keyboard is visible
      // The modal will adjust its position automatically
    }
  }, [isModalVisible, isKeyboardVisible]);

  // Ensure keyboard stays focused when modal opens
  useEffect(() => {
    if (isModalVisible) {
      // Keep the search input focused when modal opens
      const focusInterval = setInterval(() => {
        searchInputRef.current?.focus();
      }, 100);

      // Clear interval after 1 second
      setTimeout(() => {
        clearInterval(focusInterval);
      }, 1000);

      return () => clearInterval(focusInterval);
    }
  }, [isModalVisible]);

  const addToCart = (item: CartItem) => {
    const existItem = cartItems.find(
      (x: CartItem) => x.system_id === item.system_id,
    );
    const quantity = existItem ? existItem.quantity + 1 : 1;

    if (quantity > item.inventory) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Stock Limit Reached',
        text2: `Only ${item.inventory} items available`,
        text1Style: {
          fontSize: 16,
          fontWeight: '600',
          color: '#E53935',
        },
        text2Style: {
          fontSize: 14,
          color: '#666',
        },
        visibilityTime: 2500,
        position: 'top',
      });
      return;
    }

    // Add current date as date_sold and include id field
    const currentDate = new Date().toISOString();

    const trackingConfig =
      item.tracking_code ?? existItem?.tracking_code ?? null;
    const selectedTrackingCode =
      existItem?.selectedTrackingCode ?? item.selectedTrackingCode ?? null;
    const trackingDetails = existItem?.trackingDetails ?? item.trackingDetails;

    dispatch({
      type: 'CART_ADD_ITEM',
      payload: {
        ...item,
        quantity,
        date_sold: currentDate,
        tracking_code: trackingConfig,
        selectedTrackingCode,
        trackingDetails,
      },
    });

    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const handleSearch = async (itemCode: string) => {
    setIsLoading(true);
    try {
      if (!itemCode.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please enter a search query.',
          text1Style: {
            fontSize: 13,
            fontWeight: '600',
            color: '#FF3B30',
            textAlign: 'center',
          },
          text2Style: {
            fontSize: 11,
            color: '#666',
            textAlign: 'center',
          },
          visibilityTime: 4000,
          position: 'top',
        });
        return;
      }
      const results = await searchItems(itemCode);

      if (results.length === 1) {
        addToCart(results[0]);
      } else if (results.length > 1) {
        setModalItems(results);
        toggleModal();
        setSearchQuery('');
      } else {
        Toast.show({
          type: 'info',
          text1: 'No Results',
          text2: 'No items found for your search.',
          text1Style: {
            fontSize: 20,
            fontWeight: 'bold',
            color: '#007AFF', // iOS-style blue for info
            textAlign: 'center',
          },
          text2Style: {
            fontSize: 17,
            color: '#666',
            textAlign: 'center',
            lineHeight: 22,
          },
          visibilityTime: 4000,
          position: 'top',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Error: ${error}`,
        text1Style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: '#FF3B30',
          textAlign: 'center',
        },
        text2Style: {
          fontSize: 17,
          color: '#666',
          textAlign: 'center',
          lineHeight: 22,
        },
        visibilityTime: 4000,
        position: 'top',
      });
    } finally {
      setIsLoading(false);
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const updateQuantityHandler = (systemId: string, newQty: number) => {
    const existItem = cartItems.find(
      (x: {system_id: string}) => x.system_id === systemId,
    );

    if (existItem) {
      if (newQty > existItem.inventory) {
        Toast.show({
          type: 'error',
          text1: '⚠️ Inventory Alert',
          text2: `Only ${existItem.inventory} items left in stock`,
          text1Style: {
            fontSize: 16,
            fontWeight: '600',
            color: '#E53935',
            textAlign: 'left',
          },
          text2Style: {
            fontSize: 11,
            color: '#555',
            textAlign: 'left',
          },
          visibilityTime: 3000,
          position: 'top',
        });
        return;
      }

      dispatch({
        type: 'UPDATE_CART_ITEM_QUANTITY',
        payload: {
          system_id: systemId,
          quantity: newQty,
        },
      });
    } else {
      console.error('Item not found in cart:', systemId);
    }
  };

  function toggleModal() {
    setIsModalVisible(!isModalVisible);
  }

  const handlePlaceOrder = async (total: number) => {
    if (isPlacingOrder) return;

    // Show sales completion modal
    setShowSalesModal(true);
  };

  const handleSaleSuccess = (result: any) => {
    // Clear cart after successful sale
    dispatch({type: 'CLEAR_CART'});
    // Clear current draft ID and system_id if set
    setCurrentDraftId(null);
    setCurrentDraftSystemId(null);

    // Refresh drafts after successful sale
    loadDrafts();

    // Navigate back to home
    setTimeout(() => {
      navigation.navigate('Cart');
    }, 2000);
  };

  // Load drafts
  const loadDrafts = async () => {
    try {
      setLoadingDrafts(true);
      const draftList = await fetchDraftSales();
      setDrafts(draftList);
    } catch (error) {
      console.error('Error loading drafts:', error);
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (isSavingDraft || cartItems.length === 0) return;

    try {
      setIsSavingDraft(true);

      // Get default customer (General)
      const customersData = await fetchCustomers();
      const generalCustomer = customersData.find(
        customer =>
          customer.name.toLowerCase().includes('general') ||
          customer.no.toLowerCase().includes('gen'),
      );

      if (!generalCustomer) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please select a customer first',
          visibilityTime: 3000,
          position: 'top',
        });
        return;
      }

      // Get payment methods
      const paymentMethodsData = await fetchPaymentMethods();
      if (paymentMethodsData.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'No payment methods available. Please contact your administrator.',
          visibilityTime: 3000,
          position: 'top',
        });
        return;
      }

      const totalAmount = cartItems.reduce(
        (sum: number, item: CartItem) =>
          sum + (item.unit_price || 0) * (Number(item.quantity) || 0),
        0,
      );

      const salesInvoiceData = {
        customer: generalCustomer.id,
        customer_name: generalCustomer.name,
        document_date: globalSellingDate.toISOString().split('T')[0],
        status: 'Draft' as const,
        total_amount: totalAmount,
        payment_method: paymentMethodsData[0]?.id,
        lines: cartItems.map((item, index) => ({
          id: index + 1,
          item: item.no || item.system_id,
          item_no: item.no || item.system_id,
          item_name: item.item_name,
          quantity: item.quantity.toString(),
          unit_price: item.unit_price.toString(),
          total_amount: (item.unit_price * Number(item.quantity)).toString(),
          unit_of_measure: item.unit_of_measure || 'PCS',
          tracking_code: item.selectedTrackingCode || '',
          description: '',
        })),
      };

      let response;

      // If we have a current draft ID, update it instead of creating new
      if (currentDraftId) {
        console.log('Updating existing draft:', currentDraftId, 'system_id:', currentDraftSystemId);
        
        // Include id and system_id in the update data (required by upsert endpoint)
        const updateData = {
          ...salesInvoiceData,
          id: currentDraftId,
          system_id: currentDraftSystemId || undefined,
        };
        
        response = await updateSalesInvoice(currentDraftId, updateData);

        Toast.show({
          type: 'success',
          text1: 'Draft Updated',
          text2: `Draft has been updated successfully`,
          visibilityTime: 3000,
          position: 'top',
        });

        // Clear the current draft ID and system_id after successful update
        setCurrentDraftId(null);
        setCurrentDraftSystemId(null);
      } else {
        // Check if we already have 3 drafts before creating new
        if (drafts.length >= 3) {
          Toast.show({
            type: 'error',
            text1: 'Maximum Drafts Reached',
            text2: 'You can only have 3 drafts. Please complete or delete an existing draft first.',
            visibilityTime: 3000,
            position: 'top',
          });
          return;
        }

        console.log('Creating new draft');
        response = await createSalesInvoice(salesInvoiceData);

        Toast.show({
          type: 'success',
          text1: 'Draft Saved',
          text2: `Invoice No: ${response.data.invoice_no || 'Draft'}`,
          visibilityTime: 3000,
          position: 'top',
        });
      }

      // Clear cart after saving draft
      dispatch({type: 'CLEAR_CART'});
      
      // Clear current draft ID and system_id if they were set
      setCurrentDraftId(null);
      setCurrentDraftSystemId(null);

      // Refresh drafts list
      await loadDrafts();
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Failed to save draft',
        visibilityTime: 3000,
        position: 'top',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Select draft and load into cart
  const handleSelectDraft = async (draft: any) => {
    try {
      setLoadingDraftIntoCart(true);

      // Get full draft details with lines
      const fullDraft = await getSalesInvoice(draft.id);

      // Clear current cart
      dispatch({type: 'CLEAR_CART'});

      // Fetch current inventory for each item in the draft
      const draftItemsWithInventory = await Promise.all(
        (fullDraft.lines || []).map(async (line: any) => {
          const itemNo = line.item_no || line.item;
          const systemId = line.item_system_id || itemNo;

          // Try to fetch current item details to get inventory
          let inventory = 0;
          let itemDetails: any = null;

          try {
            // Search for the item to get current inventory
            const searchResults = await searchItems(itemNo);
            itemDetails = searchResults.find(
              (item: CartItem) =>
                item.no === itemNo ||
                item.system_id === systemId ||
                item.bar_code_no === itemNo,
            );

            if (itemDetails) {
              inventory = itemDetails.inventory || 0;
            }
          } catch (error) {
            console.warn(`Failed to fetch inventory for item ${itemNo}:`, error);
            // Continue with inventory = 0 if fetch fails
          }

          return {
            system_id: systemId || `draft-${line.id}`,
            no: itemNo,
            item_name: line.item_name,
            barcode: itemDetails?.bar_code_no || '',
            quantity: parseInt(line.quantity) || 1,
            unit_price: parseFloat(line.unit_price) || 0,
            original_price: parseFloat(line.unit_price) || 0,
            total: parseFloat(line.total_amount) || 0,
            inventory: inventory,
            unit_of_measure: line.unit_of_measure || 'PCS',
            quantity_per_unit: itemDetails?.quantity_per_unit || 1,
            selectedTrackingCode: line.tracking_code || '',
            tracking_code: line.tracking_code || null,
            date_sold: fullDraft.document_date || new Date().toISOString(),
            item_images: itemDetails?.item_images || [],
          };
        }),
      );

      // Add items to cart
      draftItemsWithInventory.forEach((item: CartItem) => {
        dispatch({
          type: 'CART_ADD_ITEM',
          payload: item,
        });
      });

      // Set global selling date
      if (fullDraft.document_date) {
        setGlobalSellingDate(new Date(fullDraft.document_date));
      }

      // Store the draft ID and system_id so we can update it later instead of creating new
      setCurrentDraftId(draft.id);
      setCurrentDraftSystemId(fullDraft.system_id || null);

      Toast.show({
        type: 'success',
        text1: 'Draft Loaded',
        text2: 'Draft has been loaded into sale. You can add more items and save to update.',
        visibilityTime: 3000,
        position: 'top',
      });

      // Hide drafts section
      setShowDraftsSection(false);
    } catch (error: any) {
      console.error('Failed to load draft:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load draft',
        visibilityTime: 3000,
        position: 'top',
      });
    } finally {
      setLoadingDraftIntoCart(false);
    }
  };

  // Delete draft
  const handleDeleteDraft = async (draft: any) => {
    try {
      await updateSalesInvoice(draft.id, {
        deleted: true,
        system_id: draft.system_id,
      });
      
      // Remove from local state
      setDrafts(drafts.filter(d => d.id !== draft.id));

      // If the deleted draft is the one currently loaded, clear the current draft tracking
      if (currentDraftId === draft.id) {
        setCurrentDraftId(null);
        setCurrentDraftSystemId(null);
      }

      Toast.show({
        type: 'success',
        text1: 'Draft Deleted',
        text2: 'Draft has been deleted successfully',
        visibilityTime: 2000,
        position: 'top',
      });
    } catch (error: any) {
      console.error('Failed to delete draft:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete draft',
        visibilityTime: 3000,
        position: 'top',
      });
    }
  };

  function renderFooter() {
    const subQuantity = cartItems.reduce(
      (a: number, c: {quantity: number}) => a + (Number(c.quantity) || 0),
      0,
    );
    const subTotal = cartItems.reduce(
      (sum: number, item: {unit_price: number; quantity: number}) =>
        sum + (item.unit_price || 0) * (Number(item.quantity) || 0),
      0,
    );
    const total = subTotal;
    return (
      <View>
        {/* Global Selling Date */}
        <View style={styles.datePickerContainer}>
          <Text style={styles.dateLabel}>Selling Date:</Text>
          <TouchableOpacity
            style={styles.globalDatePickerButton}
            onPress={() => setShowGlobalDatePicker(true)}>
            <Image source={icons.calender} style={styles.calendarIcon} />
            <Text style={styles.datePickerText}>
              {globalSellingDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        {showGlobalDatePicker && (
          <DateTimePicker
            value={globalSellingDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              const currentDate = selectedDate || globalSellingDate;
              setShowGlobalDatePicker(Platform.OS === 'ios');
              setGlobalSellingDate(currentDate);
            }}
            themeVariant={colorScheme || 'light'}
          />
        )}

        {/* Save Draft Button */}
        {cartItems.length > 0 && (
          <TouchableOpacity
            style={[
              styles.saveDraftButton,
              isSavingDraft && styles.saveDraftButtonDisabled,
              currentDraftId && styles.saveDraftButtonUpdating,
            ]}
            onPress={handleSaveDraft}
            disabled={isSavingDraft || (!currentDraftId && drafts.length >= 3)}>
            {isSavingDraft ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveDraftButtonText}>
                {currentDraftId ? 'Update Draft' : 'Save Draft'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <FooterTotal
          subTotal={subTotal}
          totalQuantity={subQuantity}
          total={total}
          printReceipt={printReceipt}
          setPrintReceipt={setPrintReceipt}
          onPress={() => handlePlaceOrder(total)}
          isLoading={isPlacingOrder}
        />
      </View>
    );
  }

  const ModalPopup = () => (
    <ReactNativeModal
      isVisible={isModalVisible}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onBackdropPress={toggleModal}
      style={styles.modal}
      avoidKeyboard={false}
      propagateSwipe={true}
      backdropOpacity={0.3}
      useNativeDriver={true}
      hideModalContentWhileAnimating={false}
      onModalShow={() => {
        // Ensure keyboard stays focused when modal shows
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }}
      onModalHide={() => {
        // Ensure keyboard stays focused when modal closes
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }}
      onBackButtonPress={() => {
        toggleModal();
        return true;
      }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalView}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {searchQuery
              ? `Search Results for "${searchQuery}"`
              : 'Select an Item'}
          </Text>
          <TouchableOpacity onPress={toggleModal} style={styles.closeButton}>
            <Image source={icons.cross} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{flex: 1}}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}>
          <FlatList
            data={modalItems}
            renderItem={({item}: {item: CartItem}) => (
              <TouchableOpacity
                style={styles.modalItemContainer}
                onPress={() => {
                  addToCart(item);
                  Toast.show({
                    type: 'success',
                    text1: 'Item Added',
                    text2: `${item.item_name} has been added to sale.`,
                    text1Style: {
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#4CD964', // iOS-style green for success
                      textAlign: 'center',
                    },
                    text2Style: {
                      fontSize: 11,
                      color: '#666',
                      textAlign: 'center',
                    },
                    visibilityTime: 4000,
                    position: 'top',
                  });
                  toggleModal();
                }}>
                <View style={styles.modalImageContainer}>
                  <Image
                    source={{uri: item.item_images?.[0]?.url}}
                    style={styles.modalItemImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.modalItemDetails}>
                  <Text style={styles.modalItemName} numberOfLines={1}>
                    {item.item_name}
                  </Text>
                  <View style={styles.modalItemInfo}>
                    <Text style={styles.modalStockText}>
                      Stock: {item.inventory}
                    </Text>
                    <Text style={styles.modalPriceText}>
                      UGX {item.unit_price?.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.system_id}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Image source={icons.search} style={styles.emptyListIcon} />
                <Text style={styles.emptyListText}>
                  {searchQuery
                    ? `No items found for "${searchQuery}"`
                    : 'No items found'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.modalListContainer}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            scrollEnabled={false}
            nestedScrollEnabled={true}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ReactNativeModal>
  );

  const openPriceModal = (item: any) => {
    setSelectedItem(item);
    setNewPrice(item.unit_price.toString());
    setPriceModalVisible(true);
  };

  const updatePrice = () => {
    if (selectedItem) {
      const updatedItem = {
        ...(selectedItem as CartItem),
        unit_price: parseFloat(newPrice),
      };

      dispatch({type: 'CART_UPDATE_ITEM', payload: updatedItem});
    }
    setPriceModalVisible(false);
  };

  const renderPriceModal = () => (
    <Modal
      visible={isPriceModalVisible}
      transparent={true}
      animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.priceModalTitle}>Update Price</Text>
          <TextInput
            style={styles.input}
            value={newPrice.toLocaleString()}
            onChangeText={setNewPrice}
            keyboardType="numeric"
            placeholder="Enter new price"
            placeholderTextColor={COLORS.gray}
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => setPriceModalVisible(false)}
            />
            <Button title="Update" onPress={updatePrice} />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={{flex: 1}} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={{flex: 1}}>
          <Header
            title="Make Sale"
            showBack={true}
            onBackPress={() => navigation.goBack()}
            rightComponent={
              <CartQuantityButton
                quantity={cartItems.reduce(
                  (a: number, c: any) => a + (Number(c.quantity) || 0),
                  0,
                )}
                onPress={() => {}}
              />
            }
            containerStyle={{
              zIndex: -1,
            }}
          />
          <SearchBar
            searchQuery={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={() => handleSearch(searchQuery)}
            isLoading={isLoading}
            inputRef={searchInputRef}
            onFocus={() => navigation.navigate('SearchPage' as never)}
            onPress={() => navigation.navigate('SearchPage' as never)}
          />

          {/* Drafts Section */}
          {drafts.length > 0 && (
            <View style={styles.draftsSection}>
              <View style={styles.draftsHeader}>
                <Text style={styles.draftsTitle}>
                  Recent Drafts ({drafts.length}/3)
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDraftsSection(!showDraftsSection)}>
                  <Text style={styles.draftsToggle}>
                    {showDraftsSection ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
              {showDraftsSection && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.draftsList}>
                  {drafts.map((draft) => (
                    <View key={draft.id} style={styles.draftCard}>
                      <TouchableOpacity
                        style={styles.draftCardContent}
                        onPress={() => handleSelectDraft(draft)}>
                        <View style={styles.draftCardHeader}>
                          <Text style={styles.draftInvoiceNo}>
                            {draft.invoice_no || 'Draft'}
                          </Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              Alert.alert(
                                'Delete Draft',
                                'Are you sure you want to delete this draft?',
                                [
                                  {text: 'Cancel', style: 'cancel'},
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: () => handleDeleteDraft(draft),
                                  },
                                ],
                              );
                            }}>
                            <Image
                              source={icons.delete_icon}
                              style={styles.draftDeleteIcon}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.draftCustomer}>
                          {draft.customer_name || 'Unknown'}
                        </Text>
                        <Text style={styles.draftDate}>
                          {new Date(draft.created_at).toLocaleDateString()}
                        </Text>
                        <Text style={styles.draftAmount}>
                          UGX {draft.total_amount?.toLocaleString() || '0'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {loadingDrafts && (
            <View style={styles.draftsLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
              <Text style={styles.draftsLoadingText}>Loading drafts...</Text>
            </View>
          )}

          {loadingDraftIntoCart && (
            <View style={styles.draftsLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
              <Text style={styles.draftsLoadingText}>
                Loading draft into sale...
              </Text>
            </View>
          )}

          <SwipeListView
            data={cartItems}
            extraData={cartItems}
            keyExtractor={(item: any) => `${item.system_id}`}
            renderItem={({item}: {item: any}) => (
              <View style={styles.cartItemWrapper}>
                <View style={styles.cartItem}>
                  <View style={styles.imageContainer}>
                    <Image
                      source={
                        item.item_images && item.item_images[0]?.url
                          ? {uri: item.item_images[0].url}
                          : icons.product2
                      }
                      resizeMode="cover"
                      style={styles.productImage}
                    />
                  </View>

                  <View style={styles.contentContainer}>
                    <View>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.item_name}
                      </Text>
                    </View>

                    <View style={styles.priceAndQuantityRow}>
                      <TouchableOpacity
                        style={styles.priceButton}
                        onPress={() => openPriceModal(item)}>
                        <Text style={styles.priceText}>
                          UGX {item.unit_price?.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>
                        Qty: {Number(item.quantity) || 1}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.quantityContainer}>
                    <StepperInput
                      containerStyle={{
                        height: 38,
                        width: 100,
                        backgroundColor: COLORS.lightGray2,
                        borderRadius: 8,
                      }}
                      value={Number(item.quantity) || 1}
                      onAdd={() =>
                        updateQuantityHandler(
                          item.system_id,
                          (Number(item.quantity) || 1) + 1,
                        )
                      }
                      onMinus={() => {
                        const currentQty = Number(item.quantity) || 1;
                        if (currentQty > 1) {
                          updateQuantityHandler(item.system_id, currentQty - 1);
                        }
                      }}
                    />
                  </View>
                </View>
              </View>
            )}
            renderHiddenItem={(data: any, rowMap: any) => (
              <View style={styles.hiddenItemContainer}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    dispatch({type: 'REMOVE_FROM_CART', payload: data.item})
                  }>
                  <Image
                    source={icons.delete_icon}
                    style={{
                      width: 24,
                      height: 24,
                      tintColor: COLORS.white,
                    }}
                  />
                </TouchableOpacity>
              </View>
            )}
            rightOpenValue={-75}
            disableRightSwipe
            swipeToOpenPercent={30}
            contentContainerStyle={{
              flexGrow: 1,
              paddingVertical: 8,
              paddingHorizontal: 4,
            }}
            ListEmptyComponent={
              <View style={styles.emptyCartContainer}>
                <Image source={icons.emptycart} style={styles.emptyCartImage} />
                <Text style={styles.emptyCartText}>No items in sale. Start adding items to make a sale.</Text>
              </View>
            }
          />

          {/* Footer */}
          {cartItems.length > 0 && !isKeyboardVisible && (
            <View style={styles.footerContainer}>{renderFooter()}</View>
          )}

          {isPlacingOrder && (
            <ActivityIndicator
              size="large"
              color={COLORS.primary2}
              style={{position: 'absolute', top: '50%', left: '50%'}}
            />
          )}

          <ModalPopup />
          {renderPriceModal()}

          <SalesCompletionModal
            isVisible={showSalesModal}
            onClose={() => setShowSalesModal(false)}
            onSuccess={handleSaleSuccess}
            cartItems={cartItems}
            total={cartItems.reduce(
              (sum, item) => sum + item.quantity * item.unit_price,
              0,
            )}
            username={auth?.username || 'Unknown'}
            userId={Number(auth?.user_id) || 0}
            documentDate={globalSellingDate.toISOString().split('T')[0]}
          />

          <Toast />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  cartItemWrapper: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
  },
  cartItem: {
    height: 110,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: 75,
    height: 75,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray2,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'space-between',
    height: 75,
  },
  productName: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontSize: 12,
  },
  dateText: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontSize: 12,
  },
  priceButton: {
    backgroundColor: COLORS.lightGray2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priceText: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontSize: 14,
  },
  quantityContainer: {
    marginLeft: 8,
  },
  deleteButton: {
    width: 75,
    height: '100%',
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyCartText: {
    ...FONTS.h3,
    color: COLORS.gray,
    marginTop: 16,
  },
  emptyCartImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
    tintColor: COLORS.gray,
    opacity: 0.5,
  },
  footerContainer: {
    backgroundColor: COLORS.white,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    padding: 20,
    borderRadius: 10,
    width: '80%',
    backgroundColor: COLORS.white,
  },
  priceModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.darkGray,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  hiddenItemContainer: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
    height: 110,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  priceAndQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  quantityText: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 12,
    marginRight: 8,
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalView: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: '30%',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.darkGray,
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray,
  },
  modalListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  modalItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
  },
  modalImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray2,
  },
  modalItemImage: {
    width: '100%',
    height: '100%',
  },
  modalItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  modalItemName: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  modalItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalStockText: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  modalPriceText: {
    ...FONTS.h4,
    color: COLORS.primary,
  },
  emptyListContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyListIcon: {
    width: 48,
    height: 48,
    tintColor: COLORS.gray,
    opacity: 0.5,
    marginBottom: 12,
  },
  emptyListText: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginTop: 12,
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
  },
  dateLabel: {
    ...FONTS.body4,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  globalDatePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  calendarIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary,
  },
  datePickerText: {
    ...FONTS.body4,
    color: COLORS.darkGray,
  },
  // Drafts Section Styles
  draftsSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  draftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  draftsTitle: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontWeight: '600',
    fontSize: 14,
  },
  draftsToggle: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontSize: 12,
  },
  draftsList: {
    marginTop: 8,
  },
  draftCard: {
    width: 200,
    marginRight: 12,
    backgroundColor: COLORS.lightGray2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
  },
  draftCardContent: {
    padding: 12,
  },
  draftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  draftInvoiceNo: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  draftDeleteIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary,
  },
  draftCustomer: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 12,
    marginBottom: 4,
  },
  draftDate: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontSize: 11,
    marginBottom: 8,
  },
  draftAmount: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  draftsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  draftsLoadingText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginLeft: 8,
    fontSize: 12,
  },
  // Save Draft Button Styles
  saveDraftButton: {
    backgroundColor: COLORS.primary2,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveDraftButtonDisabled: {
    opacity: 0.6,
  },
  saveDraftButtonUpdating: {
    backgroundColor: COLORS.primary,
  },
  saveDraftButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Cart;
