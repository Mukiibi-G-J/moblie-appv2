import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants';
import icons from '../../constants/icons';
import Header from '../../Components/Header';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {PaymentJournalServices} from '../../services/PaymentJournalServices';
import {
  PaymentJournal,
} from '../../@types/paymentJournal';
import PaymentFormModal from './PaymentFormModal';

const Payments: React.FC = () => {
  const navigation = useNavigation<any>();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PAYMENTS;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header
          title="Payments"
          showBack={true}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view payments.
          </Text>
        </View>
      </View>
    );
  }

  // State management
  const [payments, setPayments] = useState<PaymentJournal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentJournal | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1); // Reset to first page on search
      setSearchLoading(false);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load payments when filters change
  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearchQuery]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: 20,
        status: 'Open', // Only fetch open payments
      };

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      const response = await PaymentJournalServices.getPaymentJournals(params);

      if (response && response.results && Array.isArray(response.results)) {
        if (page === 1) {
          setPayments(response.results);
        } else {
          setPayments(prev => [...prev, ...response.results]);
        }
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setPayments([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('Error loading payments:', error);
      const invalidPage =
        error?.response?.data?.detail === 'Invalid page.' ||
        error?.response?.data?.error === 'Invalid page.';

      if (invalidPage && page > 1) {
        setPage(1);
        setHasMore(false);
      } else {
        setPayments([]);
        setTotalCount(0);
        setHasMore(false);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load payments',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadPayments();
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && !refreshing) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore, refreshing]);

  const handleCreate = () => {
    setSelectedPayment(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (payment: PaymentJournal) => {
    if (!canEdit) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to edit payments.',
      );
      return;
    }
    setSelectedPayment(payment);
    setIsFormModalVisible(true);
  };

  const handleDelete = async (payment: PaymentJournal) => {
    if (!canDelete) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to delete payments.',
      );
      return;
    }

    Alert.alert(
      'Delete Payment',
      `Are you sure you want to delete payment ${payment.document_no}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PaymentJournalServices.deletePaymentJournal(payment.id);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Payment deleted successfully',
              });
              loadPayments();
            } catch (error: any) {
              console.error('Error deleting payment:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error?.response?.data?.error || 'Failed to delete payment',
              });
            }
          },
        },
      ],
    );
  };

  const handleSave = () => {
    setIsFormModalVisible(false);
    setSelectedPayment(null);
    setPage(1);
    loadPayments();
  };

  const formatAmount = (amount: number) => {
    return `UGX ${(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const renderPaymentItem = ({item}: {item: PaymentJournal}) => (
    <TouchableOpacity
      style={styles.paymentItem}
      onPress={() => handleEdit(item)}
      activeOpacity={0.7}>
      <View style={styles.paymentItemContent}>
        <View style={styles.paymentItemHeader}>
          <Text style={styles.paymentDocumentNo}>{item.document_no}</Text>
          <Text style={styles.paymentAmount}>{formatAmount(item.amount)}</Text>
        </View>
        <View style={styles.paymentItemDetails}>
          <Text style={styles.paymentAccount}>
            {item.account_name || `${item.account_type} - ${item.account_object_id}`}
          </Text>
          <Text style={styles.paymentStatus}>{item.status}</Text>
        </View>
        {item.description && (
          <Text style={styles.paymentDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <View style={styles.paymentItemFooter}>
          <Text style={styles.paymentDate}>
            {new Date(item.posting_date).toLocaleDateString()}
          </Text>
          {canDelete && (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.deleteButton}>
              <Image
                source={icons.delete as ImageSourcePropType}
                style={styles.deleteIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No payments found</Text>
      {canCreate && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          activeOpacity={0.7}>
          <Image
            source={icons.plus as ImageSourcePropType}
            style={styles.createButtonIcon}
            resizeMode="contain"
          />
          <Text style={styles.createButtonText}>Create Payment</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Image
          source={icons.search as ImageSourcePropType}
          style={styles.searchIcon}
          resizeMode="contain"
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search payments..."
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchLoading && (
          <ActivityIndicator
            size="small"
            color={COLORS.primary}
            style={styles.searchLoader}
          />
        )}
      </View>
      {canCreate && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreate}
          activeOpacity={0.7}>
          <Image
            source={icons.plus as ImageSourcePropType}
            style={styles.addButtonIcon}
            resizeMode="contain"
          />
          <Text style={styles.addButtonText}>Create</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Payments"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />
      {renderHeader()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          renderItem={renderPaymentItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={
            payments.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && page > 1 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
        />
      )}
      <PaymentFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
        onSave={handleSave}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    marginBottom: SIZES.base,
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: SIZES.base,
    ...FONTS.body3,
    color: COLORS.black,
  },
  searchLoader: {
    marginLeft: SIZES.base,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding,
  },
  addButtonIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.white,
    marginRight: SIZES.base / 2,
  },
  addButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  list: {
    padding: SIZES.padding,
  },
  paymentItem: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.base,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
  },
  paymentItemContent: {
    padding: SIZES.padding,
  },
  paymentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2,
  },
  paymentDocumentNo: {
    ...FONTS.h4,
    color: COLORS.black,
    fontWeight: '600',
  },
  paymentAmount: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  paymentItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base / 2,
  },
  paymentAccount: {
    ...FONTS.body3,
    color: COLORS.black,
    flex: 1,
  },
  paymentStatus: {
    ...FONTS.body4,
    color: COLORS.primary,
    backgroundColor: COLORS.lightGray1,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
  },
  paymentDescription: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: SIZES.base / 2,
  },
  paymentItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.base / 2,
  },
  paymentDate: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  deleteButton: {
    padding: SIZES.base / 2,
  },
  deleteIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.error,
  },
  emptyList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  emptyStateText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: SIZES.padding,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding,
  },
  createButtonIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.white,
    marginRight: SIZES.base / 2,
  },
  createButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.base,
  },
  footerLoader: {
    padding: SIZES.padding,
    alignItems: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: SIZES.radius,
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

export default Payments;



