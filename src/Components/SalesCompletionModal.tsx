import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import ReactNativeModal from 'react-native-modal';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_HIT_SLOP,
} from '../constants';
import {QuickIconPressable} from './QuickIconPressable';
import {CartItem, SalesInvoiceData} from '../@types/types.dto';
import {validateCartTracking} from '../utils/salesTracking';
import {formatCurrencyCompact} from '../utils/currency';
import {
  fetchPaymentMethods,
  createSalesInvoice,
  postSalesInvoice,
  getCompanyInfo,
  Customer,
  PaymentMethod,
} from '../services/app.services';
import {getLocalPaymentMethods} from '../services/localData';
import {completeOfflineSale} from '../services/offline/OfflineSaleService';
import {loadReceiptBusinessInfo} from '../services/companyInfoCache';
import {useOfflineOptional} from '../context/OfflineContext';
import {getEffectiveIsOnline} from '../utils/posConnectivity';
import {getCartTrackingMode} from '../utils/posConnectivity';
import PrintService, {CompanyInfo} from '../services/PrintService';
import {useTheme} from '../context/ThemeContext';

const WINDOW_HEIGHT = Dimensions.get('window').height;
/** Tender step needs a real height; otherwise flex children collapse to a thin strip at the bottom. */
const TENDER_MODAL_MIN_HEIGHT = Math.round(WINDOW_HEIGHT * 0.52);

interface SalesCompletionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
  cartItems: CartItem[];
  total: number;
  username: string;
  userId: number;
  documentDate?: string; // Optional global selling date
  initialSelectedCustomer?: Customer | null;
}

const SalesCompletionModal: React.FC<SalesCompletionModalProps> = ({
  isVisible,
  onClose,
  onSuccess,
  cartItems,
  total,
  username,
  userId,
  documentDate,
  initialSelectedCustomer,
}) => {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const offlineCtx = useOfflineOptional();
  const isPosOnline = offlineCtx?.isOnline ?? getEffectiveIsOnline();
  const st = useMemo(
    () => ({
      modalView: {backgroundColor: colors.surface},
      sectionTitle: {color: colors.textPrimary},
      summaryLabel: {color: colors.textSecondary},
      summaryValue: {color: colors.textPrimary},
      totalRow: {borderTopColor: colors.border},
      totalLabel: {color: colors.textPrimary},
      content: {backgroundColor: colors.surface},
      paymentRow: {borderBottomColor: colors.border},
      paymentRowSel: {
        backgroundColor: isDark ? 'rgba(2, 134, 255, 0.12)' : COLORS.transparentPrimary2,
      },
      paymentRowText: {color: colors.textPrimary},
      paymentChevron: {tintColor: colors.iconMuted},
      noPayText: {color: colors.textSecondary},
      customerCard: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      customerName: {color: colors.textPrimary},
      customerCode: {color: colors.textSecondary},
      checkbox: {borderColor: colors.border},
      checkboxLabel: {color: colors.textPrimary},
      footer: {borderTopColor: colors.border, backgroundColor: colors.surface},
      cancelBtn: {backgroundColor: colors.screenMuted},
      cancelBtnText: {color: colors.textPrimary},
      checkoutClose: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      checkoutCloseGlyph: {color: colors.textPrimary},
      heroTotal: {color: colors.textPrimary},
      heroSub: {color: colors.textSecondary},
      tenderHdr: {borderBottomColor: colors.border},
      tenderBack: {backgroundColor: colors.screenMuted},
      tenderTitle: {color: colors.textPrimary},
      tenderLabel: {color: colors.textSecondary},
      tenderShell: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      tenderInput: {color: colors.textPrimary},
      tenderChange: {
        backgroundColor: isDark ? 'rgba(2,134,255,0.1)' : COLORS.transparentPrimary,
        borderColor: colors.border,
      },
      changeLabel: {color: colors.textSecondary},
    }),
    [colors, isDark],
  );

  const fallbackGeneralCustomer: Customer = {
    id: 0,
    no: 'GEN',
    name: 'General',
    system_id: 'general',
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [amountReceived, setAmountReceived] = useState('');
  const [amountReceivedDisplay, setAmountReceivedDisplay] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  /** Main checkout vs cash / amount entry (tender) screen */
  const [screenMode, setScreenMode] = useState<'main' | 'tender'>('main');

  const formatTotalDisplay = () => formatCurrencyCompact(total);

  useEffect(() => {
    if (isVisible) {
      setScreenMode('main');
      setSelectedCustomer(initialSelectedCustomer || fallbackGeneralCustomer);
      fetchPaymentMethodsData();
    }
  }, [isVisible, initialSelectedCustomer]);

  useEffect(() => {
    if (screenMode === 'tender' && paymentMethod?.requires_amount_received) {
      setAmountReceived('');
      setAmountReceivedDisplay('');
    }
  }, [screenMode, paymentMethod?.requires_amount_received, paymentMethod?.id]);

  const fetchPaymentMethodsData = async () => {
    setLoadingPaymentMethods(true);
    try {
      if (!isPosOnline) {
        const local = await getLocalPaymentMethods();
        setPaymentMethods(local);
        return;
      }
      const paymentMethodsData = await fetchPaymentMethods();
      setPaymentMethods(paymentMethodsData);
    } catch (error) {
      console.error('❌ Failed to fetch payment methods:', error);
      const local = await getLocalPaymentMethods();
      if (local.length) {
        setPaymentMethods(local);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load payment methods',
        });
      }
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const calculateChange = (): number => {
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, received - total);
  };

  const handleAmountReceivedChange = (text: string) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = text.replace(/[^0-9.]/g, '');

    // Update the raw value for calculations
    setAmountReceived(numericValue);

    // Format for display with commas
    if (numericValue) {
      const number = parseFloat(numericValue);
      if (!isNaN(number)) {
        setAmountReceivedDisplay(number.toLocaleString());
      } else {
        setAmountReceivedDisplay(numericValue);
      }
    } else {
      setAmountReceivedDisplay('');
    }
  };

  const handleCompleteSale = async () => {
    if (isProcessing) return;

    // Clear any previous error
    setErrorMessage(null);
    console.log('🔍 Starting sale completion validation...');

    // Validate inputs
    if (
      paymentMethod?.requires_amount_received &&
      (!amountReceived || parseFloat(amountReceived) < total)
    ) {
      const errorMsg =
        'Amount received must be greater than or equal to total.';
      console.log('❌ Validation error:', errorMsg);
      setErrorMessage(errorMsg);
      return;
    }

    // Don't allow completion if payment method is Bank and no amount received
    if (
      paymentMethod?.description?.toLowerCase().includes('bank') &&
      (!amountReceived || parseFloat(amountReceived) === 0)
    ) {
      const errorMsg = 'Please enter the amount received for bank payment.';
      console.log('❌ Bank payment error:', errorMsg);
      setErrorMessage(errorMsg);
      return;
    }

    const trackingMode = getCartTrackingMode(isPosOnline);
    if (trackingMode === 'strict') {
      const trackingValidation = validateCartTracking(cartItems);
      if (!trackingValidation.ok) {
        setErrorMessage(trackingValidation.message);
        return;
      }
    }

    setIsProcessing(true);

    const finalDocumentDate =
      documentDate || new Date().toISOString().split('T')[0];

    if (!isPosOnline) {
      try {
        const offlineResult = await completeOfflineSale({
          cartItems,
          customerName: selectedCustomer?.name || 'General Customer',
          customerId: selectedCustomer?.id || null,
          paymentMethodId: paymentMethod?.id || null,
          amountReceived:
            paymentMethod?.requires_amount_received === false
              ? 0
              : parseFloat(amountReceived) || total,
          changeAmount:
            paymentMethod?.requires_amount_received === false
              ? 0
              : Math.max(0, (parseFloat(amountReceived) || total) - total),
          documentDate: finalDocumentDate,
        });

        if (printReceipt) {
          try {
            const printService = PrintService.getInstance();
            const isPrinterAvailable = await printService.checkConnection();
            if (isPrinterAvailable) {
              let companyInfo: CompanyInfo | undefined;
              try {
                const cached = await loadReceiptBusinessInfo();
                const company = (cached as {company?: Record<string, string>})
                  ?.company;
                if (company) {
                  companyInfo = {
                    name: company.name || 'ZENTRO APP',
                    logo: company.logo || '',
                    address: company.address || '',
                    phone: company.phone || '',
                    email: company.email || '',
                    tin: company.tin || '',
                  };
                }
              } catch {
                /* optional */
              }

              await printService.printReceipt({
                receiptId: offlineResult.receiptNo,
                username,
                customerName: selectedCustomer?.name || 'General Customer',
                cartItems,
                subtotal: total,
                total,
                tax: 0,
                discount: 0,
                amountReceived: parseFloat(amountReceived) || total,
                change: calculateChange(),
                paymentMethod: paymentMethod?.description || 'Cash',
                saleDate: new Date().toISOString(),
                companyInfo,
              });
            }
          } catch {
            /* non-fatal */
          }
        }

        const statusLabel =
          offlineResult.syncStatus === 'posted'
            ? 'Sale posted'
            : offlineResult.syncStatus === 'failed'
              ? 'Saved — sync failed'
              : 'Saved — pending sync';

        Toast.show({
          type: offlineResult.syncStatus === 'failed' ? 'error' : 'success',
          text1: statusLabel,
          text2: `Receipt ${offlineResult.receiptNo}`,
        });

        onSuccess({
          id: offlineResult.localId,
          invoice_no: offlineResult.receiptNo,
          offline: true,
          syncStatus: offlineResult.syncStatus,
          syncError: offlineResult.syncError,
        });
        handleClose();
      } catch (error: unknown) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Offline sale failed',
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {

      const salesInvoiceData: SalesInvoiceData = {
        customer: selectedCustomer?.id || 0,
        customer_name: selectedCustomer?.name || 'General Customer',
        document_date: finalDocumentDate,
        status: 'Open',
        total_amount: total,
        amount_received:
          paymentMethod?.requires_amount_received === false
            ? 0
            : parseFloat(amountReceived) || total,
        change_amount:
          paymentMethod?.requires_amount_received === false
            ? 0
            : Math.max(0, (parseFloat(amountReceived) || total) - total),
        payment_method: paymentMethod?.id || 1,
        user: userId, // Add user ID
        lines: cartItems.map((item, index) => {
          // Debug logging for each item
          console.log(`DEBUG: Cart item ${index}:`, {
            item_id: item.item_id,
            system_id: item.system_id,
            bar_code_no: item.bar_code_no,
            item_name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            date_sold: item.date_sold,
          });

          // Use item.no for the item field (like frontend)
          // This should be "ITM-000359" format
          const itemNo = item.no || item.system_id;
          const itemTotal = (item.unit_price * item.quantity).toString();

          return {
            id: index + 1,
            item: itemNo, // item.no as string (like frontend)
            item_no: itemNo, // item.no as string
            item_name: item.item_name,
            quantity: item.quantity.toString(),
            unit_price: item.unit_price.toString(),
            total_amount: itemTotal,
            unit_of_measure: item.unit_of_measure || 'PCS',
            tracking_code: (item.selectedTrackingCode || '').trim(),
            description: '',
          };
        }),
      };

      // Debug logging to see the exact data being sent
      console.log('=== DEBUG: SALES INVOICE DATA ===');
      console.log('Document Date:', finalDocumentDate);
      console.log('Customer:', selectedCustomer);
      console.log('Payment Method:', paymentMethod);
      console.log('Cart Items:', cartItems);
      console.log('Total:', total);
      console.log('Amount Received:', amountReceived);
      console.log(
        'Full salesInvoiceData:',
        JSON.stringify(salesInvoiceData, null, 2),
      );
      console.log('=== END DEBUG ===');

      // Create sales invoice and post it automatically
      const response = await createSalesInvoice(salesInvoiceData);
      console.log('🔍 DEBUG: createSalesInvoice response:', response.data);

      if (response.data && response.data.id) {
        let postedSuccessfully = false;
        try {
          console.log('🔍 DEBUG: About to call postSalesInvoice...');
          await postSalesInvoice(response.data.id);
          postedSuccessfully = true;
          console.log('✅ Sale posted successfully!');
        } catch (postError: any) {
          console.error('Failed to post invoice:', postError);
          const apiErr = postError?.response?.data?.error;
          const msg =
            typeof apiErr === 'string'
              ? apiErr
              : postError?.message || 'Failed to post invoice.';
          setErrorMessage(msg);
          Toast.show({
            type: 'error',
            text1: 'Could not post sale',
            text2: msg.length > 140 ? `${msg.slice(0, 137)}...` : msg,
            visibilityTime: 5000,
          });
        }

        if (!postedSuccessfully) {
          return;
        }

        // Receipt printing only after a successful post (avoid "paid" slips for unposted invoices)
        try {
          if (!printReceipt) {
            console.log('🖨️ Print receipt unchecked — skipping');
          } else {
            console.log('🖨️ Checking printer availability...');
            const printService = PrintService.getInstance();
            const isPrinterAvailable = await printService.checkConnection();

            if (!isPrinterAvailable) {
              console.log('ℹ️ No printer available');
              Toast.show({
                type: 'info',
                text1: 'No Printer Found',
                text2:
                  'Pair the built-in printer in Android Bluetooth settings, open Printer configuration, then try again.',
              });
            } else {
              console.log('🖨️ Printer available, starting receipt printing...');

              let companyInfo: CompanyInfo | undefined;
              try {
                console.log('🏢 Fetching company information...');
                const companyResponse = await getCompanyInfo();
                if (companyResponse.data && companyResponse.data.company) {
                  const company = companyResponse.data.company;
                  companyInfo = {
                    name: company.name || 'ZENTRO APP',
                    logo: company.logo || '',
                    address: company.address || 'Address',
                    phone: company.phone || 'Phone',
                    email: company.email || 'Email',
                    tin: company.tin || 'TIN',
                  };
                  console.log('✅ Company info fetched:', companyInfo);
                } else {
                  console.log('⚠️ No company info found, using defaults');
                }
              } catch (companyError) {
                console.error('❌ Error fetching company info:', companyError);
              }

              const receiptData = {
                receiptId:
                  response.data.invoice_no || response.data.id.toString(),
                username: username,
                customerName: selectedCustomer?.name || 'General Customer',
                cartItems: cartItems,
                subtotal: total,
                total: total,
                tax: 0,
                discount: 0,
                amountReceived: parseFloat(amountReceived) || total,
                change: calculateChange(),
                paymentMethod: paymentMethod?.description || 'Cash',
                saleDate: new Date().toISOString(),
                companyInfo: companyInfo,
              };

              console.log('🖨️ Receipt data for printing:', receiptData);
              const printResult = await printService.printReceipt(receiptData);

              if (printResult) {
                console.log('✅ Receipt printed successfully');
                Toast.show({
                  type: 'success',
                  text1: 'Receipt Printed',
                  text2: 'Receipt has been sent to printer',
                });
              } else {
                console.log('❌ Receipt printing failed');
                Toast.show({
                  type: 'info',
                  text1: 'Print Failed',
                  text2:
                    'Receipt could not be printed. Check Bluetooth printer in Settings.',
                });
              }
            }
          }
        } catch (printError) {
          console.error('❌ Error printing receipt:', printError);
          // Don't fail the sale if printing fails
          if (printReceipt) {
            Toast.show({
              type: 'error',
              text1: 'Print Error',
              text2: 'Failed to print receipt. Sale completed successfully.',
            });
          }
        }

        Toast.show({
          type: 'success',
          text1: 'Sale Completed',
          text2: `Sales invoice created and posted successfully! Invoice No: ${
            response.data.invoice_no || response.data.id
          }`,
        });

        onSuccess(response.data);
        handleClose();
      } else {
        setErrorMessage('Failed to complete sale. No invoice ID received.');
      }
    } catch (error: any) {
      console.error('=== SALE COMPLETION ERROR ===');
      console.error('Error:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      console.error('Error message:', error?.message);
      console.error('=== END ERROR ===');
      setErrorMessage(error?.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setScreenMode('main');
      setSelectedCustomer(initialSelectedCustomer || fallbackGeneralCustomer);
      setPaymentMethod(null);
      setAmountReceived('');
      setAmountReceivedDisplay('');
      setPrintReceipt(true);
      setErrorMessage(null);
      onClose();
    }
  };

  const handlePaymentMethodRowPress = (method: PaymentMethod) => {
    if (isProcessing) {
      return;
    }
    setPaymentMethod(method);
    setErrorMessage(null);
    if (method.requires_amount_received) {
      setScreenMode('tender');
    }
  };

  const change = calculateChange();

  /** Cash/tender step: require full payment before enabling Complete Sale */
  const tenderAmountOk =
    !paymentMethod?.requires_amount_received ||
    (amountReceived !== '' && parseFloat(amountReceived) >= total);

  return (
    <ReactNativeModal
      isVisible={isVisible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      useNativeDriver={false}
      statusBarTranslucent={true}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          styles.modalView,
          st.modalView,
          screenMode === 'tender' && {minHeight: TENDER_MODAL_MIN_HEIGHT},
          // Modal + Android: automatic bottom safe area is often wrong; use explicit inset
          {paddingBottom: insets.bottom},
        ]}>
        {/* Error Message - Fixed position below header */}
        {errorMessage && (
          <View style={styles.errorContainerFixed}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <QuickIconPressable
              style={styles.errorCloseButton}
              onPress={() => setErrorMessage(null)}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Dismiss error">
              <Text style={styles.errorCloseText}>✕</Text>
            </QuickIconPressable>
          </View>
        )}

        {screenMode === 'tender' && paymentMethod ? (
          <KeyboardAvoidingView
            style={styles.tenderKeyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
            <View style={styles.tenderScreen}>
              <View style={styles.tenderTopBlock}>
                <View style={[styles.tenderHeader, st.tenderHdr]}>
                  <QuickIconPressable
                    style={[styles.tenderBackButton, st.tenderBack]}
                    onPress={() => setScreenMode('main')}
                    disabled={isProcessing}
                    hitSlop={ICON_BUTTON_HIT_SLOP}
                    accessibilityLabel="Back">
                    <Image source={icons.back} style={styles.tenderBackIcon} />
                  </QuickIconPressable>
                  <Text
                    style={[styles.tenderHeaderTitle, st.tenderTitle]}
                    numberOfLines={2}
                    ellipsizeMode="tail">
                    {formatTotalDisplay()} · {paymentMethod.description}
                  </Text>
                </View>

                <Text style={[styles.tenderFieldLabel, st.tenderLabel]}>Amount received</Text>
                <View style={[styles.tenderInputShell, st.tenderShell]}>
                  <TextInput
                    style={[styles.tenderInput, st.tenderInput]}
                    placeholder="0.00"
                    placeholderTextColor={colors.placeholder}
                    value={amountReceivedDisplay}
                    onChangeText={handleAmountReceivedChange}
                    keyboardType="decimal-pad"
                    editable={!isProcessing}
                  />
                </View>
                {amountReceived ? (
                  <View style={[styles.tenderChangeCard, st.tenderChange]}>
                    <Text style={[styles.changeLabel, st.changeLabel]}>Change</Text>
                    <Text style={styles.changeValue}>{formatCurrencyCompact(change)}</Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.tenderPrimaryButton,
                  (isProcessing || !tenderAmountOk) && styles.disabledButton,
                ]}
                onPress={handleCompleteSale}
                disabled={isProcessing || !tenderAmountOk}
                activeOpacity={0.85}>
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.tenderPrimaryButtonText}>
                    Complete Sale
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <>
            <View style={styles.checkoutHeader}>
              <QuickIconPressable
                style={[styles.checkoutCloseCircle, st.checkoutClose]}
                onPress={handleClose}
                disabled={isProcessing}
                hitSlop={ICON_BUTTON_HIT_SLOP}
                accessibilityLabel="Close">
                <Text style={[styles.checkoutCloseGlyph, st.checkoutCloseGlyph]}>✕</Text>
              </QuickIconPressable>
            </View>

            <ScrollView style={[styles.content, st.content]} showsVerticalScrollIndicator={false}>
              <View style={styles.heroTotalWrap}>
                <Text
                  style={[styles.heroTotalText, st.heroTotal]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.28}>
                  {formatTotalDisplay()}
                </Text>
                <Text style={[styles.heroSubtitle, st.heroSub]}>Select Payment Type Below</Text>
              </View>

              <View style={styles.paymentPickerSection}>
                {loadingPaymentMethods ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : paymentMethods.length === 0 ? (
                  <Text style={[styles.noPaymentMethodsText, st.noPayText]}>
                    No payment methods available.
                  </Text>
                ) : (
                  paymentMethods.map((method, index) => (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.paymentPickerRow,
                        st.paymentRow,
                        index === paymentMethods.length - 1 &&
                          styles.paymentPickerRowLast,
                        paymentMethod?.id === method.id &&
                          styles.paymentPickerRowSelected,
                        paymentMethod?.id === method.id && st.paymentRowSel,
                      ]}
                      onPress={() => handlePaymentMethodRowPress(method)}
                      disabled={isProcessing}
                      activeOpacity={0.65}>
                      <Text style={[styles.paymentPickerRowText, st.paymentRowText]}>
                        {method.description}
                      </Text>
                      <Image
                        source={icons.down_arrow}
                        style={[styles.paymentPickerChevron, st.paymentChevron]}
                      />
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Sale Summary */}
              <View style={styles.section}>
            <Text style={[styles.sectionTitle, st.sectionTitle]}>Sale Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, st.summaryLabel]}>Items:</Text>
              <Text style={[styles.summaryValue, st.summaryValue]}>{cartItems.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, st.summaryLabel]}>Subtotal:</Text>
              <Text style={[styles.summaryValue, st.summaryValue]}>{formatCurrencyCompact(total)}</Text>
            </View>
            {/* Tax and discount rows removed */}
            <View style={[styles.summaryRow, styles.totalRow, st.totalRow]}>
              <Text style={[styles.totalLabel, st.totalLabel]}>Total:</Text>
              <Text style={styles.totalValue}>{formatCurrencyCompact(total)}</Text>
            </View>
              </View>

              {/* Selected Customer */}
              <View style={styles.section}>
            <Text style={[styles.sectionTitle, st.sectionTitle]}>Customer</Text>
            <View style={[styles.selectedCustomerCard, st.customerCard]}>
              <Text style={[styles.selectedCustomerName, st.customerName]}>
                {selectedCustomer?.name || 'General'}
              </Text>
              <Text style={[styles.selectedCustomerCode, st.customerCode]}>
                {selectedCustomer?.no || 'GEN'}
              </Text>
            </View>
              </View>

              {/* Receipt Printing */}
              <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setPrintReceipt(!printReceipt)}
              disabled={isProcessing}>
              <View
                style={[styles.checkbox, st.checkbox, printReceipt && styles.checkedBox]}>
                {printReceipt && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxLabel, st.checkboxLabel]}>Print Receipt</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, st.footer]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, st.cancelBtn]}
            onPress={handleClose}
            disabled={isProcessing}>
            <Text style={[styles.cancelButtonText, st.cancelBtnText]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.completeButton,
              (isProcessing || !paymentMethod) && styles.disabledButton,
            ]}
            onPress={handleCompleteSale}
            disabled={isProcessing || !paymentMethod}>
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.completeButtonText}>Complete Sale</Text>
            )}
          </TouchableOpacity>
        </View>
          </>
        )}
      </SafeAreaView>
    </ReactNativeModal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
    zIndex: 999, // Lower z-index to allow Toast to appear on top
  },
  modalView: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.gray,
    fontWeight: 'bold',
  },
  content: {
    padding: SIZES.padding,
  },
  section: {
    marginBottom: SIZES.radius * 2,
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    marginBottom: SIZES.radius,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  summaryValue: {
    ...FONTS.body4,
    color: COLORS.darkGray,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    ...FONTS.h4,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  totalValue: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    padding: SIZES.radius,
    ...FONTS.body4,
    color: COLORS.darkGray,
  },
  inputLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 0.48,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.radius,
  },
  paymentMethod: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.radius / 2,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    minWidth: 80,
    alignItems: 'center',
  },
  selectedPaymentMethod: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  paymentMethodText: {
    ...FONTS.body5,
    color: COLORS.darkGray,
  },
  selectedPaymentMethodText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
  },
  changeLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  changeValue: {
    ...FONTS.body4,
    color: COLORS.success,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.lightGray2,
    borderRadius: 4,
    marginRight: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    ...FONTS.body4,
    color: COLORS.darkGray,
  },
  footer: {
    flexDirection: 'row',
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
    gap: SIZES.radius,
  },
  button: {
    flex: 1,
    paddingVertical: SIZES.radius,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray2,
  },
  cancelButtonText: {
    ...FONTS.body4,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: COLORS.primary,
  },
  completeButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  noPaymentMethodsText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: SIZES.radius,
  },
  selectedCustomerCard: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    backgroundColor: COLORS.transparentPrimary,
    borderRadius: SIZES.radius,
    padding: SIZES.radius,
  },
  selectedCustomerName: {
    ...FONTS.body4,
    color: COLORS.primary2,
    fontWeight: '600',
  },
  selectedCustomerCode: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: SIZES.radius,
    padding: SIZES.radius,
    marginBottom: SIZES.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorContainerFixed: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 0,
    padding: SIZES.radius,
    marginHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F44336',
  },
  errorText: {
    ...FONTS.body4,
    color: '#D32F2F',
    flex: 1,
    marginRight: SIZES.radius,
  },
  errorCloseButton: {
    padding: 4,
  },
  errorCloseText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: 8,
    paddingBottom: 12,
  },
  checkoutCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkoutCloseGlyph: {
    fontSize: 16,
    color: COLORS.darkGray,
    fontWeight: '600',
  },
  heroTotalWrap: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  heroTotalText: {
    fontSize: 44,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 14,
    fontWeight: '500',
  },
  paymentPickerSection: {
    marginBottom: SIZES.radius * 2,
  },
  paymentPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray2,
  },
  paymentPickerRowLast: {
    borderBottomWidth: 0,
  },
  paymentPickerRowSelected: {
    backgroundColor: COLORS.transparentPrimary2,
  },
  paymentPickerRowText: {
    ...FONTS.body3,
    color: COLORS.darkGray,
    fontWeight: '500',
    fontSize: 17,
    flex: 1,
    paddingRight: 12,
  },
  paymentPickerChevron: {
    width: 14,
    height: 14,
    tintColor: COLORS.gray,
    transform: [{rotate: '-90deg'}],
  },
  tenderKeyboardView: {
    flex: 1,
    width: '100%',
  },
  tenderScreen: {
    flex: 1,
    width: '100%',
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding,
    justifyContent: 'space-between',
  },
  tenderTopBlock: {
    flexShrink: 0,
  },
  tenderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray1,
  },
  tenderBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: COLORS.lightGray2,
  },
  tenderBackIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.primary2,
  },
  tenderHeaderTitle: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
    flex: 1,
  },
  tenderFieldLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tenderInputShell: {
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  tenderInput: {
    paddingVertical: 14,
    ...FONTS.h2,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.black,
    fontWeight: '600',
  },
  tenderChangeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.transparentPrimary,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  tenderPrimaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  tenderPrimaryButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default SalesCompletionModal;
