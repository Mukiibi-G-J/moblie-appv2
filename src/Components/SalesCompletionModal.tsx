import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import ReactNativeModal from 'react-native-modal';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../constants';
import {CartItem, SalesInvoiceData} from '../@types/types.dto';
import {
  fetchCustomers,
  fetchPaymentMethods,
  createSalesInvoice,
  postSalesInvoice,
  getCompanyInfo,
  Customer,
  PaymentMethod,
} from '../services/app.services';
import PrintService, {CompanyInfo} from '../services/PrintService';

interface SalesCompletionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
  cartItems: CartItem[];
  total: number;
  username: string;
  userId: number;
}

const SalesCompletionModal: React.FC<SalesCompletionModalProps> = ({
  isVisible,
  onClose,
  onSuccess,
  cartItems,
  total,
  username,
  userId,
}) => {
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

  // Data fetching states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  // Customer search state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Fetch customers and payment methods on modal open
  useEffect(() => {
    if (isVisible) {
      fetchCustomersData();
      fetchPaymentMethodsData();
    }
  }, [isVisible]);

  const fetchCustomersData = async () => {
    setLoadingCustomers(true);
    try {
      console.log('🔍 Fetching customers...');
      const customersData = await fetchCustomers();
      console.log('✅ Customers fetched:', customersData);

      // Find existing "General" customer from API
      const generalCustomer = customersData.find(
        customer =>
          customer.name.toLowerCase().includes('general') ||
          customer.no.toLowerCase().includes('gen'),
      );

      if (generalCustomer) {
        // Use existing General customer as default
        setCustomers(customersData);
        setSelectedCustomer(generalCustomer);
        console.log(
          '✅ Found existing General customer:',
          generalCustomer.name,
        );
      } else {
        // Fallback: Create a General Customer if none exists
        const fallbackGeneralCustomer: Customer = {
          id: 0,
          no: 'GEN',
          name: 'General Customer',
          system_id: 'general',
        };

        const allCustomers = [fallbackGeneralCustomer, ...customersData];
        setCustomers(allCustomers);
        setSelectedCustomer(fallbackGeneralCustomer);
        console.log('⚠️ No General customer found, created fallback');
      }
    } catch (error) {
      console.error('❌ Failed to fetch customers:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load customers',
      });
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchPaymentMethodsData = async () => {
    setLoadingPaymentMethods(true);
    try {
      console.log('🔍 Fetching payment methods...');
      const paymentMethodsData = await fetchPaymentMethods();
      console.log('✅ Payment methods fetched:', paymentMethodsData);
      setPaymentMethods(paymentMethodsData);
      // Set first payment method as default
      if (paymentMethodsData.length > 0) {
        setPaymentMethod(paymentMethodsData[0]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch payment methods:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load payment methods',
      });
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

    setIsProcessing(true);

    try {
      // Prepare sales invoice data following the frontend pattern exactly
      // Use the earliest date from cart items as the document date, or current date if no items
      const documentDate =
        cartItems.length > 0
          ? cartItems
              .reduce((earliest, item) => {
                const itemDate = new Date(item.date_sold);
                const currentEarliest = new Date(earliest);
                return itemDate < currentEarliest ? item.date_sold : earliest;
              }, cartItems[0].date_sold)
              .split('T')[0]
          : new Date().toISOString().split('T')[0];

      const salesInvoiceData: SalesInvoiceData = {
        customer: selectedCustomer?.id || 0,
        customer_name: selectedCustomer?.name || 'General Customer',
        document_date: documentDate,
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
            unit_of_measure: 'PCS',
            tracking_code: '',
            description: '',
          };
        }),
      };

      // Debug logging to see the exact data being sent
      console.log('=== DEBUG: SALES INVOICE DATA ===');
      console.log('Document Date:', documentDate);
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
        try {
          console.log('🔍 DEBUG: About to call postSalesInvoice...');
          await postSalesInvoice(response.data.id);
          console.log('✅ Sale posted successfully!');
        } catch (postError) {
          console.error('Failed to post invoice:', postError);
          // Continue with the sale even if posting fails
        }

        // Print receipt if requested (moved outside postSalesInvoice try-catch)
        console.log('🔍 DEBUG: printReceipt state:', printReceipt);
        if (printReceipt) {
          try {
            console.log('🖨️ Starting receipt printing...');
            const printService = PrintService.getInstance();

            // Fetch company information
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
                  vatNo: company.vatNo || 'VAT No',
                };
                console.log('✅ Company info fetched:', companyInfo);
              } else {
                console.log('⚠️ No company info found, using defaults');
              }
            } catch (companyError) {
              console.error('❌ Error fetching company info:', companyError);
              // Continue with default values
            }

            const receiptData = {
              receiptId:
                response.data.invoice_no || response.data.id.toString(),
              username: username,
              customerName: selectedCustomer?.name || 'General Customer',
              cartItems: cartItems, // Use original cartItems
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
            } else {
              console.log('❌ Receipt printing failed');
            }
          } catch (printError) {
            console.error('❌ Error printing receipt:', printError);
            // Don't fail the sale if printing fails
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
      setSelectedCustomer(null);
      setPaymentMethod(null);
      setAmountReceived('');
      setAmountReceivedDisplay('');
      setPrintReceipt(true);
      setErrorMessage(null);
      onClose();
    }
  };

  const change = calculateChange();

  // Filter customers based on search query
  const filteredCustomers = customers.filter(
    customer =>
      customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      customer.no.toLowerCase().includes(customerSearchQuery.toLowerCase()),
  );

  // Show only first 5 customers if not searching and more than 5 customers
  const displayedCustomers =
    showCustomerSearch || customers.length <= 5
      ? filteredCustomers
      : customers.slice(0, 5);

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
      <SafeAreaView style={styles.modalView}>
        <View style={styles.header}>
          <Text style={styles.title}>Complete Sale</Text>
          <TouchableOpacity onPress={handleClose} disabled={isProcessing}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Error Message - Fixed position below header */}
        {errorMessage && (
          <View style={styles.errorContainerFixed}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.errorCloseButton}
              onPress={() => setErrorMessage(null)}>
              <Text style={styles.errorCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Sale Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sale Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>{cartItems.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>
                UGX {total.toLocaleString()}
              </Text>
            </View>
            {/* Tax and discount rows removed */}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>
                UGX {total.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Customer Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Customer</Text>
            {loadingCustomers ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : customers.length === 0 ? (
              <Text style={styles.noCustomersText}>
                No customers available in the system.
              </Text>
            ) : (
              <View>
                <Text style={styles.sectionSubtitle}>
                  Choose a customer from the system:
                </Text>

                {/* Customer Search */}
                {customers.length > 5 && (
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search customers..."
                      value={customerSearchQuery}
                      onChangeText={setCustomerSearchQuery}
                      editable={!isProcessing}
                    />
                    <TouchableOpacity
                      style={styles.searchToggleButton}
                      onPress={() => setShowCustomerSearch(!showCustomerSearch)}
                      disabled={isProcessing}>
                      <Text style={styles.searchToggleText}>
                        {showCustomerSearch ? 'Show Less' : 'Show All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Customer List */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.customersScroll}>
                  {displayedCustomers.map(customer => (
                    <TouchableOpacity
                      key={customer.id}
                      style={[
                        styles.customerOption,
                        selectedCustomer?.id === customer.id &&
                          styles.selectedCustomerOption,
                      ]}
                      onPress={() => {
                        setSelectedCustomer(customer);
                      }}
                      disabled={isProcessing}>
                      <Text
                        style={[
                          styles.customerOptionText,
                          selectedCustomer?.id === customer.id &&
                            styles.selectedCustomerOptionText,
                        ]}>
                        {customer.no} - {customer.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Show more indicator */}
                {!showCustomerSearch && customers.length > 5 && (
                  <Text style={styles.moreCustomersText}>
                    +{customers.length - 5} more customers. Use search to find
                    specific customers.
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentMethods}>
              {loadingPaymentMethods ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : paymentMethods.length === 0 ? (
                <Text style={styles.noPaymentMethodsText}>
                  No payment methods available.
                </Text>
              ) : (
                paymentMethods.map(method => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.paymentMethod,
                      paymentMethod?.id === method.id &&
                        styles.selectedPaymentMethod,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                    disabled={isProcessing}>
                    <Text
                      style={[
                        styles.paymentMethodText,
                        paymentMethod?.id === method.id &&
                          styles.selectedPaymentMethodText,
                      ]}>
                      {method.description}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>

          {/* Amount Received (for Cash payments) */}
          {paymentMethod?.requires_amount_received && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amount Received</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount received"
                value={amountReceivedDisplay}
                onChangeText={handleAmountReceivedChange}
                keyboardType="numeric"
                editable={!isProcessing}
              />
              {amountReceived && (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>Change:</Text>
                  <Text style={styles.changeValue}>
                    UGX {change.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Tax and Discount section removed */}

          {/* Receipt Printing */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setPrintReceipt(!printReceipt)}
              disabled={isProcessing}>
              <View
                style={[styles.checkbox, printReceipt && styles.checkedBox]}>
                {printReceipt && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Print Receipt</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
            disabled={isProcessing}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.completeButton,
              isProcessing && styles.disabledButton,
            ]}
            onPress={handleCompleteSale}
            disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.completeButtonText}>Complete Sale</Text>
            )}
          </TouchableOpacity>
        </View>
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
    maxHeight: '90%',
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
  sectionSubtitle: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginTop: SIZES.radius,
    marginBottom: SIZES.radius / 2,
  },
  customersScroll: {
    marginTop: SIZES.radius,
  },
  customerOption: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.radius / 2,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    marginRight: SIZES.radius,
    minWidth: 120,
    alignItems: 'center',
  },
  selectedCustomerOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  customerOptionText: {
    ...FONTS.body5,
    color: COLORS.darkGray,
    textAlign: 'center',
  },
  selectedCustomerOptionText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: SIZES.radius,
    gap: SIZES.radius,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: SIZES.radius,
    padding: SIZES.radius,
    ...FONTS.body4,
    color: COLORS.darkGray,
  },
  searchToggleButton: {
    paddingHorizontal: SIZES.radius,
    paddingVertical: SIZES.radius,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchToggleText: {
    ...FONTS.body5,
    color: COLORS.white,
    fontWeight: '600',
  },
  moreCustomersText: {
    ...FONTS.body5,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.radius,
    fontStyle: 'italic',
  },
  noCustomersText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: SIZES.radius,
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
});

export default SalesCompletionModal;
