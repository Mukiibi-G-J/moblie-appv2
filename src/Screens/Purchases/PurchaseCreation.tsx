import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Linking,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {QuickIconPressable} from '../../Components';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import Toast from 'react-native-toast-message';
import DocumentPicker from 'react-native-document-picker';
import {
  upsertPurchase,
  updatePurchaseLines,
  postPurchase,
  fetchVendors,
  searchItems,
  fetchPurchasesData,
  fetchItemByNo,
  generatePurchaseVendorInvoiceNo,
  fetchPurchaseAttachments,
  uploadPurchaseAttachment,
  deletePurchaseAttachment,
  type PurchaseInvoiceAttachmentDto,
  type ItemDetailByNo,
} from '../../services/app.services';
import PurchaseLineSpecificationsModal from './PurchaseLineSpecificationsModal';
import {fetchPaymentMethods} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';

type Vendor = {
  id: number;
  system_id: string;
  no: string;
  name: string;
  contact?: string;
};

type PaymentMethod = {
  id: number;
  code: string;
  description: string;
};

type PurchaseLine = {
  id?: number;
  system_id?: string;
  item_no: string;
  item_name: string;
  item_system_id?: string;
  quantity: number;
  unit_cost: number;
  unit_of_measure: string;
  description?: string;
  total_amount?: number;
  deleted?: boolean;
};

type PurchaseAttachment = PurchaseInvoiceAttachmentDto;

const parseDecimalInput = (text: string): number => {
  const trimmed = text.trim().replace(/,/g, '');
  if (!trimmed || trimmed === '.' || trimmed === ',') {
    return 0;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
};

const formatAmountWithCommas = (
  value: number,
  hideZero = false,
): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return hideZero ? '' : '0';
  }
  if (hideZero && n === 0) {
    return '';
  }
  return n.toLocaleString('en-US', {maximumFractionDigits: 0});
};

const formatCommaInput = (text: string): string => {
  const cleanedText = text.replace(/[^0-9.]/g, '');
  if (!cleanedText) {
    return '';
  }
  const numericValue = parseFloat(cleanedText.replace(/,/g, ''));
  if (!Number.isFinite(numericValue)) {
    return cleanedText;
  }
  return numericValue.toLocaleString('en-US', {maximumFractionDigits: 0});
};

const formatLineNumericDisplay = (
  value: number,
  draft: string | undefined,
  hideZero = false,
  useCommas = false,
): string => {
  if (draft !== undefined) {
    return draft;
  }
  if (useCommas) {
    return formatAmountWithCommas(value, hideZero);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return hideZero ? '' : '0';
  }
  if (hideZero && n === 0) {
    return '';
  }
  return String(n);
};

const normalizePurchaseLine = (line: PurchaseLine): PurchaseLine => ({
  ...line,
  quantity: parseDecimalInput(String(line.quantity ?? 1)) || 1,
  unit_cost: parseDecimalInput(String(line.unit_cost ?? 0)),
});

const getLineDraftKey = (line: PurchaseLine, index: number): string =>
  line.id != null ? `id-${line.id}` : `idx-${index}`;

type PurchaseInvoice = {
  id?: number;
  system_id?: string;
  invoice_no?: string;
  vendor?: number;
  vendor_name?: string;
  contact_person?: string;
  document_date: string;
  posting_date: string;
  vat_date: string;
  due_date?: string;
  vendor_invoice_no?: string;
  payment_method?: number;
  status?: string;
  total_amount?: number;
  lines?: PurchaseLine[];
  attachments?: PurchaseAttachment[];
};

const PurchaseCreation = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {selectedTab, setSelectedTab} = useTabContext();
  const {canCreate, canEdit} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PURCHASES;

  const t = useMemo(
    () => ({
      screen: {backgroundColor: colors.screenMuted},
      topHeader: {
        paddingTop: Math.max(insets.top, 12),
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      },
      headerTitle: {color: colors.textPrimary},
      sectionCard: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      sectionTitle: {color: colors.textPrimary},
      mutedText: {color: colors.textSecondary},
      input: {
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      inputDisabled: {
        backgroundColor: colors.screenMuted,
        color: colors.textSecondary,
      },
      vendorInner: {backgroundColor: colors.inputBackground},
      pickerRow: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      pickerText: {color: colors.textPrimary},
      dashedSelect: {
        backgroundColor: colors.inputBackground,
        borderColor: COLORS.primary,
      },
      lineCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
      },
      lineInput: {
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      totalsCard: {
        backgroundColor: colors.card,
        borderColor: colors.border,
      },
      secondaryBtn: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      secondaryBtnText: {color: colors.textSecondary},
      emptyBox: {
        backgroundColor: colors.inputBackground,
      },
      modalSurface: {backgroundColor: colors.surface},
      modalHeaderBorder: {borderBottomColor: colors.border},
      modalTitle: {color: colors.textPrimary},
      searchBarBorder: {borderBottomColor: colors.border},
      searchInner: {backgroundColor: colors.inputBackground},
      listRowBorder: {borderBottomColor: colors.border},
      thumbBg: {backgroundColor: colors.inputBackground},
    }),
    [colors, insets.top],
  );

  const onSelectTab = (tab: string) => {
    setSelectedTab(tab);
    navigation.navigate('Home' as never);
  };

  // Get purchase from route params if editing
  const existingPurchase = (route.params as any)?.purchase as
    | PurchaseInvoice
    | undefined;

  const [purchase, setPurchase] = useState<PurchaseInvoice>(() => {
    if (existingPurchase) {
      // Load full purchase details if we have an ID
      return existingPurchase;
    }
    // Initialize new purchase
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 14);

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    return {
      vendor: undefined,
      vendor_name: '',
      contact_person: '',
      document_date: formatDate(today),
      posting_date: formatDate(today),
      vat_date: formatDate(today),
      due_date: formatDate(dueDate),
      vendor_invoice_no: '',
      payment_method: undefined,
      status: 'Open',
      total_amount: 0,
      lines: [],
    };
  });

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [lines, setLines] = useState<PurchaseLine[]>(purchase.lines || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vendorModalVisible, setVendorModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemsLoading, setItemsLoading] = useState(false);
  const [postingPurchase, setPostingPurchase] = useState(false);
  const [generatingVendorInvoiceNo, setGeneratingVendorInvoiceNo] =
    useState(false);
  const [attachments, setAttachments] = useState<PurchaseAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadAttachmentBusy, setUploadAttachmentBusy] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [specModalCtx, setSpecModalCtx] = useState<{
    lineId: number;
    itemPk: number;
    itemNo: string;
    itemName: string;
    tracking: NonNullable<ItemDetailByNo['tracking_code']>;
  } | null>(null);
  const [openingSpecs, setOpeningSpecs] = useState(false);
  const [lineDrafts, setLineDrafts] = useState<
    Record<string, Partial<{quantity: string; unit_cost: string}>>
  >({});

  const clearLineDraft = useCallback(
    (draftKey: string, field: 'quantity' | 'unit_cost') => {
      setLineDrafts(prev => {
        const entry = prev[draftKey];
        if (!entry) {
          return prev;
        }
        const nextEntry = {...entry};
        delete nextEntry[field];
        if (Object.keys(nextEntry).length === 0) {
          const next = {...prev};
          delete next[draftKey];
          return next;
        }
        return {...prev, [draftKey]: nextEntry};
      });
    },
    [],
  );

  // Load payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const methods = await fetchPaymentMethods();
        setPaymentMethods(methods);
      } catch (error) {
        console.error('Error loading payment methods:', error);
      }
    };
    loadPaymentMethods();
  }, []);

  // Load purchase details if editing
  useEffect(() => {
    const loadPurchaseDetails = async () => {
      if (existingPurchase?.id && !existingPurchase.lines) {
        try {
          // Fetch full purchase with lines
          const response = await fetchPurchasesData({
            search: existingPurchase.invoice_no,
          });
          if (response.results && response.results.length > 0) {
            const fullPurchase = response.results.find(
              p => p.id === existingPurchase.id,
            );
            if (fullPurchase) {
              setPurchase(fullPurchase);
              setLines((fullPurchase.lines || []).map(normalizePurchaseLine));
              // Set vendor if available
              if (fullPurchase.vendor_name) {
                setVendor({
                  id: fullPurchase.vendor || 0,
                  system_id: '',
                  no: '',
                  name: fullPurchase.vendor_name,
                });
              }
            }
          }
        } catch (error) {
          console.error('Error loading purchase details:', error);
        }
      } else if (existingPurchase?.lines) {
        setLines((existingPurchase.lines || []).map(normalizePurchaseLine));
        if (existingPurchase.vendor_name) {
          setVendor({
            id: existingPurchase.vendor || 0,
            system_id: '',
            no: '',
            name: existingPurchase.vendor_name,
          });
        }
      }
    };
    loadPurchaseDetails();
  }, [existingPurchase]);

  useEffect(() => {
    if (!purchase.id) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setAttachmentsLoading(true);
      try {
        const list = await fetchPurchaseAttachments(purchase.id);
        if (!cancelled) {
          setAttachments(list);
        }
      } catch (error) {
        console.error('Error loading purchase attachments:', error);
        if (!cancelled) {
          setAttachments([]);
        }
      } finally {
        if (!cancelled) {
          setAttachmentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchase.id]);

  // Load vendors when modal opens
  useEffect(() => {
    if (vendorModalVisible) {
      loadVendors();
    }
  }, [vendorModalVisible]);

  // Search vendors
  useEffect(() => {
    if (vendorModalVisible && vendorSearchQuery) {
      const debounceTimer = setTimeout(() => {
        loadVendors(vendorSearchQuery);
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else if (vendorModalVisible) {
      loadVendors();
    }
  }, [vendorModalVisible, vendorSearchQuery]);

  // Search items
  useEffect(() => {
    if (itemModalVisible && itemSearchQuery) {
      const debounceTimer = setTimeout(() => {
        searchItemsForPurchase(itemSearchQuery);
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [itemModalVisible, itemSearchQuery]);

  const loadVendors = async (search?: string) => {
    try {
      setVendorsLoading(true);
      const vendorsList = await fetchVendors(search);
      setVendors(vendorsList);
    } catch (error) {
      console.error('Error loading vendors:', error);
      Alert.alert('Error', 'Failed to load vendors');
    } finally {
      setVendorsLoading(false);
    }
  };

  const searchItemsForPurchase = async (query: string) => {
    try {
      setItemsLoading(true);
      const results = await searchItems(query);
      setItems(results);
    } catch (error) {
      console.error('Error searching items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleGenerateVendorInvoiceNo = async () => {
    if (purchase.status === 'Posted') {
      return;
    }
    setGeneratingVendorInvoiceNo(true);
    try {
      const invNo = purchase.invoice_no?.trim();
      const data = await generatePurchaseVendorInvoiceNo({
        system_id: purchase.system_id || '',
        ...(invNo ? {invoice_no: invNo} : {}),
      });
      const next = data?.vendor_invoice_no;
      if (next) {
        setPurchase(prev => ({...prev, vendor_invoice_no: next}));
        Toast.show({
          type: 'success',
          text1: 'Vendor invoice number',
          text2: next,
        });
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Could not generate vendor invoice number';
      Toast.show({type: 'error', text1: 'Generate failed', text2: String(msg)});
    } finally {
      setGeneratingVendorInvoiceNo(false);
    }
  };

  const handleAddAttachment = async () => {
    if (!purchase.id || purchase.status === 'Posted' || !canEdit(PAGE_NAME)) {
      return;
    }
    try {
      const [picked] = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.images,
          DocumentPicker.types.plainText,
          DocumentPicker.types.doc,
          DocumentPicker.types.docx,
          DocumentPicker.types.xls,
          DocumentPicker.types.xlsx,
        ],
        copyTo: 'cachesDirectory',
      });
      const uri = picked.fileCopyUri || picked.uri;
      const name = picked.name || `file_${Date.now()}`;
      const mime = picked.type || 'application/octet-stream';
      setUploadAttachmentBusy(true);
      const created = await uploadPurchaseAttachment(
        purchase.id,
        uri,
        name,
        mime,
      );
      setAttachments(prev =>
        [...prev, created].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        ),
      );
      Toast.show({type: 'success', text1: 'Attachment added'});
    } catch (e: any) {
      if (DocumentPicker.isCancel(e)) {
        return;
      }
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.file?.[0] ||
        e?.message ||
        'Upload failed';
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: String(msg),
      });
    } finally {
      setUploadAttachmentBusy(false);
    }
  };

  const handleOpenAttachment = async (url: string | null) => {
    if (!url) {
      Toast.show({type: 'error', text1: 'No file link for this attachment'});
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Toast.show({type: 'error', text1: 'Cannot open this file'});
      }
    } catch {
      Toast.show({type: 'error', text1: 'Could not open file'});
    }
  };

  const handleDeleteAttachment = (att: PurchaseAttachment) => {
    if (purchase.status === 'Posted' || !canEdit(PAGE_NAME)) {
      return;
    }
    Alert.alert(
      'Remove attachment',
      att.original_name || 'This file will be removed.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchaseAttachment(att.id);
              setAttachments(prev => prev.filter(x => x.id !== att.id));
              Toast.show({type: 'success', text1: 'Attachment removed'});
            } catch (e: any) {
              const msg =
                e?.response?.data?.detail ||
                e?.message ||
                'Delete failed';
              Toast.show({
                type: 'error',
                text1: 'Delete failed',
                text2: String(msg),
              });
            }
          },
        },
      ],
    );
  };

  const handleVendorSelect = (selectedVendor: Vendor) => {
    setVendor(selectedVendor);
    setPurchase(prev => ({
      ...prev,
      vendor: selectedVendor.id,
      vendor_name: selectedVendor.name,
      contact_person: selectedVendor.contact || '',
    }));
    setVendorModalVisible(false);
    setVendorSearchQuery('');
  };

  const handleCreatePurchase = async () => {
    if (!purchase.vendor_name) {
      Alert.alert('Error', 'Please select a vendor first');
      return;
    }

    setIsLoading(true);
    try {
      const purchaseData: any = {
        vendor_name: purchase.vendor_name,
        vendor: purchase.vendor,
        document_date: purchase.document_date,
        posting_date: purchase.posting_date,
        vat_date: purchase.vat_date,
        due_date: purchase.due_date,
        vendor_invoice_no: purchase.vendor_invoice_no,
        contact_person: purchase.contact_person,
        payment_method: purchase.payment_method,
        status: 'Open',
      };

      // Include id/system_id for updates
      if (purchase.id) {
        purchaseData.id = purchase.id;
      }
      if (purchase.system_id) {
        purchaseData.system_id = purchase.system_id;
      }

      const createdPurchase = await upsertPurchase(purchaseData);
      setPurchase(createdPurchase);
      const successButtons = [
        {text: 'Continue', style: 'cancel' as const},
        {
          text: 'View list',
          onPress: () => safeGoBack(navigation, 'Purchases'),
        },
      ];
      if (purchase.id) {
        Alert.alert('Success', 'Purchase updated successfully', successButtons);
      } else {
        Alert.alert('Success', 'Purchase created successfully', successButtons);
      }
    } catch (error: any) {
      console.error('Error creating/updating purchase:', error);
      const data = error?.response?.data;
      let errorMessage =
        error?.message || 'Failed to save purchase';
      if (data?.global_dimension_1) {
        errorMessage =
          'Branch is required. Open the menu, select your branch, then try again.';
      } else if (data?.vendor_name) {
        errorMessage = Array.isArray(data.vendor_name)
          ? data.vendor_name[0]
          : data.vendor_name;
      } else if (data?.detail) {
        errorMessage = String(data.detail);
      } else if (data && typeof data === 'object') {
        const [field, value] = Object.entries(data)[0] ?? [];
        if (field && value) {
          errorMessage = Array.isArray(value) ? String(value[0]) : String(value);
        }
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async (item: any) => {
    if (!purchase.id) {
      Alert.alert('Error', 'Please create the purchase first');
      return;
    }

    const newLine: PurchaseLine = {
      item_no: item.no || item.item_no,
      item_name: item.item_name || item.name,
      item_system_id: item.system_id,
      quantity: 1,
      unit_cost: parseDecimalInput(String(item.unit_cost ?? item.unit_price ?? 0)),
      unit_of_measure: item.base_unit_of_measure || 'PCS',
      description: item.item_name || item.name,
    };

    const updatedLines = [...lines, newLine];
    await handleUpdateLines(updatedLines);
    setItemModalVisible(false);
    setItemSearchQuery('');
  };

  const handleUpdateLines = async (updatedLines: PurchaseLine[]) => {
    if (!purchase.id) return;

    setIsSaving(true);
    try {
      const linesData = updatedLines.map(line => ({
        id: line.id,
        system_id: line.system_id,
        item_no: line.item_no,
        item_name: line.item_name,
        item_system_id: line.item_system_id,
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        unit_of_measure: line.unit_of_measure || 'PCS',
        description: line.description || line.item_name,
        deleted: line.deleted === true,
      }));

      const updatedPurchase = await updatePurchaseLines(purchase.id, linesData);
      setPurchase(updatedPurchase);
      setLines((updatedPurchase.lines || []).map(normalizePurchaseLine));
      setLineDrafts({});
    } catch (error: any) {
      console.error('Error updating lines:', error);
      Alert.alert('Error', 'Failed to update purchase lines');
    } finally {
      setIsSaving(false);
    }
  };

  const openLineSpecifications = async (line: PurchaseLine) => {
    if (!purchase.id) {
      Alert.alert(
        'Save first',
        'Create the purchase header before adding specifications.',
      );
      return;
    }
    if (!line.id) {
      Alert.alert(
        'Save line first',
        'Save the purchase so the line is stored, then you can add tracking specifications (same as web).',
      );
      return;
    }
    if (!line.item_no) {
      return;
    }
    if (!line.quantity || line.quantity <= 0) {
      Alert.alert(
        'Quantity required',
        'Set the line quantity to at least 1 before adding tracking specifications. The total spec quantities must match the line quantity (in base units).',
      );
      return;
    }
    setOpeningSpecs(true);
    try {
      const item = await fetchItemByNo(line.item_no);
      if (!item?.tracking_code) {
        Alert.alert(
          'No tracking setup',
          'This item has no tracking code on file. Specifications apply only to items with a tracking code (same as web).',
        );
        return;
      }
      setSpecModalCtx({
        lineId: line.id,
        itemPk: item.id,
        itemNo: item.no,
        itemName: item.item_name || line.item_name,
        tracking: item.tracking_code,
      });
      setSpecModalOpen(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        'Could not load item details';
      Alert.alert('Error', String(msg));
    } finally {
      setOpeningSpecs(false);
    }
  };

  const handleDeleteLine = async (index: number, line: PurchaseLine) => {
    if (!purchase.id) return;

    Alert.alert('Delete Item', 'Are you sure you want to remove this item?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (line.id) {
            const updatedLines = lines.map(currentLine =>
              currentLine.id === line.id
                ? {...currentLine, deleted: true}
                : currentLine,
            );
            await handleUpdateLines(updatedLines);
          } else {
            const updatedLines = lines.filter((_, i) => i !== index);
            setLines(updatedLines);
            setLineDrafts({});
          }
        },
      },
    ]);
  };

  const commitLineNumericField = async (
    index: number,
    field: 'quantity' | 'unit_cost',
    value: number,
  ) => {
    const updatedLines = lines.map((currentLine, i) =>
      i === index ? {...currentLine, [field]: value} : currentLine,
    );
    setLines(updatedLines);
    if (purchase.id) {
      await handleUpdateLines(updatedLines);
    }
  };

  const handlePostPurchase = async () => {
    if (!purchase.id) {
      Alert.alert('Error', 'Purchase not created yet');
      return;
    }

    if (lines.length === 0) {
      Alert.alert('Error', 'Please add at least one item before posting');
      return;
    }

    Alert.alert(
      'Post Purchase',
      'Are you sure? This will finalize the purchase and cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Post',
          onPress: async () => {
            setPostingPurchase(true);
            try {
              await postPurchase(purchase.id!);
              Alert.alert('Success', 'Purchase posted successfully', [
                {
                  text: 'OK',
                  onPress: () => safeGoBack(navigation, 'Purchases'),
                },
              ]);
            } catch (error: any) {
              console.error('Error posting purchase:', error);
              const errorMessage =
                error?.response?.data?.error ||
                error?.response?.data?.error_details ||
                error?.message ||
                'Failed to post purchase';
              Alert.alert('Error', errorMessage);
            } finally {
              setPostingPurchase(false);
            }
          },
        },
      ],
    );
  };

  const renderVendorPicker = () => (
    <Modal
      visible={vendorModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setVendorModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, t.modalSurface]}>
          <View style={[styles.modalHeader, t.modalHeaderBorder]}>
            <Text style={[styles.modalTitle, t.modalTitle]}>Select Vendor</Text>
            <QuickIconPressable
              onPress={() => {
                setVendorModalVisible(false);
                setVendorSearchQuery('');
              }}
              style={styles.closeButton}
              accessibilityLabel="Close">
              <Image
                source={icons.cross as ImageSourcePropType}
                style={[styles.closeIcon, {tintColor: colors.textTertiary}]}
                resizeMode="contain"
              />
            </QuickIconPressable>
          </View>

          <View style={[styles.searchContainer, t.searchBarBorder]}>
            <View style={[styles.searchInputContainer, t.searchInner]}>
              <Image
                source={icons.search as ImageSourcePropType}
                style={[styles.searchIcon, {tintColor: colors.textTertiary}]}
                resizeMode="contain"
              />
              <TextInput
                style={[styles.searchInput, {color: colors.textPrimary}]}
                placeholder="Search vendors..."
                placeholderTextColor={colors.placeholder}
                value={vendorSearchQuery}
                onChangeText={setVendorSearchQuery}
              />
            </View>
          </View>

          {vendorsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={vendors}
              keyExtractor={item => item.id.toString()}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[styles.vendorItem, t.listRowBorder]}
                  onPress={() => handleVendorSelect(item)}
                  activeOpacity={0.7}>
                  <View style={styles.vendorItemLeft}>
                    <Text style={[styles.vendorItemName, t.sectionTitle]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.vendorItemCode, t.mutedText]}>
                      {item.no}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, t.mutedText]}>
                    No vendors found
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderItemPicker = () => (
    <Modal
      visible={itemModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setItemModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, t.modalSurface]}>
          <View style={[styles.modalHeader, t.modalHeaderBorder]}>
            <Text style={[styles.modalTitle, t.modalTitle]}>Select Item</Text>
            <QuickIconPressable
              onPress={() => {
                setItemModalVisible(false);
                setItemSearchQuery('');
              }}
              style={styles.closeButton}
              accessibilityLabel="Close">
              <Image
                source={icons.cross as ImageSourcePropType}
                style={[styles.closeIcon, {tintColor: colors.textTertiary}]}
                resizeMode="contain"
              />
            </QuickIconPressable>
          </View>

          <View style={[styles.searchContainer, t.searchBarBorder]}>
            <View style={[styles.searchInputContainer, t.searchInner]}>
              <Image
                source={icons.search as ImageSourcePropType}
                style={[styles.searchIcon, {tintColor: colors.textTertiary}]}
                resizeMode="contain"
              />
              <TextInput
                style={[styles.searchInput, {color: colors.textPrimary}]}
                placeholder="Search items..."
                placeholderTextColor={colors.placeholder}
                value={itemSearchQuery}
                onChangeText={setItemSearchQuery}
              />
            </View>
          </View>

          {itemsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={item =>
                item?.id?.toString() ||
                item?.no ||
                item?.system_id ||
                Math.random().toString()
              }
              renderItem={({item}) => (
                <TouchableOpacity
                  style={[styles.itemListItem, t.listRowBorder]}
                  onPress={() => handleAddItem(item)}
                  activeOpacity={0.7}>
                  <View style={[styles.itemImageContainer, t.thumbBg]}>
                    <Image
                      source={
                        item.item_images && item.item_images[0]?.url
                          ? {uri: item.item_images[0].url}
                          : icons.product2
                      }
                      style={styles.itemListItemImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.itemListItemLeft}>
                    <Text style={[styles.itemListItemName, t.sectionTitle]}>
                      {item.item_name || item.name}
                    </Text>
                    <Text style={[styles.itemListItemCode, t.mutedText]}>
                      {item.no || item.item_no}
                    </Text>
                  </View>
                  <Text style={styles.itemListItemPrice}>
                    UGX{' '}
                    {(item.unit_cost || item.unit_price || 0).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, t.mutedText]}>
                    No items found
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderLineItem = (line: PurchaseLine, index: number) => {
    if (line.deleted) return null;

    const draftKey = getLineDraftKey(line, index);
    const quantityDisplay = formatLineNumericDisplay(
      line.quantity,
      lineDrafts[draftKey]?.quantity,
      false,
      true,
    );
    const unitCostDisplay = formatLineNumericDisplay(
      line.unit_cost,
      lineDrafts[draftKey]?.unit_cost,
      true,
      true,
    );
    const previewQuantity =
      lineDrafts[draftKey]?.quantity !== undefined
        ? parseDecimalInput(lineDrafts[draftKey].quantity!)
        : line.quantity;
    const previewUnitCost =
      lineDrafts[draftKey]?.unit_cost !== undefined
        ? parseDecimalInput(lineDrafts[draftKey].unit_cost!)
        : line.unit_cost;

    return (
      <View key={line.id || index} style={[styles.lineItemCard, t.lineCard]}>
        <View style={styles.lineItemHeader}>
          <View style={styles.lineItemInfo}>
            <Text style={[styles.lineItemName, t.sectionTitle]}>{line.item_name}</Text>
            <Text style={[styles.lineItemCode, t.mutedText]}>{line.item_no}</Text>
          </View>
          {purchase.status !== 'Posted' && (
            <TouchableOpacity
              onPress={() => handleDeleteLine(index, line)}
              style={styles.deleteLineButton}>
              <Image
                source={icons.delete_icon as ImageSourcePropType}
                style={styles.deleteLineIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.lineItemFields}>
          <View style={styles.lineItemField}>
            <Text style={[styles.lineItemLabel, t.mutedText]}>Quantity</Text>
            <TextInput
              style={[
                styles.lineItemInput,
                t.lineInput,
                purchase.status === 'Posted' && t.inputDisabled,
              ]}
              value={quantityDisplay}
              onChangeText={text => {
                const formatted = formatCommaInput(text);
                setLineDrafts(prev => ({
                  ...prev,
                  [draftKey]: {...prev[draftKey], quantity: formatted},
                }));
              }}
              onBlur={() => {
                const raw =
                  lineDrafts[draftKey]?.quantity ??
                  formatLineNumericDisplay(line.quantity, undefined, false, true);
                const qty = parseDecimalInput(raw);
                const finalQty = qty > 0 ? qty : 1;
                clearLineDraft(draftKey, 'quantity');
                void commitLineNumericField(index, 'quantity', finalQty);
              }}
              keyboardType="decimal-pad"
              editable={purchase.status !== 'Posted'}
            />
            <Text style={[styles.lineItemUOM, t.mutedText]}>
              {line.unit_of_measure}
            </Text>
          </View>

          <View style={styles.lineItemField}>
            <Text style={[styles.lineItemLabel, t.mutedText]}>Unit Cost</Text>
            <TextInput
              style={[
                styles.lineItemInput,
                t.lineInput,
                purchase.status === 'Posted' && t.inputDisabled,
              ]}
              value={unitCostDisplay}
              placeholder="Enter cost"
              placeholderTextColor={colors.placeholder}
              onChangeText={text => {
                const formatted = formatCommaInput(text);
                setLineDrafts(prev => ({
                  ...prev,
                  [draftKey]: {...prev[draftKey], unit_cost: formatted},
                }));
              }}
              onBlur={() => {
                const raw =
                  lineDrafts[draftKey]?.unit_cost ??
                  formatLineNumericDisplay(line.unit_cost, undefined, true, true);
                const cost = parseDecimalInput(raw);
                clearLineDraft(draftKey, 'unit_cost');
                void commitLineNumericField(index, 'unit_cost', cost);
              }}
              keyboardType="decimal-pad"
              editable={purchase.status !== 'Posted'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.specsButton,
            {borderColor: colors.border, backgroundColor: colors.inputBackground},
          ]}
          onPress={() => openLineSpecifications(line)}
          disabled={openingSpecs || !line.item_no}
          activeOpacity={0.7}>
          {openingSpecs ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.specsButtonText}>
              Item specifications / tracking
            </Text>
          )}
        </TouchableOpacity>

        <View style={[styles.lineItemTotal, {borderTopColor: colors.border}]}>
          <Text style={[styles.lineItemTotalLabel, t.mutedText]}>
            Line Total:
          </Text>
          <Text style={styles.lineItemTotalValue}>
            UGX {(previewQuantity * previewUnitCost).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, t.screen]}>
      <KeyboardAvoidingView
        style={styles.keyboardFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.topHeader, t.topHeader]}>
          <QuickIconPressable
            onPress={() => safeGoBack(navigation, 'Purchases')}
            style={[
              styles.headerCircleBtn,
              {backgroundColor: colors.backButtonBg},
            ]}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityLabel="Go back">
            <Image
              source={icons.back}
              style={[styles.headerBackIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.headerBarTitle, t.headerTitle]}>
            {existingPurchase ? 'Edit purchase' : 'New purchase'}
          </Text>
          <View style={styles.headerBarSpacer} />
        </View>
        <ScrollView
          style={[styles.scrollView, {backgroundColor: colors.screenMuted}]}
          contentContainerStyle={[styles.scrollContent, styles.scrollContentBottom]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Invoice Number */}
          {purchase.invoice_no && (
            <View style={[styles.invoiceNumberContainer, t.sectionCard]}>
              <Text style={[styles.invoiceNumberLabel, t.mutedText]}>
                Invoice No:
              </Text>
              <Text style={styles.invoiceNumber}>{purchase.invoice_no}</Text>
            </View>
          )}

          {/* Vendor Selection */}
          <View style={[styles.section, t.sectionCard]}>
            <Text style={[styles.sectionTitle, t.sectionTitle]}>Vendor *</Text>
            {vendor ? (
              <View style={[styles.vendorCard, t.vendorInner]}>
                <View style={styles.vendorInfo}>
                  <Text style={[styles.vendorName, t.sectionTitle]}>
                    {vendor.name}
                  </Text>
                  <Text style={[styles.vendorCode, t.mutedText]}>{vendor.no}</Text>
                </View>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => setVendorModalVisible(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.selectVendorButton, t.dashedSelect]}
                onPress={() => setVendorModalVisible(true)}
                activeOpacity={0.7}>
                <Image
                  source={icons.plus as ImageSourcePropType}
                  style={styles.selectButtonIcon}
                  resizeMode="contain"
                />
                <Text style={styles.selectButtonText}>Select vendor</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Header Fields */}
          {vendor && (
            <>
              <View style={[styles.section, t.sectionCard]}>
                <Text style={[styles.sectionTitle, t.sectionTitle]}>
                  Document date
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    t.input,
                    purchase.status === 'Posted' && t.inputDisabled,
                  ]}
                  value={purchase.document_date}
                  onChangeText={text =>
                    setPurchase(prev => ({...prev, document_date: text}))
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                  editable={purchase.status !== 'Posted'}
                />
              </View>

              <View style={[styles.section, t.sectionCard]}>
                <Text style={[styles.sectionTitle, t.sectionTitle]}>
                  Vendor invoice no
                </Text>
                <View style={styles.vendorInvoiceRow}>
                  <TextInput
                    style={[
                      styles.vendorInvoiceInput,
                      styles.input,
                      t.input,
                      purchase.status === 'Posted' && t.inputDisabled,
                    ]}
                    value={purchase.vendor_invoice_no ?? ''}
                    onChangeText={text =>
                      setPurchase(prev => ({...prev, vendor_invoice_no: text}))
                    }
                    placeholder="Vendor's invoice number"
                    placeholderTextColor={colors.placeholder}
                    editable={purchase.status !== 'Posted'}
                  />
                  <TouchableOpacity
                    style={[
                      styles.generateInvoiceNoBtn,
                      (purchase.status === 'Posted' ||
                        generatingVendorInvoiceNo) &&
                        styles.generateInvoiceNoBtnDisabled,
                    ]}
                    onPress={handleGenerateVendorInvoiceNo}
                    disabled={
                      purchase.status === 'Posted' ||
                      generatingVendorInvoiceNo
                    }
                    activeOpacity={0.7}>
                    {generatingVendorInvoiceNo ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.white}
                      />
                    ) : (
                      <Text style={styles.generateInvoiceNoBtnText}>
                        Generate
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {purchase.status !== 'Posted' ? (
                  <Text style={[styles.generateHint, t.mutedText]}>
                    {purchase.invoice_no
                      ? 'Generate replaces the vendor invoice number and saves it on this purchase.'
                      : 'Generate picks a unique number now; it is stored when you create the purchase.'}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.section, t.sectionCard]}>
                <Text style={[styles.sectionTitle, t.sectionTitle]}>
                  Contact person
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    t.input,
                    purchase.status === 'Posted' && t.inputDisabled,
                  ]}
                  value={purchase.contact_person}
                  onChangeText={text =>
                    setPurchase(prev => ({...prev, contact_person: text}))
                  }
                  placeholder="Contact person name"
                  placeholderTextColor={colors.placeholder}
                  editable={purchase.status !== 'Posted'}
                />
              </View>

              <View style={[styles.section, t.sectionCard]}>
                <Text style={[styles.sectionTitle, t.sectionTitle]}>
                  Payment method
                </Text>
                <TouchableOpacity
                  style={[styles.pickerButton, t.pickerRow]}
                  onPress={() => {
                    Alert.alert('Payment Method', 'Select payment method', [
                      {text: 'Cancel', style: 'cancel'},
                      ...paymentMethods.map(method => ({
                        text: `${method.code} - ${method.description}`,
                        onPress: () =>
                          setPurchase(prev => ({
                            ...prev,
                            payment_method: method.id,
                          })),
                      })),
                    ]);
                  }}
                  activeOpacity={0.7}
                  disabled={purchase.status === 'Posted'}>
                  <Text style={[styles.pickerButtonText, t.pickerText]}>
                    {purchase.payment_method
                      ? paymentMethods.find(
                          m => m.id === purchase.payment_method,
                        )?.description || 'Select...'
                      : 'Select payment method'}
                  </Text>
                  <Image
                    source={icons.down_arrow as ImageSourcePropType}
                    style={[
                      styles.pickerArrow,
                      {tintColor: colors.textTertiary},
                    ]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Create Purchase Button */}
          {vendor && !purchase.id && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreatePurchase}
              disabled={isLoading}
              activeOpacity={0.7}>
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.createButtonText}>Create purchase</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Line Items Section */}
          {purchase.id && (
            <>
              <View style={[styles.section, t.sectionCard]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitleFlat, t.sectionTitle]}>
                    Attachments
                  </Text>
                  {purchase.status !== 'Posted' && canEdit(PAGE_NAME) ? (
                    <TouchableOpacity
                      style={styles.addItemButton}
                      onPress={handleAddAttachment}
                      disabled={uploadAttachmentBusy}
                      activeOpacity={0.7}>
                      {uploadAttachmentBusy ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.primary}
                        />
                      ) : (
                        <>
                          <Image
                            source={icons.plus as ImageSourcePropType}
                            style={styles.addItemIcon}
                            resizeMode="contain"
                          />
                          <Text style={styles.addItemButtonText}>Add file</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
                {attachmentsLoading ? (
                  <ActivityIndicator
                    color={COLORS.primary}
                    style={styles.attachmentsLoader}
                  />
                ) : attachments.length === 0 ? (
                  <View style={[styles.emptyLinesContainer, t.emptyBox]}>
                    <Text style={[styles.emptyLinesText, t.mutedText]}>
                      No attachments. Add invoices, delivery notes, or other
                      documents.
                    </Text>
                  </View>
                ) : (
                  attachments.map(att => (
                    <View
                      key={att.id}
                      style={[styles.attachmentRow, t.lineCard]}>
                      <TouchableOpacity
                        style={styles.attachmentRowMain}
                        onPress={() => handleOpenAttachment(att.file_url)}
                        activeOpacity={0.7}>
                        <Text
                          style={[styles.attachmentName, t.sectionTitle]}
                          numberOfLines={1}>
                          {att.original_name || 'File'}
                        </Text>
                        <Text style={[styles.attachmentOpenHint, t.mutedText]}>
                          Open
                        </Text>
                      </TouchableOpacity>
                      {purchase.status !== 'Posted' && canEdit(PAGE_NAME) ? (
                        <TouchableOpacity
                          style={styles.attachmentDeleteBtn}
                          onPress={() => handleDeleteAttachment(att)}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                          activeOpacity={0.7}>
                          <Image
                            source={icons.delete_icon as ImageSourcePropType}
                            style={[
                              styles.attachmentDeleteIcon,
                              {tintColor: colors.textSecondary},
                            ]}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))
                )}
              </View>

              <View style={[styles.section, t.sectionCard]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitleFlat, t.sectionTitle]}>
                    Items
                  </Text>
                  {purchase.status !== 'Posted' && (
                    <TouchableOpacity
                      style={styles.addItemButton}
                      onPress={() => setItemModalVisible(true)}
                      activeOpacity={0.7}>
                      <Image
                        source={icons.plus as ImageSourcePropType}
                        style={styles.addItemIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.addItemButtonText}>Add item</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {lines.length === 0 ? (
                  <View style={[styles.emptyLinesContainer, t.emptyBox]}>
                    <Text style={[styles.emptyLinesText, t.mutedText]}>
                      No items yet. Tap Add item to add lines.
                    </Text>
                  </View>
                ) : (
                  lines.map((line, index) => renderLineItem(line, index))
                )}
              </View>

              <View style={[styles.totalsSection, t.totalsCard]}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, t.sectionTitle]}>
                    Total amount
                  </Text>
                  <Text style={styles.totalValue}>
                    UGX {(purchase.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsSection}>
                <TouchableOpacity
                  style={[styles.saveDraftButton, t.secondaryBtn]}
                  onPress={() => safeGoBack(navigation, 'Purchases')}
                  activeOpacity={0.7}>
                  <Text style={[styles.saveDraftButtonText, t.secondaryBtnText]}>
                    Save draft
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.postButton,
                    (lines.length === 0 || purchase.status === 'Posted') &&
                      styles.postButtonDisabled,
                  ]}
                  onPress={handlePostPurchase}
                  disabled={
                    lines.length === 0 ||
                    purchase.status === 'Posted' ||
                    postingPurchase
                  }
                  activeOpacity={0.7}>
                  {postingPurchase ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.postButtonText}>Post purchase</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {isSaving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[styles.savingText, t.mutedText]}>Saving...</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {renderVendorPicker()}
      {renderItemPicker()}
      {specModalCtx && purchase.id != null && (
        <PurchaseLineSpecificationsModal
          visible={specModalOpen}
          onClose={() => {
            setSpecModalOpen(false);
            setSpecModalCtx(null);
          }}
          purchaseId={purchase.id}
          lineId={specModalCtx.lineId}
          itemPk={specModalCtx.itemPk}
          itemNo={specModalCtx.itemNo}
          itemName={specModalCtx.itemName}
          trackingInfo={specModalCtx.tracking}
          readOnly={purchase.status === 'Posted'}
        />
      )}
      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectTab}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardFlex: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBackIcon: {
    width: 20,
    height: 20,
  },
  headerBarTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerBarSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.base * 2,
    paddingBottom: SIZES.padding * 2,
  },
  scrollContentBottom: {
    paddingBottom: 100,
  },
  invoiceNumberContainer: {
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  invoiceNumberLabel: {
    ...FONTS.body4,
    fontWeight: '500',
  },
  invoiceNumber: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  section: {
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  sectionTitle: {
    ...FONTS.h4,
    fontWeight: '600',
    marginBottom: SIZES.base * 1.5,
  },
  sectionTitleFlat: {
    ...FONTS.h4,
    fontWeight: '600',
    marginBottom: 0,
  },
  vendorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    ...FONTS.h4,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  vendorCode: {
    ...FONTS.body4,
  },
  changeButton: {
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
  },
  changeButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  selectVendorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: SIZES.base,
  },
  selectButtonIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary,
  },
  selectButtonText: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
  },
  input: {
    ...FONTS.body3,
    padding: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  vendorInvoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.base,
  },
  vendorInvoiceInput: {
    flex: 1,
    minWidth: 0,
  },
  generateInvoiceNoBtn: {
    paddingHorizontal: SIZES.base * 1.75,
    paddingVertical: SIZES.base * 1.35,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateInvoiceNoBtnDisabled: {
    opacity: 0.45,
  },
  generateInvoiceNoBtnText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
  generateHint: {
    ...FONTS.body5,
    marginTop: SIZES.base,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerButtonText: {
    ...FONTS.body3,
    flex: 1,
  },
  pickerArrow: {
    width: 16,
    height: 16,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 2,
    paddingVertical: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    gap: SIZES.base * 0.5,
  },
  addItemIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.white,
  },
  addItemButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyLinesContainer: {
    padding: SIZES.base * 2,
    alignItems: 'center',
    borderRadius: SIZES.radius,
  },
  emptyLinesText: {
    ...FONTS.body3,
    textAlign: 'center',
  },
  attachmentsLoader: {
    marginVertical: SIZES.base * 1.5,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base * 1.25,
    paddingHorizontal: SIZES.base * 1.5,
    marginBottom: SIZES.base,
    borderRadius: SIZES.radius,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SIZES.base,
  },
  attachmentRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SIZES.base,
  },
  attachmentName: {
    ...FONTS.body3,
    flex: 1,
    fontWeight: '500',
  },
  attachmentOpenHint: {
    ...FONTS.body5,
  },
  attachmentDeleteBtn: {
    padding: SIZES.base * 0.75,
  },
  attachmentDeleteIcon: {
    width: 20,
    height: 20,
  },
  lineItemCard: {
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 1.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.base * 1.5,
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemName: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  lineItemCode: {
    ...FONTS.body5,
  },
  deleteLineButton: {
    padding: SIZES.base * 0.5,
  },
  deleteLineIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.error,
  },
  lineItemFields: {
    flexDirection: 'row',
    gap: SIZES.base,
    marginBottom: SIZES.base * 1.5,
  },
  lineItemField: {
    flex: 1,
  },
  lineItemLabel: {
    ...FONTS.body5,
    marginBottom: SIZES.base * 0.5,
  },
  lineItemInput: {
    ...FONTS.body3,
    padding: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lineItemUOM: {
    ...FONTS.body5,
    marginTop: SIZES.base * 0.25,
  },
  specsButton: {
    alignSelf: 'flex-start',
    marginTop: SIZES.base,
    marginBottom: SIZES.base * 0.5,
    paddingVertical: SIZES.base * 0.75,
    paddingHorizontal: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  specsButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  lineItemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SIZES.base * 1.5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lineItemTotalLabel: {
    ...FONTS.body3,
    fontWeight: '500',
  },
  lineItemTotalValue: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  totalsSection: {
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...FONTS.h4,
    fontWeight: '600',
  },
  totalValue: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: '600',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: SIZES.base,
    marginBottom: SIZES.base * 2,
  },
  saveDraftButton: {
    flex: 1,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveDraftButtonText: {
    ...FONTS.button,
    fontWeight: '600',
  },
  postButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  postButtonDisabled: {
    backgroundColor: COLORS.lightGray1,
    opacity: 0.5,
  },
  postButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontWeight: '600',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.base,
    gap: SIZES.base,
  },
  savingText: {
    ...FONTS.body4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '90%',
    paddingBottom: SIZES.padding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    ...FONTS.h3,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 20,
    height: 20,
  },
  searchContainer: {
    padding: SIZES.base * 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    height: 48,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 0,
  },
  loadingContainer: {
    padding: SIZES.padding * 2,
    alignItems: 'center',
  },
  vendorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  vendorItemLeft: {
    flex: 1,
  },
  vendorItemName: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  vendorItemCode: {
    ...FONTS.body5,
  },
  itemListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SIZES.base * 1.5,
  },
  itemImageContainer: {
    width: 50,
    height: 50,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemListItemImage: {
    width: 50,
    height: 50,
  },
  itemListItemLeft: {
    flex: 1,
  },
  itemListItemName: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  itemListItemCode: {
    ...FONTS.body5,
  },
  itemListItemPrice: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: SIZES.padding * 2,
    alignItems: 'center',
  },
  emptyText: {
    ...FONTS.body3,
  },
});

export default PurchaseCreation;
