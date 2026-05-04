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
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  COLORS,
  FONTS,
  SIZES,
  icons,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useTabContext} from '../../context/Store';
import {QuickIconPressable} from '../../Components';
import MainBottomTabBar from '../../Components/MainBottomTabBar';
import {usePermissions} from '../../hooks/usePermissions';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';
import {PaymentJournalServices} from '../../services/PaymentJournalServices';
import {PaymentJournal} from '../../@types/paymentJournal';
import PaymentFormModal from './PaymentFormModal';

const getPaymentInitials = (documentNo?: string | null) => {
  if (!documentNo?.trim()) {
    return 'PY';
  }
  const alnum = documentNo.replace(/[^a-zA-Z0-9]/g, '');
  if (alnum.length >= 2) {
    return alnum.slice(0, 2).toUpperCase();
  }
  if (alnum.length === 1) {
    return `${alnum}`.toUpperCase();
  }
  return 'PY';
};

const Payments: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {selectedTab, setSelectedTab} = useTabContext();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PAYMENTS;
  const canReadPayments = canRead(PAGE_NAME);

  const [payments, setPayments] = useState<PaymentJournal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentJournal | null>(null);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onSelectTab = useCallback(
    (tab: string) => {
      setSelectedTab(tab);
      navigation.navigate('Home' as never);
    },
    [navigation, setSelectedTab],
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
      setSearchLoading(false);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadPayments = useCallback(async () => {
    if (!canReadPayments) {
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page,
        page_size: 20,
        status: 'Open',
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
  }, [page, debouncedSearchQuery, canReadPayments]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    if (page === 1) {
      loadPayments();
    } else {
      setPage(1);
    }
  }, [page, loadPayments]);

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
    if (!canEdit(PAGE_NAME)) {
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
    if (!canDelete(PAGE_NAME)) {
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
                text2:
                  error?.response?.data?.error || 'Failed to delete payment',
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
    return `UGX ${(amount || 0)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const renderPaymentItem = ({item}: {item: PaymentJournal}) => {
    const accountLabel =
      item.account_name ||
      `${item.account_type} - ${item.account_object_id}`;
    const initials = getPaymentInitials(item.document_no);

    return (
      <TouchableOpacity
        style={[styles.paymentRow, {borderBottomColor: colors.border}]}
        onPress={() => handleEdit(item)}
        activeOpacity={0.7}
        disabled={!canEdit(PAGE_NAME)}>
        <View
          style={[
            styles.paymentThumb,
            {backgroundColor: colors.screenMuted},
          ]}>
          <Text style={[styles.paymentThumbText, {color: colors.textSecondary}]}>
            {initials}
          </Text>
        </View>
        <View style={styles.paymentMiddle}>
          <Text
            style={[styles.paymentDocNo, {color: colors.textPrimary}]}
            numberOfLines={1}>
            {item.document_no}
          </Text>
          <Text
            style={[styles.paymentAccount, {color: colors.textSecondary}]}
            numberOfLines={1}>
            {accountLabel}
          </Text>
          {item.description ? (
            <Text
              style={[styles.paymentMeta, {color: colors.textSecondary}]}
              numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <Text style={[styles.paymentMeta, {color: colors.textSecondary}]}>
            {new Date(item.posting_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.paymentRight}>
          <Text style={[styles.paymentAmount, {color: colors.textPrimary}]}>
            {formatAmount(item.amount)}
          </Text>
          <View style={styles.paymentRightBottom}>
            <Text
              style={[
                styles.statusPill,
                {
                  color: colors.textSecondary,
                  backgroundColor: colors.screenMuted,
                  borderColor: colors.border,
                },
              ]}>
              {item.status}
            </Text>
            {canDelete(PAGE_NAME) ? (
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={ICON_BUTTON_HIT_SLOP}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete payment">
                <Image
                  source={icons.delete_icon}
                  style={styles.deleteIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconContainer,
          {backgroundColor: colors.screenMuted},
        ]}
        accessibilityRole="image"
        accessibilityLabel="No payments">
        <Image
          source={icons.wallet}
          style={[styles.emptyStateIcon, {tintColor: colors.iconMuted}]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.emptyTitle, {color: colors.textPrimary}]}>
        No payments found
      </Text>
      <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
        {searchQuery.trim()
          ? 'Try adjusting your search terms'
          : canCreate(PAGE_NAME)
            ? 'Create your first payment to get started.'
            : 'No open payments at the moment.'}
      </Text>
      {canCreate(PAGE_NAME) && !searchQuery.trim() ? (
        <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
          <Text style={styles.emptyButtonText}>Create payment</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderTopHeader = (showTrailingCreate: boolean) => (
    <View
      style={[
        styles.allItemsHeader,
        {
          paddingTop: Math.max(insets.top, 10),
          backgroundColor: colors.background,
        },
      ]}>
      <QuickIconPressable
        style={[
          styles.headerRoundButton,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
        onPress={() => safeGoBack(navigation, 'Home')}
        accessibilityLabel="Go back">
        <Image
          source={icons.back}
          style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
          resizeMode="contain"
        />
      </QuickIconPressable>
      <Text style={[styles.allItemsTitle, {color: colors.textPrimary}]}>
        Payments
      </Text>
      <View style={styles.headerTrailing}>
        {showTrailingCreate && canCreate(PAGE_NAME) ? (
          <TouchableOpacity
            onPress={handleCreate}
            style={styles.headerActionButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Create payment">
            <Image
              source={icons.plus}
              style={styles.headerActionIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
      </View>
    </View>
  );

  const renderSearch = () => (
    <View
      style={[
        styles.searchContainerOuter,
        {backgroundColor: colors.background},
      ]}>
      <View
        style={[
          styles.searchPill,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}>
        <Image
          source={icons.search}
          style={[styles.searchIcon, {tintColor: colors.iconMuted}]}
          resizeMode="contain"
        />
        <TextInput
          style={[styles.searchInput, {color: colors.textPrimary}]}
          placeholder="Search payments..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchLoading ? (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!canReadPayments) {
    return (
      <View style={[styles.container, {backgroundColor: colors.background}]}>
        {renderTopHeader(false)}
        <View
          style={[
            styles.accessDeniedContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}>
          <Text style={[styles.accessDeniedTitle, {color: COLORS.error}]}>
            Access Denied
          </Text>
          <Text
            style={[styles.accessDeniedMessage, {color: colors.textSecondary}]}>
            You don't have permission to view payments.
          </Text>
        </View>
        <MainBottomTabBar
          selectedTab={selectedTab}
          onSelectTab={onSelectTab}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {renderTopHeader(true)}
      {renderSearch()}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading payments...
          </Text>
        </View>
      ) : (
        <View style={styles.listFlex}>
          <FlatList
            style={styles.listFlex}
            data={payments}
            renderItem={renderPaymentItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={
              payments.length === 0 ? styles.listEmptyGrow : undefined
            }
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.primary2]}
                tintColor={COLORS.primary2}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              loading && page > 1 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary2} />
                </View>
              ) : null
            }
          />
        </View>
      )}
      <MainBottomTabBar
        selectedTab={selectedTab}
        onSelectTab={onSelectTab}
      />
      <PaymentFormModal
        visible={isFormModalVisible}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
        onSave={handleSave}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        canDelete={canDelete(PAGE_NAME)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  allItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 10,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRoundIcon: {
    width: 20,
    height: 20,
  },
  allItemsTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailing: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTrailingSpacer: {
    width: 40,
    height: 40,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.white,
  },
  searchContainerOuter: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 4,
    paddingBottom: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 12,
    minHeight: 48,
  },
  searchLoadingContainer: {
    paddingLeft: 8,
  },
  listFlex: {
    flex: 1,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  paymentRow: {
    marginHorizontal: SIZES.padding,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  paymentThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  paymentThumbText: {
    ...FONTS.body3,
    fontWeight: '700',
    fontSize: 13,
  },
  paymentMiddle: {
    flex: 1,
    minWidth: 0,
  },
  paymentDocNo: {
    ...FONTS.h3,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  paymentAccount: {
    ...FONTS.body3,
    marginBottom: 2,
  },
  paymentMeta: {
    ...FONTS.body4,
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
    maxWidth: '36%',
  },
  paymentAmount: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'right',
  },
  paymentRightBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    ...FONTS.body4,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleteIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 2,
    paddingHorizontal: SIZES.padding,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyStateIcon: {
    width: 40,
    height: 40,
  },
  emptyTitle: {
    ...FONTS.h3,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptyText: {
    ...FONTS.body3,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: SIZES.base * 2,
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...FONTS.body3,
    marginTop: SIZES.base,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
    margin: SIZES.base * 2,
    borderRadius: SIZES.radius,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    marginBottom: SIZES.base * 1.5,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    textAlign: 'center',
  },
});

export default Payments;
