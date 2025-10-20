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
} from 'react-native';
import {SwipeListView} from 'react-native-swipe-list-view';
import {
  createSales,
  postItemJournal,
  searchItems,
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

    dispatch({
      type: 'CART_ADD_ITEM',
      payload: {
        ...item,
        quantity,
        date_sold: currentDate,
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

    // Navigate back to home
    setTimeout(() => {
      navigation.navigate('Cart');
    }, 2000);
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
      <FooterTotal
        subTotal={subTotal}
        totalQuantity={subQuantity}
        total={total}
        printReceipt={printReceipt}
        setPrintReceipt={setPrintReceipt}
        onPress={() => handlePlaceOrder(total)}
        isLoading={isPlacingOrder}
      />
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
                    text2: `${item.item_name} has been added to your cart.`,
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
    setSelectedDate(new Date());
    setPriceModalVisible(true);
  };

  const updatePrice = () => {
    if (selectedItem) {
      const updatedItem = {
        ...(selectedItem as CartItem),
        unit_price: parseFloat(newPrice),
        date_sold: selectedDate.toISOString(),
      };

      dispatch({type: 'CART_UPDATE_ITEM', payload: updatedItem});
    }
    setPriceModalVisible(false);
  };

  const onDateChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(Platform.OS === 'ios');
    setSelectedDate(currentDate);
  };

  const renderPriceModal = () => (
    <Modal
      visible={isPriceModalVisible}
      transparent={true}
      animationType="slide">
      <View style={styles.modalContainer}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor:
                colorScheme === 'dark' ? COLORS.darkGray : COLORS.white,
            },
          ]}>
          <Text
            style={[
              styles.priceModalTitle,
              {color: colorScheme === 'dark' ? COLORS.white : COLORS.black},
            ]}>
            Update Price
          </Text>
          <TextInput
            style={[
              styles.input,
              {color: colorScheme === 'dark' ? COLORS.white : COLORS.black},
            ]}
            value={newPrice.toLocaleString()}
            onChangeText={setNewPrice}
            keyboardType="numeric"
            placeholder="Enter new price"
            placeholderTextColor={
              colorScheme === 'dark' ? COLORS.lightGray : COLORS.gray
            }
          />
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}>
            <Text
              style={{
                color: colorScheme === 'dark' ? COLORS.white : COLORS.black,
              }}>
              {selectedDate.toDateString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              themeVariant={colorScheme || 'light'}
              style={{
                backgroundColor:
                  colorScheme === 'dark' ? COLORS.darkGray : COLORS.white,
              }}
            />
          )}
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
            title="CART"
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
                      <Text style={styles.dateText}>
                        {formatDate(item.date_sold)}
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
                <Text style={styles.emptyCartText}>Your cart is empty</Text>
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
  },
  priceModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
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
});

export default Cart;
