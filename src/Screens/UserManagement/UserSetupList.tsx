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
import {QuickIconPressable} from '../../Components';
import {useTheme} from '../../context/ThemeContext';
import {safeGoBack} from '../../hooks/NavigationService';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import {useQueryClient} from '@tanstack/react-query';
import {UserSetup} from '../../@types/userSetup';
import {UserSetupService} from '../../services/UserSetupService';
import {queryKeys} from '../../query/keys';
import UserSetupFormModal from './UserSetupFormModal';
import UserSetupListItem from './UserSetupListItem';

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
        setHasMore(!!response.next);
      } else {
        setSetups([]);
        setHasMore(false);
      }
    } catch (error: any) {
      setSetups([]);
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.detail || 'Couldn’t load user setups',
        visibilityTime: 5000,
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
        text1:
          error?.response?.data?.error ||
          error?.response?.data?.detail ||
          'Couldn’t create the missing setups',
        visibilityTime: 5000,
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
                text1:
                  error?.response?.data?.detail || 'Couldn’t delete this user setup',
                visibilityTime: 5000,
              });
            }
          },
        },
      ],
    );
  };

  const openCreate = () => {
    setSelectedSetup(null);
    setFormVisible(true);
  };

  const openEdit = (setup: UserSetup) => {
    setSelectedSetup(setup);
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
            User Setup
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
            placeholder="Search user setups..."
            placeholderTextColor={COLORS.gray3}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {loading && setups.length > 0 ? (
            <ActivityIndicator size="small" color={COLORS.primary2} />
          ) : null}
        </View>
        {canCreateSetup ? (
          <TouchableOpacity
            onPress={() => {
              void handleCreateMissing();
            }}
            style={styles.missingBtn}>
            <Text style={styles.missingBtnText}>Create missing setups</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading && setups.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.loadingText}>Loading user setups...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={setups}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <UserSetupListItem
              setup={item}
              onEdit={canEditSetup ? openEdit : undefined}
              onDelete={canDeleteSetup ? handleDelete : undefined}
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
            setups.length === 0
              ? styles.emptyListContainer
              : styles.listContentContainer
          }
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loading && setups.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Image
                  source={icons.setting}
                  style={styles.emptyIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.emptyText, {color: colors.textPrimary}]}>
                No user setups found
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Try a different name or email.'
                  : 'Create a setup for a user, or fill in the missing ones.'}
              </Text>
            </View>
          }
        />
      )}

      {canCreateSetup ? (
        <TouchableOpacity
          style={[styles.fab, {bottom: Math.max(insets.bottom, 16) + 16}]}
          onPress={openCreate}
          activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      ) : null}

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
  missingBtn: {alignSelf: 'flex-start', marginTop: 10},
  missingBtnText: {...FONTS.body4, color: COLORS.primary2, fontWeight: '600'},
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
  },
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

export default UserSetupList;
