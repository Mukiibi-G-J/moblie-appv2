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
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {safeGoBack} from '../../hooks/NavigationService';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {User} from '../../@types/userManagement';
import {UserManagementService} from '../../services/UserManagementService';
import UserFormModal from './UserFormModal';
import UserListItem from './UserListItem';
import {Image} from 'react-native';

const Users: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const app = useAppContext();
  const {canCreate, canEdit, canDelete} = usePermissions();
  const canLoginAs =
    app?.auth?.username === 'debug_admin' && !app?.impersonation?.active;
  const PAGE_NAME = PAGE_NAMES.USER_MANAGEMENT;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [loginAsUserId, setLoginAsUserId] = useState<number | null>(null);
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
        setHasMore(!!response.next);
      } else {
        setUsers([]);
        setHasMore(false);
      }
    } catch (error: any) {
      setUsers([]);
      setHasMore(false);
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.detail || 'Couldn’t load users',
        visibilityTime: 5000,
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

  const confirmLoginAs = (user: User) => {
    if (!canLoginAs || loginAsUserId != null) {
      return;
    }
    const label = user.full_name || user.username;
    Alert.alert(
      'Login as user',
      `View the system as ${label}? Your debug_admin session will be paused until you exit.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Login as',
          onPress: () => {
            void runLoginAs(user);
          },
        },
      ],
    );
  };

  const runLoginAs = async (user: User) => {
    if (!app?.startImpersonation || !Number.isFinite(user.id) || user.id <= 0) {
      Toast.show({
        type: 'error',
        text1: 'You can’t sign in as this user',
        visibilityTime: 4000,
      });
      return;
    }
    setLoginAsUserId(user.id);
    try {
      await app.startImpersonation(user.id);
      Toast.show({
        type: 'success',
        text1: `Viewing as ${user.full_name || user.username}`,
      });
      navigation.reset({index: 0, routes: [{name: 'Home'}]});
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1:
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Couldn’t open this user’s session',
        visibilityTime: 5000,
      });
      setLoginAsUserId(null);
    }
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
                text1:
                  error?.response?.data?.detail || 'Couldn’t deactivate this user',
                visibilityTime: 5000,
              });
            }
          },
        },
      ],
    );
  };

  const openCreate = () => {
    setSelectedUser(null);
    setFormVisible(true);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setFormVisible(true);
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.headerSection, {backgroundColor: colors.background}]}>
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
              {borderColor: colors.border, backgroundColor: colors.card},
            ]}
            onPress={() => safeGoBack(navigation, 'UserManagement')}
            accessibilityLabel="Go back">
            <Image
              source={icons.back}
              style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={[styles.allItemsTitle, {color: colors.textPrimary}]}>
            Users
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        <View style={styles.searchInputContainer}>
          <Image
            source={icons.search}
            style={styles.searchIcon}
            resizeMode="contain"
          />
          <TextInput
            style={[styles.searchInput, {color: colors.textPrimary}]}
            placeholder="Search users..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {loading && users.length > 0 ? (
            <ActivityIndicator size="small" color={COLORS.primary2} />
          ) : null}
        </View>
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={users}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <UserListItem
              user={item}
              onEdit={canEdit(PAGE_NAME) ? openEdit : undefined}
              onDeactivate={canDelete(PAGE_NAME) ? handleDelete : undefined}
              onLoginAs={
                canLoginAs &&
                item.username !== 'debug_admin' &&
                loginAsUserId == null
                  ? confirmLoginAs
                  : undefined
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={() => {
            if (!loading && hasMore) {
              setPage(p => p + 1);
            }
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={
            users.length === 0
              ? styles.emptyListContainer
              : styles.listContentContainer
          }
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loading && users.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Image
                  source={icons.profile}
                  style={styles.emptyIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.emptyText, {color: colors.textPrimary}]}>
                No users found
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Try a different name or email.'
                  : canCreate(PAGE_NAME)
                    ? 'Create your first user to get started.'
                    : 'No users available.'}
              </Text>
              {canCreate(PAGE_NAME) && !searchQuery ? (
                <TouchableOpacity style={styles.emptyButton} onPress={openCreate}>
                  <Text style={styles.emptyButtonText}>Create User</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {canCreate(PAGE_NAME) ? (
        <TouchableOpacity
          style={[styles.fab, {bottom: Math.max(insets.bottom, 16) + 16}]}
          onPress={openCreate}
          activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      ) : null}

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
  list: {flex: 1},
  listContentContainer: {paddingBottom: 120},
  headerSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
  },
  allItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerRoundIcon: {width: 20, height: 20},
  allItemsTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerTrailingSpacer: {width: 40, height: 40},
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 0,
  },
  emptyListContainer: {flexGrow: 1, paddingTop: 36},
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyIconImage: {width: 40, height: 40, tintColor: COLORS.primary2},
  emptyText: {
    ...FONTS.h3,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray2,
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: SIZES.base * 2,
  },
  emptyButton: {
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
  },
  emptyButtonText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {...FONTS.body3, color: COLORS.gray2, marginTop: SIZES.base},
  footerLoader: {paddingVertical: SIZES.padding, alignItems: 'center'},
  fab: {
    position: 'absolute',
    right: SIZES.padding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 1000,
  },
  fabText: {fontSize: 32, color: COLORS.white, fontWeight: '300', marginTop: -2},
});

export default Users;
