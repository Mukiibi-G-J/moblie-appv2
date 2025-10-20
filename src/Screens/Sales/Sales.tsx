import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {COLORS, FONTS, SIZES, icons, images} from '../../constants';
import {Header, IconButton} from '../../Components';
import DropDownPicker from 'react-native-dropdown-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {fetchSalesData, SalesItem} from '../../services/app.services';

// Updated types based on backend API structure
interface SalesInvoice {
  id: number;
  system_id: string;
  invoice_no: string;
  customer: number;
  customer_name: string;
  customer_no?: string;
  document_date: string;
  customer_invoice_no: string;
  status: 'Draft' | 'Open' | 'Posted' | 'Cancelled';
  total_amount: number;
  created_at: string;
  updated_at: string;
  payment_method_name?: string;
  payment_method_details?: {
    id: number;
    code: string;
    description: string;
    requires_amount_received: boolean;
  };
  user_name?: string;
  lines: SalesLine[];
}

interface SalesLine {
  id: number;
  system_id?: string;
  item: string;
  item_system_id?: string;
  item_no: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  description?: string;
  unit_of_measure?: string;
  item_images?: Array<{url: string}>;
}

const Sales = () => {
  const navigation = useNavigation();
  const [filterOption, setFilterOption] = useState('last7days');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    {label: 'Last 7 days', value: 'last7days'},
    {label: 'Last 30 days', value: 'last30days'},
    {label: 'Current year', value: 'currentyear'},
  ]);
  const [salesData, setSalesData] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SalesInvoice | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadSalesData();
  }, [startDate, endDate]);

  const loadSalesData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSalesData({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      if (data && Array.isArray(data)) {
        setSalesData(data);
      } else {
        setSalesData([]);
      }
    } catch (err) {
      setError('Failed to load sales data. Please try again.');
      console.error('Error fetching sales data:', err);
      setSalesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  function renderHeader() {
    return (
      <Header
        title="SALES"
        showBack={true}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: SIZES.radius,
              backgroundColor: COLORS.primary,
            }}
            onPress={() => ''}>
            <Image
              source={icons.calender}
              style={{
                width: 20,
                height: 20,
                tintColor: COLORS.white,
              }}
            />
          </TouchableOpacity>
        }
        containerStyle={{
          zIndex: -1,
        }}
      />
    );
  }

  function renderFilterInputs() {
    return (
      <View style={styles.filterContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Start Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowStartDatePicker(true)}>
            <Text style={styles.dateText}>
              {startDate.toLocaleDateString()}
            </Text>
            <Image source={icons.calender} style={styles.calendarIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>End Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowEndDatePicker(true)}>
            <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
            <Image source={icons.calender} style={styles.calendarIcon} />
          </TouchableOpacity>
        </View>

        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartDatePicker(false);
              if (selectedDate) setStartDate(selectedDate);
            }}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndDatePicker(false);
              if (selectedDate) setEndDate(selectedDate);
            }}
          />
        )}
      </View>
    );
  }

  function renderSalesTable() {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading sales data...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Image source={icons.cross} style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSalesData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const totalSales = salesData.reduce(
      (sum, sale) => sum + sale.total_amount,
      0,
    );

    const renderItem = ({item}: {item: SalesInvoice}) => (
      <TouchableOpacity
        style={styles.tableRow}
        onPress={() => {
          setSelectedItem(item);
          setModalVisible(true);
        }}>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {new Date(item.document_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.invoiceContainer}>
          <Text style={styles.invoiceText} numberOfLines={1}>
            {item.invoice_no}
          </Text>
        </View>
        <View style={styles.customerContainer}>
          <Text style={styles.customerText} numberOfLines={1}>
            {item.customer_name}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amountText}>
            UGX {item.total_amount?.toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    );

    const renderTableHeader = () => (
      <View style={styles.tableHeader}>
        <View style={styles.headerDateContainer}>
          <Text style={styles.headerText}>Date</Text>
        </View>
        <View style={styles.headerInvoiceContainer}>
          <Text style={styles.headerText}>Invoice No</Text>
        </View>
        <View style={styles.headerCustomerContainer}>
          <Text style={styles.headerText}>Customer</Text>
        </View>
        <View style={styles.headerAmountContainer}>
          <Text style={styles.headerText}>Amount</Text>
        </View>
      </View>
    );

    const renderTableFooter = () => (
      <View style={styles.tableFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerText}>Total</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerAmountText}>
            UGX {totalSales?.toLocaleString()}
          </Text>
        </View>
      </View>
    );

    return (
      <View style={styles.tableContainer}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          <View style={styles.tableWrapper}>
            {renderTableHeader()}
            <FlatList
              data={salesData}
              renderItem={renderItem}
              keyExtractor={item => item.id.toString()}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Image source={icons.product} style={styles.emptyIcon} />
                  <Text style={styles.emptyText}>No sales data found</Text>
                  <Text style={styles.emptySubtext}>
                    Try adjusting your date range or check back later
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
            {salesData.length > 0 && renderTableFooter()}
          </View>
        </ScrollView>
      </View>
    );
  }

  function renderItemModal() {
    if (!selectedItem) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Invoice: {selectedItem.invoice_no}
              </Text>
              <TouchableOpacity
                style={styles.closeIconButton}
                onPress={() => setModalVisible(false)}>
                <Image source={icons.cross} style={styles.closeIcon} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer:</Text>
                <Text style={styles.infoValue}>
                  {selectedItem.customer_name}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date:</Text>
                <Text style={styles.infoValue}>
                  {new Date(selectedItem.document_date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <View
                  style={[
                    styles.statusBadge,
                    selectedItem.status === 'Posted' && styles.statusPosted,
                    selectedItem.status === 'Open' && styles.statusOpen,
                    selectedItem.status === 'Draft' && styles.statusDraft,
                  ]}>
                  <Text style={styles.statusText}>{selectedItem.status}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total:</Text>
                <Text style={styles.totalAmount}>
                  UGX {selectedItem.total_amount?.toLocaleString()}
                </Text>
              </View>
            </View>

            {selectedItem.lines && selectedItem.lines.length > 0 && (
              <View style={styles.linesContainer}>
                <Text style={styles.modalSubtitle}>Items Sold</Text>
                <ScrollView style={styles.linesScrollView}>
                  {selectedItem.lines.map((line, index) => (
                    <View key={line.id || index} style={styles.lineItem}>
                      <View style={styles.lineItemHeader}>
                        <Text style={styles.lineItemName}>
                          {line.item_name}
                        </Text>
                        <Text style={styles.lineItemCode}>{line.item_no}</Text>
                      </View>
                      <View style={styles.lineItemDetails}>
                        <Text style={styles.lineItemDetail}>
                          Qty: {line.quantity} {line.unit_of_measure || 'PCS'}
                        </Text>
                        <Text style={styles.lineItemDetail}>
                          Price: UGX{' '}
                          {parseFloat(line.unit_price || '0').toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>
                        Total: UGX{' '}
                        {parseFloat(line.total_amount || '0').toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderFilterInputs()}
      {renderSalesTable()}
      {renderItemModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
    zIndex: 1000,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.gray2,
    borderRadius: SIZES.radius,
    paddingTop: 15,
    paddingHorizontal: 10,
    position: 'relative',
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    position: 'absolute',
    top: -12,
    left: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 4,
    fontSize: 12,
    color: COLORS.gray,
    zIndex: 10,
    fontWeight: '600',
  },
  dateInput: {
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
  },
  calendarIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.primary,
  },
  tableContainer: {
    flex: 1,
    marginBottom: SIZES.padding,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tableWrapper: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: SIZES.padding,
    borderTopLeftRadius: SIZES.radius,
    borderTopRightRadius: SIZES.radius,
  },
  headerDateContainer: {
    flex: 1,
  },
  headerInvoiceContainer: {
    flex: 1.2,
  },
  headerCustomerContainer: {
    flex: 1.2,
  },
  headerAmountContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  listContainer: {
    flexGrow: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray2,
    paddingVertical: 12,
    paddingHorizontal: SIZES.padding,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  dateContainer: {
    flex: 1,
  },
  invoiceContainer: {
    flex: 1.2,
  },
  customerContainer: {
    flex: 1.2,
  },
  amountContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  invoiceText: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: '600',
  },
  customerText: {
    ...FONTS.body3,
    color: COLORS.black,
  },
  amountText: {
    ...FONTS.body3,
    color: COLORS.black,
    fontWeight: '600',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.lightGray,
    borderBottomLeftRadius: SIZES.radius,
    borderBottomRightRadius: SIZES.radius,
    borderTopWidth: 2,
    borderTopColor: COLORS.gray2,
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  footerText: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: 'bold',
  },
  footerAmountText: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginHorizontal: SIZES.padding,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.padding,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginHorizontal: SIZES.padding,
    padding: SIZES.padding * 2,
  },
  errorIcon: {
    width: 50,
    height: 50,
    tintColor: COLORS.red,
    marginBottom: SIZES.padding,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: SIZES.padding,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 3,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    tintColor: COLORS.gray2,
    marginBottom: SIZES.padding,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    width: '90%',
    maxHeight: '85%',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray2,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.black,
    flex: 1,
  },
  closeIconButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: COLORS.lightGray,
  },
  closeIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.gray,
  },
  modalInfoContainer: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  infoLabel: {
    ...FONTS.body3,
    color: COLORS.gray,
    fontWeight: '600',
  },
  infoValue: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: SIZES.radius,
  },
  statusPosted: {
    backgroundColor: COLORS.green,
  },
  statusOpen: {
    backgroundColor: COLORS.orange,
  },
  statusDraft: {
    backgroundColor: COLORS.blue,
  },
  statusText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  totalAmount: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  linesContainer: {
    padding: SIZES.padding,
  },
  modalSubtitle: {
    ...FONTS.h3,
    color: COLORS.black,
    marginBottom: SIZES.padding,
    fontWeight: 'bold',
  },
  linesScrollView: {
    maxHeight: 300,
  },
  lineItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray2,
    paddingVertical: SIZES.base,
    marginBottom: SIZES.base,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2,
  },
  lineItemName: {
    ...FONTS.body3,
    fontWeight: 'bold',
    color: COLORS.black,
    flex: 1,
  },
  lineItemCode: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  lineItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.base / 2,
  },
  lineItemDetail: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  lineItemTotal: {
    ...FONTS.body3,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'right',
  },
  closeButton: {
    margin: SIZES.padding,
    padding: SIZES.padding,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  closeButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default Sales;
