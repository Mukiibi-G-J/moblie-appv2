import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {StackScreenLayout} from '../../Components';
import {showUserError} from '../../utils/userFeedback';
import {
  deleteItemJournal,
  fetchItemJournal,
  postItemJournalLines,
} from '../../services/app.services';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/Store';
import {usePermissions} from '../../hooks/usePermissions';
import {useScreenBottomInset} from '../../hooks/useScreenTopInset';
import {PAGE_NAMES} from '../../constants/pageNames';
import ItemJournalListItem, {type ItemJournalLine} from './ItemJournalListItem';
import ItemJournalFormModal from './ItemJournalFormModal';
import {normalizeLine} from './itemJournalUtils';
import {
  OPERATIONAL_JOURNAL_CONFIG,
  type ItemJournalScreenConfig,
} from './itemJournalScreenConfig';

const PAGE_NAME = PAGE_NAMES.ITEM_JOURNAL;
const HISTORY_PAGE_NAME = PAGE_NAMES.ADJUST_INVENTORY_HISTORY;

function formatItemJournalPostFailure(e: unknown): string {
  if (typeof e === 'string') {
    return e;
  }

  const ax = e as {
    response?: {data?: Record<string, unknown>};
    message?: string;
  };

  let data = ax?.response?.data;
  if (
    !data &&
    e &&
    typeof e === 'object' &&
    !('response' in (e as object)) &&
    ('invalid_journals' in (e as object) || 'error' in (e as object))
  ) {
    data = e as Record<string, unknown>;
  }

  if (data && typeof data === 'object') {
    const parts: string[] = [];

    if (typeof data.error === 'string' && data.error.trim()) {
      parts.push(data.error.trim());
    }

    const invalid = data.invalid_journals;
    if (Array.isArray(invalid) && invalid.length > 0) {
      const first = invalid[0] as {
        document_no?: string;
        errors?: unknown[];
      };
      if (first?.document_no) {
        parts.push(`Document: ${first.document_no}`);
      }
      const errs = first?.errors;
      if (Array.isArray(errs) && errs.length > 0) {
        errs.forEach(err => {
          if (typeof err === 'string' && err.trim()) {
            parts.push(err.trim());
          } else if (err != null) {
            try {
              parts.push(JSON.stringify(err));
            } catch {
              parts.push(String(err));
            }
          }
        });
      } else if (!parts.length) {
        parts.push('Validation failed; no detailed messages were returned.');
      }
    }

    if (parts.length > 0) {
      return parts.join('\n');
    }

    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail.trim();
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map(String).join('\n');
    }
    if (data.detail != null && typeof data.detail === 'object') {
      try {
        return JSON.stringify(data.detail);
      } catch {
        return 'Post failed.';
      }
    }
  }

  const msg = ax?.message;
  return typeof msg === 'string' && msg.trim()
    ? msg.trim()
    : 'Post failed. Please try again.';
}

const ItemJournalScreen = ({
  config = OPERATIONAL_JOURNAL_CONFIG,
}: {
  config?: ItemJournalScreenConfig;
}) => {
  const navigation = useNavigation<any>();
  const {colors} = useTheme();
  const {auth} = useAuth();
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const screenConfig = config;
  const bottomInset = useScreenBottomInset(16);

  const userId = useMemo(() => {
    const n = parseInt(auth.user_id || '', 10);
    return Number.isFinite(n) ? n : 0;
  }, [auth.user_id]);

  if (!canRead(PAGE_NAME)) {
    return (
      <StackScreenLayout title={screenConfig.pageTitle}>
        <View
          style={[
            styles.accessDeniedContainer,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={[styles.accessDeniedMessage, {color: colors.textSecondary}]}>
            {screenConfig.accessDeniedMessage}
          </Text>
        </View>
      </StackScreenLayout>
    );
  }

  const [journals, setJournals] = useState<ItemJournalLine[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingLine, setEditingLine] = useState<ItemJournalLine | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
      setSearchLoading(false);
    }, 500);
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery]);

  const loadJournals = useCallback(
    async (pageOverride?: number) => {
      const p = pageOverride ?? page;
      try {
        setLoading(true);
        const response = await fetchItemJournal(p, debouncedSearch, {status: 'Open'});
        const rawList = response.results || [];
        const parsed = rawList
          .map(r => normalizeLine(r as Record<string, unknown>))
          .filter(Boolean) as ItemJournalLine[];

        if (p === 1) {
          setJournals(parsed);
        } else {
          setJournals(prev => [...prev, ...parsed]);
        }
        setHasMore(!!response.next);
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        const invalidPage =
          detail === 'Invalid page.' || e?.response?.data?.error === 'Invalid page.';
        if (invalidPage && p > 1) {
          setPage(1);
          setHasMore(false);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Failed to load adjustments',
            text2: typeof detail === 'string' ? detail : 'Please try again.',
          });
          if (p === 1) {
            setJournals([]);
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, debouncedSearch],
  );

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    if (page === 1) {
      loadJournals(1);
    } else {
      setPage(1);
    }
  }, [page, loadJournals]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(p => p + 1);
    }
  };

  const openCreate = () => {
    if (!canCreate(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to create lines.');
      return;
    }
    setEditingLine(null);
    setFormVisible(true);
  };

  const openEdit = (line: ItemJournalLine) => {
    if (!canEdit(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to edit journal lines.');
      return;
    }
    if (line.status !== 'Open') {
      Alert.alert('Cannot edit', 'Only Open lines can be edited.');
      return;
    }
    setEditingLine(line);
    setFormVisible(true);
  };

  const confirmRemove = (line: ItemJournalLine) => {
    if (!canDelete(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to remove journal lines.');
      return;
    }
    if (line.status !== 'Open') {
      Alert.alert('Cannot remove', 'Only Open lines can be removed.');
      return;
    }
    Alert.alert(
      'Remove journal line',
      `Remove ${line.document_no}? This deletes the open line from the journal.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItemJournal(line.id);
              Toast.show({type: 'success', text1: 'Journal line removed'});
              setPage(1);
              loadJournals(1);
            } catch (e: unknown) {
              const ax = e as {
                response?: {data?: {detail?: unknown}};
                message?: string;
              };
              const detail = ax?.response?.data?.detail;
              const msg =
                typeof detail === 'string'
                  ? detail
                  : ax?.message || 'Could not remove journal line.';
              Toast.show({type: 'error', text1: 'Remove failed', text2: msg});
            }
          },
        },
      ],
    );
  };

  const confirmPost = (line: ItemJournalLine) => {
    if (!canEdit(PAGE_NAME)) {
      Alert.alert('Access denied', 'You do not have permission to post.');
      return;
    }
    if (line.status !== 'Open') {
      return;
    }
    Alert.alert(
      'Post journal line',
      `Post ${line.document_no} to inventory? This cannot be undone from the app.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Post',
          onPress: async () => {
            try {
              await postItemJournalLines([line.id]);
              Toast.show({type: 'success', text1: 'Posted'});
              setPage(1);
              loadJournals(1);
            } catch (e: unknown) {
              showUserError(
                'Could not post',
                formatItemJournalPostFailure(e),
              );
            }
          },
        },
      ],
    );
  };

  const handleFormSave = () => {
    setFormVisible(false);
    setEditingLine(null);
    setPage(1);
    loadJournals(1);
  };

  const renderPostedAdjustmentsRow = () => {
    if (!canRead(HISTORY_PAGE_NAME)) {
      return null;
    }
    return (
      <>
        <TouchableOpacity
          style={[
            styles.postedAdjustmentsRow,
            {backgroundColor: colors.background},
          ]}
          onPress={() => navigation.navigate('ItemJournalHistory')}
          activeOpacity={0.65}>
          <Text
            style={[
              styles.postedAdjustmentsRowLabel,
              {color: colors.textPrimary},
            ]}>
            View posted adjustments
          </Text>
          <Text
            style={[
              styles.postedAdjustmentsRowChevron,
              {color: colors.textSecondary},
            ]}>
            ›
          </Text>
        </TouchableOpacity>
        <View style={[styles.rowDivider, {backgroundColor: colors.border}]} />
      </>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Image
          source={icons.cross}
          style={styles.emptyIconImage}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.emptyText, {color: colors.textPrimary}]}>
        {screenConfig.emptyTitle}
      </Text>
      <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>
        {searchQuery.trim()
          ? 'Try adjusting your search query.'
          : canCreate(PAGE_NAME)
            ? screenConfig.emptySubtextCreate
            : screenConfig.emptySubtextNoCreate}
      </Text>
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.emptyButton} onPress={openCreate}>
          <Text style={styles.emptyButtonText}>{screenConfig.emptyButtonLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) {
      return null;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  const searchBar = (
    <View style={styles.searchContainer}>
      <View
        style={[
          styles.searchInputContainer,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}>
        <View style={styles.searchIconContainer}>
          <Image
            source={icons.search}
            style={[styles.searchIcon, {tintColor: colors.iconMuted}]}
            resizeMode="contain"
          />
        </View>
        <TextInput
          style={[styles.searchInput, {color: colors.textPrimary}]}
          placeholder={screenConfig.searchPlaceholder}
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchLoading && (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary2} />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <StackScreenLayout
      title={screenConfig.pageTitle}
      headerBottom={searchBar}>
      {renderPostedAdjustmentsRow()}

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={[styles.loadingText, {color: colors.textSecondary}]}>
            Loading adjustments...
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={journals}
          keyExtractor={item => item.system_id || String(item.id)}
          renderItem={({item}) => (
            <ItemJournalListItem
              line={item}
              onPress={() => openEdit(item)}
              onPost={() => confirmPost(item)}
              onRemove={() => confirmRemove(item)}
              canOpenLine={canEdit(PAGE_NAME)}
              canPost={canEdit(PAGE_NAME)}
              canRemove={canDelete(PAGE_NAME)}
            />
          )}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={
            journals.length === 0
              ? styles.emptyListContainer
              : styles.listContentContainer
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        />
      )}

      {canCreate(PAGE_NAME) && (
        <TouchableOpacity
          style={[styles.fab, {bottom: bottomInset + 16}]}
          onPress={openCreate}
          activeOpacity={0.8}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <ItemJournalFormModal
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          setEditingLine(null);
        }}
        line={editingLine}
        onSave={handleFormSave}
        userId={userId}
        canCreate={canCreate(PAGE_NAME)}
        canEdit={canEdit(PAGE_NAME)}
        lockedAdjustmentType={screenConfig.lockedAdjustmentType}
        addFormTitle={screenConfig.addFormTitle}
        editFormTitle={screenConfig.editFormTitle}
      />
    </StackScreenLayout>
  );
};

export default ItemJournalScreen;

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 180,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
  },
  searchIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    width: 20,
    height: 20,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    paddingVertical: 0,
  },
  searchLoadingContainer: {
    marginLeft: SIZES.base,
  },
  postedAdjustmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  postedAdjustmentsRowLabel: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  postedAdjustmentsRowChevron: {
    ...FONTS.h3,
    fontSize: 22,
    fontWeight: '300',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    paddingTop: 36,
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
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base * 2,
  },
  emptyIconImage: {
    width: 40,
    height: 40,
    tintColor: COLORS.primary2,
  },
  emptyText: {
    ...FONTS.h3,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: SIZES.base * 2,
  },
  emptyButton: {
    paddingHorizontal: SIZES.base * 3,
    paddingVertical: SIZES.base * 1.5,
    borderRadius: 24,
    backgroundColor: COLORS.primary2,
    shadowColor: COLORS.primary2,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    ...FONTS.button,
    color: COLORS.white,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    ...FONTS.body3,
    marginTop: SIZES.base,
  },
  footerLoader: {
    paddingVertical: SIZES.padding,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: SIZES.padding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary3,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  fabText: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: '300',
    lineHeight: 32,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 16,
    borderRadius: SIZES.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    textAlign: 'center',
  },
});
