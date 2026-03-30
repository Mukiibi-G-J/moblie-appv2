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
  PermissionsAndroid,
  Dimensions,
} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';
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
  fetchAllItemLedgerEntries,
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
import SalesCompletionModal from '../../Components/SalesCompletionModal';
import {useSearchMode} from '../../context/SearchModeStore';
import TrackingSelectionModal from '../../Components/TrackingSelectionModal';
import SalesItemBrowser from '../../Components/SalesItemBrowser';
import {
  buildFifoTrackingOptions,
  shouldEnforceTrackingSelection,
  trackingDetailsFromOption,
  validateCartTracking,
} from '../../utils/salesTracking';
import type {TrackingLotOption} from '../../utils/salesTracking';
import {playBarcodeBeep} from '../../utils/barcodeFeedback';
// import {SaleResult} from '../../services/SalesService';
// PrinterTestButton import removed - keeping test code in PrintService

const SCANNER_VIEWPORT_HEIGHT = Math.round(SIZES.height * 0.18);
const FULL_SWIPE_DELETE_THRESHOLD = Math.round(Dimensions.get('window').width * 0.68);

const formatDate = (date: Date | string | undefined) => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatMoney = (value: number | string | undefined | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '0.00';
  }
  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const Cart = ({
  navigation,
  isTabMode = false,
}: {
  navigation: any;
  isTabMode?: boolean;
}) => {
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
  const {state: searchModeState} = useSearchMode();
  
  // Drafts state
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftsModalVisible, setDraftsModalVisible] = useState(false);
  const [loadingDraftIntoCart, setLoadingDraftIntoCart] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null); // Track loaded draft
  const [currentDraftSystemId, setCurrentDraftSystemId] = useState<string | null>(null); // Track loaded draft system_id

  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingModalItem, setTrackingModalItem] = useState<CartItem | null>(
    null,
  );
  const [trackingOptions, setTrackingOptions] = useState<TrackingLotOption[]>(
    [],
  );
  const [loadingTrackingOptions, setLoadingTrackingOptions] = useState(false);
  const [saleCustomers, setSaleCustomers] = useState<Customer[]>([]);
  const [loadingSaleCustomers, setLoadingSaleCustomers] = useState(false);
  const [selectedSaleCustomer, setSelectedSaleCustomer] = useState<Customer | null>(
    null,
  );
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customerPickerQuery, setCustomerPickerQuery] = useState('');
  const [reviewSaleVisible, setReviewSaleVisible] = useState(false);
  const [saleActionsVisible, setSaleActionsVisible] = useState(false);
  const swipeDeletingIdsRef = useRef<Set<string>>(new Set());

  /** Android embedded scanner */
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    Platform.OS === 'android' ? null : false,
  );
  const [scannerTorchOn, setScannerTorchOn] = useState(false);
  const lastEmbeddedScanRef = useRef<{value: string; at: number} | null>(null);

  const requestCartCameraPermission = React.useCallback(async () => {
    if (Platform.OS !== 'android') {
      setCameraPermission(false);
      return;
    }
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera permission',
          message: 'Camera access is needed to scan barcodes on this screen.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      setCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      setCameraPermission(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !searchModeState.barcodeScannerEnabled) {
      setCameraPermission(Platform.OS === 'android' ? null : false);
      return;
    }
    requestCartCameraPermission();
  }, [searchModeState.barcodeScannerEnabled, requestCartCameraPermission]);

  useEffect(() => {
    if (!isFocused) {
      setScannerTorchOn(false);
    }
  }, [isFocused]);

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
      loadSaleCustomers();
    }
  }, [isFocused]);

  useEffect(() => {
    if (drafts.length === 0 && draftsModalVisible) {
      setDraftsModalVisible(false);
    }
  }, [drafts.length, draftsModalVisible]);

  const loadSaleCustomers = async () => {
    try {
      setLoadingSaleCustomers(true);
      const customersData = await fetchCustomers();
      setSaleCustomers(customersData);

      const generalCustomer =
        customersData.find(customer => {
          const name = customer.name?.trim().toLowerCase() || '';
          const no = customer.no?.trim().toLowerCase() || '';
          return (
            name === 'general' ||
            name === 'general customer' ||
            no.includes('gen')
          );
        }) || null;

      setSelectedSaleCustomer(previous => previous ?? generalCustomer);
    } catch (error) {
      console.error('Failed to load sale customers:', error);
      setSaleCustomers([]);
    } finally {
      setLoadingSaleCustomers(false);
    }
  };

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

  const openBarcodeScanner = () => {
    if (!searchModeState.barcodeScannerEnabled) {
      Toast.show({
        type: 'info',
        text1: 'Scanner Disabled',
        text2: 'Enable barcode scanner in Settings to use camera scan.',
        visibilityTime: 3000,
        position: 'top',
      });
      return;
    }

    navigation.navigate('BarcodeScanner', {
      onScan: (scannedCode: string) => handleSearch(scannedCode),
    });
  };

  const handleEmbeddedBarcodeRead = (event: {
    nativeEvent?: {codeStringValue?: string};
  }) => {
    const scannedCode = event?.nativeEvent?.codeStringValue?.trim();
    if (!scannedCode) {
      return;
    }
    const now = Date.now();
    const last = lastEmbeddedScanRef.current;
    if (last && last.value === scannedCode && now - last.at < 1500) {
      return;
    }
    lastEmbeddedScanRef.current = {value: scannedCode, at: now};
    if (searchModeState.barcodeBeepEnabled) {
      playBarcodeBeep();
    }
    handleSearch(scannedCode);
  };

  const showEmbeddedScanner =
    Platform.OS === 'android' &&
    searchModeState.barcodeScannerEnabled &&
    cameraPermission === true &&
    isFocused;

  const showScanShortcutButton =
    searchModeState.barcodeScannerEnabled &&
    (Platform.OS !== 'android' || cameraPermission === false);

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

    const trackingValidation = validateCartTracking(cartItems);
    if (!trackingValidation.ok) {
      Toast.show({
        type: 'error',
        text1: 'Tracking required',
        text2: trackingValidation.message,
        visibilityTime: 4500,
        position: 'top',
      });
      return;
    }

    // Show sales completion modal
    setShowSalesModal(true);
  };

  const openTrackingModal = async (item: CartItem) => {
    setTrackingModalItem(item);
    setTrackingModalVisible(true);
    setTrackingOptions([]);
    setLoadingTrackingOptions(true);
    try {
      const itemNo = item.no || item.system_id;
      const raw = await fetchAllItemLedgerEntries(itemNo);
      const fifo = buildFifoTrackingOptions(raw);
      setTrackingOptions(fifo);
      if (fifo.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'No lots available',
          text2:
            'No ledger lots with quantity for this item, or stock was received without lot numbers.',
          visibilityTime: 4000,
          position: 'top',
        });
      }
    } catch (e) {
      console.error('Failed to load item ledger entries:', e);
      Toast.show({
        type: 'error',
        text1: 'Could not load lots',
        text2: 'Check your connection and try again.',
        visibilityTime: 3500,
        position: 'top',
      });
      setTrackingOptions([]);
    } finally {
      setLoadingTrackingOptions(false);
    }
  };

  const handleTrackingLotSelected = (option: TrackingLotOption) => {
    const target = trackingModalItem;
    if (!target) {
      return;
    }
    const updated: CartItem = {
      ...target,
      selectedTrackingCode: option.lot_no,
      trackingDetails: trackingDetailsFromOption(option),
    };
    dispatch({type: 'CART_UPDATE_ITEM', payload: updated});
    setTrackingModalVisible(false);
    setTrackingModalItem(null);
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

    const trackingValidation = validateCartTracking(cartItems);
    if (!trackingValidation.ok) {
      Toast.show({
        type: 'error',
        text1: 'Tracking required',
        text2: trackingValidation.message,
        visibilityTime: 4500,
        position: 'top',
      });
      return;
    }

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
            type: itemDetails?.type,
            selectedTrackingCode: line.tracking_code || '',
            tracking_code: itemDetails?.tracking_code ?? null,
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

      setDraftsModalVisible(false);
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
        {!isTabMode ? (
          <View style={styles.footerTopCombined}>
            <View style={styles.footerDateBlock}>
              <Text style={styles.dateLabel}>Selling date</Text>
              <TouchableOpacity
                style={styles.globalDatePickerButton}
                onPress={() => setShowGlobalDatePicker(true)}>
                <Image source={icons.calender} style={styles.calendarIcon} />
                <Text style={styles.datePickerText} numberOfLines={1}>
                  {globalSellingDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            {cartItems.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.saveDraftButtonInline,
                  isSavingDraft && styles.saveDraftButtonDisabled,
                  currentDraftId && styles.saveDraftButtonUpdating,
                ]}
                onPress={handleSaveDraft}
                disabled={
                  isSavingDraft || (!currentDraftId && drafts.length >= 3)
                }>
                {isSavingDraft ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveDraftButtonText} numberOfLines={1}>
                    {currentDraftId ? 'Update Draft' : 'Save Draft'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Date Picker Modal */}
        {showGlobalDatePicker && !isTabMode && (
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

        <FooterTotal
          subTotal={subTotal}
          totalQuantity={subQuantity}
          total={total}
          printReceipt={printReceipt}
          setPrintReceipt={setPrintReceipt}
          onPress={() => setReviewSaleVisible(true)}
          isLoading={isPlacingOrder}
        />
      </View>
    );
  }

  const filteredSaleCustomers = saleCustomers.filter(customer => {
    const query = customerPickerQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      customer.name?.toLowerCase().includes(query) ||
      customer.no?.toLowerCase().includes(query)
    );
  });

  const isGeneralSaleCustomer = (() => {
    const normalizedName = selectedSaleCustomer?.name?.trim().toLowerCase() || '';
    return normalizedName === 'general' || normalizedName === 'general customer';
  })();

  const renderCustomerPicker = () => (
    <ReactNativeModal
      isVisible={customerPickerVisible}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onBackdropPress={() => setCustomerPickerVisible(false)}
      style={styles.modal}
      backdropOpacity={0.3}
      useNativeDriver={true}
      onBackButtonPress={() => {
        setCustomerPickerVisible(false);
        return true;
      }}>
      <View style={styles.modalView}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select customer</Text>
          <TouchableOpacity
            onPress={() => setCustomerPickerVisible(false)}
            style={styles.closeButton}>
            <Image source={icons.cross} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.saleCustomerSearchWrap}>
          <Image source={icons.search} style={styles.saleCustomerSearchIcon} />
          <TextInput
            value={customerPickerQuery}
            onChangeText={setCustomerPickerQuery}
            placeholder="Search customers..."
            placeholderTextColor={COLORS.gray}
            style={styles.saleCustomerSearchInput}
          />
        </View>

        {loadingSaleCustomers ? (
          <View style={styles.saleCustomerStateWrap}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
            <Text style={styles.saleCustomerStateText}>Loading customers...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredSaleCustomers}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => {
              const isSelected = selectedSaleCustomer?.id === item.id;

              return (
                <TouchableOpacity
                  style={[
                    styles.saleCustomerRow,
                    isSelected && styles.saleCustomerRowSelected,
                  ]}
                  onPress={() => {
                    setSelectedSaleCustomer(item);
                    setCustomerPickerVisible(false);
                    setCustomerPickerQuery('');
                  }}
                  activeOpacity={0.75}>
                  <View style={styles.saleCustomerAvatar}>
                    <Text style={styles.saleCustomerAvatarText}>
                      {(item.name || 'C')
                        .trim()
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(part => part[0])
                        .join('')
                        .toUpperCase() || 'C'}
                    </Text>
                  </View>
                  <View style={styles.saleCustomerTextWrap}>
                    <Text style={styles.saleCustomerName}>{item.name}</Text>
                    <Text style={styles.saleCustomerMeta}>{item.no}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.saleCustomerListContent}
            ListEmptyComponent={
              <View style={styles.saleCustomerStateWrap}>
                <Text style={styles.saleCustomerStateText}>
                  No customers match that search.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </ReactNativeModal>
  );

  const renderReviewSaleSheet = () => {
    const total = cartItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0,
    );
    const quantity = cartItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    );

    return (
      <ReactNativeModal
        isVisible={reviewSaleVisible}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        onBackdropPress={() => setReviewSaleVisible(false)}
        style={styles.reviewSaleModal}
        backdropOpacity={0.28}
        useNativeDriver={true}
        onBackButtonPress={() => {
          setReviewSaleVisible(false);
          return true;
        }}>
        <View style={styles.currentSalePanel}>
          <View style={styles.currentSaleHandle} />

          <View style={styles.currentSaleHeader}>
            <TouchableOpacity
              style={styles.currentSaleCloseButton}
              onPress={() => setReviewSaleVisible(false)}
              activeOpacity={0.75}>
              <Image source={icons.cross} style={styles.currentSaleCloseIcon} />
            </TouchableOpacity>
            <Text style={styles.currentSaleTitle}>Current sale ({cartItems.length})</Text>
            <TouchableOpacity
              style={styles.currentSaleMoreButton}
              onPress={() => setSaleActionsVisible(true)}
              activeOpacity={0.75}>
              <Text style={styles.currentSaleMoreText}>...</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.customerRow}
            onPress={() => setCustomerPickerVisible(true)}
            activeOpacity={0.78}>
            <View style={styles.customerRowIconWrap}>
              <Image source={icons.profile} style={styles.customerRowIcon} />
              <Image source={icons.plus} style={styles.customerRowPlusIcon} />
            </View>
            <View style={styles.customerRowTextWrap}>
              <Text style={styles.customerRowTitle}>
                {selectedSaleCustomer && !isGeneralSaleCustomer
                  ? selectedSaleCustomer.name
                  : 'Add customer'}
              </Text>
              <Text style={styles.customerRowSubtitle}>
                {selectedSaleCustomer
                  ? selectedSaleCustomer.no
                  : loadingSaleCustomers
                    ? 'Loading customers...'
                    : 'Choose a customer for this sale'}
              </Text>
            </View>
            <Image source={icons.down_arrow} style={styles.customerRowChevron} />
          </TouchableOpacity>

          <SwipeListView
            data={cartItems}
            extraData={cartItems}
            keyExtractor={(item: any) => `${item.system_id}`}
            renderItem={({item}: {item: any}) => (
              <View style={styles.squareCartItemWrapper}>
                <View style={styles.squareCartItem}>
                  <View style={styles.squareCartTextWrap}>
                    <Text style={styles.squareCartItemName} numberOfLines={1}>
                      {item.item_name}
                      {(Number(item.quantity) || 1) > 1
                        ? ` x ${Number(item.quantity)}`
                        : ''}
                    </Text>
                    {item.tracking_code ? (
                      <TouchableOpacity
                        onPress={() => openTrackingModal(item)}
                        activeOpacity={0.7}
                        style={[
                          styles.trackingChip,
                          shouldEnforceTrackingSelection(item) &&
                            !(item.selectedTrackingCode || '').trim() &&
                            styles.trackingChipWarning,
                        ]}>
                        <Text style={styles.trackingChipText} numberOfLines={1}>
                          Lot:{' '}
                          {(item.selectedTrackingCode || '').trim() ||
                            'Tap to select'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.squareCartRight}>
                    <TouchableOpacity
                      style={styles.squarePriceButton}
                      onPress={() => openPriceModal(item)}>
                      <Text style={styles.squareCartAmount}>
                        USh{(
                          (Number(item.unit_price) || 0) *
                          (Number(item.quantity) || 1)
                        ).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </TouchableOpacity>
                    <StepperInput
                      containerStyle={styles.squareStepper}
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
            renderHiddenItem={() => (
              <View style={styles.hiddenItemContainer}>
                <View style={styles.deleteSwipeIndicator}>
                  <Image
                    source={icons.delete_icon}
                    style={styles.deleteSwipeIcon}
                  />
                </View>
              </View>
            )}
            rightOpenValue={-75}
            stopRightSwipe={-Dimensions.get('window').width}
            disableRightSwipe
            swipeToOpenPercent={30}
            onSwipeValueChange={({key, value}: {key: string; value: number}) => {
              if (
                value <= -FULL_SWIPE_DELETE_THRESHOLD &&
                !swipeDeletingIdsRef.current.has(String(key))
              ) {
                swipeDeletingIdsRef.current.add(String(key));
                dispatch({
                  type: 'REMOVE_FROM_CART',
                  payload: {system_id: String(key)},
                });
                setTimeout(() => {
                  swipeDeletingIdsRef.current.delete(String(key));
                }, 350);
              }
            }}
            contentContainerStyle={styles.squareCartListContent}
            ListEmptyComponent={
              <View style={styles.emptyCartContainer}>
                <Image source={icons.emptycart} style={styles.emptyCartImage} />
                <Text style={styles.emptyCartText}>
                  No items in sale. Start adding items to make a sale.
                </Text>
              </View>
            }
          />

          <View style={styles.reviewSaleFooter}>
            <FooterTotal
              subTotal={total}
              totalQuantity={quantity}
              total={total}
              printReceipt={printReceipt}
              setPrintReceipt={setPrintReceipt}
              onPress={() => {
                setReviewSaleVisible(false);
                handlePlaceOrder(total);
              }}
              isLoading={isPlacingOrder}
            />
          </View>
        </View>
      </ReactNativeModal>
    );
  };

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
                      UGX {formatMoney(item.unit_price)}
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

  const renderSaleActionsSheet = () => (
    <ReactNativeModal
      isVisible={saleActionsVisible}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onBackdropPress={() => setSaleActionsVisible(false)}
      style={styles.saleActionsModal}
      backdropOpacity={0.28}
      useNativeDriver={true}
      onBackButtonPress={() => {
        setSaleActionsVisible(false);
        return true;
      }}>
      <View style={styles.saleActionsSheet}>
        <View style={styles.saleActionsHandle} />
        <TouchableOpacity
          style={[
            styles.saleActionsPrimaryButton,
            cartItems.length === 0 && styles.saleActionsPrimaryButtonDisabled,
          ]}
          disabled={cartItems.length === 0}
          activeOpacity={0.85}
          onPress={async () => {
            await dispatch({type: 'CLEAR_CART'});
            setSaleActionsVisible(false);
          }}>
          <Text
            style={[
              styles.saleActionsPrimaryText,
              cartItems.length === 0 && styles.saleActionsPrimaryTextDisabled,
            ]}>
            Clear items
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saleActionsDismissButton}
          activeOpacity={0.75}
          onPress={() => setSaleActionsVisible(false)}>
          <Text style={styles.saleActionsDismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
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

  const closeDraftsModal = () => setDraftsModalVisible(false);

  const renderDraftsModal = () => (
    <ReactNativeModal
      isVisible={draftsModalVisible && drafts.length > 0}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onBackdropPress={closeDraftsModal}
      style={styles.modal}
      avoidKeyboard={true}
      backdropOpacity={0.3}
      useNativeDriver={true}
      onBackButtonPress={() => {
        closeDraftsModal();
        return true;
      }}>
      <View style={styles.modalView}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Recent drafts</Text>
          <TouchableOpacity onPress={closeDraftsModal} style={styles.closeButton}>
            <Image source={icons.cross} style={styles.closeIcon} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.draftsModalList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {drafts.map((draft: any) => (
            <View
              key={draft.id}
              style={[styles.draftCard, styles.draftCardInModal]}>
              <TouchableOpacity
                style={styles.draftCardContent}
                onPress={() => handleSelectDraft(draft)}
                disabled={loadingDraftIntoCart}>
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
      </View>
    </ReactNativeModal>
  );

  return (
    <SafeAreaView style={{flex: 1}} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={{flex: 1}}>
          {!isTabMode ? (
            <Header
              title="Make Sale"
              showBack={!isTabMode}
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
          ) : null}

          {Platform.OS === 'android' && searchModeState.barcodeScannerEnabled && (
            <View style={styles.embeddedScannerSection}>
              {cameraPermission === null && (
                <View
                  style={[
                    styles.scannerPlaceholder,
                    {minHeight: SCANNER_VIEWPORT_HEIGHT},
                  ]}>
                  <ActivityIndicator color={COLORS.primary2} />
                  <Text style={styles.scannerPlaceholderText}>
                    Preparing camera…
                  </Text>
                </View>
              )}
              {cameraPermission === false && (
                <View
                  style={[
                    styles.scannerPlaceholder,
                    {minHeight: SCANNER_VIEWPORT_HEIGHT},
                  ]}>
                  <Text style={styles.scannerPlaceholderText}>
                    Allow camera access to scan barcodes on this screen.
                  </Text>
                  <TouchableOpacity
                    style={styles.scannerPermissionButton}
                    onPress={requestCartCameraPermission}
                    activeOpacity={0.8}>
                    <Text style={styles.scannerPermissionButtonText}>
                      Grant access
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {showEmbeddedScanner && (
                <View
                  style={[
                    styles.scannerViewport,
                    {height: SCANNER_VIEWPORT_HEIGHT},
                  ]}>
                  <Camera
                    style={StyleSheet.absoluteFill}
                    cameraType={CameraType.Back}
                    scanBarcode
                    showFrame
                    laserColor={COLORS.primary2}
                    frameColor={COLORS.white}
                    onReadCode={handleEmbeddedBarcodeRead}
                    torchMode={scannerTorchOn ? 'on' : 'off'}
                  />
                  <View style={styles.scannerOverlay} pointerEvents="box-none">
                    <Text style={styles.scannerHintText}>
                      Scan Product Code
                    </Text>
                    <TouchableOpacity
                      style={styles.scannerTorchButton}
                      onPress={() => setScannerTorchOn(v => !v)}
                      activeOpacity={0.85}
                      accessibilityLabel="Toggle flashlight">
                      <Text style={styles.scannerTorchGlyph}>🔦</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          <SalesItemBrowser
            onAddItem={item => {
              addToCart(item);
            }}
            onScanPress={openBarcodeScanner}
            showScanButton={showScanShortcutButton}
          />

          {drafts.length > 0 && !isTabMode && (
            <View style={styles.salesBrowserMetaRow}>
              <TouchableOpacity
                style={styles.draftsOpenButton}
                onPress={() => setDraftsModalVisible(true)}
                activeOpacity={0.7}>
                <Text
                  style={styles.draftsOpenButtonText}
                  numberOfLines={1}>
                  Drafts ({drafts.length}/3)
                </Text>
              </TouchableOpacity>
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
          {renderDraftsModal()}

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
            initialSelectedCustomer={selectedSaleCustomer}
          />

          <TrackingSelectionModal
            visible={trackingModalVisible}
            title={
              trackingModalItem
                ? `Select lot — ${trackingModalItem.item_name}`
                : 'Select lot'
            }
            loading={loadingTrackingOptions}
            options={trackingOptions}
            onClose={() => {
              setTrackingModalVisible(false);
              setTrackingModalItem(null);
            }}
            onSelect={handleTrackingLotSelected}
          />

          <Toast />
          {renderCustomerPicker()}
          {renderReviewSaleSheet()}
          {renderSaleActionsSheet()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  embeddedScannerSection: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
  },
  scannerViewport: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.black,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  scannerHintText: {
    ...FONTS.body4,
    color: COLORS.white,
    marginBottom: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  scannerTorchButton: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTorchGlyph: {
    fontSize: 18,
  },
  scannerPlaceholder: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    backgroundColor: COLORS.lightGray2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding,
  },
  scannerPlaceholderText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.base,
  },
  scannerPermissionButton: {
    marginTop: SIZES.padding,
    backgroundColor: COLORS.primary2,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
  },
  scannerPermissionButtonText: {
    color: COLORS.white,
    ...FONTS.h4,
  },
  orderItemsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
    paddingBottom: 4,
  },
  orderItemsTitle: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  orderItemsCount: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginLeft: 6,
  },
  currentSalePanel: {
    height: '82%',
    marginHorizontal: 12,
    marginTop: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  currentSaleHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    alignSelf: 'center',
    marginBottom: 10,
    opacity: 0.22,
  },
  currentSaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.transparentPrimary2,
  },
  currentSaleCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentSaleCloseIcon: {
    width: 13,
    height: 13,
    tintColor: COLORS.primary2,
  },
  currentSaleTitle: {
    ...FONTS.h3,
    flex: 1,
    textAlign: 'center',
    color: COLORS.primary2,
    fontWeight: '700',
  },
  currentSaleMoreButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentSaleMoreText: {
    ...FONTS.h2,
    color: COLORS.primary2,
    lineHeight: 22,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.transparentPrimary2,
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  customerRowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  customerRowIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary2,
  },
  customerRowPlusIcon: {
    width: 10,
    height: 10,
    tintColor: COLORS.primary2,
    position: 'absolute',
    right: 5,
    bottom: 6,
  },
  customerRowTextWrap: {
    flex: 1,
  },
  customerRowTitle: {
    ...FONTS.h3,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  customerRowSubtitle: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 3,
  },
  customerRowChevron: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary2,
    transform: [{rotate: '-90deg'}],
  },
  reviewSaleModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  saleActionsModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  reviewSaleFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.white,
  },
  saleActionsSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  saleActionsHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primary2,
    alignSelf: 'center',
    opacity: 0.2,
    marginBottom: 16,
  },
  saleActionsPrimaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleActionsPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  saleActionsPrimaryText: {
    ...FONTS.h3,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  saleActionsPrimaryTextDisabled: {
    color: COLORS.gray,
  },
  saleActionsDismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
    paddingBottom: 6,
  },
  saleActionsDismissText: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  squareCartListContent: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 16,
  },
  squareCartItemWrapper: {
    backgroundColor: COLORS.white,
  },
  squareCartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
  },
  squareCartTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  squareCartItemName: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  squareCartRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 118,
  },
  squarePriceButton: {
    marginBottom: 10,
  },
  squareCartAmount: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    fontWeight: '500',
  },
  squareStepper: {
    height: 38,
    width: 96,
    backgroundColor: '#F4F8FF',
    borderRadius: 12,
  },
  cartItemWrapper: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
  },
  cartItem: {
    minHeight: 124,
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
    justifyContent: 'center',
    paddingVertical: 8,
  },
  productInfoTop: {
    marginBottom: 8,
  },
  productName: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontSize: 12,
  },
  trackingChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F16D5B',
    maxWidth: '100%',
  },
  trackingChipWarning: {
    borderWidth: 1,
    borderColor: '#E53935',
  },
  trackingChipText: {
    ...FONTS.body5,
    fontSize: 11,
    color: COLORS.darkGray,
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
    marginRight: 8,
  },
  priceText: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontSize: 14,
  },
  quantityContainer: {
    marginLeft: 8,
  },
  deleteSwipeIndicator: {
    width: 75,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteSwipeIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.white,
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
    paddingTop: 0,
    paddingBottom: 0,
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
  saleCustomerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.lightGray2,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  saleCustomerSearchIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray,
  },
  saleCustomerSearchInput: {
    flex: 1,
    marginLeft: 10,
    ...FONTS.body4,
    color: COLORS.black,
  },
  saleCustomerListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  saleCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    marginBottom: 10,
  },
  saleCustomerRowSelected: {
    borderColor: COLORS.primary2,
    backgroundColor: COLORS.transparentPrimary2,
  },
  saleCustomerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  saleCustomerAvatarText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
  saleCustomerTextWrap: {
    flex: 1,
  },
  saleCustomerName: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  saleCustomerMeta: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 3,
  },
  saleCustomerStateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  saleCustomerStateText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginTop: 8,
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
    justifyContent: 'flex-start',
    width: '100%',
    flexWrap: 'wrap',
  },
  quantityText: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 12,
    marginRight: 8,
    marginTop: 2,
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
  footerTopCombined: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
    gap: 8,
  },
  footerDateBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    ...FONTS.body5,
    color: COLORS.darkGray,
    fontWeight: '600',
    flexShrink: 0,
  },
  globalDatePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
    minWidth: 0,
  },
  calendarIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.primary,
  },
  datePickerText: {
    ...FONTS.body5,
    color: COLORS.darkGray,
    flexShrink: 1,
  },
  // Search + drafts (same row)
  searchAndDraftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginVertical: SIZES.base,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
    gap: 8,
  },
  searchBarRowWrapper: {
    flex: 1,
    minWidth: 0,
  },
  searchBarInRow: {
    marginHorizontal: 0,
    marginVertical: 0,
    flex: 1,
  },
  draftsOpenButton: {
    borderWidth: 1,
    borderColor: COLORS.primary2,
    backgroundColor: COLORS.lightGray2,
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexShrink: 0,
    maxWidth: 120,
  },
  draftsOpenButtonText: {
    ...FONTS.h4,
    color: COLORS.primary2,
    fontSize: 14,
    fontWeight: '600',
  },
  salesBrowserMetaRow: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 6,
    alignItems: 'flex-end',
  },
  draftsModalList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  draftCardInModal: {
    width: '100%',
    marginRight: 0,
    marginBottom: 12,
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
  saveDraftButtonInline: {
    backgroundColor: COLORS.primary2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    maxWidth: '42%',
    flexShrink: 0,
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
    fontSize: 12,
    fontWeight: '600',
  },
});

export default Cart;
