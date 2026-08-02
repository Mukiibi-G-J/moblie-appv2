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
import {User} from '../../@types/userManagement';
import {UserManagementService} from '../../services/UserManagementService';
import UserFormModal from './UserFormModal';
import {Image} from 'react-native';

const Users: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.USER_MANAGEMENT;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await UserManagementService.getUsers({
        page,
        page_size: 20,
        search: debouncedSearch || undefined,
      });
      if (response?.results && Array.isArray(response.results)) {
        const filtered = response.results.filter(
          u => u.username !== 'debug_admin',
        );
        setUsers(prev => (page === 1 ? filtered : [...prev, ...filtered]));
        setTotalCount(response.count);
        setHasMore(!!response.next);
      } else {
        setUsers([]);
        setTotalCount(0);
        setHasMore(false);
      }
    } catch (error: any) {
      setUsers([]);
      setTotalCount(0);
      setHasMore(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.response?.data?.detail || 'Failed to load users',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadUsers();
  };

  const handleDelete = (user: User) => {
    Alert.alert(
      'Deactivate user',
      `Deactivate ${user.full_name || user.username}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await UserManagementService.deleteUser(user.id);
              Toast.show({type: 'success', text1: 'User deactivated'});
              onRefresh();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2:
                  error?.response?.data?.detail || 'Failed to deactivate user',
              });
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}: {item: User}) => (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}
      onPress={() => {
        if (canEdit(PAGE_NAME)) {
          setSelectedUser(item);
          setFormVisible(true);
        }
      }}
      onLongPress={() => {
        if (canDelete(PAGE_NAME)) {
          handleDelete(item);
        }
      }}>
      <View style={styles.cardHeader}>
        <Text style={[styles.name, {color: colors.textPrimary}]}>
          {item.full_name || item.username}
        </Text>
        <View
          style={[
            styles.badge,
            {backgroundColor: item.is_active ? '#DCFCE7' : '#FEE2E2'},
          ]}>
          <Text
            style={{
              ...FONTS.body5,
              color: item.is_active ? '#166534' : '#991B1B',
            }}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={[styles.meta, {color: colors.textSecondary}]}>
        {item.email}
      </Text>
      {item.user_groups && item.user_groups.length > 0 && (
        <Text style={[styles.meta, {color: colors.textSecondary}]}>
          Groups: {item.user_groups.map(g => g.name).join(', ')}
        </Text>
      )}
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
          Users
        </Text>
        {canCreate(PAGE_NAME) ? (
          <TouchableOpacity
            onPress={() => {
              setSelectedUser(null);
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
          placeholder="Search users..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Text style={[styles.count, {color: colors.textSecondary}]}>
          {totalCount} user{totalCount === 1 ? '' : 's'}
        </Text>
      </View>

      <FlatList
        data={users}
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
              No users found
            </Text>
          )
        }
      />

      <UserFormModal
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={() => {
          setFormVisible(false);
          setSelectedUser(null);
          onRefresh();
        }}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
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
    marginBottom: 6,
  },
  count: {...FONTS.body5},
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {...FONTS.h4},
  meta: {...FONTS.body4, marginTop: 2},
  badge: {borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2},
  empty: {textAlign: 'center', marginTop: 40, ...FONTS.body3},
});

export default Users;
