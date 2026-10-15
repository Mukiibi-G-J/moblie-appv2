import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONTS, SIZES, COLORS, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext, useAuth} from '../../context/Store';
import RestaurantScreenLayout from './RestaurantScreenLayout';
import RestaurantCloseCheckoutSheet from './RestaurantCloseCheckoutSheet';
import {
  addItemsToOrder,
  cancelEmptyOrder,
  createRestaurantOrder,
  deleteOrCancelOrderItem,
  fetchActiveMenus,
  fetchFloors,
  fetchMenuPosTree,
  fetchOrder,
  fetchOrders,
  fetchTables,
  fireOrder,
  flattenPosTree,
  openPosSession,
  type OpenPosPayload,
  type PosTreeMenuItem,
  type RestaurantFloor,
  type RestaurantMenu,
  type RestaurantOrder,
  type RestaurantOrderItem,
  type RestaurantTable,
  updateOrderItemStatus,
  settleRestaurantOrder,
} from '../../services/restaurantApi';
import PrintService from '../../services/PrintService';
import {fetchCompanyInfoForReceipt} from '../../utils/companyReceiptInfo';
import {formatCurrencyCompact} from '../../utils/currency';
import {useCompanyInfo} from '../../hooks/useCompanyInfo';
import {usePublishCustomerDisplay} from '../../hooks/usePublishCustomerDisplay';
import {
  buildIdleCustomerDisplay,
  linesFromCartItems,
  publishCustomerDisplay,
} from '../../services/customerDisplay';
import {
  receiptLabelFromPostedPayload,
  restaurantOrderToReceiptData,
} from '../../services/restaurantReceiptAdapter';
import type {KotData} from '../../services/UsbPrinterService';
import {
  groupTablesByFloorAndSection,
  singleGroupAllTables,
  sortFloorsByDisplayOrder,
  type FloorGroup,
} from '../../services/restaurantTableGrouping';

/** Web POS chrome (light surfaces) regardless of global dark theme. */
const POS = {
  pageBg: '#F9FAFB',
  surface: '#FFFFFF',
  muted: '#6B7280',
  text: '#111827',
  border: '#E5E7EB',
  divider: '#E5E7EB',
  tabActive: '#4F46E5',
  tabInactive: '#6B7280',
  emeraldBar: '#ECFDF5',
  emeraldBarBorder: '#D1FAE5',
  emeraldBtn: '#059669',
};

function overviewTileColors(status: string): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  switch (status) {
    case 'occupied':
      return {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        textColor: '#450A0A',
      };
    case 'reserved':
      return {
        backgroundColor: '#FFFBEB',
        borderColor: '#FCD34D',
        textColor: '#451A03',
      };
    case 'cleaning':
      return {
        backgroundColor: '#F0F9FF',
        borderColor: '#7DD3FC',
        textColor: '#0C4A6E',
      };
    case 'maintenance':
      return {
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE',
        textColor: '#4C1D95',
      };
    case 'available':
    default:
      return {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
        textColor: '#14532D',
      };
  }
}

function parseWaiterId(raw: string | undefined): number {
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function messageFromCaught(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const rec = err as {message?: unknown; response?: {data?: unknown}};
    const data = rec.response?.data;
    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.error === 'string' && obj.error.trim()) {
        return obj.error.trim();
      }
      if (typeof obj.detail === 'string' && obj.detail.trim()) {
        return obj.detail.trim();
      }
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'error' || key === 'detail') continue;
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
        if (Array.isArray(value) && value.length) {
          return String(value[0]);
        }
      }
    }
    if (typeof rec.message === 'string') {
      return rec.message;
    }
  }
  return '';
}

function posCountsFromOrder(o: RestaurantOrder): {
  unsent_items_count: number;
  fired_items_count: number;
} {
  const ordItems = o.order_items || [];
  return {
    unsent_items_count: ordItems.filter(
      i =>
        i.status === 'pending' &&
        (i.fire_state === undefined || i.fire_state === 'hold'),
    ).length,
    fired_items_count: ordItems.filter(
      (i: RestaurantOrderItem) => i.fire_state === 'fire',
    ).length,
  };
}

function payloadFromOrders(
  table: RestaurantTable | null,
  orders: RestaurantOrder[],
): OpenPosPayload {
  let unsent = 0;
  let fired = 0;
  let checks = 0;
  for (const o of orders) {
    const c = posCountsFromOrder(o);
    unsent += c.unsent_items_count;
    fired += c.fired_items_count;
    checks += o.active_checks?.length ?? 0;
  }
  return {
    table,
    active_orders: orders,
    active_checks_count: checks,
    unsent_items_count: unsent,
    fired_items_count: fired,
  };
}

function formatPosMoney(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) {
    return String(n);
  }
  return v.toLocaleString(undefined, {maximumFractionDigits: 0});
}

function menuAccentBorder(raw?: string): string {
  const s = (raw || '').trim();
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) {
    return s;
  }
  return POS.border;
}

/** Pending lines still on hold (not fired) can be removed; matches web POS. */
function canRemoveOrderLine(li: RestaurantOrderItem): boolean {
  if (li.status !== 'pending') {
    return false;
  }
  const fs = li.fire_state;
  return fs === undefined || fs === null || fs === '' || fs === 'hold';
}

/** DRF/axios can mix string vs number ids across responses; strict === breaks merge/find. */
function sameOrderId(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): boolean {
  if (a == null || b == null) {
    return false;
  }
  return Number(a) === Number(b);
}

function mergeOpenOrderLists(
  a: RestaurantOrder[],
  b: RestaurantOrder[],
): RestaurantOrder[] {
  const byId = new Map<number, RestaurantOrder>();
  for (const o of [...a, ...b]) {
    const id = Number(o.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    byId.set(id, o);
  }
  return Array.from(byId.values()).sort(
    (x, y) =>
      new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
  );
}

function minimalTableForPos(
  hydrated: RestaurantOrder,
  tableId: number,
): RestaurantTable {
  return {
    id: tableId,
    no: String(tableId),
    table_number: String(hydrated.table_number ?? tableId),
    status: 'occupied',
    status_display: 'Occupied',
    capacity: 0,
  };
}

function errMessageRestaurant(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const data = (e as {response?: {data?: {error?: unknown}}}).response
      ?.data;
    if (typeof data?.error === 'string') {
      return data.error;
    }
  }
  if (e instanceof Error && typeof e.message === 'string') {
    return e.message;
  }
  return fallback;
}

function mergeOrderIntoPayload(
  prev: OpenPosPayload | null,
  updated: RestaurantOrder,
): OpenPosPayload | null {
  const table = prev?.table ?? null;
  const uid = Number(updated.id);
  if (!Number.isFinite(uid)) {
    return prev;
  }
  const orders = prev?.active_orders || [];
  /** Drop any row for this order id, then append server order (fixes duplicate empty+full rows + stale prev after await). */
  const without = orders.filter(o => Number(o.id) !== uid);
  const nextList = [...without, updated];
  return payloadFromOrders(table, nextList);
}

function primaryImageUriForOrderLine(
  li: RestaurantOrderItem,
  menuItems: PosTreeMenuItem[],
): string | null | undefined {
  if (li.primary_image_url) {
    return li.primary_image_url;
  }
  const sku = (li.item_no ?? li.item ?? '').trim();
  if (!sku) {
    return null;
  }
  return menuItems.find(mi => mi.item_no === sku)?.primary_image_url ?? null;
}

function MenuItemThumbnail({
  uri,
  fallbackLetter,
  borderColor,
}: {
  uri?: string | null;
  fallbackLetter: string;
  borderColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(uri) && !failed;
  return (
    <View
      style={[
        styles.menuThumbWrap,
        {borderColor: borderColor || POS.border},
      ]}>
      {showImg ? (
        <Image
          source={{uri: uri!}}
          style={styles.menuThumbImg}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.menuThumbLetter}>
          {(fallbackLetter || '?').slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export default function RestaurantPOS() {
  const {colors} = useTheme();
  const app = useAppContext();
  const {auth} = useAuth();
  const {storeLabel, logoUri} = useCompanyInfo();
  const {width: screenW, height: screenH} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = screenW >= 600;
  const waiterId = useMemo(() => parseWaiterId(auth.user_id), [auth.user_id]);

  const branchLine = useMemo(() => {
    const b = app?.branchSession?.active_branch;
    if (!b) {
      return null;
    }
    const desc = (b.description || '').trim();
    const code = (b.code || '').trim();
    if (!code && !desc) {
      return null;
    }
    if (!desc || desc.toUpperCase() === code.toUpperCase()) {
      return code || desc;
    }
    return `${code} — ${desc}`;
  }, [app?.branchSession?.active_branch]);

  const [tablesLoading, setTablesLoading] = useState(true);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [floors, setFloors] = useState<RestaurantFloor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(
    null,
  );
  const [isQuickSale, setIsQuickSale] = useState(false);
  const [openingSession, setOpeningSession] = useState(false);

  const [posLoading, setPosLoading] = useState(false);
  const [posData, setPosData] = useState<OpenPosPayload | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [pendingQuickSale, setPendingQuickSale] = useState(false);
  const [pendingNewCheck, setPendingNewCheck] = useState(false);

  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<PosTreeMenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number | null>(null);
  const [removingLineId, setRemovingLineId] = useState<number | null>(null);
  const [loadOrderSheetOpen, setLoadOrderSheetOpen] = useState(false);
  const [openOrders, setOpenOrders] = useState<RestaurantOrder[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);

  const [closeSheetOpen, setCloseSheetOpen] = useState(false);
  const [orderToClose, setOrderToClose] = useState<RestaurantOrder | null>(null);
  const [closingInProgress, setClosingInProgress] = useState(false);
  const [isPrintingKot, setIsPrintingKot] = useState(false);

  const inPosSession = selectedTable != null || isQuickSale;

  const sortedFloors = useMemo(
    () => sortFloorsByDisplayOrder(floors),
    [floors],
  );

  const resolvedFloorId = useMemo(() => {
    if (sortedFloors.length === 0) {
      return null;
    }
    if (
      selectedFloor != null &&
      sortedFloors.some(f => f.id === selectedFloor)
    ) {
      return selectedFloor;
    }
    return sortedFloors[0].id;
  }, [sortedFloors, selectedFloor]);

  useEffect(() => {
    if (resolvedFloorId == null) {
      return;
    }
    if (selectedFloor !== resolvedFloorId) {
      setSelectedFloor(resolvedFloorId);
    }
  }, [resolvedFloorId, selectedFloor]);

  const floorGroups: FloorGroup[] = useMemo(() => {
    if (resolvedFloorId == null || sortedFloors.length === 0) {
      return singleGroupAllTables(tables);
    }
    return groupTablesByFloorAndSection(
      tables,
      sortedFloors,
      resolvedFloorId,
    );
  }, [tables, sortedFloors, resolvedFloorId]);

  const totalTablesInOverview = useMemo(
    () =>
      floorGroups.reduce(
        (sum, g) => sum + g.sections.reduce((s, sec) => s + sec.tables.length, 0),
        0,
      ),
    [floorGroups],
  );

  const loadStartup = useCallback(async () => {
    setTablesLoading(true);
    try {
      const [tablesRes, floorsRes] = await Promise.all([
        fetchTables(),
        fetchFloors().catch(() => ({results: [] as RestaurantFloor[]})),
      ]);
      setTables(tablesRes.results || []);
      setFloors((floorsRes.results || []).filter(Boolean));
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load restaurant data',
        text2: e?.message || 'Try again',
      });
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStartup();
    }, [loadStartup]),
  );

  const refreshPosForTable = async (table: RestaurantTable) => {
    setPosLoading(true);
    try {
      const data = await openPosSession(table.id);
      setPosData(data);
      const orders = data.active_orders || [];
      setActiveOrderId(prev =>
        prev != null && orders.some(o => sameOrderId(o.id, prev))
          ? prev
          : orders[0]?.id != null
            ? Number(orders[0].id)
            : null,
      );
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not open table',
        text2: e?.message || 'Check table status',
      });
      setPosData(null);
      setActiveOrderId(null);
    } finally {
      setPosLoading(false);
    }
  };

  const refreshQuickSaleOrders = async (explicit?: RestaurantOrder[]) => {
    const list = explicit ?? posData?.active_orders ?? [];
    if (list.length === 0) {
      if (!activeOrderId) {
        return;
      }
      const o = await fetchOrder(activeOrderId);
      setPosData(payloadFromOrders(null, [o]));
      return;
    }
    const refreshed = await Promise.all(list.map(o => fetchOrder(o.id)));
    setPosData(payloadFromOrders(null, refreshed));
  };

  const refreshAfterMutation = async (quickSaleOrders?: RestaurantOrder[]) => {
    if (isQuickSale) {
      await refreshQuickSaleOrders(quickSaleOrders);
    } else if (selectedTable) {
      await refreshPosForTable(selectedTable);
    }
  };

  const loadMenus = async () => {
    setMenuLoading(true);
    try {
      const list = await fetchActiveMenus();
      setMenus(list || []);
      const first = list?.[0];
      if (first) {
        const tree = await fetchMenuPosTree(first.id);
        setMenuId(first.id);
        setMenuItems(flattenPosTree(tree));
      } else {
        setMenuId(null);
        setMenuItems([]);
      }
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load menu',
        text2: e?.message || '',
      });
    } finally {
      setMenuLoading(false);
    }
  };

  /** Switch POS menu without refetching the menu list (web-style menu picker). */
  const switchRestaurantMenu = async (id: number) => {
    if (id === menuId) {
      return;
    }
    setMenuLoading(true);
    try {
      const tree = await fetchMenuPosTree(id);
      setMenuId(id);
      setMenuItems(flattenPosTree(tree));
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load menu',
        text2: typeof e?.response?.data?.error === 'string'
          ? e.response.data.error
          : e?.message || '',
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const exitToPicker = () => {
    void (async () => {
      const orders = posData?.active_orders ?? [];
      for (const o of orders) {
        if ((o.order_items || []).length === 0) {
          try {
            await cancelEmptyOrder(o.id);
          } catch {
            // best effort
          }
        }
      }
      setPendingQuickSale(false);
      setPendingNewCheck(false);
      setIsQuickSale(false);
      setSelectedTable(null);
      setPosData(null);
      setActiveOrderId(null);
      setMenus([]);
      setMenuItems([]);
      setMenuId(null);
    })();
  };

  const onSelectTable = async (t: RestaurantTable) => {
    setIsQuickSale(false);
    setPendingQuickSale(false);
    setPendingNewCheck(false);
    setSelectedTable(t);
    await refreshPosForTable(t);
    await loadMenus();
  };

  const startQuickSale = async () => {
    if (!waiterId) {
      Toast.show({
        type: 'error',
        text1: 'Quick sale',
        text2: 'Missing waiter profile',
      });
      return;
    }
    setOpeningSession(true);
    try {
      setSelectedTable(null);
      setIsQuickSale(true);
      setPendingQuickSale(true);
      setPendingNewCheck(false);
      setActiveOrderId(null);
      setPosData(payloadFromOrders(null, []));
      Toast.show({
        type: 'success',
        text1: 'Quick sale',
        text2: 'Add an item to start the order.',
      });
      await loadMenus();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Quick sale',
        text2:
          typeof e?.response?.data?.error === 'string'
            ? e.response.data.error
            : e?.message || 'Could not start',
      });
    } finally {
      setOpeningSession(false);
    }
  };

  const loadOpenOrders = async () => {
    setOpenOrdersLoading(true);
    try {
      const [newRes, progRes] = await Promise.all([
        fetchOrders({
          status: 'new',
          page_size: 50,
          ordering: '-created_at',
        }),
        fetchOrders({
          status: 'in_progress',
          page_size: 50,
          ordering: '-created_at',
        }),
      ]);
      setOpenOrders(
        mergeOpenOrderLists(
          newRes.results || [],
          progRes.results || [],
        ),
      );
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Could not load orders',
        text2: errMessageRestaurant(e, 'Try again'),
      });
    } finally {
      setOpenOrdersLoading(false);
    }
  };

  const loadOrderIntoPOS = async (order: RestaurantOrder) => {
    setLoadOrderSheetOpen(false);
    setOpeningSession(true);
    setPendingQuickSale(false);
    setPendingNewCheck(false);
    try {
      const hydrated = await fetchOrder(Number(order.id));
      const rawTable = hydrated.table;
      const tableId =
        rawTable != null && Number(rawTable) > 0 ? Number(rawTable) : null;

      if (tableId != null) {
        const tableObj =
          tables.find(t => sameOrderId(t.id, tableId)) ??
          minimalTableForPos(hydrated, tableId);
        setIsQuickSale(false);
        setSelectedTable(tableObj);
        await refreshPosForTable(tableObj);
        setActiveOrderId(Number(hydrated.id));
        await loadMenus();
        Toast.show({
          type: 'success',
          text1: `Order ${hydrated.no} loaded`,
          text2: `${(hydrated.order_items || []).length} item(s) — add more below`,
        });
        return;
      }

      setIsQuickSale(true);
      setSelectedTable(null);
      setPosData(payloadFromOrders(null, [hydrated]));
      setActiveOrderId(Number(hydrated.id));
      await loadMenus();
      Toast.show({
        type: 'success',
        text1: `Order ${hydrated.no} loaded`,
        text2: `${(hydrated.order_items || []).length} item(s) — add more below`,
      });
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Could not load order',
        text2: errMessageRestaurant(e, 'Try again'),
      });
    } finally {
      setOpeningSession(false);
    }
  };

  const openNewCheck = async () => {
    if (!waiterId) {
      Toast.show({
        type: 'error',
        text1: 'Cannot start order',
        text2: 'Missing waiter profile',
      });
      return;
    }
    if (!isQuickSale && !selectedTable) {
      Toast.show({
        type: 'error',
        text1: 'Cannot start order',
        text2: 'Select a table first',
      });
      return;
    }
    if (!activeOrderId && (pendingNewCheck || pendingQuickSale)) {
      Toast.show({
        type: 'info',
        text1: 'Check pending',
        text2: 'Add an item to this check or select another one.',
      });
      return;
    }
    setPendingNewCheck(true);
    setActiveOrderId(null);
    Toast.show({
      type: 'success',
      text1: 'New check',
      text2: 'Select items to create this check.',
    });
  };

  const onAddItem = async (item: PosTreeMenuItem) => {
    if (!activeOrderId && !(pendingQuickSale || pendingNewCheck)) {
      Toast.show({
        type: 'info',
        text1: 'Open or select a check first',
      });
      return;
    }
    const no = (item.item_no || '').trim();
    if (!no) {
      Toast.show({
        type: 'info',
        text1: 'This menu row is not linked to an item',
      });
      return;
    }
    if (item.pos_out_of_stock === true) {
      Toast.show({
        type: 'info',
        text1: 'Out of stock',
        text2: 'Not enough on hand at this branch for this item.',
      });
      return;
    }
    setAddingItemId(item.id);
    try {
      let orderId =
        activeOrderId != null ? Number(activeOrderId) : null;
      if (!orderId && (pendingQuickSale || pendingNewCheck)) {
        if (!waiterId) {
          Toast.show({
            type: 'error',
            text1: 'Cannot add item',
            text2: 'Missing waiter profile',
          });
          return;
        }
        const isTakeout = isQuickSale;
        if (!isTakeout && !selectedTable) {
          Toast.show({
            type: 'error',
            text1: 'Cannot add item',
            text2: 'Select a table first',
          });
          return;
        }
        const created = await createRestaurantOrder(
          isTakeout
            ? {
                waiter: waiterId,
                order_type: 'takeout',
                covers: null,
              }
            : {
                table: selectedTable!.id,
                waiter: waiterId,
                order_type: 'dine_in',
                covers: null,
              },
        );
        const hydrated = await fetchOrder(Number(created.id));
        const prev = posData?.active_orders ?? [];
        const next = [...prev, hydrated];
        setPosData(
          payloadFromOrders(isQuickSale ? null : selectedTable ?? null, next),
        );
        setActiveOrderId(Number(hydrated.id));
        setPendingQuickSale(false);
        setPendingNewCheck(false);
        orderId = Number(hydrated.id);
      }
      if (!orderId) {
        return;
      }
      const unit = Number(item.unit_price);
      await addItemsToOrder(orderId, [
        {
          item: no,
          quantity: 1,
          unit_price: Number.isFinite(unit) ? unit : 0,
        },
      ]);
      // GET order always returns current lines (add-items response can omit lines if prefetch stale on server).
      const updatedOrder = await fetchOrder(orderId);
      setPosData(prev => mergeOrderIntoPayload(prev, updatedOrder));
    } catch (e: any) {
      const d = e?.response?.data;
      const msg =
        typeof d?.error === 'string'
          ? d.error
          : typeof e?.message === 'string'
            ? e.message
            : 'Could not add item';
      Toast.show({
        type: 'error',
        text1: 'Could not add item',
        text2: msg,
      });
      await refreshAfterMutation();
    } finally {
      setAddingItemId(null);
    }
  };

  const onRemoveLine = async (line: RestaurantOrderItem) => {
    if (!canRemoveOrderLine(line)) {
      Toast.show({
        type: 'info',
        text1: 'Cannot remove',
        text2: 'Items already sent to the kitchen must be voided from the register.',
      });
      return;
    }
    setRemovingLineId(line.id);
    try {
      await deleteOrCancelOrderItem(line.id);
      await refreshAfterMutation();
      Toast.show({type: 'success', text1: 'Line removed'});
    } catch (e: any) {
      const d = e?.response?.data;
      const msg =
        typeof d?.error === 'string'
          ? d.error
          : typeof e?.message === 'string'
            ? e.message
            : 'Remove failed';
      Toast.show({type: 'error', text1: 'Remove failed', text2: msg});
    } finally {
      setRemovingLineId(null);
    }
  };

  function buildKotData(
    order: RestaurantOrder,
    kitchenItems: RestaurantOrderItem[],
  ): KotData {
    const tableLabel = order.table_number
      ? `Table ${order.table_number}`
      : 'Quick sale / Takeout';
    return {
      order_no: order.no,
      table_label: tableLabel,
      order_type_display: order.order_type_display || '',
      waiter_name: order.waiter_name || undefined,
      printed_at: new Date().toLocaleString(),
      items: kitchenItems.map(i => ({
        item_name: i.item_name || i.item || '',
        quantity: Number(i.quantity) || 1,
        special_instructions: i.special_instructions || null,
        fire_state_display: i.fire_state_display || null,
      })),
    };
  }

  const onFire = async () => {
    if (!activeOrderId) {
      return;
    }
    const order = (posData?.active_orders || []).find(o =>
      sameOrderId(o.id, activeOrderId),
    );
    if (!order) {
      return;
    }

    const pendingItems = (order.order_items || []).filter(
      i =>
        i.status === 'pending' &&
        (i.fire_state === 'hold' || !i.fire_state),
    );

    if (pendingItems.length === 0) {
      Toast.show({type: 'info', text1: 'No pending items to fire'});
      return;
    }

    const kitchenItems = pendingItems.filter(i => i.routes_to_kitchen !== false);
    const bypassItems = pendingItems.filter(i => i.routes_to_kitchen === false);

    try {
      if (kitchenItems.length > 0) {
        await fireOrder(
          activeOrderId,
          kitchenItems.map(i => i.id),
        );
      }

      if (bypassItems.length > 0) {
        await Promise.all(
          bypassItems.map(i => updateOrderItemStatus(i.id, 'served')),
        );
      }

      await refreshAfterMutation();

      const parts: string[] = [];
      if (kitchenItems.length > 0) {
        parts.push(`${kitchenItems.length} sent to kitchen`);
      }
      if (bypassItems.length > 0) {
        parts.push(`${bypassItems.length} marked served (no kitchen)`);
      }

      Toast.show({
        type: 'success',
        text1: 'Order fired',
        text2: parts.join(' · '),
      });
      if (kitchenItems.length > 0) {
        const kotData = buildKotData(order, kitchenItems);
        void PrintService.getInstance().printKot(kotData).catch(() => {});
      }
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Fire failed',
        text2: messageFromCaught(e) || 'Could not fire order',
      });
    }
  };

  const onCloseOrder = (order: RestaurantOrder) => {
    const unsentCount = (order.order_items || []).filter(
      i =>
        i.status === 'pending' &&
        (i.fire_state === 'hold' || !i.fire_state),
    ).length;

    if (unsentCount > 0) {
      Alert.alert(
        'Unsent items',
        `${unsentCount} item(s) have not been sent to kitchen yet. Fire the order first.`,
        [{text: 'OK'}],
      );
      return;
    }

    setOrderToClose(order);
    setCloseSheetOpen(true);
  };

  const confirmClose = async (
    shouldPrint: boolean,
    paymentMethodId: number,
    transactionId?: string,
  ) => {
    if (!orderToClose) {
      return;
    }
    const snap = orderToClose;
    setClosingInProgress(true);
    try {
      const payload = await settleRestaurantOrder(snap, paymentMethodId, {
        ...(transactionId ? {transaction_id: transactionId} : {}),
      });
      const receiptId = receiptLabelFromPostedPayload(payload, snap.no);
      publishCustomerDisplay({
        mode: 'thanks',
        companyName: storeLabel,
        companyLogo: logoUri,
        heading: 'Thank you',
        message: 'Please take your receipt',
        totalAmount: formatCurrencyCompact(Number(snap.total_amount) || 0),
      });

      if (shouldPrint) {
        const companyInfo = await fetchCompanyInfoForReceipt();
        const receiptData = restaurantOrderToReceiptData(snap, {
          username: auth.username || auth.user_id || 'Staff',
          receiptIdOverride: receiptId,
          companyInfo,
        });
        const printed =
          await PrintService.getInstance().printReceipt(receiptData);
        if (!printed) {
          Toast.show({
            type: 'info',
            text1: 'Check settled',
            text2: 'Could not print — check printer in Settings.',
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Invoice posted & receipt printed',
          });
        }
      } else {
        Toast.show({
          type: 'success',
          text1: 'Invoice posted',
          text2: snap.no,
        });
      }

      setCloseSheetOpen(false);
      setOrderToClose(null);

      await refreshAfterMutation();
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Could not settle check',
        text2: messageFromCaught(e) || '',
      });
    } finally {
      setClosingInProgress(false);
    }
  };

  const activeOrder: RestaurantOrder | undefined = useMemo(() => {
    const orders = posData?.active_orders || [];
    if (!activeOrderId) {
      return undefined;
    }
    return orders.find(o => sameOrderId(o.id, activeOrderId));
  }, [posData, activeOrderId]);

  const customerDisplayPayload = useMemo(() => {
    if (closeSheetOpen && orderToClose) {
      const items = orderToClose.order_items || [];
      const qty = items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
      return {
        mode: 'paying' as const,
        companyName: storeLabel,
        companyLogo: logoUri,
        heading: 'Please pay',
        message: orderToClose.table_number
          ? `Table ${orderToClose.table_number}`
          : 'Pay at the counter',
        lines: linesFromCartItems(items),
        totalLabel: 'AMOUNT DUE',
        totalAmount: formatCurrencyCompact(Number(orderToClose.total_amount) || 0),
        footer: `${qty} item${qty === 1 ? '' : 's'}`,
      };
    }
    const items = activeOrder?.order_items || [];
    if (!activeOrder || items.length === 0) {
      return buildIdleCustomerDisplay(storeLabel, logoUri);
    }
    const qty = items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    return {
      mode: 'cart' as const,
      companyName: storeLabel,
      companyLogo: logoUri,
      heading: activeOrder.table_number
        ? `Table ${activeOrder.table_number}`
        : 'Your order',
      lines: linesFromCartItems(items),
      totalLabel: 'TOTAL',
      totalAmount: formatCurrencyCompact(Number(activeOrder.total_amount) || 0),
      footer: `${qty} item${qty === 1 ? '' : 's'}`,
    };
  }, [
    activeOrder,
    closeSheetOpen,
    logoUri,
    orderToClose,
    storeLabel,
  ]);
  usePublishCustomerDisplay(customerDisplayPayload);

  const onPrintKot = async () => {
    if (!activeOrder) {
      return;
    }
    const kitchenItems = (activeOrder.order_items || []).filter(
      i => i.routes_to_kitchen !== false,
    );
    if (kitchenItems.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No kitchen items',
        text2: 'All items on this check bypass the kitchen.',
      });
      return;
    }
    setIsPrintingKot(true);
    try {
      const kotData = buildKotData(activeOrder, kitchenItems);
      const printed = await PrintService.getInstance().printKot(kotData);
      if (!printed) {
        Toast.show({
          type: 'info',
          text1: 'KOT not printed',
          text2: 'Check printer in Settings.',
        });
      } else {
        Toast.show({type: 'success', text1: 'KOT printed'});
      }
    } catch {
      Toast.show({type: 'error', text1: 'KOT print failed'});
    } finally {
      setIsPrintingKot(false);
    }
  };

  /** Table picker chrome width for tile grid */
  const pickerCols = screenW >= 400 ? 3 : 2;
  const tileGap = 10;
  const horizontalPad = SIZES.padding * 2 + 24;
  const tileW =
    (screenW - horizontalPad - (pickerCols - 1) * tileGap) / pickerCols;

  const renderFloorTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.floorTabScroll}>
      {(sortedFloors.length ? sortedFloors : []).map(fl => {
        const active = fl.id === resolvedFloorId;
        return (
          <Pressable
            key={fl.id}
            onPress={() => setSelectedFloor(fl.id)}
            style={styles.floorTabInner}>
            <Text
              style={{
                ...FONTS.body3,
                fontWeight: '600',
                color: active ? POS.tabActive : POS.tabInactive,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderBottomWidth: active ? 2 : 2,
                borderBottomColor: active ? POS.tabActive : 'transparent',
              }}>
              {(fl.name || '').toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderTableTiles = () => {
    const sectionAccents = [
      {pillBg: '#EEF2FF', pillBorder: '#C7D2FE', pillText: '#312E81'},
      {pillBg: '#ECFDF5', pillBorder: '#A7F3D0', pillText: '#064E3B'},
      {pillBg: '#F0F9FF', pillBorder: '#BAE6FD', pillText: '#0C4A6E'},
    ];

    const sessionBusy = openingSession;

    const groupsToRender =
      sortedFloors.length > 0
        ? floorGroups
        : singleGroupAllTables(tables);

    return groupsToRender.flatMap((fg, fgIx) =>
      fg.sections.map((section, secIdx) => (
        <View key={`fg-${fg.floorId}-${section.sectionId ?? 'u'}-${fgIx}-${secIdx}`}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.gradLineLeft, styles.gradLineMuted]} />
            <View
              style={[
                styles.sectionPill,
                {
                  backgroundColor: sectionAccents[secIdx % 3].pillBg,
                  borderColor: sectionAccents[secIdx % 3].pillBorder,
                },
              ]}>
              <Text
                style={{
                  ...FONTS.body5,
                  fontWeight: '700',
                  color: sectionAccents[secIdx % 3].pillText,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                {section.sectionName}
              </Text>
            </View>
            <View style={[styles.gradLineRight, styles.gradLineMuted]} />
          </View>
          <View style={[styles.tileGrid, {gap: tileGap}]}>
            {section.tables.map(t => {
              const vc = overviewTileColors(t.status);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    if (sessionBusy) {
                      return;
                    }
                    void onSelectTable(t);
                  }}
                  disabled={sessionBusy}
                  style={[
                    styles.overviewTile,
                    {
                      width: Math.max(tileW, 100),
                      backgroundColor: vc.backgroundColor,
                      borderColor: vc.borderColor,
                      opacity: sessionBusy ? 0.65 : 1,
                    },
                  ]}>
                  <Text
                    numberOfLines={3}
                    style={{
                      ...FONTS.body3,
                      fontWeight: '700',
                      color: vc.textColor,
                      textAlign: 'center',
                    }}>
                    {t.table_number || t.no}
                  </Text>
                  <Text style={[styles.seatsLbl, {color: vc.textColor}]}>
                    {t.capacity} seats
                  </Text>
                  {t.status !== 'available' ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.statusLbl, {color: vc.textColor}]}>
                      {t.status_display || t.status}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      )),
    );
  };

  const tablePickerPanel = tablesLoading ? (
    <View style={[styles.pickCentered, {backgroundColor: POS.pageBg}]}>
      <ActivityIndicator color={POS.tabActive} />
      <Text style={{...FONTS.body4, color: POS.muted, marginTop: 8}}>
        Loading tables…
      </Text>
    </View>
  ) : (
    <ScrollView
      style={{flex: 1}}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.pickScrollContent,
        {backgroundColor: POS.pageBg},
      ]}>
      {branchLine ? (
        <View style={[styles.branchRow, {borderBottomColor: POS.divider}]}>
          <Image
            source={icons.location_pin}
            style={[styles.branchIcon, {tintColor: POS.muted}]}
          />
          <Text
            numberOfLines={1}
            style={{...FONTS.body4, flex: 1, color: POS.muted, fontWeight: '600'}}>
            {branchLine}
          </Text>
        </View>
      ) : null}

      <View style={[styles.pickBlock, {borderBottomColor: POS.divider}]}>
        <Text style={styles.pickTitle}>Choose a table</Text>
        <Text style={styles.pickSubtitle}>
          Pick a table or use Quick sale for walk-in counter checkout
        </Text>
      </View>

      {sortedFloors.length ? (
        <View style={[styles.whiteBar, {borderBottomColor: POS.border}]}>
          {renderFloorTabs()}
        </View>
      ) : (
        <View style={[styles.whiteBar, {borderBottomColor: POS.border}]}>
          <Text style={[styles.pickSubtitle, {paddingVertical: 6}]}>
            No floors configured — showing all tables
          </Text>
        </View>
      )}

      <View
        style={[
          styles.quickSaleBar,
          {
            backgroundColor: POS.emeraldBar,
            borderBottomColor: POS.emeraldBarBorder,
          },
        ]}>
        <Pressable
          disabled={openingSession}
          onPress={() => void startQuickSale()}
          style={[
            styles.quickSaleBtn,
            {backgroundColor: POS.emeraldBtn, opacity: openingSession ? 0.7 : 1},
          ]}>
          {openingSession ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.quickSaleBtnText}>Quick sale (walk-in)</Text>
          )}
        </Pressable>
        <Text style={styles.quickSaleHint}>
          No table — record payment and print receipt at the counter.
        </Text>
      </View>

      <Pressable
        disabled={openingSession}
        onPress={() => {
          setLoadOrderSheetOpen(true);
          void loadOpenOrders();
        }}
        style={[
          styles.loadOrderBar,
          {
            backgroundColor: POS.surface,
            borderBottomColor: POS.border,
            opacity: openingSession ? 0.6 : 1,
          },
        ]}>
        <Text style={styles.loadOrderBarText}>Resume existing order</Text>
        <Text style={styles.loadOrderBarHint}>
          Add items to an order already in progress
        </Text>
      </Pressable>

      <View style={styles.pickBoard}>
        {openingSession ? (
          <View style={styles.openingOverlay}>
            <ActivityIndicator color={POS.tabActive} />
            <Text style={{marginTop: 6, ...FONTS.body4, color: POS.muted}}>
              Opening…
            </Text>
          </View>
        ) : null}

        {tables.length === 0 ? (
          <Text style={[styles.pickEmptyText, {color: POS.muted}]}>
            No tables found for this tenant.
          </Text>
        ) : sortedFloors.length > 0 && totalTablesInOverview === 0 ? (
          <Text style={[styles.pickEmptyText, {color: POS.muted}]}>
            {`${tables.length} table${tables.length === 1 ? '' : 's'} loaded — none on this floor. Check floor assignments.`}
          </Text>
        ) : (
          <>
            {sortedFloors.length > 0 && floorGroups.length > 0 ? (
              <View
                style={[styles.panelHeader, styles.panelHeroIndigo]}
                accessibilityRole="header">
                <Text style={[styles.panelTitle, {flex: 1}]}>
                  {floorGroups[0]?.floorName}
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeTxt}>
                    {totalTablesInOverview} table
                    {totalTablesInOverview === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ) : null}

            {!sortedFloors.length && tables.length > 0 ? (
              <View
                style={[styles.panelHeader, styles.panelHeroIndigo]}
                accessibilityRole="header">
                <Text style={[styles.panelTitle, {flex: 1}]}>Tables</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeTxt}>
                    {tables.length} table
                    {tables.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ) : null}

            {renderTableTiles()}
          </>
        )}
      </View>
    </ScrollView>
  );

  const nestedHorizontalExtras = !isWide
    ? ({
        nestedScrollEnabled: true,
        scrollEventThrottle: 16,
        directionalLockEnabled: true,
      } as const)
    : {};

  function renderStickyActionBar(): React.ReactElement {
    return (
      <SafeAreaView edges={['bottom']} style={{backgroundColor: colors.card}}>
        <View
          style={[
            styles.stickyActionBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            },
          ]}>
          <Pressable
            onPress={() => void openNewCheck()}
            disabled={!activeOrderId && (pendingQuickSale || pendingNewCheck)}
            style={[
              styles.stickyPrimaryBtn,
              {
                backgroundColor: COLORS.primary,
                opacity:
                  !activeOrderId && (pendingQuickSale || pendingNewCheck)
                    ? 0.5
                    : 1,
              },
            ]}>
            <Text style={styles.btnText}>New check</Text>
          </Pressable>
          <Pressable
            onPress={() => void onPrintKot()}
            disabled={!activeOrder || isPrintingKot}
            style={[
              styles.stickyOutlineBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: activeOrder && !isPrintingKot ? 1 : 0.4,
              },
            ]}>
            {isPrintingKot ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={[styles.btnTextDark, {color: colors.textPrimary}]}>
                Print KOT
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void onFire()}
            disabled={!activeOrderId}
            style={[
              styles.stickyOutlineBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: activeOrderId ? 1 : 0.5,
              },
            ]}>
            <Text style={[styles.btnTextDark, {color: colors.textPrimary}]}>
              Fire / send
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  function renderChecksPanel(): React.ReactElement {
    return (
      <>
        <Text
          style={[
            styles.sectionLabel,
            {
              paddingHorizontal: 16,
              marginTop: 8,
              backgroundColor: colors.background,
              color: colors.textSecondary,
            },
          ]}>
          {isQuickSale ? 'Checks (quick sale)' : 'Checks on table'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...nestedHorizontalExtras}
          contentContainerStyle={styles.orderChipsInner}>
          {(posData?.active_orders || []).map(o => {
            const sel = sameOrderId(o.id, activeOrderId);
            return (
              <Pressable
                key={Number(o.id)}
                onPress={() => {
                  setActiveOrderId(o.id != null ? Number(o.id) : null);
                  setPendingQuickSale(false);
                  setPendingNewCheck(false);
                }}
                style={[
                  styles.orderChip,
                  {
                    borderColor: sel ? COLORS.primary : colors.border,
                    backgroundColor: sel
                      ? COLORS.primary + '22'
                      : colors.card,
                  },
                ]}>
                <Text style={[styles.orderChipText, {color: colors.textPrimary}]}>
                  {o.no}
                </Text>
                <Text
                  style={[styles.orderChipSub, {color: colors.textSecondary}]}>
                  {o.status_display}
                </Text>
              </Pressable>
            );
          })}
          {pendingQuickSale || pendingNewCheck ? (
            <Pressable
              onPress={() => setActiveOrderId(null)}
              style={[
                styles.orderChip,
                {
                  borderColor:
                    activeOrderId === null
                      ? COLORS.primary
                      : colors.border,
                  backgroundColor:
                    activeOrderId === null
                      ? COLORS.primary + '22'
                      : colors.card,
                },
              ]}>
              <Text style={[styles.orderChipText, {color: colors.textPrimary}]}>
                {pendingQuickSale ? 'Quick sale (pending)' : 'New check (pending)'}
              </Text>
              <Text
                style={[styles.orderChipSub, {color: colors.textSecondary}]}>
                …
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {!activeOrder && (pendingQuickSale || pendingNewCheck) ? (
          <View style={[styles.checkPanel, {paddingVertical: 20}]}>
            <Text style={[styles.checkMeta, {color: colors.textSecondary}]}>
              {pendingQuickSale
                ? 'Add an item to start the order.'
                : 'Select items to create this check.'}
            </Text>
          </View>
        ) : null}

        {activeOrder ? (
          <View style={styles.checkPanel}>
            <View style={styles.checkTitleRow}>
              <View style={{flex: 1}}>
                <Text style={[styles.checkTitle, {color: colors.textPrimary}]}>
                  {activeOrder.no} · {activeOrder.status_display}
                </Text>
                <Text style={[styles.checkMeta, {color: colors.textSecondary}]}>
                  Items · {(activeOrder.order_items || []).length}
                </Text>
              </View>
              <Pressable
                onPress={() => onCloseOrder(activeOrder)}
                style={[styles.closeOrderBtn, {borderColor: COLORS.primary}]}>
                <Text style={[styles.closeOrderBtnTxt, {color: COLORS.primary}]}>
                  Close order
                </Text>
              </Pressable>
            </View>
            {(activeOrder.order_items || []).map(li => {
              const removable = canRemoveOrderLine(li);
              const busyLine = removingLineId === li.id;
              return (
                <View
                  key={li.id}
                  style={[styles.checkLineRow, {borderBottomColor: colors.border}]}>
                  <MenuItemThumbnail
                    uri={primaryImageUriForOrderLine(li, menuItems)}
                    fallbackLetter={li.item_name || li.item || '?'}
                    borderColor={colors.border}
                  />
                  <View style={styles.checkLineMid}>
                    <Text style={[styles.checkLineName, {color: colors.textPrimary}]}>
                      {li.item_name || li.item}
                    </Text>
                    <Text style={[styles.checkLineSub, {color: colors.textSecondary}]}>
                      {Number(li.unit_price ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{' '}
                      ea · {li.status_display}
                      {li.fire_state_display ? ` · ${li.fire_state_display}` : ''}
                    </Text>
                    {li.routes_to_kitchen === false ? (
                      <View style={styles.bypassBadge}>
                        <Text style={styles.bypassBadgeTxt}>No kitchen</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.checkLineRight}>
                    <Text style={[styles.checkLineQty, {color: colors.textPrimary}]}>
                      ×{li.quantity}
                    </Text>
                    {removable ? (
                      <Pressable
                        onPress={() => void onRemoveLine(li)}
                        disabled={removingLineId !== null}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                        style={[
                          styles.lineRemoveBtn,
                          {borderColor: COLORS.error},
                        ]}>
                        {busyLine ? (
                          <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                          <Text style={styles.lineRemoveTxt}>Remove</Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </>
    );
  }

  function renderMenuPanel(): React.ReactElement {
    return (
      <>
        <Text
          style={[
            styles.sectionLabel,
            {
              paddingHorizontal: 16,
              marginTop: 14,
              backgroundColor: colors.background,
              color: colors.textSecondary,
            },
          ]}>
          Menu
        </Text>
        {menus.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...nestedHorizontalExtras}
            contentContainerStyle={styles.menuPickerRow}>
            {menus.map(m => {
              const active = m.id === menuId;
              return (
                <Pressable
                  key={m.id}
                  disabled={menuLoading}
                  onPress={() => void switchRestaurantMenu(m.id)}
                  hitSlop={{top: 4, bottom: 4}}
                  style={[
                    styles.menuPickerChip,
                    {
                      backgroundColor: active
                        ? COLORS.primary + '24'
                        : colors.card,
                      borderColor: active ? COLORS.primary : colors.border,
                    },
                  ]}>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...FONTS.body4,
                      fontWeight: active ? '700' : '600',
                      color: active ? COLORS.primary : colors.textSecondary,
                      maxWidth: 200,
                    }}>
                    {(m.name || m.code || `Menu ${m.id}`).trim()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : menus.length === 1 ? (
          <Text style={[styles.menuSingleName, {color: colors.textSecondary}]}>
            {(menus[0].name || menus[0].code || '').trim()}
          </Text>
        ) : null}
        {menuLoading ? (
          <View style={styles.menuStatusPad}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : menus.length === 0 ? (
          <View style={styles.menuStatusPad}>
            <Text style={{color: colors.textSecondary}}>
              No active menu for this location
            </Text>
          </View>
        ) : (
          menuItems.map(mi => {
            const accent = menuAccentBorder(mi.tile_accent_color);
            const out =
              mi.pos_stock_tracked === true && mi.pos_out_of_stock === true;
            const busyMenu = addingItemId !== null || removingLineId !== null;
            return (
              <Pressable
                key={mi.id}
                onPress={() => void onAddItem(mi)}
                disabled={out || busyMenu}
                android_ripple={{color: COLORS.transparentPrimary}}
                style={[
                  styles.menuTileRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: accent,
                    opacity: out ? 0.55 : 1,
                  },
                ]}>
                <MenuItemThumbnail
                  uri={mi.primary_image_url}
                  fallbackLetter={mi.item_name}
                  borderColor={accent}
                />
                <View style={styles.menuTileBody}>
                  <Text
                    style={[styles.menuTileTitle, {color: colors.textPrimary}]}>
                    {mi.item_name}
                  </Text>
                  <Text
                    style={[styles.menuTilePrice, {color: colors.textSecondary}]}>
                    {formatPosMoney(Number(mi.unit_price) || 0)}
                    {typeof mi.pos_available_qty === 'number' &&
                    mi.pos_stock_tracked
                      ? ` · ${mi.pos_available_qty} in stock`
                      : ''}
                  </Text>
                  {mi.routes_to_kitchen === false ? (
                    <Text style={styles.menuBypassTag}>Direct serve</Text>
                  ) : null}
                  {out ? (
                    <Text style={[styles.menuStockTag, {color: COLORS.error}]}>
                      Out of stock
                    </Text>
                  ) : null}
                </View>
                <View style={styles.menuAddSlot}>
                  {addingItemId === mi.id ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <View
                      style={[
                        styles.menuAddCircle,
                        {backgroundColor: COLORS.primary},
                      ]}>
                      <Text style={styles.menuAddPlus}>+</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </>
    );
  }

  function renderPosSessionMiddle(): React.ReactElement {
    if (isWide) {
      return (
        <View style={styles.sessionSplitPane}>
          <ScrollView
            style={styles.sessionSplitChecks}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}>
            {renderChecksPanel()}
          </ScrollView>
          <View
            style={[styles.sessionSplitDivider, {backgroundColor: colors.border}]}
          />
          <ScrollView
            style={styles.sessionSplitMenu}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}>
            {renderMenuPanel()}
          </ScrollView>
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.posScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEventThrottle={16}
        directionalLockEnabled
        removeClippedSubviews={false}>
        {renderChecksPanel()}
        {renderMenuPanel()}
      </ScrollView>
    );
  }

  const sheetMaxH = Math.round(screenH * 0.75);
  const sheetScrollMaxH = Math.round(screenH * 0.58);
  const sheetEmptyMinH = Math.round(Math.min(320, screenH * 0.35));

  return (
    <>
      <RestaurantScreenLayout title="Restaurant POS">
        {!inPosSession ? (
        tablePickerPanel
      ) : tablesLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.sessionBody}>
          <View style={[styles.sessionTop, {borderBottomColor: colors.border}]}>
            <Pressable
              onPress={exitToPicker}
              style={[styles.changeTableBtn, {borderColor: colors.border}]}>
              <Text
                style={{...FONTS.body4, fontWeight: '700', color: COLORS.primary}}>
                Choose table
              </Text>
            </Pressable>
            <View
              style={[
                styles.sessionBadge,
                isQuickSale
                  ? {
                      backgroundColor: '#ECFDF5',
                      borderColor: '#A7F3D0',
                    }
                  : {
                      backgroundColor: COLORS.primary + '15',
                      borderColor: COLORS.primary + '44',
                    },
              ]}>
              <Text
                style={[
                  styles.sessionBadgeText,
                  {
                    color: isQuickSale ? '#065F46' : COLORS.primary,
                  },
                ]}>
                {isQuickSale ? 'Quick sale' : selectedTable?.table_number || 'Table'}
              </Text>
            </View>
          </View>

          {selectedTable && posLoading ? (
            <View style={styles.sessionMainFill}>
              <View style={styles.centered}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            </View>
          ) : selectedTable || isQuickSale ? (
            <>
              <View style={styles.sessionMainFill}>{renderPosSessionMiddle()}</View>
              {renderStickyActionBar()}
            </>
          ) : null}
        </View>
      )}
      </RestaurantScreenLayout>

    <Modal
      visible={loadOrderSheetOpen}
      animationType="slide"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => setLoadOrderSheetOpen(false)}>
      <View style={styles.sheetModalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.sheetDim}
          onPress={() => setLoadOrderSheetOpen(false)}
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: POS.surface,
              maxHeight: sheetMaxH,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          <View style={[styles.sheetHeader, {borderBottomColor: POS.border}]}>
            <Text style={[styles.sheetTitle, {color: POS.text}]}>
              Resume an order
            </Text>
            <Pressable
              onPress={() => setLoadOrderSheetOpen(false)}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <Text style={{fontSize: 20, color: POS.muted}}>✕</Text>
            </Pressable>
          </View>

          {openOrdersLoading ? (
            <View
              style={[styles.sheetCentered, {minHeight: sheetEmptyMinH}]}>
              <ActivityIndicator color={POS.tabActive} />
              <Text style={{...FONTS.body4, color: POS.muted, marginTop: 8}}>
                Loading open orders…
              </Text>
            </View>
          ) : openOrders.length === 0 ? (
            <View
              style={[styles.sheetCentered, {minHeight: sheetEmptyMinH}]}>
              <Text style={{...FONTS.body4, color: POS.muted}}>
                No open orders found
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{maxHeight: sheetScrollMaxH}}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              contentContainerStyle={{paddingBottom: 24}}>
              {openOrders.map(o => {
                const itemCount = (o.order_items || []).length;
                const isEmpty = itemCount === 0;
                return (
                  <Pressable
                    key={Number(o.id)}
                    onPress={() => void loadOrderIntoPOS(o)}
                    style={[
                      styles.sheetOrderRow,
                      {borderBottomColor: POS.border},
                    ]}>
                    <View style={{flex: 1, minWidth: 0}}>
                      <Text
                        numberOfLines={1}
                        style={[styles.sheetOrderNo, {color: POS.text}]}>
                        {o.no}
                      </Text>
                      <Text style={[styles.sheetOrderMeta, {color: POS.muted}]}>
                        {o.order_type_display} · {o.waiter_name || 'Unknown'}
                        {o.table_number ? ` · Table ${o.table_number}` : ''}
                      </Text>
                      {isEmpty ? (
                        <Text
                          style={[styles.sheetOrderEmpty, {color: '#D97706'}]}>
                          No items yet
                        </Text>
                      ) : (
                        <Text style={[styles.sheetOrderMeta, {color: POS.muted}]}>
                          {itemCount} item{itemCount === 1 ? '' : 's'}
                          {' · '}
                          {Number(o.total_amount).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </Text>
                      )}
                    </View>
                    <View style={styles.sheetOrderRight}>
                      <View
                        style={[
                          styles.sheetStatusPill,
                          {
                            backgroundColor:
                              o.status === 'in_progress' ? '#ECFDF5' : '#EEF2FF',
                            borderColor:
                              o.status === 'in_progress' ? '#A7F3D0' : '#C7D2FE',
                          },
                        ]}>
                        <Text
                          style={{
                            ...FONTS.body5,
                            fontWeight: '700',
                            color:
                              o.status === 'in_progress' ? '#065F46' : '#3730A3',
                          }}>
                          {o.status_display}
                        </Text>
                      </View>
                      <Text style={{color: POS.muted, fontSize: 18}}>›</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>

    <RestaurantCloseCheckoutSheet
      visible={closeSheetOpen}
      orderNo={orderToClose?.no ?? ''}
      itemCount={(orderToClose?.order_items || []).length}
      totalAmount={Number(orderToClose?.total_amount || 0)}
      primaryButtonColor={COLORS.primary}
      chrome={{
        surface: POS.surface,
        text: POS.text,
        muted: POS.muted,
        border: POS.border,
      }}
      submitting={closingInProgress}
      onCancel={() => {
        if (closingInProgress) {
          return;
        }
        setCloseSheetOpen(false);
      }}
      onConfirm={(shouldPrint, paymentMethodId, transactionId) =>
        void confirmClose(shouldPrint, paymentMethodId, transactionId)
      }
    />
    </>
  );
}

const styles = StyleSheet.create({
  pickCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickScrollContent: {paddingBottom: 32},
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    backgroundColor: POS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  branchIcon: {width: 18, height: 18},
  pickBlock: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 14,
    backgroundColor: POS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  pickTitle: {...FONTS.h2, color: POS.text, fontWeight: '800'},
  pickSubtitle: {...FONTS.body4, color: POS.muted, marginTop: 6, maxWidth: 520},
  whiteBar: {
    backgroundColor: POS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  floorTabScroll: {maxHeight: 48, paddingHorizontal: 8},
  floorTabInner: {marginHorizontal: 2},
  quickSaleBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickSaleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  quickSaleBtnText: {
    ...FONTS.body4,
    color: '#fff',
    fontWeight: '700',
  },
  quickSaleHint: {...FONTS.body5, flex: 1, color: POS.muted, minWidth: 160},
  loadOrderBar: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    backgroundColor: POS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  loadOrderBarText: {
    ...FONTS.body3,
    fontWeight: '700',
    color: POS.tabActive,
    flexShrink: 0,
  },
  loadOrderBarHint: {
    ...FONTS.body5,
    color: POS.muted,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '55%',
  },
  sheetModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {...FONTS.h3, fontWeight: '700'},
  sheetCentered: {
    alignItems: 'center',
    padding: 40,
  },
  sheetOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sheetOrderNo: {...FONTS.body3, fontWeight: '700'},
  sheetOrderMeta: {...FONTS.body5, marginTop: 3},
  sheetOrderEmpty: {...FONTS.body5, fontWeight: '600', marginTop: 3},
  sheetOrderRight: {alignItems: 'flex-end', gap: 6},
  sheetStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pickBoard: {
    paddingHorizontal: 12,
    paddingTop: 16,
    flex: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: 'relative',
  },
  openingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    zIndex: 2,
    borderRadius: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  panelHeroIndigo: {
    borderColor: '#EEF2FF',
    backgroundColor: '#FDFDFF',
  },
  panelTitle: {...FONTS.h3, fontWeight: '700', color: POS.text},
  countBadge: {
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  countBadgeTxt: {
    ...FONTS.body5,
    fontWeight: '700',
    color: POS.tabActive,
  },
  pickEmptyText: {...FONTS.body4, padding: 24, textAlign: 'center'},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
    gap: 6,
  },
  gradLineLeft: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 3,
    backgroundColor: POS.border,
  },
  gradLineRight: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 3,
    backgroundColor: POS.border,
  },
  gradLineMuted: {},
  sectionPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileGrid: {flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 12},
  overviewTile: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 4,
  },
  seatsLbl: {...FONTS.body5, fontWeight: '600', opacity: 0.85, marginTop: 4},
  statusLbl: {
    ...FONTS.body5,
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 9,
    opacity: 0.96,
    textAlign: 'center',
  },

  sessionBody: {flex: 1, flexDirection: 'column'},
  sessionMainFill: {flex: 1, minHeight: 0},
  sessionSplitPane: {flex: 1, flexDirection: 'row', minHeight: 0},
  sessionSplitChecks: {flex: 42, minHeight: 0},
  sessionSplitDivider: {
    alignSelf: 'stretch',
    width: StyleSheet.hairlineWidth,
  },
  sessionSplitMenu: {flex: 58, minHeight: 0},
  sessionBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  sessionBadgeText: {...FONTS.body4, fontWeight: '700'},
  stickyActionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stickyPrimaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyOutlineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  orderChipsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  menuStatusPad: {paddingHorizontal: 16, paddingVertical: 12},
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  changeTableBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },

  centered: {padding: 24, alignItems: 'center'},
  body: {flex: 1, paddingHorizontal: SIZES.padding},

  sectionLabel: {
    ...FONTS.body4,
    marginBottom: 4,
    paddingVertical: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  menuPickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingRight: 8,
    alignItems: 'center',
    flexGrow: 0,
  },
  menuPickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginRight: 8,
    maxWidth: 280,
  },
  menuSingleName: {
    ...FONTS.body4,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  posScroll: {flex: 1, marginTop: 4},
  actions: {flexDirection: 'row', gap: 10, marginVertical: 10},
  btn: {paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, flex: 1},
  btnText: {
    ...FONTS.body3,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  btnTextDark: {
    ...FONTS.body3,
    fontWeight: '600',
    textAlign: 'center',
  },
  orderChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginRight: 8,
  },
  orderChipText: {...FONTS.body3, fontWeight: '700'},
  orderChipSub: {...FONTS.body4, marginTop: 2},
  checkPanel: {marginTop: 12, marginBottom: 8, paddingHorizontal: 16},
  checkTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  closeOrderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  closeOrderBtnTxt: {...FONTS.body5, fontWeight: '700'},
  checkTitle: {...FONTS.h3, fontWeight: '700'},
  checkMeta: {...FONTS.body4, marginTop: 4, marginBottom: 8},
  checkLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  checkLineMid: {flex: 1, minWidth: 0},
  checkLineName: {...FONTS.body3, fontWeight: '700'},
  checkLineSub: {...FONTS.body5, marginTop: 4},
  bypassBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bypassBadgeTxt: {
    ...FONTS.body5,
    fontWeight: '700',
    color: '#C2410C',
    fontSize: 10,
  },
  checkLineRight: {alignItems: 'flex-end', gap: 6},
  checkLineQty: {...FONTS.body3, fontWeight: '700'},
  lineRemoveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineRemoveTxt: {...FONTS.body5, color: COLORS.error, fontWeight: '700'},
  menuThumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: POS.pageBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuThumbImg: {width: 54, height: 54},
  menuThumbLetter: {...FONTS.h3, fontWeight: '800', color: POS.muted},
  menuTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 10,
    gap: 12,
  },
  menuTileBody: {flex: 1, minWidth: 0},
  menuTileTitle: {...FONTS.body3, fontWeight: '700'},
  menuTilePrice: {...FONTS.body4, marginTop: 4},
  menuBypassTag: {
    ...FONTS.body5,
    marginTop: 4,
    color: '#C2410C',
    fontWeight: '600',
    fontSize: 10,
  },
  menuStockTag: {...FONTS.body5, marginTop: 6, fontWeight: '700'},
  menuAddSlot: {width: 44, alignItems: 'center', justifyContent: 'center'},
  menuAddCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuAddPlus: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: -2,
  },
});
