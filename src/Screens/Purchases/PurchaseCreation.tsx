import React, {useState, useEffect, useCallback, useRef} from 'react';
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
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {COLORS, FONTS, SIZES} from '../../constants/theme';
import icons from '../../constants/icons';
import Header from '../../Components/Header';
import {
  upsertPurchase,
  updatePurchaseLines,
  postPurchase,
  fetchVendors,
  searchItems,
  fetchPurchasesData,
} from '../../services/app.services';
import {fetchPaymentMethods} from '../../services/app.services';
import {usePermissions} from '../../hooks/usePermissions';
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
};

const PurchaseCreation = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {canCreate, canEdit} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PURCHASES;

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
              setLines(fullPurchase.lines || []);
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
        setLines(existingPurchase.lines);
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
      if (purchase.id) {
        Alert.alert('Success', 'Purchase updated successfully');
      } else {
        Alert.alert('Success', 'Purchase created successfully');
      }
    } catch (error: any) {
      console.error('Error creating/updating purchase:', error);
      const errorMessage =
        error?.response?.data?.vendor_name ||
        error?.message ||
        'Failed to save purchase';
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
      unit_cost: parseFloat(item.unit_cost || item.unit_price || '0'),
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
      const linesData = updatedLines
        .filter(line => !line.deleted)
        .map(line => ({
          id: line.id,
          system_id: line.system_id,
          item_no: line.item_no,
          item_name: line.item_name,
          item_system_id: line.item_system_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
          unit_of_measure: line.unit_of_measure || 'PCS',
          description: line.description || line.item_name,
          deleted: line.deleted || false,
        }));

      const updatedPurchase = await updatePurchaseLines(purchase.id, linesData);
      setPurchase(updatedPurchase);
      setLines(updatedPurchase.lines || []);
    } catch (error: any) {
      console.error('Error updating lines:', error);
      Alert.alert('Error', 'Failed to update purchase lines');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLine = async (lineId: number) => {
    if (!purchase.id) return;

    Alert.alert('Delete Item', 'Are you sure you want to remove this item?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updatedLines = lines.map(line =>
            line.id === lineId ? {...line, deleted: true} : line,
          );
          await handleUpdateLines(updatedLines);
        },
      },
    ]);
  };

  const handleUpdateLine = async (
    lineId: number,
    field: 'quantity' | 'unit_cost',
    value: number,
  ) => {
    const updatedLines = lines.map(line =>
      line.id === lineId ? {...line, [field]: value} : line,
    );
    setLines(updatedLines);
    // Auto-save on blur
    setTimeout(() => {
      handleUpdateLines(updatedLines);
    }, 500);
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
                  onPress: () => navigation.goBack(),
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
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vendor</Text>
            <TouchableOpacity
              onPress={() => {
                setVendorModalVisible(false);
                setVendorSearchQuery('');
              }}
              style={styles.closeButton}>
              <Image
                source={icons.cross as ImageSourcePropType}
                style={styles.closeIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Image
                source={icons.search as ImageSourcePropType}
                style={styles.searchIcon}
                resizeMode="contain"
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vendors..."
                placeholderTextColor={COLORS.gray3}
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
                  style={styles.vendorItem}
                  onPress={() => handleVendorSelect(item)}
                  activeOpacity={0.7}>
                  <View style={styles.vendorItemLeft}>
                    <Text style={styles.vendorItemName}>{item.name}</Text>
                    <Text style={styles.vendorItemCode}>{item.no}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No vendors found</Text>
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
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Item</Text>
            <TouchableOpacity
              onPress={() => {
                setItemModalVisible(false);
                setItemSearchQuery('');
              }}
              style={styles.closeButton}>
              <Image
                source={icons.cross as ImageSourcePropType}
                style={styles.closeIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Image
                source={icons.search as ImageSourcePropType}
                style={styles.searchIcon}
                resizeMode="contain"
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor={COLORS.gray3}
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
                  style={styles.itemListItem}
                  onPress={() => handleAddItem(item)}
                  activeOpacity={0.7}>
                  <View style={styles.itemImageContainer}>
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
                    <Text style={styles.itemListItemName}>
                      {item.item_name || item.name}
                    </Text>
                    <Text style={styles.itemListItemCode}>
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
                  <Text style={styles.emptyText}>No items found</Text>
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

    return (
      <View key={line.id || index} style={styles.lineItemCard}>
        <View style={styles.lineItemHeader}>
          <View style={styles.lineItemInfo}>
            <Text style={styles.lineItemName}>{line.item_name}</Text>
            <Text style={styles.lineItemCode}>{line.item_no}</Text>
          </View>
          {purchase.status !== 'Posted' && (
            <TouchableOpacity
              onPress={() => line.id && handleDeleteLine(line.id)}
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
            <Text style={styles.lineItemLabel}>Quantity</Text>
            <TextInput
              style={styles.lineItemInput}
              value={line.quantity.toString()}
              onChangeText={text => {
                const qty = parseFloat(text) || 0;
                if (line.id) {
                  handleUpdateLine(line.id, 'quantity', qty);
                } else {
                  const updatedLines = lines.map((l, i) =>
                    i === index ? {...l, quantity: qty} : l,
                  );
                  setLines(updatedLines);
                }
              }}
              keyboardType="numeric"
              editable={purchase.status !== 'Posted'}
            />
            <Text style={styles.lineItemUOM}>{line.unit_of_measure}</Text>
          </View>

          <View style={styles.lineItemField}>
            <Text style={styles.lineItemLabel}>Unit Cost</Text>
            <TextInput
              style={styles.lineItemInput}
              value={line.unit_cost.toString()}
              onChangeText={text => {
                const cost = parseFloat(text) || 0;
                if (line.id) {
                  handleUpdateLine(line.id, 'unit_cost', cost);
                } else {
                  const updatedLines = lines.map((l, i) =>
                    i === index ? {...l, unit_cost: cost} : l,
                  );
                  setLines(updatedLines);
                }
              }}
              keyboardType="numeric"
              editable={purchase.status !== 'Posted'}
            />
          </View>
        </View>

        <View style={styles.lineItemTotal}>
          <Text style={styles.lineItemTotalLabel}>Line Total:</Text>
          <Text style={styles.lineItemTotalValue}>
            UGX {(line.quantity * line.unit_cost).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header
        title={existingPurchase ? 'Edit Purchase' : 'New Purchase'}
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Invoice Number */}
        {purchase.invoice_no && (
          <View style={styles.invoiceNumberContainer}>
            <Text style={styles.invoiceNumberLabel}>Invoice No:</Text>
            <Text style={styles.invoiceNumber}>{purchase.invoice_no}</Text>
          </View>
        )}

        {/* Vendor Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vendor *</Text>
          {vendor ? (
            <View style={styles.vendorCard}>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{vendor.name}</Text>
                <Text style={styles.vendorCode}>{vendor.no}</Text>
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
              style={styles.selectVendorButton}
              onPress={() => setVendorModalVisible(true)}
              activeOpacity={0.7}>
              <Image
                source={icons.plus as ImageSourcePropType}
                style={styles.selectButtonIcon}
                resizeMode="contain"
              />
              <Text style={styles.selectButtonText}>Select Vendor</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Header Fields */}
        {vendor && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Document Date</Text>
              <TextInput
                style={styles.input}
                value={purchase.document_date}
                onChangeText={text =>
                  setPurchase(prev => ({...prev, document_date: text}))
                }
                placeholder="YYYY-MM-DD"
                editable={purchase.status !== 'Posted'}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vendor Invoice No</Text>
              <TextInput
                style={styles.input}
                value={purchase.vendor_invoice_no}
                onChangeText={text =>
                  setPurchase(prev => ({...prev, vendor_invoice_no: text}))
                }
                placeholder="Vendor's invoice number"
                editable={purchase.status !== 'Posted'}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Person</Text>
              <TextInput
                style={styles.input}
                value={purchase.contact_person}
                onChangeText={text =>
                  setPurchase(prev => ({...prev, contact_person: text}))
                }
                placeholder="Contact person name"
                editable={purchase.status !== 'Posted'}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  // Simple payment method picker
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
                activeOpacity={0.7}>
                <Text style={styles.pickerButtonText}>
                  {purchase.payment_method
                    ? paymentMethods.find(m => m.id === purchase.payment_method)
                        ?.description || 'Select...'
                    : 'Select Payment Method'}
                </Text>
                <Image
                  source={icons.down_arrow as ImageSourcePropType}
                  style={styles.pickerArrow}
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
              <Text style={styles.createButtonText}>Create Purchase</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Line Items Section */}
        {purchase.id && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Items</Text>
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
                    <Text style={styles.addItemButtonText}>Add Item</Text>
                  </TouchableOpacity>
                )}
              </View>

              {lines.length === 0 ? (
                <View style={styles.emptyLinesContainer}>
                  <Text style={styles.emptyLinesText}>
                    No items added yet. Tap "Add Item" to add items.
                  </Text>
                </View>
              ) : (
                lines.map((line, index) => renderLineItem(line, index))
              )}
            </View>

            {/* Totals */}
            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  UGX {(purchase.total_amount || 0).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              <TouchableOpacity
                style={styles.saveDraftButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}>
                <Text style={styles.saveDraftButtonText}>Save Draft</Text>
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
                  <Text style={styles.postButtonText}>Post Purchase</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>

      {renderVendorPicker()}
      {renderItemPicker()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.base * 2,
    paddingBottom: SIZES.padding * 2,
  },
  invoiceNumberContainer: {
    backgroundColor: COLORS.white,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  invoiceNumberLabel: {
    ...FONTS.body4,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  invoiceNumber: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.white,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base * 1.5,
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 1.5,
  },
  vendorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 1.5,
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  vendorCode: {
    ...FONTS.body4,
    color: COLORS.gray2,
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
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    borderWidth: 2,
    borderColor: COLORS.primary,
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
    color: COLORS.black,
    backgroundColor: COLORS.lightGray2,
    padding: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    padding: SIZES.base * 1.5,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  pickerButtonText: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
  },
  pickerArrow: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray2,
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
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
  },
  emptyLinesText: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
  },
  lineItemCard: {
    backgroundColor: COLORS.white,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 1.5,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
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
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  lineItemCode: {
    ...FONTS.body5,
    color: COLORS.gray2,
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
    color: COLORS.gray2,
    marginBottom: SIZES.base * 0.5,
  },
  lineItemInput: {
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: COLORS.lightGray2,
    padding: SIZES.base * 1.25,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  lineItemUOM: {
    ...FONTS.body5,
    color: COLORS.gray2,
    marginTop: SIZES.base * 0.25,
  },
  lineItemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SIZES.base * 1.5,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray1,
  },
  lineItemTotalLabel: {
    ...FONTS.body3,
    color: COLORS.gray2,
    fontWeight: '500',
  },
  lineItemTotalValue: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  totalsSection: {
    backgroundColor: COLORS.white,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base * 2,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...FONTS.h4,
    color: COLORS.black,
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
    backgroundColor: COLORS.lightGray2,
    padding: SIZES.base * 2,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
  },
  saveDraftButtonText: {
    ...FONTS.button,
    color: COLORS.gray2,
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
    color: COLORS.gray2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.black,
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
    tintColor: COLORS.gray2,
  },
  searchContainer: {
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base * 1.5,
    height: 48,
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
  },
  vendorItemLeft: {
    flex: 1,
  },
  vendorItemName: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  vendorItemCode: {
    ...FONTS.body5,
    color: COLORS.gray2,
  },
  itemListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray1,
    gap: SIZES.base * 1.5,
  },
  itemImageContainer: {
    width: 50,
    height: 50,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGray2,
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
    color: COLORS.black,
    fontWeight: '600',
    marginBottom: SIZES.base * 0.5,
  },
  itemListItemCode: {
    ...FONTS.body5,
    color: COLORS.gray2,
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
    color: COLORS.gray2,
  },
});

export default PurchaseCreation;
