import React, {useState, useEffect, useMemo, useRef} from 'react';
import {
  pickDefaultCashPaymentMethod,
  paymentMethodRequiresTransactionId,
  TRANSACTION_ID_MAX_LENGTH,
  TRANSACTION_ID_REQUIRED_MESSAGE,
} from '../utils/paymentMethodDefaults';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import ReactNativeModal from 'react-native-modal';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_HIT_SLOP,
} from '../constants';
import {
  showUserError,
  showUserInfo,
  showUserSuccess,
} from '../utils/userFeedback';
import {QuickIconPressable} from './QuickIconPressable';
import {CartItem, SalesInvoiceData} from '../@types/types.dto';
import {validateCartTracking} from '../utils/salesTracking';
import {formatCurrencyCompact, getLocalCurrencyCode} from '../utils/currency';
import {
  createSalesInvoice,
  postSalesInvoice,
  getCompanyInfo,
  getSalesInvoice,
  getSalesApiErrorMessage,
  isAlreadyPostedSalesError,
  Customer,
  PaymentMethod,
} from '../services/app.services';
import {completeOfflineSale} from '../services/offline/OfflineSaleService';
import {loadReceiptBusinessInfo} from '../services/companyInfoCache';
import {tenantCompanyToReceiptInfo} from '../utils/companyReceiptInfo';
import {useOfflineOptional} from '../context/OfflineContext';
import {getEffectiveIsOnline} from '../utils/posConnectivity';
import {getCartTrackingMode} from '../utils/posConnectivity';
import {usePosPaymentMethodsQuery} from '../hooks/useSaleCustomersQuery';
import PrintService, {CompanyInfo} from '../services/PrintService';
import {useTheme} from '../context/ThemeContext';
import {
  constrainedWidthStyle,
  SHEET_MAX_WIDTH,
} from '../utils/layout';

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
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const sheetMaxHeight = Math.round(windowHeight * 0.92);
  const sheetWidthStyle = constrainedWidthStyle(
    windowWidth,
    SHEET_MAX_WIDTH,
    windowHeight,
  );
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
      dropdown: {
        borderColor: colors.border,
        backgroundColor: colors.inputBackground,
      },
      dropdownOpen: {
        borderColor: COLORS.primary,
      },
      dropdownText: {color: colors.textPrimary},
      dropdownPlaceholder: {color: colors.textSecondary},
      dropdownMenu: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      dropdownOption: {borderBottomColor: colors.border},
      dropdownOptionSel: {
        backgroundColor: isDark
          ? 'rgba(0, 81, 81, 0.14)'
          : COLORS.transparentPrimary2,
      },
      dropdownOptionText: {color: colors.textPrimary},
      dropdownOptionTextSel: {color: COLORS.primary},
      dropdownChevron: {tintColor: colors.iconMuted},
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
      tenderLabel: {color: colors.textSecondary},
      tenderShell: {
        backgroundColor: colors.inputBackground,
        borderColor: colors.border,
      },
      tenderInput: {color: colors.textPrimary},
      tenderChange: {
        backgroundColor: isDark
          ? 'rgba(0,81,81,0.1)'
          : COLORS.transparentPrimary,
        borderColor: colors.border,
      },
      changeLabel: {color: colors.textSecondary},
      exactBtn: {
        borderColor: colors.border,
        backgroundColor: colors.screenMuted,
      },
      exactBtnText: {color: colors.textPrimary},
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
  const [transactionId, setTransactionId] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);

  const {
    data: paymentMethods = [],
    isLoading: loadingPaymentMethods,
    refetch: refetchPaymentMethods,
    isError: paymentMethodsError,
  } = usePosPaymentMethodsQuery(isVisible, isPosOnline);

  const formatTotalDisplay = () => formatCurrencyCompact(total);
  const needsAmountReceived = Boolean(paymentMethod?.requires_amount_received);
  const needsTransactionId = paymentMethodRequiresTransactionId(paymentMethod);

  const didAutoSelectPaymentRef = useRef(false);

  useEffect(() => {
    if (isVisible) {
      setSelectedCustomer(initialSelectedCustomer || fallbackGeneralCustomer);
      setPaymentMethod(null);
      setAmountReceived('');
      setAmountReceivedDisplay('');
      setTransactionId('');
      setPaymentDropdownOpen(false);
      didAutoSelectPaymentRef.current = false;
      refetchPaymentMethods();
    }
  }, [isVisible, initialSelectedCustomer, refetchPaymentMethods]);

  useEffect(() => {
    if (!isVisible || !paymentMethodsError || paymentMethods.length > 0) {
      return;
    }
    showUserError(
      'Payment methods unavailable',
      'Failed to load payment methods. Check your connection and try again.',
    );
  }, [isVisible, paymentMethodsError, paymentMethods.length]);

  /** Default payment type to Cash CST when the completion sheet opens. */
  useEffect(() => {
    if (!isVisible || didAutoSelectPaymentRef.current || paymentMethods.length === 0) {
      return;
    }
    const cash = pickDefaultCashPaymentMethod(paymentMethods);
    if (!cash) {
      return;
    }
    didAutoSelectPaymentRef.current = true;
    setPaymentMethod(cash);
    if (cash.requires_amount_received) {
      const exact = String(total);
      setAmountReceived(exact);
      setAmountReceivedDisplay(total.toLocaleString());
    }
  }, [isVisible, paymentMethods, total]);

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

    if (needsTransactionId && !transactionId.trim()) {
      setErrorMessage(TRANSACTION_ID_REQUIRED_MESSAGE);
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
          transactionId: needsTransactionId ? transactionId.trim() : '',
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
                  companyInfo = tenantCompanyToReceiptInfo(
                    company as Record<string, unknown>,
                  );
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

        if (offlineResult.syncStatus === 'failed') {
          showUserError(
            statusLabel,
            offlineResult.syncError ||
              `Receipt ${offlineResult.receiptNo} was saved locally but sync failed.`,
          );
        } else {
          showUserSuccess(statusLabel, `Receipt ${offlineResult.receiptNo}`);
        }

        onSuccess({
          id: offlineResult.localId,
          invoice_no: offlineResult.receiptNo,
          offline: true,
          syncStatus: offlineResult.syncStatus,
          syncError: offlineResult.syncError,
        });
        handleClose();
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : 'Offline sale failed';
        setErrorMessage(msg);
        showUserError('Offline sale failed', msg);
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
        transaction_id: needsTransactionId ? transactionId.trim() : '',
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
          // Cart unit_price is already the UOM sell price (price list). Match web: send as-is.

          const requiresSerial = Boolean(item.tracking_code?.require_serial_no);
          const lotNo = requiresSerial
            ? ''
            : (item.selectedTrackingCode || '').trim();
          const serialNos = Array.isArray(item.selectedSerialNos)
            ? item.selectedSerialNos.filter(s => String(s || '').trim())
            : [];

          return {
            id: index + 1,
            item: itemNo, // item.no as string (like frontend)
            item_no: itemNo, // item.no as string
            item_name: item.item_name,
            quantity: item.quantity.toString(),
            unit_price: item.unit_price.toString(),
            total_amount: itemTotal,
            unit_of_measure: item.unit_of_measure || 'PCS',
            tracking_code: lotNo,
            serial_nos: serialNos,
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

      // Create Open invoice, then post explicitly (post failures must be shown).
      const response = await createSalesInvoice(salesInvoiceData);
      console.log('🔍 DEBUG: createSalesInvoice response:', response.data);

      if (response.data && response.data.id) {
        const invoiceId = response.data.id as number;
        const invoiceNo =
          response.data.invoice_no || response.data.customer_invoice_no || invoiceId;

        let postedSuccessfully = false;
        try {
          console.log('🔍 DEBUG: About to call postSalesInvoice...');
          const postResponse = await postSalesInvoice(invoiceId);
          const postedStatus =
            postResponse?.data?.status ||
            postResponse?.data?.invoice?.status ||
            postResponse?.data?.sale?.status;

          if (postedStatus && postedStatus !== 'Posted') {
            throw Object.assign(
              new Error(
                `Invoice ${invoiceNo} is still ${postedStatus} after posting.`,
              ),
              {
                response: {
                  data: {error: `Invoice is still ${postedStatus}`},
                },
              },
            );
          }

          // Confirm status when response omits it — catches false "success" responses.
          if (postedStatus !== 'Posted') {
            const confirm = await getSalesInvoice(invoiceId);
            // getSalesInvoice returns the invoice payload (not AxiosResponse).
            const confirmedStatus = confirm?.status;
            if (confirmedStatus !== 'Posted') {
              throw Object.assign(
                new Error(
                  `Invoice ${invoiceNo} was not posted (status: ${confirmedStatus || 'unknown'}).`,
                ),
                {
                  response: {
                    data: {
                      error: `Posting failed — invoice status is ${confirmedStatus || 'unknown'}`,
                      detail: `Invoice ${invoiceNo} is still ${confirmedStatus || 'unposted'}. It will not appear in Sales History until posted.`,
                    },
                  },
                },
              );
            }
          }

          postedSuccessfully = true;
          console.log('✅ Sale posted successfully!');
        } catch (postError: any) {
          if (isAlreadyPostedSalesError(postError)) {
            postedSuccessfully = true;
            console.log('✅ Sale already posted — treating as success');
          } else {
            console.error('Failed to post invoice:', postError);
            const msg = getSalesApiErrorMessage(
              postError,
              'Failed to post invoice.',
            );
            const fullMsg = `Sale saved as Open (${invoiceNo}) but posting failed:\n\n${msg}\n\nThis sale will not appear in Recent Transactions until it is posted. Open Unposted Sales to retry.`;
            setErrorMessage(fullMsg);
            showUserError('Could not post sale', fullMsg);
          }
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
              showUserInfo(
                'No printer found',
                'Pair the printer in Android Bluetooth settings, open Printer configuration, then try again.',
              );
            } else {
              console.log('🖨️ Printer available, starting receipt printing...');

              let companyInfo: CompanyInfo | undefined;
              try {
                console.log('🏢 Fetching company information...');
                const companyResponse = await getCompanyInfo();
                if (companyResponse.data && companyResponse.data.company) {
                  companyInfo = tenantCompanyToReceiptInfo(
                    companyResponse.data.company,
                  );
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
                showUserSuccess(
                  'Receipt printed',
                  'Receipt has been sent to printer',
                );
              } else {
                console.log('❌ Receipt printing failed');
                showUserInfo(
                  'Print failed',
                  'Receipt could not be printed. Check Bluetooth printer in Settings.',
                );
              }
            }
          }
        } catch (printError) {
          console.error('❌ Error printing receipt:', printError);
          // Don't fail the sale if printing fails
          if (printReceipt) {
            showUserInfo(
              'Print error',
              'Failed to print receipt. The sale was still completed successfully.',
            );
          }
        }

        showUserSuccess(
          'Sale completed',
          `Invoice ${
            response.data.invoice_no || response.data.id
          } created and posted.`,
        );

        onSuccess(response.data);
        handleClose();
      } else {
        setErrorMessage('Failed to complete sale. No invoice ID received.');
        showUserError(
          'Sale failed',
          'Failed to complete sale. No invoice ID received.',
        );
      }
    } catch (error: any) {
      console.error('=== SALE COMPLETION ERROR ===');
      console.error('Error:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      console.error('Error message:', error?.message);
      console.error('=== END ERROR ===');
      const msg = getSalesApiErrorMessage(
        error,
        'An unexpected error occurred while completing the sale.',
      );
      setErrorMessage(msg);
      showUserError('Sale failed', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedCustomer(initialSelectedCustomer || fallbackGeneralCustomer);
      setPaymentMethod(null);
      setAmountReceived('');
      setAmountReceivedDisplay('');
      setTransactionId('');
      setPaymentDropdownOpen(false);
      setPrintReceipt(true);
      setErrorMessage(null);
      onClose();
    }
  };

  const applyExactAmount = () => {
    const exact = String(total);
    setAmountReceived(exact);
    setAmountReceivedDisplay(total.toLocaleString());
    setErrorMessage(null);
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    if (isProcessing) {
      return;
    }
    setPaymentMethod(method);
    setPaymentDropdownOpen(false);
    setErrorMessage(null);
    setAmountReceived('');
    setAmountReceivedDisplay('');
    if (!paymentMethodRequiresTransactionId(method)) {
      setTransactionId('');
    }
  };

  const change = calculateChange();

  /** Cash methods: require full payment before enabling Complete Sale */
  const tenderAmountOk =
    !needsAmountReceived ||
    (amountReceived !== '' && parseFloat(amountReceived) >= total);

  const canCompleteSale =
    Boolean(paymentMethod) &&
    tenderAmountOk &&
    (!needsTransactionId || Boolean(transactionId.trim())) &&
    !isProcessing;

  /** Leave room for close row + action footer inside the sheet */
  const scrollMaxHeight = Math.max(
    220,
    sheetMaxHeight - insets.bottom - 130,
  );

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
          sheetWidthStyle,
          {
            maxHeight: sheetMaxHeight,
            paddingBottom: insets.bottom,
          },
        ]}>
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

        <KeyboardAvoidingView
          style={[
            styles.mainKeyboardView,
            {maxHeight: sheetMaxHeight - insets.bottom},
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
          <View style={styles.checkoutHeader}>
            <QuickIconPressable
              style={[styles.checkoutCloseCircle, st.checkoutClose]}
              onPress={handleClose}
              disabled={isProcessing}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityLabel="Close">
              <Text style={[styles.checkoutCloseGlyph, st.checkoutCloseGlyph]}>
                ✕
              </Text>
            </QuickIconPressable>
          </View>

          <ScrollView
            style={[styles.contentScroll, {maxHeight: scrollMaxHeight}]}
            contentContainerStyle={[styles.content, st.content]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View style={styles.heroTotalWrap}>
              <Text
                style={[styles.heroTotalText, st.heroTotal]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.28}>
                {formatTotalDisplay()}
              </Text>
              <Text style={[styles.heroSubtitle, st.heroSub]}>
                Select payment & enter amount
              </Text>
            </View>

            {/* Payment type dropdown */}
            <View style={styles.paymentPickerSection}>
              <Text style={[styles.sectionTitle, st.sectionTitle]}>
                Payment Type
              </Text>
              {loadingPaymentMethods ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : paymentMethods.length === 0 ? (
                <Text style={[styles.noPaymentMethodsText, st.noPayText]}>
                  No payment methods available.
                </Text>
              ) : (
                <View style={styles.dropdownWrap}>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTrigger,
                      st.dropdown,
                      paymentDropdownOpen && styles.dropdownTriggerOpen,
                      paymentDropdownOpen && st.dropdownOpen,
                    ]}
                    onPress={() =>
                      !isProcessing &&
                      setPaymentDropdownOpen(open => !open)
                    }
                    disabled={isProcessing}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{expanded: paymentDropdownOpen}}>
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        paymentMethod
                          ? st.dropdownText
                          : st.dropdownPlaceholder,
                      ]}
                      numberOfLines={1}>
                      {paymentMethod?.description || 'Select payment type'}
                    </Text>
                    <Image
                      source={icons.down_arrow}
                      style={[
                        styles.dropdownChevron,
                        st.dropdownChevron,
                        paymentDropdownOpen && styles.dropdownChevronOpen,
                      ]}
                    />
                  </TouchableOpacity>

                  {paymentDropdownOpen ? (
                    <View style={[styles.dropdownMenu, st.dropdownMenu]}>
                      {paymentMethods.map((method, index) => {
                        const selected = paymentMethod?.id === method.id;
                        const isLast = index === paymentMethods.length - 1;
                        return (
                          <TouchableOpacity
                            key={method.id}
                            style={[
                              styles.dropdownOption,
                              st.dropdownOption,
                              isLast && styles.dropdownOptionLast,
                              selected && styles.dropdownOptionSelected,
                              selected && st.dropdownOptionSel,
                            ]}
                            onPress={() => handlePaymentMethodSelect(method)}
                            disabled={isProcessing}
                            activeOpacity={0.7}>
                            <Text
                              style={[
                                styles.dropdownOptionText,
                                st.dropdownOptionText,
                                selected && styles.dropdownOptionTextSelected,
                                selected && st.dropdownOptionTextSel,
                              ]}
                              numberOfLines={2}>
                              {method.description}
                            </Text>
                            {selected ? (
                              <Text style={styles.dropdownCheck}>✓</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            {/* Amount received — on the face when cash / tender methods */}
            {needsAmountReceived ? (
              <View style={styles.amountFaceSection}>
                <View style={styles.amountFaceHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      st.sectionTitle,
                      styles.amountFaceTitle,
                    ]}>
                    Amount Received
                  </Text>
                  <TouchableOpacity
                    style={[styles.exactAmountBtn, st.exactBtn]}
                    onPress={applyExactAmount}
                    disabled={isProcessing}
                    activeOpacity={0.75}>
                    <Text style={[styles.exactAmountBtnText, st.exactBtnText]}>
                      Exact
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.tenderInputShell, st.tenderShell]}>
                  <Text style={[styles.amountCurrencyPrefix, st.tenderLabel]}>
                    {getLocalCurrencyCode()}
                  </Text>
                  <TextInput
                    style={[styles.tenderInput, st.tenderInput]}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    value={amountReceivedDisplay}
                    onChangeText={handleAmountReceivedChange}
                    keyboardType="decimal-pad"
                    editable={!isProcessing}
                  />
                </View>
                {amountReceived ? (
                  <View style={[styles.tenderChangeCard, st.tenderChange]}>
                    <Text style={[styles.changeLabel, st.changeLabel]}>
                      Change
                    </Text>
                    <Text style={styles.changeValueFace}>
                      {formatCurrencyCompact(change)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.amountHint, st.heroSub]}>
                    Enter what the customer paid
                  </Text>
                )}
              </View>
            ) : null}

            {needsTransactionId ? (
              <View style={styles.amountFaceSection}>
                <Text
                  style={[
                    styles.sectionTitle,
                    st.sectionTitle,
                    styles.amountFaceTitle,
                  ]}>
                  Transaction ID *
                </Text>
                <View style={[styles.tenderInputShell, st.tenderShell]}>
                  <TextInput
                    style={[styles.tenderInput, st.tenderInput]}
                    placeholder="Enter provider transaction ID"
                    placeholderTextColor={colors.placeholder}
                    value={transactionId}
                    onChangeText={setTransactionId}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={TRANSACTION_ID_MAX_LENGTH}
                    editable={!isProcessing}
                  />
                </View>
              </View>
            ) : null}

            {/* Sale Summary */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, st.sectionTitle]}>
                Sale Summary
              </Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, st.summaryLabel]}>
                  Items:
                </Text>
                <Text style={[styles.summaryValue, st.summaryValue]}>
                  {cartItems.length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, st.summaryLabel]}>
                  Subtotal:
                </Text>
                <Text style={[styles.summaryValue, st.summaryValue]}>
                  {formatCurrencyCompact(total)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow, st.totalRow]}>
                <Text style={[styles.totalLabel, st.totalLabel]}>Total:</Text>
                <Text style={styles.totalValue}>
                  {formatCurrencyCompact(total)}
                </Text>
              </View>
            </View>

            {/* Selected Customer */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, st.sectionTitle]}>
                Customer
              </Text>
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
            <View style={[styles.section, styles.lastSection]}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setPrintReceipt(!printReceipt)}
                disabled={isProcessing}>
                <View
                  style={[
                    styles.checkbox,
                    st.checkbox,
                    printReceipt && styles.checkedBox,
                  ]}>
                  {printReceipt && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, st.checkboxLabel]}>
                  Print Receipt
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.footer, st.footer]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, st.cancelBtn]}
              onPress={handleClose}
              disabled={isProcessing}>
              <Text style={[styles.cancelButtonText, st.cancelBtnText]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.completeButton,
                !canCompleteSale && styles.disabledButton,
              ]}
              onPress={handleCompleteSale}
              disabled={!canCompleteSale}
              activeOpacity={0.85}>
              {isProcessing ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.completeButtonText}>Complete Sale</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    width: '100%',
    overflow: 'hidden',
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
    paddingBottom: 8,
  },
  contentScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  lastSection: {
    marginBottom: 4,
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
    flexGrow: 0,
    flexShrink: 0,
    padding: SIZES.padding,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray2,
    gap: SIZES.radius,
    backgroundColor: COLORS.white,
  },
  button: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 14,
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
  mainKeyboardView: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: SIZES.padding,
    paddingTop: 8,
    paddingBottom: 4,
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
    marginBottom: 8,
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
    marginTop: 10,
    fontWeight: '500',
  },
  paymentPickerSection: {
    marginBottom: SIZES.radius * 1.5,
  },
  dropdownWrap: {
    zIndex: 20,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: SIZES.radius,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray2,
    backgroundColor: COLORS.white,
  },
  dropdownTriggerOpen: {
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownTriggerText: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  dropdownChevron: {
    width: 14,
    height: 14,
    tintColor: COLORS.gray,
  },
  dropdownChevronOpen: {
    transform: [{rotate: '180deg'}],
  },
  dropdownMenu: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.radius,
    borderBottomRightRadius: SIZES.radius,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray2,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionSelected: {
    backgroundColor: COLORS.transparentPrimary2,
  },
  dropdownOptionText: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.darkGray,
    flex: 1,
    paddingRight: 10,
  },
  dropdownOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dropdownCheck: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  amountFaceSection: {
    marginBottom: SIZES.radius * 2,
  },
  amountFaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountFaceTitle: {
    marginBottom: 0,
  },
  exactAmountBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    backgroundColor: COLORS.lightGray2,
  },
  exactAmountBtnText: {
    ...FONTS.body5,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  amountCurrencyPrefix: {
    ...FONTS.body4,
    fontWeight: '700',
    color: COLORS.gray,
    marginRight: 8,
  },
  amountHint: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: 8,
  },
  changeValueFace: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '700',
  },
  tenderInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 64,
  },
  tenderInput: {
    flex: 1,
    paddingVertical: 14,
    ...FONTS.h2,
    fontSize: 30,
    lineHeight: 36,
    color: COLORS.black,
    fontWeight: '700',
  },
  tenderChangeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.transparentPrimary,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
});

export default SalesCompletionModal;
