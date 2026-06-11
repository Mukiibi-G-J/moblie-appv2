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
  InteractionManager,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {safeGoBack} from '../../hooks/NavigationService';
import Toast from 'react-native-toast-message';
import Clipboard from '@react-native-clipboard/clipboard';
import {QuickIconPressable} from '../../Components';
import {fetchItemJournal, postItemJournalLines} from '../../services/app.services';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useAuth} from '../../context/Store';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';
import ItemJournalListItem, {type ItemJournalLine} from './ItemJournalListItem';
import ItemJournalFormModal from './ItemJournalFormModal';
import {normalizeLine} from './itemJournalUtils';

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

function showPostErrorAlert(message: string) {
  InteractionManager.runAfterInteractions(() => {
    Alert.alert(
      'Could not post',
      message,
      [
        {
          text: 'Copy error',
          onPress: () => {
            try {
              Clipboard.setString(message);
              Toast.show({type: 'success', text1: 'Error copied to clipboard'});
            } catch {
              Toast.show({type: 'error', text1: 'Could not copy'});
            }
          },
        },
        {text: 'OK', style: 'cancel'},
      ],
      {cancelable: true},
    );
  });
}

const ItemJournalScreen = () => {
  const navigation = useNavigation<any>();
  const {auth} = useAuth();
  const {canRead, canCreate, canEdit} = usePermissions();

  const userId = useMemo(() => {
    const n = parseInt(auth.user_id || '', 10);
    return Number.isFinite(n) ? n : 0;
  }, [auth.user_id]);

  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You do not have permission to view stock adjustments.
          </Text>
        </View>
      </View>
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
              showPostErrorAlert(formatItemJournalPostFailure(e));
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
          style={styles.postedAdjustmentsRow}
          onPress={() => navigation.navigate('ItemJournalHistory')}
          activeOpacity={0.65}>
          <Text style={styles.postedAdjustmentsRowLabel}>View posted adjustments</Text>
          <Text style={styles.postedAdjustmentsRowChevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.rowDivider} />
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
      <Text style={styles.emptyText}>No adjustments found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery.trim()
          ? 'Try adjusting your search query.'
          : canCreate(PAGE_NAME)
            ? 'Create your first stock adjustment to get started.'
            : 'No open adjustments available.'}
      </Text>
      {canCreate(PAGE_NAME) && (
        <TouchableOpacity style={styles.emptyButton} onPress={openCreate}>
          <Text style={styles.emptyButtonText}>Add adjustment</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <QuickIconPressable
            style={styles.backButton}
            onPress={() => safeGoBack(navigation, 'Home')}
            accessibilityLabel="Go back">
            <Image
              source={icons.back}
              style={styles.backButtonIcon}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={styles.screenTitle}>Adjust inventory</Text>
          <View style={styles.titleRowSpacer} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <View style={styles.searchIconContainer}>
              <Image
                source={icons.search}
                style={styles.searchIcon}
                resizeMode="contain"
              />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search open adjustments..."
              placeholderTextColor={COLORS.gray3}
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
      </View>

      {renderPostedAdjustmentsRow()}

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
          <Text style={styles.loadingText}>Loading adjustments...</Text>
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
              canOpenLine={canEdit(PAGE_NAME)}
              canPost={canEdit(PAGE_NAME)}
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
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.8}>
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
      />
    </View>
  );
};

export default ItemJournalScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  list: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 180,
  },
  headerSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.transparentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.primary3,
  },
  screenTitle: {
    ...FONTS.h1,
    color: COLORS.black,
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  titleRowSpacer: {
    width: 44,
    height: 44,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
  },
  searchIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: COLORS.gray2,
  },
  searchInput: {
    flex: 1,
    ...FONTS.body3,
    color: COLORS.black,
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
    backgroundColor: COLORS.white,
  },
  postedAdjustmentsRowLabel: {
    ...FONTS.body3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    flex: 1,
  },
  postedAdjustmentsRowChevron: {
    ...FONTS.h3,
    color: COLORS.gray2,
    fontSize: 22,
    fontWeight: '300',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lightGray1,
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
    color: COLORS.black,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray2,
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
    color: COLORS.gray2,
    marginTop: SIZES.base,
  },
  footerLoader: {
    paddingVertical: SIZES.padding,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: SIZES.padding,
    bottom: 130,
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
