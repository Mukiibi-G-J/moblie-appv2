import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES} from '../../constants';
import icons from '../../constants/icons';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {useQueryClient} from '@tanstack/react-query';
import {UserSetup} from '../../@types/userSetup';
import {UserSetupService} from '../../services/UserSetupService';
import {queryKeys} from '../../query/keys';
import UserSetupFormModal from './UserSetupFormModal';

const UserSetupList: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const {canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.USER_SETUP;
  const FALLBACK_PAGE = PAGE_NAMES.USER_MANAGEMENT;
  const canCreateSetup = canCreate(PAGE_NAME) || canCreate(FALLBACK_PAGE);
  const canEditSetup = canEdit(PAGE_NAME) || canEdit(FALLBACK_PAGE);
  const canDeleteSetup = canDelete(PAGE_NAME) || canDelete(FALLBACK_PAGE);

  const [setups, setSetups] = useState<UserSetup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSetup, setSelectedSetup] = useState<UserSetup | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadSetups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await UserSetupService.getUserSetups({
        page,
        page_size: 20,
        search: debouncedSearch || undefined,
      });
      if (response?.results && Array.isArray(response.results)) {
        setSetups(prev =>
          page === 1 ? response.results : [...prev, ...response.results],
        );
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setSetups([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error: any) {
      setSetups([]);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to load user setups',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadSetups();
  }, [loadSetups]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadSetups();
  };

  const handleCreateMissing = async () => {
    try {
      const result = await UserSetupService.createMissingSetups();
      Toast.show({type: 'success', text1: result.message});
      onRefresh();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2:
          error?.response?.data?.error ||
          error?.response?.data?.detail ||
          'Failed to create missing setups',
      });
    }
  };

  const handleDelete = (setup: UserSetup) => {
    Alert.alert(
      'Delete user setup',
      `Remove setup for ${setup.fullName || setup.username}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await UserSetupService.deleteUserSetup(setup.id);
              Toast.show({type: 'success', text1: 'User setup deleted'});
              onRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to delete user setup',
              });
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}: {item: UserSetup}) => (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}
      onPress={() => {
        if (canEditSetup) {
          setSelectedSetup(item);
          setFormVisible(true);
        }
      }}
      onLongPress={() => {
        if (canDeleteSetup) {
          handleDelete(item);
        }
      }}>
      <Text style={[styles.name, {color: colors.textPrimary}]}>
        {item.fullName || item.username}
      </Text>
      <Text style={[styles.meta, {color: colors.textSecondary}]}>
        {item.email}
      </Text>
      <View style={styles.flagsRow}>
        {!item.canSeeBuyingPrice && (
          <Text style={styles.flag}>No buying price</Text>
        )}
        {!item.canSeeProfitMargin && (
          <Text style={styles.flag}>No profit</Text>
        )}
        {item.canEditSalesPrice ? (
          <Text style={styles.flag}>Edit price</Text>
        ) : null}
        {item.canViewOnlyTheirSales && (
          <Text style={styles.flag}>Own sales only</Text>
        )}
        {item.defaultSalesUi === 'pos' && (
          <Text style={styles.flag}>POS UI</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.screenMuted}]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}>
        <TouchableOpacity
          onPress={() => safeGoBack(navigation, 'UserManagement')}
          style={styles.backBtn}>
          <Image
            source={icons.back}
            style={[styles.backIcon, {tintColor: colors.textPrimary}]}
          />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, {color: colors.textPrimary}]}>
          User Setup
        </Text>
        {canCreateSetup ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedSetup(null);
              setFormVisible(true);
            }}>
            <Text style={styles.addText}>+ Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <View style={[styles.searchWrap, {backgroundColor: colors.surface}]}>
        <TextInput
          style={[styles.searchInput, {color: colors.textPrimary, borderColor: colors.border}]}
          placeholder="Search user setups..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={handleCreateMissing} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>Create missing setups</Text>
        </TouchableOpacity>
        <Text style={[styles.count, {color: colors.textSecondary}]}>
          {totalCount} setup{totalCount === 1 ? '' : 's'}
        </Text>
      </View>

      <FlatList
        data={setups}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{padding: SIZES.padding, paddingBottom: insets.bottom + 24}}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => {
          if (!loading && hasMore) {
            setPage(p => p + 1);
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={COLORS.primary} style={{marginTop: 40}} />
          ) : (
            <Text style={[styles.empty, {color: colors.textSecondary}]}>
              No user setups found
            </Text>
          )
        }
      />

      <UserSetupFormModal
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          setSelectedSetup(null);
        }}
        setup={selectedSetup}
        onSave={() => {
          setFormVisible(false);
          setSelectedSetup(null);
          void queryClient.invalidateQueries({queryKey: queryKeys.userSetup()});
          onRefresh();
        }}
        canCreate={canCreateSetup}
        canEdit={canEditSetup}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center'},
  backIcon: {width: 20, height: 20},
  screenTitle: {...FONTS.h3},
  addText: {...FONTS.body3, color: COLORS.primary, fontWeight: '600'},
  searchWrap: {paddingHorizontal: 16, paddingVertical: 12},
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...FONTS.body3,
    marginBottom: 8,
  },
  missingBtn: {alignSelf: 'flex-start', marginBottom: 6},
  missingBtnText: {...FONTS.body4, color: COLORS.primary},
  count: {...FONTS.body5},
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  name: {...FONTS.h4, marginBottom: 4},
  meta: {...FONTS.body4},
  flagsRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6},
  flag: {
    ...FONTS.body5,
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  empty: {textAlign: 'center', marginTop: 40, ...FONTS.body3},
});

export default UserSetupList;
