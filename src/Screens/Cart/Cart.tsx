import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {formatCurrencyCompact, formatCurrencyLabel, getLocalCurrencyCode} from '../../utils/currency';
import {pickDefaultCashPaymentMethod} from '../../utils/paymentMethodDefaults';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Dimensions,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {
  createSales,
  fetchDraftSales,
  getSalesInvoice,
  updateSalesInvoice,
  createSalesInvoice,
  fetchCustomers,
  fetchPaymentMethods,
  Customer,
  PaymentMethod,
  fetchAllItemLedgerEntries,
  fetchItemTrackingByNo,
  fetchItemUnitsOfMeasure,
  ItemUnitOfMeasure,
} from '../../services/app.services';
import {searchItems as catalogSearchItems} from '../../services/itemCatalogService';
import {useOfflineOptional} from '../../context/OfflineContext';
import {PosConnectivityBadge} from '../../Components/PosConnectivityBadge';
import {
  getCartTrackingMode,
  getPosConnectivityMode,
  OFFLINE_LOT_PICKER_MESSAGE,
} from '../../utils/posConnectivity';
import Toast from 'react-native-toast-message';
import AppToastHost from '../../Components/AppToastHost';
import ReactNativeModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  FONTS,
  SIZES,
  COLORS,
  icons,
  dummyData,
  ICON_BUTTON_HIT_SLOP,
  ICON_BUTTON_QUICK_PRESS,
} from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import {
  CartQuantityButton,
  FooterTotal,
  Header,
  QuickIconPressable,
} from '../../Components';
import TodayMySalesBar from '../../Components/TodayMySalesBar';
import { useAppContext } from '../../context/Store';
import { usePermissions } from '../../hooks/usePermissions';
import { useSaleCustomersQuery } from '../../hooks/useSaleCustomersQuery';
import { useInvalidateSales } from '../../hooks/useSalesQuery';
import { useInvalidateItems } from '../../hooks/useItemsQuery';
import { PAGE_NAMES } from '../../constants/pageNames';
import { useCart } from '../../context/CartStore';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { handlePrint } from '../../Components/HandlePrint';
import { SalesPostData, CartItem } from '../../@types/types.dto';
import {
  isInventoryPosItem,
  isPosItemOutOfStock,
  posItemMaxSaleQuantity,
  posItemStockLabel,
} from '../../utils/posItemStock';
import SalesCompletionModal from '../../Components/SalesCompletionModal';
import { useSearchMode } from '../../context/SearchModeStore';
import { safeGoBack } from '../../hooks/NavigationService';
import TrackingSelectionModal from '../../Components/TrackingSelectionModal';
import UOMSelectionModal from '../../Components/UOMSelectionModal';
import SalesItemBrowser from '../../Components/SalesItemBrowser';
import { SwipeableCartLine } from '../../Components/SwipeableCartLine';
import {
  buildAvailableSerialOptions,
  buildFifoTrackingOptions,
  itemRequiresSerial,
  itemRequiresTracking,
  shouldEnforceTrackingSelection,
  trackingDetailsFromOption,
  validateCartTracking,
} from '../../utils/salesTracking';
import type { TrackingLotOption } from '../../utils/salesTracking';
import {
  POS_LOAD_UNPOSTED_EVENT,
  takePendingPosLoad,
  type PosLoadUnpostedPayload,
} from '../../utils/posInvoiceLoad';
import {showUserError, showUserSuccess} from '../../utils/userFeedback';
import {
  displayPriceForUom,
  resolvePosUnitPrice,
  resolvePricesForUoms,
  withCartUomDefaults,
} from '../../utils/posUom';
import { playBarcodeBeep } from '../../utils/barcodeFeedback';
// import {SaleResult} from '../../services/SalesService';
// PrinterTestButton import removed - keeping test code in PrintService

const SCANNER_VIEWPORT_HEIGHT = Math.round(SIZES.height * 0.18);

/** Caps customer list height so the sheet hugs content for short lists (avoids empty space from a tall minHeight). */
const SALE_CUSTOMER_PICKER_LIST_MAX_HEIGHT = Math.round(
  Dimensions.get('window').height * 0.52,
);

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
  const [modalItems, setModalItems] = useState < CartItem[] > ([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [cartItemEditorVisible, setCartItemEditorVisible] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState < CartItem | null > (null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { colors, resolvedScheme, isDark } = useTheme();
  const ct = useMemo(
    () => ({
      screen: { backgroundColor: colors.background },
      scannerPh: {
        borderColor: colors.border,
        backgroundColor: colors.screenMuted,
      },
      scannerPhText: { color: colors.textSecondary },
      orderHdrTitle: { color: colors.textPrimary },
      orderHdrCount: { color: colors.textSecondary },
      currentSalePanel: { backgroundColor: colors.surface },
      currentSaleHdr: { borderBottomColor: colors.border },
      customerRow: {
        backgroundColor: isDark ? 'rgba(0, 81, 81, 0.14)' : COLORS.transparentPrimary2,
      },
      customerIconWrap: { backgroundColor: colors.surface },
      reviewFooter: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      },
      saleActionsSheet: { backgroundColor: colors.surface },
      squareCartWrap: { backgroundColor: colors.surface },
      squareCartItem: { borderBottomColor: colors.border },
      squareCartName: { color: colors.textPrimary },
      squareCartAmt: { color: colors.textSecondary },
      emptyCartTxt: { color: colors.textSecondary },
      hiddenSwipeB: { borderBottomColor: colors.border },
      cartEditorScreen: { backgroundColor: colors.background },
      cartEditorHdr: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      },
      cartEditorBody: { backgroundColor: colors.background },
      cartEditorInfo: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      cartEditorInfoVal: { color: colors.textPrimary },
      cartEditorQtyAct: {
        borderColor: colors.border,
        backgroundColor: isDark ? 'rgba(0,81,81,0.1)' : COLORS.transparentPrimary,
      },
      cartEditorQtyValBr: { borderBottomColor: colors.border },
      cartEditorTrack: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      cartEditorTrackHint: { color: colors.textSecondary },
      modalSheet: { backgroundColor: colors.surface },
      modalHdr: { borderBottomColor: colors.border },
      modalTitle: { color: colors.textPrimary },
      closeIc: { tintColor: colors.iconMuted },
      saleCustSearch: { backgroundColor: colors.screenMuted },
      saleCustSearchIn: { color: colors.textPrimary },
      saleCustRow: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      saleCustRowSel: {
        borderColor: COLORS.primary2,
        backgroundColor: isDark ? 'rgba(0, 81, 81, 0.12)' : COLORS.transparentPrimary2,
      },
      saleCustName: { color: colors.textPrimary },
      saleCustMeta: { color: colors.textSecondary },
      saleCustState: { color: colors.textSecondary },
      modalItem: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      modalItemName: { color: colors.textPrimary },
      modalStock: { color: colors.textSecondary },
      modalImgBg: { backgroundColor: colors.screenMuted },
      emptyListTxt: { color: colors.textSecondary },
      footerTop: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      },
      dateLbl: { color: colors.textPrimary },
      globalDateBtn: { backgroundColor: colors.screenMuted },
      datePickTxt: { color: colors.textPrimary },
      footerWrap: { backgroundColor: 'transparent' },
      draftsLoad: { backgroundColor: colors.surface },
      draftsLoadTxt: { color: colors.textSecondary },
      draftsBtn: {
        borderColor: COLORS.primary2,
        backgroundColor: colors.screenMuted,
      },
      draftCard: {
        backgroundColor: colors.screenMuted,
        borderColor: colors.border,
      },
      draftInv: { color: colors.textPrimary },
      draftCust: { color: colors.textSecondary },
      draftDate: { color: colors.textSecondary },
      loadingTxt: { color: colors.textSecondary },
      saleActDismiss: { color: colors.textSecondary },
      draftsAccessBtn: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      draftsAccessIcon: { tintColor: colors.textPrimary },
      saleDateRow: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      saleDateLabel: { color: colors.textSecondary },
      saleDateValue: { color: colors.textPrimary },
      draftsHubSheet: { backgroundColor: colors.surface },
      draftsHubHdr: { borderBottomColor: colors.border },
      draftsHubTitle: { color: colors.textPrimary },
      draftsHubSubtitle: { color: colors.textSecondary },
      draftsHubSaveBtn: {
        backgroundColor: isDark ? 'rgba(0, 81, 81, 0.18)' : COLORS.transparentPrimary2,
        borderColor: COLORS.primary2,
      },
      draftsHubSaveText: { color: COLORS.primary2 },
      draftsHubEmpty: { color: colors.textSecondary },
    }),
    [colors, isDark],
  );

  const searchInputRef = useRef<TextInput>(null);
  const { state, dispatch } = useCart();
  const appContext = useAppContext();
  const { cartItems } = state;
  const auth = appContext?.auth;
  const { canRead, canCreate, canEdit, canDelete, hasAnyPageAccess } =
    usePermissions();
  const SALES_PAGE = PAGE_NAMES.SALES;
  const canViewSales = canRead(SALES_PAGE);
  const canOpenSalesHistory = hasAnyPageAccess(PAGE_NAMES.SALES_HISTORY);
  const [todayMySalesRefreshKey, setTodayMySalesRefreshKey] = useState(0);
  const canInsertSale = canCreate(SALES_PAGE);
  const showTodayMySales = canViewSales || canInsertSale;
  const canModifySale = canEdit(SALES_PAGE);
  const canRemoveSale = canDelete(SALES_PAGE);
  const canMutateCart = canInsertSale || canModifySale;
  const canUseDrafts = canInsertSale || canModifySale;
  const isFocused = useIsFocused();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [globalSellingDate, setGlobalSellingDate] = useState(new Date());
  const [showGlobalDatePicker, setShowGlobalDatePicker] = useState(false);
  const { state: searchModeState } = useSearchMode();
  const offlineCtx = useOfflineOptional();
  const isPosOnline =
    offlineCtx?.isOnline ?? getPosConnectivityMode() === 'online';

  // Drafts state
  const [drafts, setDrafts] = useState < any[] > ([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftsModalVisible, setDraftsModalVisible] = useState(false);
  const [loadingDraftIntoCart, setLoadingDraftIntoCart] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState < number | null > (null); // Track loaded draft
  const [currentDraftSystemId, setCurrentDraftSystemId] = useState < string | null > (null); // Track loaded draft system_id

  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingModalItem, setTrackingModalItem] = useState < CartItem | null > (
    null,
  );
  const [trackingOptions, setTrackingOptions] = useState < TrackingLotOption[] > (
    [],
  );
  const [loadingTrackingOptions, setLoadingTrackingOptions] = useState(false);
  const [uomModalVisible, setUomModalVisible] = useState(false);
  const [uomOptions, setUomOptions] = useState<ItemUnitOfMeasure[]>([]);
  const [uomResolvedPrices, setUomResolvedPrices] = useState<
    Record<string, number>
  >({});
  const [loadingUomOptions, setLoadingUomOptions] = useState(false);
  const {
    data: saleCustomers = [],
    isLoading: loadingSaleCustomers,
    refetch: refetchSaleCustomers,
  } = useSaleCustomersQuery();
  const invalidateSales = useInvalidateSales();
  const invalidateItems = useInvalidateItems();
  const [selectedSaleCustomer, setSelectedSaleCustomer] = useState < Customer | null > (
    null,
  );
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customerPickerQuery, setCustomerPickerQuery] = useState('');
  const [reviewSaleVisible, setReviewSaleVisible] = useState(false);
  const [saleActionsVisible, setSaleActionsVisible] = useState(false);
  const dismissReviewSaleSheet = useCallback(() => {
    setTrackingModalVisible(false);
    setTrackingModalItem(null);
    setCartItemEditorVisible(false);
    setEditingCartItem(null);
    setSaleActionsVisible(false);
    setCustomerPickerVisible(false);
    setCustomerPickerQuery('');
    setReviewSaleVisible(false);
  }, []);
  const cartItemsRef = useRef(null) as React.MutableRefObject<CartItem[]>;
  const trackingOptionsCacheRef = useRef(
    {} as Record<string, TrackingLotOption[]>,
  );
  const trackingPrefetchingKeysRef = useRef(
    new Set() as Set<string>,
  );

  /** Android embedded scanner */
  const [cameraPermission, setCameraPermission] = useState < boolean | null > (
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

  useFocusEffect(
    useCallback(() => {
      if (showTodayMySales) {
        setTodayMySalesRefreshKey(k => k + 1);
      }
    }, [showTodayMySales]),
  );

  cartItemsRef.current = cartItems;

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

  // Load drafts when screen is focused; customers come from React Query cache.
  useEffect(() => {
    if (isFocused) {
      loadDrafts();
      refetchSaleCustomers();
    }
  }, [isFocused, refetchSaleCustomers]);

  useEffect(() => {
    if (!saleCustomers.length) {
      return;
    }
    const generalCustomer =
      saleCustomers.find(customer => {
        const name = customer.name?.trim().toLowerCase() || '';
        const no = customer.no?.trim().toLowerCase() || '';
        return (
          name === 'general' ||
          name === 'general customer' ||
          no.includes('gen')
        );
      }) || null;
    setSelectedSaleCustomer(previous => previous ?? generalCustomer);
  }, [saleCustomers]);

  const openDraftsHub = useCallback(() => {
    setDraftsModalVisible(true);
    setSaleActionsVisible(false);
  }, []);

  useEffect(() => {
    if (showSalesModal && !canInsertSale) {
      setShowSalesModal(false);
    }
  }, [showSalesModal, canInsertSale]);

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
    if (!canMutateCart) {
      Toast.show({
        type: 'info',
        text1: 'Permission denied',
        text2: 'You cannot add items to this sale.',
        visibilityTime: 3000,
        position: 'top',
      });
      return;
    }
    const existItem = cartItemsRef.current.find(
      (x: CartItem) => x.system_id === item.system_id,
    );
    const quantity = existItem ? existItem.quantity + 1 : 1;

    if (isInventoryPosItem(item) && quantity > item.inventory) {
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

    const unitOfMeasure =
      existItem?.unit_of_measure ?? item.unit_of_measure ?? 'PCS';
    const quantityPerUnit =
      existItem?.quantity_per_unit ?? item.quantity_per_unit ?? 1;
    const catalogPrice = Number(item.unit_price) || 0;

    // Preserve UOM / sell price when increasing qty on an existing line.
    // New lines: stamp catalog price first, then resolve Sales Price List (web parity).
    const nextCartItem: CartItem = withCartUomDefaults({
      ...item,
      quantity,
      date_sold: currentDate,
      tracking_code: trackingConfig,
      selectedTrackingCode,
      trackingDetails,
      unit_of_measure: unitOfMeasure,
      unit_of_measure_description:
        existItem?.unit_of_measure_description ??
        item.unit_of_measure_description,
      quantity_per_unit: quantityPerUnit,
      original_price:
        existItem?.original_price ??
        item.original_price ??
        catalogPrice,
      unit_price: existItem?.unit_price ?? catalogPrice,
    });

    dispatch({
      type: 'CART_ADD_ITEM',
      payload: nextCartItem,
    });

    if (!existItem) {
      const itemNo = item.no || item.system_id;
      void resolvePosUnitPrice({
        itemNo,
        itemSystemId: item.system_id,
        unitOfMeasure,
        customerNo: selectedSaleCustomer?.no,
        quantity,
        fallbackBasePrice: catalogPrice,
      }).then(resolvedPrice => {
        if (!Number.isFinite(resolvedPrice)) {
          return;
        }
        const latest = cartItemsRef.current.find(
          (x: CartItem) => x.system_id === item.system_id,
        );
        if (!latest) {
          return;
        }
        dispatch({
          type: 'CART_UPDATE_ITEM',
          payload: withCartUomDefaults({
            ...latest,
            unit_price: resolvedPrice,
            original_price: resolvedPrice,
          }),
        });
      });
    }

    InteractionManager.runAfterInteractions(() => {
      void enrichAndPreloadTracking(nextCartItem);
    });

    setSearchQuery('');
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
      const results = await catalogSearchItems(itemCode);

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
            color: '#005151', // iOS-style blue for info
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
    nativeEvent?: { codeStringValue?: string };
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
    lastEmbeddedScanRef.current = { value: scannedCode, at: now };
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

  const salesBrowserAddRef = useRef(null) as React.MutableRefObject<
    (item: CartItem) => void
  >;
  const salesBrowserScanRef = useRef(null) as React.MutableRefObject<
    () => void
  >;
  salesBrowserAddRef.current = addToCart;
  salesBrowserScanRef.current = openBarcodeScanner;
  
  const handleSalesBrowserAddItem = useCallback((item: CartItem) => {
    salesBrowserAddRef.current(item);
  }, []);
  
  const handleSalesBrowserScanPress = useCallback(() => {
    salesBrowserScanRef.current();
  }, []);
  
  const openAllItemsCreate = useCallback(
    (itemType: 'Inventory' | 'Service') => {
      navigation.navigate('AllItems' as never, {
        reopenItemModal: 'create',
        itemDraft: {
          system_id: '',
          item_name: '',
          unit_price: 0,
          item_images: [],
          inventory: 0,
          description: '',
          type: itemType,
        },
      } as never);
    },
    [navigation],
  );
  
  const handleOpenCreateInventory = useCallback(() => {
    openAllItemsCreate('Inventory');
  }, [openAllItemsCreate]);
  
  const handleOpenCreateService = useCallback(() => {
    openAllItemsCreate('Service');
  }, [openAllItemsCreate]);

  if (!canViewSales) {
    return (
      <SafeAreaView style={[{ flex: 1 }, ct.screen]} edges={['top', 'left', 'right']}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            {"You don't have permission to use sales."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const openCartItemEditor = (item: CartItem) => {
    if (!canMutateCart) {
      Toast.show({
        type: 'info',
        text1: 'Permission denied',
        text2: 'You cannot edit cart lines.',
        visibilityTime: 3000,
        position: 'top',
      });
      return;
    }
    const opened = withCartUomDefaults({...item});
    setEditingCartItem(opened);
    setCartItemEditorVisible(true);
    void enrichCartItemTracking(opened);
  };
  
  const closeCartItemEditor = () => {
    setCartItemEditorVisible(false);
    setEditingCartItem(null);
    setUomModalVisible(false);
    setUomOptions([]);
    setUomResolvedPrices({});
  };

  const openUomModal = async () => {
    if (!canModifySale || !editingCartItem) {
      return;
    }
    const itemNo = editingCartItem.no || editingCartItem.system_id;
    if (!itemNo) {
      Toast.show({
        type: 'error',
        text1: 'Missing item number',
        text2: 'Cannot load units of measure for this line.',
        visibilityTime: 2500,
        position: 'top',
      });
      return;
    }

    setUomModalVisible(true);
    setLoadingUomOptions(true);
    setUomResolvedPrices({});
    try {
      const rows = await fetchItemUnitsOfMeasure(String(itemNo));
      setUomOptions(rows);
      const fallbackBase =
        editingCartItem.original_price != null &&
        Number.isFinite(Number(editingCartItem.original_price))
          ? Number(editingCartItem.original_price)
          : Number(editingCartItem.unit_price) || 0;
      const prices = await resolvePricesForUoms({
        itemNo: String(itemNo),
        customerNo: selectedSaleCustomer?.no,
        quantity: editingCartItem.quantity,
        uoms: rows,
        fallbackBasePrice: fallbackBase,
      });
      setUomResolvedPrices(prices);
    } catch (error) {
      console.error('Failed to load item UOMs:', error);
      setUomOptions([]);
      setUomResolvedPrices({});
      Toast.show({
        type: 'error',
        text1: 'Could not load units',
        text2: 'Check connection and try again.',
        visibilityTime: 2500,
        position: 'top',
      });
    } finally {
      setLoadingUomOptions(false);
    }
  };

  const handleUomSelected = (uom: ItemUnitOfMeasure) => {
    if (!editingCartItem || !canModifySale) {
      return;
    }
    const quantityPerUnit = uom.quantity_per_unit || 1;
    const fallbackBase =
      Number(editingCartItem.original_price) ||
      Number(editingCartItem.unit_price) ||
      0;
    const optimisticPrice =
      uomResolvedPrices[uom.unit_of_measure] ??
      displayPriceForUom(fallbackBase, uom);

    // Match web: unit_price and original_price both become the resolved UOM sell price.
    const updated: CartItem = withCartUomDefaults({
      ...editingCartItem,
      original_price: optimisticPrice,
      unit_of_measure: uom.unit_of_measure,
      unit_of_measure_description: uom.unit_of_measure_description,
      quantity_per_unit: quantityPerUnit,
      unit_price: optimisticPrice,
    });
    setEditingCartItem(updated);
    dispatch({type: 'CART_UPDATE_ITEM', payload: updated});
    setUomModalVisible(false);

    const itemNo = editingCartItem.no || editingCartItem.system_id;
    void resolvePosUnitPrice({
      itemNo,
      itemSystemId: editingCartItem.system_id,
      unitOfMeasure: uom.unit_of_measure,
      itemUnitOfMeasureId: uom.id,
      customerNo: selectedSaleCustomer?.no,
      quantity: editingCartItem.quantity,
      fallbackBasePrice: optimisticPrice,
      fallbackUom: uom,
    }).then(resolvedPrice => {
      if (!Number.isFinite(resolvedPrice) || resolvedPrice === optimisticPrice) {
        return;
      }
      const confirmed: CartItem = withCartUomDefaults({
        ...updated,
        unit_price: resolvedPrice,
        original_price: resolvedPrice,
      });
      setEditingCartItem(previous =>
        previous?.system_id === confirmed.system_id &&
        previous?.unit_of_measure === confirmed.unit_of_measure
          ? confirmed
          : previous,
      );
      dispatch({type: 'CART_UPDATE_ITEM', payload: confirmed});
    });
  };

  /** Quantity changes apply to the cart immediately (no Save tap), matching web POS. */
  const changeEditingCartItemQuantity = (delta: number) => {
    if (!canModifySale || !editingCartItem) {
      return;
    }

    const currentQty = Number(editingCartItem.quantity) || 1;
    const maxQty = posItemMaxSaleQuantity(editingCartItem, currentQty);
    const nextQty = Math.min(maxQty, Math.max(1, currentQty + delta));

    if (nextQty === currentQty) {
      return;
    }

    const updated: CartItem = {
      ...editingCartItem,
      quantity: nextQty,
    };
    setEditingCartItem(updated);
    dispatch({ type: 'CART_UPDATE_ITEM', payload: updated });
  };

  const removeEditingCartItem = () => {
    if (!editingCartItem || !canModifySale) {
      return;
    }

    dispatch({
      type: 'REMOVE_FROM_CART',
      payload: { system_id: editingCartItem.system_id },
    });
    closeCartItemEditor();
  };
  
  function toggleModal() {
    setIsModalVisible(!isModalVisible);
  }
  
  const getTrackingCacheKey = (item: CartItem, mode?: 'lot' | 'serial') => {
    const base = String(item.no || item.system_id);
    if (mode) {
      return `${base}:${mode}`;
    }
    if (itemRequiresSerial(item)) {
      return `${base}:serial`;
    }
    return `${base}:lot`;
  };

  /** Fetch tracking_code from REST when page-data catalog omitted it. */
  const enrichCartItemTracking = async (item: CartItem): Promise<CartItem> => {
    if (itemRequiresTracking(item)) {
      return item;
    }
    const itemNo = String(item.no || '').trim();
    if (!itemNo || !isPosOnline) {
      return item;
    }
    try {
      const tracking = await fetchItemTrackingByNo(itemNo);
      if (!tracking) {
        return item;
      }
      const latest =
        cartItemsRef.current.find(c => c.system_id === item.system_id) || item;
      const updated: CartItem = {...latest, tracking_code: tracking};
      dispatch({type: 'CART_UPDATE_ITEM', payload: updated});
      if (
        cartItemEditorVisible &&
        editingCartItem &&
        editingCartItem.system_id === item.system_id
      ) {
        setEditingCartItem(updated);
      }
      return updated;
    } catch (error) {
      console.warn('enrichCartItemTracking failed:', error);
      return item;
    }
  };

  const enrichAndPreloadTracking = async (item: CartItem) => {
    const enriched = await enrichCartItemTracking(item);
    await preloadTrackingForItem(enriched);
  };

  const preloadTrackingForItem = async (item: CartItem) => {
    if (!shouldEnforceTrackingSelection(item)) {
      return;
    }
    // Serials need explicit pick (qty match) — do not auto-select.
    if (itemRequiresSerial(item)) {
      return;
    }

    const cacheKey = getTrackingCacheKey(item, 'lot');
    if (
      trackingOptionsCacheRef.current[cacheKey] ||
      trackingPrefetchingKeysRef.current.has(cacheKey)
    ) {
      return;
    }

    trackingPrefetchingKeysRef.current.add(cacheKey);

    try {
      const raw = await fetchAllItemLedgerEntries(
        String(item.no || item.system_id),
      );
      const fifo = buildFifoTrackingOptions(raw);
      trackingOptionsCacheRef.current[cacheKey] = fifo;

      if (fifo.length === 0) {
        return;
      }

      const currentCartItem = cartItemsRef.current.find(
        cartItem => cartItem.system_id === item.system_id,
      );

      if (
        !currentCartItem ||
        (currentCartItem.selectedTrackingCode || '').trim()
      ) {
        return;
      }

      const preferredLot = fifo[0];
      const updatedCartItem: CartItem = {
        ...currentCartItem,
        selectedTrackingCode: preferredLot.lot_no,
        trackingDetails: trackingDetailsFromOption(preferredLot, 'lot'),
      };

      dispatch({
        type: 'CART_UPDATE_ITEM',
        payload: updatedCartItem,
      });

      if (
        cartItemEditorVisible &&
        editingCartItem &&
        editingCartItem.system_id === currentCartItem.system_id
      ) {
        setEditingCartItem(updatedCartItem);
      }
    } catch (error) {
      console.error('Failed to preload tracking options:', error);
    } finally {
      trackingPrefetchingKeysRef.current.delete(cacheKey);
    }
  };
  
  const handlePlaceOrder = async (total: number) => {
    if (isPlacingOrder) return;
  
    if (!canInsertSale) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'You do not have permission to complete sales.',
        visibilityTime: 3500,
        position: 'top',
      });
      return;
    }
  
    if (getCartTrackingMode(isPosOnline) === 'strict') {
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
    }
  
    // Show sales completion modal
    setShowSalesModal(true);
  };
  
  const openTrackingModal = async (item: CartItem) => {
    if (!isPosOnline) {
      Toast.show({
        type: 'info',
        text1: 'Offline',
        text2: OFFLINE_LOT_PICKER_MESSAGE,
        visibilityTime: 4500,
        position: 'top',
      });
      return;
    }

    const enriched = await enrichCartItemTracking(item);
    if (!itemRequiresTracking(enriched)) {
      Toast.show({
        type: 'info',
        text1: 'No tracking required',
        text2: 'This item is not set up for lot or serial tracking.',
        visibilityTime: 3500,
        position: 'top',
      });
      return;
    }

    const mode: 'lot' | 'serial' = itemRequiresSerial(enriched)
      ? 'serial'
      : 'lot';

    setTrackingModalItem(enriched);
    setTrackingModalVisible(true);

    const cacheKey = getTrackingCacheKey(enriched, mode);
    const cachedOptions = trackingOptionsCacheRef.current[cacheKey];
    if (cachedOptions) {
      setTrackingOptions(cachedOptions);
      setLoadingTrackingOptions(false);
      return;
    }

    setTrackingOptions([]);
    setLoadingTrackingOptions(true);
    try {
      const raw = await fetchAllItemLedgerEntries(
        String(enriched.no || enriched.system_id),
      );
      const options =
        mode === 'serial'
          ? buildAvailableSerialOptions(raw)
          : buildFifoTrackingOptions(raw);
      trackingOptionsCacheRef.current[cacheKey] = options;
      setTrackingOptions(options);
      if (options.length === 0) {
        Toast.show({
          type: 'info',
          text1: mode === 'serial' ? 'No serials available' : 'No lots available',
          text2:
            mode === 'serial'
              ? 'No ledger serials with quantity for this item.'
              : 'No ledger lots with quantity for this item, or stock was received without lot numbers.',
          visibilityTime: 4000,
          position: 'top',
        });
      }
    } catch (e) {
      console.error('Failed to load item ledger entries:', e);
      Toast.show({
        type: 'error',
        text1: mode === 'serial' ? 'Could not load serials' : 'Could not load lots',
        text2: 'Check your connection and try again.',
        visibilityTime: 3500,
        position: 'top',
      });
      setTrackingOptions([]);
    } finally {
      setLoadingTrackingOptions(false);
    }
  };

  const applyTrackingUpdate = (updated: CartItem) => {
    dispatch({type: 'CART_UPDATE_ITEM', payload: updated});
    if (
      cartItemEditorVisible &&
      editingCartItem &&
      editingCartItem.system_id === updated.system_id
    ) {
      setEditingCartItem(updated);
    }
    setTrackingModalVisible(false);
    setTrackingModalItem(null);
  };

  const handleTrackingLotSelected = (option: TrackingLotOption) => {
    const target = trackingModalItem;
    if (!target) {
      return;
    }
    applyTrackingUpdate({
      ...target,
      selectedTrackingCode: option.lot_no,
      selectedSerialNos: undefined,
      trackingDetails: trackingDetailsFromOption(option, 'lot'),
    });
  };

  const handleSerialsConfirmed = (serialNos: string[]) => {
    const target = trackingModalItem;
    if (!target) {
      return;
    }
    const nextQty = Math.max(1, serialNos.length);
    applyTrackingUpdate({
      ...target,
      quantity: nextQty,
      selectedSerialNos: serialNos,
      // Keep a readable label in the editor row.
      selectedTrackingCode: serialNos.join(', '),
      trackingDetails: {
        serialNo: serialNos[0] || null,
        code: serialNos[0] || null,
      },
    });
  };
  
  const handleSaleSuccess = (_result: any) => {
    // Clear cart after successful sale
    dispatch({ type: 'CLEAR_CART' });
    // Clear current draft ID and system_id if set
    setCurrentDraftId(null);
    setCurrentDraftSystemId(null);
  
    // Refresh drafts after successful sale
    loadDrafts();
    setTodayMySalesRefreshKey(k => k + 1);
    invalidateSales();
    invalidateItems();
  
    // Tab Make Sale lives inside MainLayout (isTabMode). Navigating to stack "Cart"
    // mounts a second, full-screen Cart — wrong screen. Stay on the current tab.
    if (!isTabMode) {
      setTimeout(() => {
        navigation.navigate('Cart');
      }, 2000);
    }
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
  
    if (currentDraftId) {
      if (!canModifySale) {
        Toast.show({
          type: 'error',
          text1: 'Permission denied',
          text2: 'You cannot update drafts.',
          visibilityTime: 3500,
          position: 'top',
        });
        return;
      }
    } else if (!canInsertSale) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'You cannot save new drafts.',
        visibilityTime: 3500,
        position: 'top',
      });
      return;
    }
  
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
  
      // Prefer cached POS customers; fetch only if cache is empty.
      const customersData =
        saleCustomers.length > 0 ? saleCustomers : await fetchCustomers();
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
        payment_method:
          pickDefaultCashPaymentMethod(paymentMethodsData)?.id ??
          paymentMethodsData[0]?.id,
        lines: cartItems.map((item, index) => {
          // Cart unit_price is already the UOM sell price (price list / resolve).
          // Match web POS: send as-is — do not divide by quantity_per_unit.
          return {
            id: index + 1,
            item: item.no || item.system_id,
            item_no: item.no || item.system_id,
            item_name: item.item_name,
            quantity: item.quantity.toString(),
            unit_price: String(item.unit_price),
            total_amount: (item.unit_price * Number(item.quantity)).toString(),
            unit_of_measure: item.unit_of_measure || 'PCS',
            tracking_code: item.tracking_code?.require_serial_no
              ? ''
              : item.selectedTrackingCode || '',
            serial_nos: Array.isArray(item.selectedSerialNos)
              ? item.selectedSerialNos
              : [],
            description: '',
          };
        }),
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
      dispatch({ type: 'CLEAR_CART' });
  
      // Clear current draft ID and system_id if they were set
      setCurrentDraftId(null);
      setCurrentDraftSystemId(null);
  
      // Refresh drafts list
      await loadDrafts();
      setDraftsModalVisible(false);
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
  
  /**
   * Load an Open/Draft invoice into the POS cart.
   * When deleteAfterLoad is true (Edit in POS), the original invoice is removed
   * so the user can edit lots/qty/lines and complete a fresh sale.
   */
  const loadInvoiceIntoCart = useCallback(
    async (
      invoiceId: number,
      options?: {
        deleteAfterLoad?: boolean;
        /** Keep draft linkage so Save draft updates the same invoice. */
        keepAsDraft?: boolean;
        closeDraftsHub?: boolean;
      },
    ) => {
      if (!canMutateCart) {
        showUserError(
          'Permission denied',
          'You cannot load sales into the POS cart.',
        );
        return false;
      }

      try {
        setLoadingDraftIntoCart(true);
        const fullInvoice = await getSalesInvoice(invoiceId);
        const status = String(fullInvoice?.status || '').toLowerCase();
        if (status !== 'draft' && status !== 'open') {
          showUserError(
            'Cannot load sale',
            `Only Open or Draft invoices can be loaded. This one is ${
              fullInvoice?.status || 'unknown'
            }.`,
          );
          return false;
        }

        await dispatch({type: 'CLEAR_CART'});

        const lines = Array.isArray(fullInvoice.lines) ? fullInvoice.lines : [];
        if (lines.length === 0) {
          showUserError(
            'Empty invoice',
            'This sale has no lines to load into POS.',
          );
          return false;
        }

        const cartLines = await Promise.all(
          lines.map(async (line: any, index: number) => {
            const itemNo = line.item_no || line.item;
            const systemId =
              line.item_system_id || itemNo || `line-${line.id || index}`;

            let inventory = 0;
            let itemDetails: any = null;
            try {
              const searchResults = await catalogSearchItems(String(itemNo));
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
              console.warn(
                `Failed to fetch inventory for item ${itemNo}:`,
                error,
              );
            }

            const qpu =
              Number(line.quantity_per_unit) > 0
                ? Number(line.quantity_per_unit)
                : Number(itemDetails?.quantity_per_unit) > 0
                  ? Number(itemDetails.quantity_per_unit)
                  : 1;
            const unitPrice = parseFloat(String(line.unit_price)) || 0;
            const qty = parseInt(String(line.quantity), 10) || 1;
            return {
              system_id: String(systemId),
              no: String(itemNo || ''),
              item_name: line.item_name || 'Item',
              barcode: itemDetails?.bar_code_no || '',
              quantity: qty,
              unit_price: unitPrice,
              original_price: unitPrice,
              total: parseFloat(String(line.total_amount)) || unitPrice * qty,
              inventory,
              unit_of_measure: line.unit_of_measure || 'PCS',
              quantity_per_unit: qpu,
              type: itemDetails?.type,
            selectedTrackingCode: line.tracking_code || '',
            selectedSerialNos: Array.isArray(line.serial_nos)
              ? line.serial_nos
              : undefined,
            tracking_code: itemDetails?.tracking_code ?? null,
            date_sold:
                fullInvoice.document_date || new Date().toISOString(),
              item_images: itemDetails?.item_images || [],
            } as CartItem;
          }),
        );

        for (const item of cartLines) {
          await dispatch({type: 'CART_ADD_ITEM', payload: item});
          // Ensure lot/serial picker can open (page-data often omits tracking_code).
          void enrichAndPreloadTracking(item);
        }

        if (fullInvoice.document_date) {
          setGlobalSellingDate(new Date(fullInvoice.document_date));
        }

        const customerId = Number(fullInvoice.customer);
        const customerName = String(fullInvoice.customer_name || '').trim();
        if (Number.isFinite(customerId) && customerId > 0) {
          const match = saleCustomers.find(c => c.id === customerId);
          setSelectedSaleCustomer(
            match ||
              ({
                id: customerId,
                name: customerName || 'Customer',
                no: String(fullInvoice.customer_no || ''),
              } as Customer),
          );
        }

        if (options?.keepAsDraft && status === 'draft') {
          setCurrentDraftId(invoiceId);
          setCurrentDraftSystemId(fullInvoice.system_id || null);
        } else {
          // Fresh POS edit — do not keep updating the old Open/Draft invoice.
          setCurrentDraftId(null);
          setCurrentDraftSystemId(null);
        }

        if (options?.deleteAfterLoad) {
          if (!canRemoveSale) {
            showUserError(
              'Loaded — delete blocked',
              'Sale is in POS, but you do not have permission to delete the original unposted invoice. Remove it from Unposted Sales if needed.',
            );
          } else {
            try {
              await updateSalesInvoice(invoiceId, {
                deleted: true,
                system_id: fullInvoice.system_id,
                id: invoiceId,
              });
              setDrafts(prev => prev.filter(d => d.id !== invoiceId));
              await invalidateSales();
            } catch (deleteError) {
              console.error('Failed to delete unposted after POS load:', deleteError);
              showUserError(
                'Loaded — delete failed',
                'Sale is in POS, but the original unposted invoice could not be removed. Delete it from Unposted Sales to avoid a duplicate.',
              );
            }
          }
        }

        showUserSuccess(
          options?.deleteAfterLoad ? 'Loaded into POS' : 'Draft loaded',
          options?.deleteAfterLoad
            ? 'Edit lot, quantity, or lines, then complete the sale.'
            : 'Draft loaded. You can add items and save to update.',
        );

        if (options?.closeDraftsHub) {
          setDraftsModalVisible(false);
        }
        return true;
      } catch (error: any) {
        console.error('Failed to load invoice into cart:', error);
        showUserError(
          'Could not load sale',
          error?.response?.data?.detail ||
            error?.message ||
            'Failed to load this sale into POS.',
        );
        return false;
      } finally {
        setLoadingDraftIntoCart(false);
      }
    },
    [
      canMutateCart,
      canRemoveSale,
      dispatch,
      invalidateSales,
      saleCustomers,
    ],
  );

  const handleSelectDraft = async (draft: any) => {
    await loadInvoiceIntoCart(draft.id, {
      keepAsDraft: true,
      closeDraftsHub: true,
      deleteAfterLoad: false,
    });
  };

  // Unposted Sales → Edit in POS
  useEffect(() => {
    const runLoad = (payload: PosLoadUnpostedPayload | null) => {
      if (!payload?.invoiceId) {
        return;
      }
      void loadInvoiceIntoCart(payload.invoiceId, {
        deleteAfterLoad: payload.deleteAfterLoad !== false,
        keepAsDraft: false,
      });
    };

    runLoad(takePendingPosLoad());
    const sub = DeviceEventEmitter.addListener(
      POS_LOAD_UNPOSTED_EVENT,
      (payload: PosLoadUnpostedPayload) => {
        takePendingPosLoad();
        runLoad(payload);
      },
    );
    return () => sub.remove();
  }, [loadInvoiceIntoCart]);
  
  // Delete draft
  const handleDeleteDraft = async (draft: any) => {
    if (!canRemoveSale) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'You cannot delete drafts.',
        visibilityTime: 3500,
        position: 'top',
      });
      return;
    }
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
  
  const renderSellingDatePicker = () =>
    showGlobalDatePicker ? (
      <DateTimePicker
        value={globalSellingDate}
        mode="date"
        display="default"
        onChange={(_event, selectedDate) => {
          const currentDate = selectedDate || globalSellingDate;
          setShowGlobalDatePicker(Platform.OS === 'ios');
          setGlobalSellingDate(currentDate);
        }}
        themeVariant={resolvedScheme === 'dark' ? 'dark' : 'light'}
      />
    ) : null;

  const renderDraftsAccessButton = () => {
    if (!canUseDrafts) {
      return null;
    }
    return (
      <QuickIconPressable
        onPress={openDraftsHub}
        style={[styles.draftsAccessButton, ct.draftsAccessBtn]}
        hitSlop={ICON_BUTTON_HIT_SLOP}
        accessibilityLabel={`Drafts, ${drafts.length} of 3 saved`}>
        <Image
          source={icons.coupon}
          style={[styles.draftsAccessIcon, ct.draftsAccessIcon]}
          resizeMode="contain"
        />
        {drafts.length > 0 ? (
          <View style={styles.draftsAccessBadge}>
            <Text style={styles.draftsAccessBadgeText}>{drafts.length}</Text>
          </View>
        ) : null}
      </QuickIconPressable>
    );
  };

  function renderFooter() {
    const subQuantity = cartItems.reduce(
      (a: number, c: { quantity: number }) => a + (Number(c.quantity) || 0),
      0,
    );
    const subTotal = cartItems.reduce(
      (sum: number, item: { unit_price: number; quantity: number }) =>
        sum + (item.unit_price || 0) * (Number(item.quantity) || 0),
      0,
    );
    const total = subTotal;
    return (
      <View>
        <FooterTotal
          subTotal={subTotal}
          totalQuantity={subQuantity}
          total={total}
          printReceipt={printReceipt}
          setPrintReceipt={setPrintReceipt}
          onPress={() => setReviewSaleVisible(true)}
          isLoading={isPlacingOrder}
          checkoutBlocked={!canInsertSale}
          embeddedInTabBar={isTabMode}
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
  
  const saleCustomerPickerLoading = () => (
    <View style={styles.saleCustomerStateWrap}>
      <ActivityIndicator size="small" color={COLORS.primary2} />
      <Text style={[styles.saleCustomerStateText, ct.saleCustState]}>
        Loading customers...
      </Text>
    </View>
  );
  
  const renderSaleCustomerPickerFlatList = (listStyle: object | object[], contentExtra?: object) => (
    <FlatList
      data={filteredSaleCustomers}
      keyExtractor={item => String(item.id)}
      keyboardShouldPersistTaps="handled"
      style={listStyle}
      contentContainerStyle={
        contentExtra
          ? [styles.saleCustomerListContent, contentExtra]
          : styles.saleCustomerListContent
      }
      renderItem={({ item }) => {
        const isSelected = selectedSaleCustomer?.id === item.id;
  
        return (
          <TouchableOpacity
            style={[
              styles.saleCustomerRow,
              ct.saleCustRow,
              isSelected && styles.saleCustomerRowSelected,
              isSelected && ct.saleCustRowSel,
            ]}
            onPress={() => {
              setSelectedSaleCustomer(item);
              setCustomerPickerVisible(false);
              setCustomerPickerQuery('');
              // Customer-specific price lists: re-resolve open cart lines (web parity).
              const lines = cartItemsRef.current;
              if (lines.length > 0) {
                void Promise.all(
                  lines.map(async line => {
                    const resolved = await resolvePosUnitPrice({
                      itemNo: line.no || line.system_id,
                      itemSystemId: line.system_id,
                      unitOfMeasure: line.unit_of_measure || 'PCS',
                      customerNo: item.no,
                      quantity: line.quantity,
                      fallbackBasePrice: Number(line.unit_price) || 0,
                    });
                    if (!Number.isFinite(resolved)) {
                      return null;
                    }
                    return withCartUomDefaults({
                      ...line,
                      unit_price: resolved,
                      original_price: resolved,
                    });
                  }),
                ).then(updatedLines => {
                  updatedLines.forEach(updated => {
                    if (updated) {
                      dispatch({type: 'CART_UPDATE_ITEM', payload: updated});
                    }
                  });
                  if (
                    editingCartItem &&
                    updatedLines.some(
                      u => u && u.system_id === editingCartItem.system_id,
                    )
                  ) {
                    const match = updatedLines.find(
                      u => u && u.system_id === editingCartItem.system_id,
                    );
                    if (match) {
                      setEditingCartItem(match);
                    }
                  }
                });
              }
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
              <Text style={[styles.saleCustomerName, ct.saleCustName]}>{item.name}</Text>
              <Text style={[styles.saleCustomerMeta, ct.saleCustMeta]}>{item.no}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.saleCustomerStateWrap}>
          <Text style={[styles.saleCustomerStateText, ct.saleCustState]}>
            No customers match that search.
          </Text>
        </View>
      }
    />
  );
  
  /** Bottom sheet when opened outside Current sale (standalone Modal). */
  const renderSaleCustomerPickerSheet = () => (
    <View style={[styles.saleCustomerPickerSheet, ct.modalSheet]}>
      <View style={[styles.modalHeader, ct.modalHdr]}>
        <Text style={[styles.modalTitle, ct.modalTitle]}>Select customer</Text>
        <QuickIconPressable
          onPress={() => setCustomerPickerVisible(false)}
          style={styles.closeButton}
          accessibilityLabel="Close">
          <Image source={icons.cross} style={[styles.closeIcon, ct.closeIc]} />
        </QuickIconPressable>
      </View>
  
      <View style={[styles.saleCustomerSearchWrap, ct.saleCustSearch]}>
        <Image source={icons.search} style={styles.saleCustomerSearchIcon} />
        <TextInput
          value={customerPickerQuery}
          onChangeText={setCustomerPickerQuery}
          placeholder="Search customers..."
          placeholderTextColor={colors.placeholder}
          underlineColorAndroid="transparent"
          autoCorrect={false}
          style={[styles.saleCustomerSearchInput, ct.saleCustSearchIn]}
        />
      </View>
  
      {loadingSaleCustomers
        ? saleCustomerPickerLoading()
        : renderSaleCustomerPickerFlatList([styles.saleCustomerPickerList, { flexGrow: 0 }])}
    </View>
  );
  
  /** When Current sale is closed, picker uses its own Modal; when open, picker is inlined above the sheet. */
  const renderCustomerPicker = () => (
    <ReactNativeModal
      isVisible={customerPickerVisible && !reviewSaleVisible}
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
      {renderSaleCustomerPickerSheet()}
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
        animationInTiming={120}
        animationOutTiming={100}
        onBackdropPress={dismissReviewSaleSheet}
        style={styles.reviewSaleModal}
        backdropOpacity={0.28}
        backdropTransitionInTiming={90}
        backdropTransitionOutTiming={80}
        useNativeDriver={true}
        useNativeDriverForBackdrop={true}
        propagateSwipe
        hideModalContentWhileAnimating={false}
        onBackButtonPress={() => {
          if (customerPickerVisible) {
            setCustomerPickerVisible(false);
            return true;
          }
          if (uomModalVisible) {
            setUomModalVisible(false);
            return true;
          }
          if (trackingModalVisible) {
            setTrackingModalVisible(false);
            setTrackingModalItem(null);
            return true;
          }
          if (cartItemEditorVisible) {
            closeCartItemEditor();
            return true;
          }
          if (saleActionsVisible) {
            setSaleActionsVisible(false);
            return true;
          }
          dismissReviewSaleSheet();
          return true;
        }}>
        <View style={[styles.currentSalePanel, ct.currentSalePanel]}>
          <View style={styles.currentSaleHandle} />
  
          <View style={[styles.currentSaleHeader, ct.currentSaleHdr]}>
            <QuickIconPressable
              accessibilityLabel="Close current sale"
              hitSlop={ICON_BUTTON_HIT_SLOP}
              onPress={dismissReviewSaleSheet}
              style={styles.currentSaleHeaderIconButton}>
              <Image source={icons.cross} style={styles.currentSaleCloseIcon} />
            </QuickIconPressable>
            <Text style={styles.currentSaleTitle}>Current sale ({cartItems.length})</Text>
            {canModifySale ? (
              <QuickIconPressable
                accessibilityLabel="Sale actions"
                hitSlop={ICON_BUTTON_HIT_SLOP}
                onPress={() => setSaleActionsVisible(true)}
                style={styles.currentSaleHeaderIconButton}>
                <Text style={styles.currentSaleMoreText}>...</Text>
              </QuickIconPressable>
            ) : (
              <View style={styles.currentSaleHeaderIconButton} />
            )}
          </View>

          <TouchableOpacity
            style={[styles.saleDateRow, ct.saleDateRow]}
            disabled={!canModifySale}
            onPress={() => setShowGlobalDatePicker(true)}
            activeOpacity={0.78}>
            <Image source={icons.calender} style={styles.saleDateRowIcon} />
            <Text style={[styles.saleDateRowLabel, ct.saleDateLabel]}>
              Selling date
            </Text>
            <Text style={[styles.saleDateRowValue, ct.saleDateValue]}>
              {globalSellingDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Image source={icons.down_arrow} style={styles.saleDateRowChevron} />
          </TouchableOpacity>
  
          <TouchableOpacity
            style={[styles.customerRow, ct.customerRow]}
            disabled={!canMutateCart}
            onPress={() => setCustomerPickerVisible(true)}
            activeOpacity={0.78}>
            <View style={[styles.customerRowIconWrap, ct.customerIconWrap]}>
              <Image source={icons.profile} style={styles.customerRowIcon} />
              <Image source={icons.plus} style={styles.customerRowPlusIcon} />
            </View>
            <View style={styles.customerRowTextWrap}>
              <Text style={styles.customerRowTitle}>
                {selectedSaleCustomer?.name || 'General'}
              </Text>
              <Text style={styles.customerRowSubtitle}>
                {selectedSaleCustomer
                  ? isGeneralSaleCustomer
                    ? 'Default customer'
                    : selectedSaleCustomer.no
                  : loadingSaleCustomers
                    ? 'Loading customers...'
                    : 'Choose a customer for this sale'}
              </Text>
            </View>
            <Image source={icons.down_arrow} style={styles.customerRowChevron} />
          </TouchableOpacity>
  
          {reviewSaleVisible ? (
            <GestureHandlerRootView
              style={[styles.reviewSaleListHost, { backgroundColor: colors.surface }]}>
              <FlatList
                data={cartItems}
                extraData={cartItems}
                keyExtractor={(item: CartItem) => `${item.system_id}`}
                style={[styles.reviewSaleFlatList, { backgroundColor: colors.surface }]}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={7}
                updateCellsBatchingPeriod={50}
                renderItem={({ item }: { item: CartItem }) => {
                  const removeLine = () => {
                    if (!canModifySale) {
                      return;
                    }
                    dispatch({
                      type: 'REMOVE_FROM_CART',
                      payload: { system_id: String(item.system_id) },
                    });
                  };
                  const lineContent = (
                    <View style={[styles.squareCartItem, ct.squareCartItem]}>
                      <Pressable
                        {...ICON_BUTTON_QUICK_PRESS}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.item_name}`}
                        onPress={() => openCartItemEditor(item)}
                        style={({pressed}) => [
                          styles.squareCartMainPress,
                          pressed && {opacity: 0.78},
                        ]}>
                        <View style={styles.squareCartTextWrap}>
                          <Text
                            style={[styles.squareCartItemName, ct.squareCartName]}
                            numberOfLines={1}>
                            {item.item_name}
                            {(Number(item.quantity) || 1) > 1
                              ? ` x ${Number(item.quantity) || 1}`
                              : ''}
                          </Text>
                        </View>
                        <Text style={[styles.squareCartAmount, ct.squareCartAmt]}>
                          {formatCurrencyCompact(
                            (Number(item.unit_price) || 0) *
                              (Number(item.quantity) || 1),
                          )}
                        </Text>
                      </Pressable>

                      {canModifySale ? (
                        <QuickIconPressable
                          onPress={removeLine}
                          hitSlop={ICON_BUTTON_HIT_SLOP}
                          accessibilityLabel={`Remove ${item.item_name}`}
                          style={styles.squareCartDeleteBtn}>
                          <Image
                            source={icons.delete_icon}
                            style={[
                              styles.squareCartDeleteIcon,
                              { tintColor: COLORS.error },
                            ]}
                            resizeMode="contain"
                          />
                        </QuickIconPressable>
                      ) : null}
                    </View>
                  );
                  return canModifySale ? (
                    <SwipeableCartLine
                      deleteBackgroundColor={COLORS.primary}
                      surfaceColor={colors.surface}
                      borderBottomColor={colors.border}
                      deleteTextStyle={[styles.deleteSwipeText, { color: COLORS.white }]}
                      onDelete={removeLine}>
                      {lineContent}
                    </SwipeableCartLine>
                  ) : (
                    lineContent
                  );
                }}
                contentContainerStyle={styles.squareCartListContent}
                ListEmptyComponent={
                  <View style={styles.emptyCartContainer}>
                    <Image source={icons.emptycart} style={styles.emptyCartImage} />
                    <Text style={[styles.emptyCartText, ct.emptyCartTxt]}>
                      No items in sale
                    </Text>
                    <Text style={[styles.emptyCartSubtext, ct.emptyCartTxt]}>
                      Start adding items to make a sale.
                    </Text>
                  </View>
                }
              />
            </GestureHandlerRootView>
          ) : null}
  
          <View style={[styles.reviewSaleFooter, ct.reviewFooter]}>
            <FooterTotal
              subTotal={total}
              totalQuantity={quantity}
              total={total}
              printReceipt={printReceipt}
              setPrintReceipt={setPrintReceipt}
              onPress={() => {
                dismissReviewSaleSheet();
                handlePlaceOrder(total);
              }}
              isLoading={isPlacingOrder}
              checkoutBlocked={!canInsertSale}
            />
          </View>
  
          {saleActionsVisible ? (
            <View style={styles.saleActionsInlineRoot} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss sale actions"
                style={styles.saleActionsInlineBackdrop}
                onPress={() => setSaleActionsVisible(false)}
              />
              <View style={styles.saleActionsInlineSheetWrap} pointerEvents="box-none">
                <View style={[styles.saleActionsSheet, ct.saleActionsSheet]}>
                  <View style={styles.saleActionsHandle} />
                  {canUseDrafts ? (
                    <TouchableOpacity
                      style={styles.saleActionsMenuRow}
                      activeOpacity={0.85}
                      onPress={openDraftsHub}>
                      <Text style={styles.saleActionsMenuRowText}>
                        {drafts.length > 0
                          ? `Open drafts (${drafts.length}/3)`
                          : 'Open drafts'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {cartItems.length > 0 &&
                  (currentDraftId ? canModifySale : canInsertSale) ? (
                    <TouchableOpacity
                      style={[
                        styles.saleActionsMenuRow,
                        styles.saleActionsMenuRowPrimary,
                        (isSavingDraft ||
                          (!currentDraftId && drafts.length >= 3)) &&
                          styles.saleActionsMenuRowDisabled,
                      ]}
                      disabled={
                        isSavingDraft ||
                        (!currentDraftId && drafts.length >= 3)
                      }
                      activeOpacity={0.85}
                      onPress={async () => {
                        await handleSaveDraft();
                        setSaleActionsVisible(false);
                      }}>
                      {isSavingDraft ? (
                        <ActivityIndicator size="small" color={COLORS.primary2} />
                      ) : (
                        <Text
                          style={[
                            styles.saleActionsMenuRowText,
                            styles.saleActionsMenuRowTextPrimary,
                          ]}>
                          {currentDraftId ? 'Update draft' : 'Save as draft'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.saleActionsPrimaryButton,
                      cartItems.length === 0 && styles.saleActionsPrimaryButtonDisabled,
                    ]}
                    disabled={cartItems.length === 0 || !canModifySale}
                    activeOpacity={0.85}
                    onPress={async () => {
                      await dispatch({ type: 'CLEAR_CART' });
                      setCurrentDraftId(null);
                      setCurrentDraftSystemId(null);
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
                    <Text style={[styles.saleActionsDismissText, ct.saleActDismiss]}>
                      Dismiss
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
  
          {cartItemEditorVisible ? (
            <View
              style={[
                styles.cartEditorOverlayRoot,
                { backgroundColor: colors.background },
              ]}
              pointerEvents="auto">
              <View style={styles.cartEditorGestureRoot}>
                <SafeAreaView
                  style={[styles.cartEditorScreen, ct.cartEditorScreen]}
                  edges={['top', 'bottom']}>
                  <View style={[styles.cartEditorHeader, ct.cartEditorHdr]}>
                      <QuickIconPressable
                        style={styles.cartEditorHeaderButton}
                        onPress={closeCartItemEditor}
                        hitSlop={ICON_BUTTON_HIT_SLOP}
                        accessibilityLabel="Close editor">
                        <Image source={icons.cross} style={styles.cartEditorCloseIcon} />
                      </QuickIconPressable>
  
                    <Text style={styles.cartEditorTitle} numberOfLines={1}>
                      {editingCartItem
                        ? `${editingCartItem.item_name} ${formatCurrencyCompact(
                          editingCartItem.unit_price,
                        )}`
                        : 'Edit item'}
                    </Text>

                    {/* Spacer balances the close button; quantity/tracking auto-save. */}
                    <View style={styles.cartEditorHeaderSpacer} />
                  </View>
  
                  <View style={[styles.cartEditorBody, ct.cartEditorBody]}>
                    <TouchableOpacity
                      style={[styles.cartEditorInfoCard, ct.cartEditorInfo]}
                      onPress={openUomModal}
                      disabled={!canModifySale}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel="Change unit of measure">
                      <Text style={styles.cartEditorInfoLabel}>UNIT OF MEASURE</Text>
                      <View style={styles.cartEditorUomValueRow}>
                        <View style={styles.cartEditorUomTextWrap}>
                          <Text
                            style={[styles.cartEditorInfoValue, ct.cartEditorInfoVal]}
                            numberOfLines={1}>
                            {editingCartItem?.unit_of_measure || 'Select unit'}
                          </Text>
                          {(editingCartItem?.quantity_per_unit || 1) > 1 ? (
                            <Text
                              style={[
                                styles.cartEditorUomHint,
                                ct.cartEditorTrackHint,
                              ]}>
                              {editingCartItem?.quantity_per_unit} per unit
                            </Text>
                          ) : (
                            <Text
                              style={[
                                styles.cartEditorUomHint,
                                ct.cartEditorTrackHint,
                              ]}>
                              Tap to change unit / price
                            </Text>
                          )}
                        </View>
                        <Image
                          source={icons.down_arrow}
                          style={styles.cartEditorTrackingChevron}
                        />
                      </View>
                    </TouchableOpacity>
  
                    <Text style={styles.cartEditorSectionLabel}>QUANTITY</Text>
  
                    <View style={styles.cartEditorQuantityRow}>
                      <Pressable
                        {...ICON_BUTTON_QUICK_PRESS}
                        onPress={() => changeEditingCartItemQuantity(-1)}
                        disabled={!canModifySale}
                        android_ripple={
                          Platform.OS === 'android'
                            ? {color: 'rgba(0,0,0,0.12)', foreground: true}
                            : undefined
                        }
                        style={({pressed}) => [
                          styles.cartEditorQuantityAction,
                          styles.cartEditorQuantityActionLeft,
                          ct.cartEditorQtyAct,
                          pressed && canModifySale && {opacity: 0.75},
                        ]}>
                        <Text style={styles.cartEditorQuantityActionText}>-</Text>
                      </Pressable>
  
                      <View
                        style={[styles.cartEditorQuantityValueWrap, ct.cartEditorQtyValBr]}>
                        <Text style={styles.cartEditorQuantityValue}>
                          {Number(editingCartItem?.quantity) || 1}
                        </Text>
                      </View>
  
                      <Pressable
                        {...ICON_BUTTON_QUICK_PRESS}
                        onPress={() => changeEditingCartItemQuantity(1)}
                        disabled={!canModifySale}
                        android_ripple={
                          Platform.OS === 'android'
                            ? {color: 'rgba(0,0,0,0.12)', foreground: true}
                            : undefined
                        }
                        style={({pressed}) => [
                          styles.cartEditorQuantityAction,
                          styles.cartEditorQuantityActionRight,
                          ct.cartEditorQtyAct,
                          pressed && canModifySale && {opacity: 0.75},
                        ]}>
                        <Text style={styles.cartEditorQuantityActionText}>+</Text>
                      </Pressable>
                    </View>
  
                    {editingCartItem && itemRequiresTracking(editingCartItem) ? (
                      <View style={styles.cartEditorTrackingSection}>
                        <Text style={styles.cartEditorSectionLabel}>
                          {itemRequiresSerial(editingCartItem)
                            ? 'SERIAL NUMBERS'
                            : 'LOT NUMBER'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.cartEditorTrackingRow, ct.cartEditorTrack]}
                          onPress={() =>
                            editingCartItem && openTrackingModal(editingCartItem)
                          }
                          activeOpacity={0.78}>
                          <View style={styles.cartEditorTrackingTextWrap}>
                            <Text
                              style={styles.cartEditorTrackingValue}
                              numberOfLines={2}>
                              {itemRequiresSerial(editingCartItem)
                                ? (editingCartItem.selectedSerialNos || []).length
                                  ? (editingCartItem.selectedSerialNos || []).join(
                                      ', ',
                                    )
                                  : 'Select serial numbers'
                                : (editingCartItem.selectedTrackingCode || '').trim() ||
                                  'Select lot number'}
                            </Text>
                            <Text
                              style={[styles.cartEditorTrackingHint, ct.cartEditorTrackHint]}>
                              {itemRequiresSerial(editingCartItem)
                                ? `Choose ${editingCartItem.quantity} serial${
                                    editingCartItem.quantity === 1 ? '' : 's'
                                  } (same as web POS)`
                                : 'Choose the lot to use for this sale'}
                            </Text>
                          </View>
                          <Image
                            source={icons.down_arrow}
                            style={styles.cartEditorTrackingChevron}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : editingCartItem ? (
                      <View style={styles.cartEditorTrackingSection}>
                        <TouchableOpacity
                          style={[styles.cartEditorTrackingRow, ct.cartEditorTrack]}
                          onPress={() =>
                            editingCartItem && openTrackingModal(editingCartItem)
                          }
                          activeOpacity={0.78}>
                          <View style={styles.cartEditorTrackingTextWrap}>
                            <Text style={styles.cartEditorTrackingValue}>
                              Check lot / serial
                            </Text>
                            <Text
                              style={[
                                styles.cartEditorTrackingHint,
                                ct.cartEditorTrackHint,
                              ]}>
                              Tap to load tracking setup for this item
                            </Text>
                          </View>
                          <Image
                            source={icons.down_arrow}
                            style={styles.cartEditorTrackingChevron}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : null}
  
                    <Pressable
                      {...ICON_BUTTON_QUICK_PRESS}
                      onPress={removeEditingCartItem}
                      disabled={!canModifySale}
                      style={({pressed}) => [
                        styles.cartEditorRemoveButton,
                        pressed && canModifySale && {opacity: 0.85},
                      ]}>
                      <Text style={styles.cartEditorRemoveText}>Remove Item</Text>
                    </Pressable>
                  </View>
                </SafeAreaView>
              </View>
            </View>
          ) : null}
  
          <TrackingSelectionModal
            embedded
            visible={trackingModalVisible}
            mode={
              trackingModalItem && itemRequiresSerial(trackingModalItem)
                ? 'serial'
                : 'lot'
            }
            requiredCount={trackingModalItem?.quantity || 1}
            selectedSerialNos={trackingModalItem?.selectedSerialNos}
            title={
              trackingModalItem
                ? itemRequiresSerial(trackingModalItem)
                  ? `Select serials — ${trackingModalItem.item_name}`
                  : `Select lot — ${trackingModalItem.item_name}`
                : 'Select tracking'
            }
            loading={loadingTrackingOptions}
            options={trackingOptions}
            onClose={() => {
              setTrackingModalVisible(false);
              setTrackingModalItem(null);
            }}
            onSelect={handleTrackingLotSelected}
            onConfirmSerials={handleSerialsConfirmed}
          />

          <UOMSelectionModal
            embedded
            visible={uomModalVisible}
            title={
              editingCartItem
                ? `Unit — ${editingCartItem.item_name}`
                : 'Unit of measure'
            }
            loading={loadingUomOptions}
            options={uomOptions}
            selectedCode={editingCartItem?.unit_of_measure}
            baseUnitPrice={
              editingCartItem?.original_price != null
                ? Number(editingCartItem.original_price)
                : Number(editingCartItem?.unit_price) || 0
            }
            resolvedPrices={uomResolvedPrices}
            onClose={() => setUomModalVisible(false)}
            onSelect={handleUomSelected}
          />
  
          {customerPickerVisible ? (
            <View style={styles.customerPickerInlineRoot} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss customer list"
                style={styles.customerPickerInlineBackdrop}
                onPress={() => setCustomerPickerVisible(false)}
              />
              {/* Full-panel overlay (same idea as quantity / cart line editor) — list uses flex:1 so no dim gap above Charge */}
              <View
                style={[styles.customerPickerInlineForeground, { backgroundColor: colors.background }]}
                pointerEvents="auto">
                <GestureHandlerRootView style={styles.customerPickerEmbeddedFlex}>
                  <SafeAreaView
                    style={[styles.customerPickerEmbeddedScreen, ct.cartEditorScreen]}
                    edges={['bottom']}>
                    <View style={[styles.customerPickerEmbeddedHeader, ct.cartEditorHdr]}>
                      <QuickIconPressable
                        style={styles.cartEditorHeaderButton}
                        onPress={() => setCustomerPickerVisible(false)}
                        hitSlop={ICON_BUTTON_HIT_SLOP}
                        accessibilityLabel="Close customer list">
                        <Image source={icons.cross} style={styles.cartEditorCloseIcon} />
                      </QuickIconPressable>
                      <Text style={[styles.customerPickerEmbeddedTitle, { color: COLORS.primary2 }]}>
                        Select customer
                      </Text>
                      <View style={styles.customerPickerHeaderSpacer} />
                    </View>
  
                    <View
                      style={[
                        styles.customerPickerEmbeddedSearchPad,
                        { backgroundColor: colors.surface },
                      ]}>
                      <View style={[styles.saleCustomerSearchWrap, ct.saleCustSearch, { marginHorizontal: 0 }]}>
                        <Image source={icons.search} style={styles.saleCustomerSearchIcon} />
                        <TextInput
                          value={customerPickerQuery}
                          onChangeText={setCustomerPickerQuery}
                          placeholder="Search customers..."
                          placeholderTextColor={colors.placeholder}
                          underlineColorAndroid="transparent"
                          autoCorrect={false}
                          style={[styles.saleCustomerSearchInput, ct.saleCustSearchIn]}
                        />
                      </View>
                    </View>
  
                    <View
                      style={[styles.customerPickerEmbeddedBody, { backgroundColor: colors.surface }]}>
                      {loadingSaleCustomers ? (
                        <View style={styles.customerPickerEmbeddedLoadingWrap}>
                          {saleCustomerPickerLoading()}
                        </View>
                      ) : (
                        renderSaleCustomerPickerFlatList(
                          [styles.customerPickerEmbeddedList, { backgroundColor: colors.surface }],
                          styles.customerPickerEmbeddedListContent,
                        )
                      )}
                    </View>
                  </SafeAreaView>
                </GestureHandlerRootView>
              </View>
            </View>
          ) : null}
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
        style={[styles.modalView, ct.modalSheet]}>
        <View style={[styles.modalHeader, ct.modalHdr]}>
          <Text style={[styles.modalTitle, ct.modalTitle]}>
            {searchQuery
              ? `Search Results for "${searchQuery}"`
              : 'Select an Item'}
          </Text>
          <QuickIconPressable onPress={toggleModal} style={styles.closeButton} accessibilityLabel="Close">
            <Image source={icons.cross} style={[styles.closeIcon, ct.closeIc]} />
          </QuickIconPressable>
        </View>
  
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}>
          <FlatList
            data={modalItems}
            renderItem={({ item }: { item: CartItem }) => (
              <TouchableOpacity
                style={[styles.modalItemContainer, ct.modalItem]}
                onPress={() => {
                  addToCart(item);
                  setTimeout(() => {
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
                  }, 0);
                }}>
                <View style={[styles.modalImageContainer, ct.modalImgBg]}>
                  <Image
                    source={{ uri: item.item_images?.[0]?.url }}
                    style={styles.modalItemImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.modalItemDetails}>
                  <Text style={[styles.modalItemName, ct.modalItemName]} numberOfLines={1}>
                    {item.item_name}
                  </Text>
                  <View style={styles.modalItemInfo}>
                    <Text style={[styles.modalStockText, ct.modalStock]}>
                      {isInventoryPosItem(item)
                        ? `Stock: ${item.inventory}`
                        : posItemStockLabel(item)}
                    </Text>
                    <Text style={styles.modalPriceText}>
                      {formatCurrencyCompact(item.unit_price)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.system_id}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Image source={icons.search} style={styles.emptyListIcon} />
                <Text style={[styles.emptyListText, ct.emptyListTxt]}>
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
  
  const closeDraftsModal = () => setDraftsModalVisible(false);

  const canSaveCurrentDraft =
    cartItems.length > 0 && (currentDraftId ? canModifySale : canInsertSale);
  
  const renderDraftsHub = () => (
    <ReactNativeModal
      isVisible={draftsModalVisible}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onBackdropPress={closeDraftsModal}
      style={styles.draftsHubModal}
      avoidKeyboard={true}
      backdropOpacity={0.35}
      useNativeDriver={true}
      onBackButtonPress={() => {
        closeDraftsModal();
        return true;
      }}>
      <View style={[styles.draftsHubSheet, ct.draftsHubSheet]}>
        <View style={[styles.draftsHubHeader, ct.draftsHubHdr]}>
          <View style={styles.draftsHubHeaderText}>
            <Text style={[styles.draftsHubTitle, ct.draftsHubTitle]}>
              Saved drafts
            </Text>
            <Text style={[styles.draftsHubSubtitle, ct.draftsHubSubtitle]}>
              {drafts.length}/3 slots used · tap a draft to resume
            </Text>
          </View>
          <QuickIconPressable
            onPress={closeDraftsModal}
            style={styles.closeButton}
            accessibilityLabel="Close drafts">
            <Image source={icons.cross} style={[styles.closeIcon, ct.closeIc]} />
          </QuickIconPressable>
        </View>

        {canSaveCurrentDraft ? (
          <TouchableOpacity
            style={[
              styles.draftsHubSaveButton,
              ct.draftsHubSaveBtn,
              (isSavingDraft || (!currentDraftId && drafts.length >= 3)) &&
                styles.draftsHubSaveButtonDisabled,
            ]}
            disabled={isSavingDraft || (!currentDraftId && drafts.length >= 3)}
            onPress={handleSaveDraft}
            activeOpacity={0.85}>
            {isSavingDraft ? (
              <ActivityIndicator size="small" color={COLORS.primary2} />
            ) : (
              <Text style={[styles.draftsHubSaveButtonText, ct.draftsHubSaveText]}>
                {currentDraftId ? 'Update current draft' : 'Save current sale as draft'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.draftsHubDateRow, ct.saleDateRow]}
          disabled={!canModifySale}
          onPress={() => setShowGlobalDatePicker(true)}
          activeOpacity={0.78}>
          <Image source={icons.calender} style={styles.saleDateRowIcon} />
          <Text style={[styles.saleDateRowLabel, ct.saleDateLabel]}>
            Selling date
          </Text>
          <Text style={[styles.saleDateRowValue, ct.saleDateValue]}>
            {globalSellingDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.draftsHubList}
          contentContainerStyle={styles.draftsModalList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {loadingDrafts ? (
            <View style={styles.draftsHubEmptyState}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
              <Text style={[styles.draftsHubEmptyText, ct.draftsHubEmpty]}>
                Loading drafts…
              </Text>
            </View>
          ) : drafts.length === 0 ? (
            <View style={styles.draftsHubEmptyState}>
              <Text style={[styles.draftsHubEmptyText, ct.draftsHubEmpty]}>
                No saved drafts yet. Add items to the cart, then save a draft to
                pick up later.
              </Text>
            </View>
          ) : (
            drafts.map((draft: any) => (
            <View
              key={draft.id}
              style={[styles.draftCard, styles.draftCardInModal, ct.draftCard]}>
              <TouchableOpacity
                style={styles.draftCardContent}
                onPress={() => handleSelectDraft(draft)}
                disabled={loadingDraftIntoCart}>
                <View style={styles.draftCardHeader}>
                  <Text style={[styles.draftInvoiceNo, ct.draftInv]}>
                    {draft.invoice_no || 'Draft'}
                  </Text>
                  {canRemoveSale ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        Alert.alert(
                          'Delete Draft',
                          'Are you sure you want to delete this draft?',
                          [
                            { text: 'Cancel', style: 'cancel' },
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
                  ) : null}
                </View>
                <Text style={[styles.draftCustomer, ct.draftCust]}>
                  {draft.customer_name || 'Unknown'}
                </Text>
                <Text style={[styles.draftDate, ct.draftDate]}>
                  {new Date(draft.created_at).toLocaleDateString()}
                </Text>
                <Text style={styles.draftAmount}>
                  {formatCurrencyCompact(draft.total_amount || 0)}
                </Text>
              </TouchableOpacity>
            </View>
            ))
          )}
        </ScrollView>
      </View>
    </ReactNativeModal>
  );

  return (
    <SafeAreaView style={[{ flex: 1 }, ct.screen]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, ct.screen]}
        enabled={!isTabMode}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={[{ flex: 1 }, ct.screen]}>
          {!isTabMode ? (
            <Header
              title="Make Sale"
              showBack={!isTabMode}
              onBackPress={() => safeGoBack(navigation, 'Home')}
              rightComponent={
                <View style={styles.headerActionsRow}>
                  {canUseDrafts ? renderDraftsAccessButton() : null}
                  <CartQuantityButton
                    quantity={cartItems.reduce(
                      (a: number, c: any) => a + (Number(c.quantity) || 0),
                      0,
                    )}
                    onPress={() => {}}
                  />
                </View>
              }
              containerStyle={{
                zIndex: -1,
              }}
            />
          ) : null}

          {isTabMode || showTodayMySales ? (
            <View style={styles.posToolbarRow}>
              {isTabMode ? (
                <PosConnectivityBadge
                  compact
                  onPress={() => navigation.navigate('SyncQueue' as never)}
                />
              ) : null}
              <View style={styles.posToolbarMain}>
                {showTodayMySales ? (
                  <TodayMySalesBar
                    compact
                    userId={Number(auth?.user_id) || null}
                    refreshKey={todayMySalesRefreshKey}
                    onOpenHistory={
                      canOpenSalesHistory
                        ? () => navigation.navigate('SalesHistory' as never)
                        : undefined
                    }
                  />
                ) : null}
              </View>
              {isTabMode && canUseDrafts ? renderDraftsAccessButton() : null}
            </View>
          ) : null}
  
          {Platform.OS === 'android' && searchModeState.barcodeScannerEnabled && (
            <View style={styles.embeddedScannerSection}>
              {cameraPermission === null && (
                <View
                  style={[
                    styles.scannerPlaceholder,
                    ct.scannerPh,
                    { minHeight: SCANNER_VIEWPORT_HEIGHT },
                  ]}>
                  <ActivityIndicator color={COLORS.primary2} />
                  <Text style={[styles.scannerPlaceholderText, ct.scannerPhText]}>
                    Preparing camera…
                  </Text>
                </View>
              )}
              {cameraPermission === false && (
                <View
                  style={[
                    styles.scannerPlaceholder,
                    ct.scannerPh,
                    { minHeight: SCANNER_VIEWPORT_HEIGHT },
                  ]}>
                  <Text style={[styles.scannerPlaceholderText, ct.scannerPhText]}>
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
                    { height: SCANNER_VIEWPORT_HEIGHT },
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
  
          <View style={{ flex: 1, minHeight: 0 }}>
            <SalesItemBrowser
              onAddItem={item => {
                if (!canMutateCart) {
                  Toast.show({
                    type: 'info',
                    text1: 'Permission denied',
                    text2: 'You cannot add items to this sale.',
                    visibilityTime: 3000,
                    position: 'top',
                  });
                  return;
                }
                handleSalesBrowserAddItem(item);
              }}
              onScanPress={handleSalesBrowserScanPress}
              showScanButton={showScanShortcutButton}
              onOpenCreateItem={handleOpenCreateInventory}
              onOpenCreateService={handleOpenCreateService}
            />
          </View>
  
          {loadingDraftIntoCart && (
            <View style={[styles.draftsLoadingContainer, ct.draftsLoad]}>
              <ActivityIndicator size="small" color={COLORS.primary2} />
              <Text style={[styles.draftsLoadingText, ct.draftsLoadTxt]}>
                Loading draft into sale...
              </Text>
            </View>
          )}
  
          {/* Footer */}
          {cartItems.length > 0 && !isKeyboardVisible && (
            <View style={[styles.footerContainer, ct.footerWrap]}>{renderFooter()}</View>
          )}
  
          {isPlacingOrder && (
            <ActivityIndicator
              size="large"
              color={COLORS.primary2}
              style={{ position: 'absolute', top: '50%', left: '50%' }}
            />
          )}
  
          <ModalPopup />
          {renderSellingDatePicker()}
          {renderDraftsHub()}
  
          <SalesCompletionModal
            isVisible={showSalesModal && canInsertSale}
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
  
          <AppToastHost />
          {/* Customer picker must mount after the current-sale modal so its Modal stacks on top on Android/iOS */}
          {renderReviewSaleSheet()}
          {renderCustomerPicker()}
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
    textShadowOffset: { width: 0, height: 1 },
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
    marginHorizontal: 0,
    marginTop: 0,
    position: 'relative',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
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
  currentSaleHeaderIconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
    transform: [{ rotate: '-90deg' }],
  },
  reviewSaleModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  customerPickerInlineRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 400,
    elevation: 400,
  },
  customerPickerInlineBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  customerPickerInlineForeground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 12,
  },
  customerPickerEmbeddedFlex: {
    flex: 1,
  },
  customerPickerEmbeddedScreen: {
    flex: 1,
  },
  customerPickerEmbeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.transparentPrimary2,
    minHeight: 56,
    backgroundColor: COLORS.white,
  },
  customerPickerEmbeddedTitle: {
    flex: 1,
    ...FONTS.body3,
    fontWeight: '700',
    paddingRight: 12,
  },
  customerPickerHeaderSpacer: {
    width: 56,
    height: 56,
  },
  customerPickerEmbeddedSearchPad: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  customerPickerEmbeddedBody: {
    flex: 1,
    minHeight: 0,
  },
  customerPickerEmbeddedLoadingWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  customerPickerEmbeddedList: {
    flex: 1,
  },
  customerPickerEmbeddedListContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  saleActionsInlineRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
  saleActionsInlineBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  saleActionsInlineSheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  saleActionsMenuRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  saleActionsMenuRowPrimary: {
    borderColor: COLORS.primary2,
    backgroundColor: COLORS.transparentPrimary2,
  },
  saleActionsMenuRowDisabled: {
    opacity: 0.5,
  },
  saleActionsMenuRowText: {
    ...FONTS.body3,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  saleActionsMenuRowTextPrimary: {
    color: COLORS.primary2,
  },
  posToolbarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 8,
    gap: 8,
    minHeight: 40,
  },
  posToolbarMain: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftsAccessButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  draftsAccessIcon: {
    width: 20,
    height: 20,
  },
  draftsAccessBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  draftsAccessBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  saleDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  saleDateRowIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary2,
  },
  saleDateRowLabel: {
    ...FONTS.body4,
    flex: 1,
  },
  saleDateRowValue: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  saleDateRowChevron: {
    width: 14,
    height: 14,
    tintColor: COLORS.primary2,
    transform: [{rotate: '-90deg'}],
  },
  draftsHubModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  draftsHubSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  draftsHubHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  draftsHubHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  draftsHubTitle: {
    ...FONTS.h3,
    fontWeight: '700',
  },
  draftsHubSubtitle: {
    ...FONTS.body4,
    marginTop: 4,
  },
  draftsHubSaveButton: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftsHubSaveButtonDisabled: {
    opacity: 0.55,
  },
  draftsHubSaveButtonText: {
    ...FONTS.body3,
    fontWeight: '700',
  },
  draftsHubDateRow: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  draftsHubList: {
    flexGrow: 0,
  },
  draftsHubEmptyState: {
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  draftsHubEmptyText: {
    ...FONTS.body4,
    textAlign: 'center',
    lineHeight: 20,
  },
  squareCartListContent: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 16,
  },
  reviewSaleListHost: {
    flex: 1,
    minHeight: 0,
  },
  reviewSaleFlatList: {
    flex: 1,
  },
  squareCartItemWrapper: {
    backgroundColor: COLORS.white,
  },
  squareCartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
    gap: 4,
  },
  squareCartMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 12,
  },
  squareCartTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  squareCartItemName: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
  },
  squareCartRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 128,
    marginLeft: 12,
  },
  squareCartAmount: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 20,
  },
  squareCartDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareCartDeleteIcon: {
    width: 18,
    height: 18,
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
    shadowOffset: { width: 0, height: 2 },
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
  cartEditorOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    elevation: 500,
  },
  cartEditorGestureRoot: {
    flex: 1,
  },
  cartEditorScreen: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  cartEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.transparentPrimary2,
    minHeight: 56,
    backgroundColor: COLORS.white,
  },
  cartEditorHeaderButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartEditorCloseIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.primary2,
  },
  cartEditorTitle: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '700',
    paddingRight: 12,
  },
  cartEditorHeaderSpacer: {
    width: 56,
    height: 56,
  },
  cartEditorBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    backgroundColor: COLORS.white,
  },
  cartEditorInfoCard: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  cartEditorInfoLabel: {
    ...FONTS.body5,
    color: COLORS.primary2,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cartEditorInfoValue: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    fontWeight: '600',
    marginTop: 6,
  },
  cartEditorUomValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cartEditorUomTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  cartEditorUomHint: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 2,
  },
  cartEditorSectionLabel: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  cartEditorQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 42,
  },
  cartEditorQuantityAction: {
    width: 92,
    height: 68,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
  cartEditorQuantityActionLeft: {
    marginRight: 8,
  },
  cartEditorQuantityActionRight: {
    marginLeft: 8,
  },
  cartEditorQuantityActionText: {
    fontSize: 34,
    color: COLORS.primary2,
    fontWeight: '400',
    lineHeight: 38,
  },
  cartEditorQuantityValueWrap: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.transparentPrimary3,
    marginHorizontal: 18,
  },
  cartEditorQuantityValue: {
    ...FONTS.h2,
    color: COLORS.primary2,
    fontWeight: '700',
  },
  cartEditorTrackingSection: {
    marginBottom: 40,
  },
  cartEditorTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cartEditorTrackingTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  cartEditorTrackingValue: {
    ...FONTS.body3,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  cartEditorTrackingHint: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 4,
  },
  cartEditorTrackingChevron: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary2,
    transform: [{ rotate: '-90deg' }],
  },
  cartEditorRemoveButton: {
    marginTop: 8,
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.18)',
    backgroundColor: 'rgba(255, 71, 87, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  cartEditorRemoveText: {
    ...FONTS.body3,
    color: COLORS.error,
    fontWeight: '600',
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
    width: 104,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteSwipeText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : {}),
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
  },
  emptyCartText: {
    ...FONTS.h3,
    color: COLORS.gray,
    marginTop: 16,
    textAlign: 'center',
    width: '100%',
  },
  emptyCartSubtext: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
    lineHeight: 20,
  },
  emptyCartImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
    tintColor: COLORS.gray,
    opacity: 0.5,
  },
  footerContainer: {
    backgroundColor: 'transparent',
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
    ...Platform.select({
      android: { paddingVertical: 0 },
      default: {},
    }),
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
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 60,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
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
  /** Select-customer only: no minHeight so short lists do not leave a large blank area. */
  saleCustomerPickerSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: '78%',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  saleCustomerPickerList: {
    maxHeight: SALE_CUSTOMER_PICKER_LIST_MAX_HEIGHT,
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 16,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
  },
});

export default Cart;
