import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {usePermissions} from '../../hooks/usePermissions';
import {safeGoBack} from '../../hooks/NavigationService';
import {PAGE_NAMES} from '../../constants/pageNames';
import {QuickIconPressable} from '../../Components';
import {fetchItems} from '../../services/app.services';
import PrintService from '../../services/PrintService';

const PAGE_NAME = PAGE_NAMES.ITEMS;

type LabelListItem = {
  system_id: string;
  item_name: string;
  no?: string;
  bar_code_no?: string;
};

function mapApiItem(raw: Record<string, unknown>): LabelListItem | null {
  const sid = raw.system_id;
  if (sid == null || sid === '') {
    return null;
  }
  return {
    system_id: String(sid),
    item_name: String(raw.item_name ?? ''),
    no: raw.no != null ? String(raw.no) : undefined,
    bar_code_no:
      raw.bar_code_no != null ? String(raw.bar_code_no) : undefined,
  };
}

const PrintLabels = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const {canRead} = usePermissions();
  const printService = useMemo(() => PrintService.getInstance(), []);

  const t = useMemo(
    () => ({
      container: {backgroundColor: colors.background},
      topHeader: {backgroundColor: colors.background},
      headerBorder: {borderBottomColor: colors.border},
      headerRoundButton: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      headerRoundIcon: {tintColor: colors.textPrimary},
      topTitle: {color: colors.textPrimary},
      headerActionBtn: {backgroundColor: colors.screenMuted},
      headerActionIcon: {tintColor: colors.textPrimary},
      searchContainer: {backgroundColor: colors.background},
      searchPill: {
        borderColor: colors.border,
        backgroundColor: colors.screenMuted,
      },
      searchIcon: {tintColor: colors.iconMuted},
      searchInput: {color: colors.textPrimary},
      iosHint: {color: colors.textSecondary, backgroundColor: colors.screenMuted},
      rowCard: {
        borderColor: colors.border,
        backgroundColor: colors.card,
      },
      rowTitle: {color: colors.textPrimary},
      rowMeta: {color: colors.textSecondary},
      stepperBtn: {
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      stepperText: {color: colors.textPrimary},
      printBtn: {backgroundColor: COLORS.primary2},
      printBtnText: {color: COLORS.white},
      emptyTitle: {color: colors.textPrimary},
      emptySub: {color: colors.textSecondary},
      deniedTitle: {color: colors.textPrimary},
      deniedBody: {color: colors.textSecondary},
      loadMore: {color: colors.textSecondary},
    }),
    [colors],
  );

  const [items, setItems] = useState<LabelListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [copiesById, setCopiesById] = useState<Record<string, number>>({});
  const [printingId, setPrintingId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery]);

  const loadItems = useCallback(
    async (pageOverride?: number) => {
      const p = pageOverride ?? page;
      try {
        setLoading(true);
        const response = await fetchItems(p, debouncedSearch);
        const rawList = (response?.results ?? []) as Record<string, unknown>[];
        const parsed = rawList
          .map(mapApiItem)
          .filter(Boolean) as LabelListItem[];

        if (p === 1) {
          setItems(parsed);
        } else {
          setItems(prev => [...prev, ...parsed]);
        }
        setHasMore(!!response?.next);
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        const invalidPage =
          detail === 'Invalid page.' ||
          e?.response?.data?.error === 'Invalid page.';
        if (invalidPage && p > 1) {
          setPage(1);
          setHasMore(false);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Could not load items',
            text2:
              typeof detail === 'string' ? detail : 'Pull to refresh and try again.',
          });
          if (p === 1) {
            setItems([]);
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
    loadItems();
  }, [loadItems]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    if (page === 1) {
      loadItems(1);
    } else {
      setPage(1);
    }
  }, [page, loadItems]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const getCopies = (id: string) => {
    const n = copiesById[id];
    if (n == null || !Number.isFinite(n)) {
      return 1;
    }
    return Math.min(10, Math.max(1, n));
  };

  const bumpCopies = (id: string, delta: number) => {
    setCopiesById(prev => {
      const current = prev[id];
      const base =
        current == null || !Number.isFinite(current) ? 1 : current;
      const next = Math.min(10, Math.max(1, base + delta));
      return {...prev, [id]: next};
    });
  };

  const handlePrint = async (row: LabelListItem) => {
    if (Platform.OS !== 'android') {
      Toast.show({
        type: 'info',
        text1: 'Android only',
        text2: 'Connect a printer on an Android device to print labels.',
      });
      return;
    }
    setPrintingId(row.system_id);
    try {
      await printService.printItemLabel({
        item_name: row.item_name,
        no: row.no,
        bar_code_no: row.bar_code_no,
        copies: getCopies(row.system_id),
      });
    } finally {
      setPrintingId(null);
    }
  };

  if (!canRead(PAGE_NAME)) {
    return (
      <SafeAreaView
        style={[styles.flex, t.container]}
        edges={['left', 'right', 'bottom']}>
        <View style={styles.deniedWrap}>
          <Text style={[styles.deniedTitle, t.deniedTitle]}>Access denied</Text>
          <Text style={[styles.deniedBody, t.deniedBody]}>
            You need Items access to print labels.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTopBar = () => (
    <View
      style={[
        styles.topHeader,
        t.topHeader,
        {
          paddingTop: Math.max(
            insets.top,
            Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
            12,
          ),
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        t.headerBorder,
      ]}>
      <QuickIconPressable
        style={[styles.headerRoundButton, t.headerRoundButton]}
        onPress={() => safeGoBack(navigation, 'Home')}
        accessibilityLabel="Go back">
        <Image
          source={icons.back as any}
          style={[styles.headerRoundIcon, t.headerRoundIcon]}
        />
      </QuickIconPressable>
      <Text style={[styles.topTitle, t.topTitle]}>Print labels</Text>
      <TouchableOpacity
        style={[styles.headerRoundButton, t.headerActionBtn]}
        onPress={() => navigation.navigate('PrinterConfig' as never)}
        activeOpacity={0.7}
        accessibilityLabel="Printer settings">
        <Image
          source={icons.printer as any}
          style={[styles.headerRoundIcon, t.headerActionIcon]}
        />
      </TouchableOpacity>
    </View>
  );

  const renderSearch = () => (
    <View style={[styles.searchContainer, t.searchContainer]}>
      <View style={[styles.searchPill, t.searchPill]}>
        <Image
          source={icons.search as any}
          style={[styles.searchIcon, t.searchIcon]}
        />
        <TextInput
          style={[styles.searchInput, t.searchInput]}
          placeholder="Search items by name or number"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>
    </View>
  );

  const renderRow = ({item}: {item: LabelListItem}) => {
    const busy = printingId === item.system_id;
    const codeLine =
      item.bar_code_no?.trim() || item.no?.trim() || '—';
    return (
      <View style={[styles.rowCard, t.rowCard]}>
        <Text style={[styles.rowTitle, t.rowTitle]} numberOfLines={2}>
          {item.item_name || 'Unnamed item'}
        </Text>
        <Text style={[styles.rowMeta, t.rowMeta]} numberOfLines={1}>
          {item.no ? `No: ${item.no}` : 'No item number'}
          {item.bar_code_no ? ` · Barcode: ${item.bar_code_no}` : ''}
        </Text>
        <View style={styles.rowActions}>
          <Text style={[styles.copiesLabel, t.rowMeta]}>Copies</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperBtn, t.stepperBtn]}
              onPress={() => bumpCopies(item.system_id, -1)}
              disabled={busy || getCopies(item.system_id) <= 1}
              activeOpacity={0.7}>
              <Image
                source={icons.minus as any}
                style={[styles.stepperIcon, t.stepperText]}
              />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, t.stepperText]}>
              {getCopies(item.system_id)}
            </Text>
            <TouchableOpacity
              style={[styles.stepperBtn, t.stepperBtn]}
              onPress={() => bumpCopies(item.system_id, 1)}
              disabled={busy || getCopies(item.system_id) >= 10}
              activeOpacity={0.7}>
              <Image
                source={icons.plus as any}
                style={[styles.stepperIcon, t.stepperText]}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.printBtn, t.printBtn, busy && styles.printBtnDisabled]}
            onPress={() => handlePrint(item)}
            disabled={busy}
            activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={[styles.printBtnText, t.printBtnText]}>Print</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={[styles.codeHint, t.rowMeta]} numberOfLines={1}>
          Prints: {codeLine}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.flex, t.container]} edges={['left', 'right']}>
      {renderTopBar()}
      {renderSearch()}
      {Platform.OS === 'ios' ? (
        <Text style={[styles.iosHint, t.iosHint]}>
          Label printing is supported on Android (Bluetooth or Sunmi built-in).
        </Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={it => it.system_id}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, t.emptyTitle]}>No items</Text>
              <Text style={[styles.emptySub, t.emptySub]}>
                Try another search or pull to refresh.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && items.length > 0 ? (
            <ActivityIndicator style={styles.footerLoader} />
          ) : hasMore && items.length > 0 ? (
            <Text style={[styles.loadMore, t.loadMore]}> </Text>
          ) : null
        }
      />
      {loading && items.length === 0 ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={COLORS.primary2} />
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 14,
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
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  searchContainer: {
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
  searchIcon: {width: 20, height: 20, marginRight: 10},
  searchInput: {
    flex: 1,
    ...FONTS.body4,
    fontSize: 15,
    paddingVertical: 10,
  },
  iosHint: {
    marginHorizontal: SIZES.padding,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    ...FONTS.body5,
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 24,
    flexGrow: 1,
  },
  rowCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  rowTitle: {
    ...FONTS.h4,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rowMeta: {...FONTS.body5, fontSize: 13},
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  copiesLabel: {fontSize: 13, marginRight: 4},
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperIcon: {width: 14, height: 14},
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  printBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printBtnDisabled: {opacity: 0.7},
  printBtnText: {...FONTS.body4, fontWeight: '700', fontSize: 15},
  codeHint: {marginTop: 8, fontSize: 12},
  emptyWrap: {paddingTop: 48, alignItems: 'center'},
  emptyTitle: {...FONTS.h4, fontSize: 17, marginBottom: 6},
  emptySub: {...FONTS.body4, fontSize: 14, textAlign: 'center'},
  footerLoader: {paddingVertical: 16},
  loadMore: {paddingVertical: 8, textAlign: 'center', fontSize: 12},
  centerLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deniedWrap: {flex: 1, padding: 24, justifyContent: 'center'},
  deniedTitle: {...FONTS.h3, fontSize: 18, marginBottom: 8},
  deniedBody: {...FONTS.body4, fontSize: 15},
});

export default PrintLabels;
