import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {useFocusEffect} from '@react-navigation/native';
import {FONTS, SIZES, COLORS} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/Store';
import RestaurantScreenLayout from './RestaurantScreenLayout';
import RestaurantCloseCheckoutSheet from './RestaurantCloseCheckoutSheet';
import {
  fetchOrder,
  fetchOrders,
  fireOrder,
  deleteRestaurantOrder,
  recalculateOrderTotal,
  updateOrderItemStatus,
  type RestaurantOrder,
  type RestaurantOrderItem,
  settleRestaurantOrder,
} from '../../services/restaurantApi';
import {buildReceiptText} from '../../utils/restaurantReceipt';
import PrintService from '../../services/PrintService';
import {
  receiptLabelFromPostedPayload,
  restaurantOrderToReceiptData,
} from '../../services/restaurantReceiptAdapter';
import {fetchCompanyInfoForReceipt} from '../../utils/companyReceiptInfo';

const OPEN_ORDER_STATUSES = new Set([
  'new',
  'in_progress',
  'ready',
  'served',
]);

/** Matches web `canDeleteRestaurantOrder` (Orders.tsx). */
function canDeleteRestaurantOrder(order: RestaurantOrder | null): boolean {
  if (!order || order.sales_invoice) {
    return false;
  }
  if (order.status === 'new' || order.status === 'cancelled') {
    return true;
  }
  const items = order.order_items;
  if (!items?.length) {
    return false;
  }
  return items.every(i => i.status === 'cancelled');
}

function canCancelOrderLine(li: RestaurantOrderItem): boolean {
  if (li.status === 'cancelled' || li.status === 'served') {
    return false;
  }
  return (
    li.status === 'pending' ||
    li.status === 'preparing' ||
    li.status === 'ready'
  );
}

function countUnsentForClose(order: RestaurantOrder): number {
  return (order.order_items || []).filter(
    i =>
      i.status === 'pending' &&
      (i.fire_state === 'hold' || !i.fire_state),
  ).length;
}

function canCloseOrderFromList(order: RestaurantOrder | null): boolean {
  if (!order || order.sales_invoice) {
    return false;
  }
  return countUnsentForClose(order) === 0;
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

export default function RestaurantOrders() {
  const {colors} = useTheme();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RestaurantOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [settleTarget, setSettleTarget] = useState<RestaurantOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOrders({page_size: 200});
      const rows = (res.results || []).filter(o =>
        OPEN_ORDER_STATUSES.has(o.status),
      );
      setOrders(rows);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load orders',
        text2: e?.message || '',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const o = await fetchOrder(id);
      setDetail(o);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load order',
        text2: e?.message || '',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const onFire = async () => {
    if (!detail) {
      return;
    }
    try {
      await fireOrder(detail.id);
      await load();
      await openDetail(detail.id);
      Toast.show({type: 'success', text1: 'Sent to kitchen'});
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Fire failed',
        text2: e?.message || '',
      });
    }
  };

  const refreshDetailAndList = async (orderId: number) => {
    await load();
    if (selectedId === orderId) {
      await openDetail(orderId);
    }
  };

  const onMarkServed = (item: RestaurantOrderItem) => {
    if (!detail) {
      return;
    }
    Alert.alert('Mark served', `Mark "${item.item_name || item.item}" as served?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Mark served',
        onPress: () => {
          void (async () => {
            setActionBusy(true);
            try {
              await updateOrderItemStatus(item.id, 'served');
              await refreshDetailAndList(detail.id);
              Toast.show({type: 'success', text1: 'Marked served'});
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: 'Update failed',
                text2: e?.message || '',
              });
            } finally {
              setActionBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const onCancelLine = (item: RestaurantOrderItem) => {
    if (!detail) {
      return;
    }
    Alert.alert(
      'Cancel item',
      `Cancel "${item.item_name || item.item}"? The check total will be updated.`,
      [
        {text: 'Keep', style: 'cancel'},
        {
          text: 'Cancel item',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionBusy(true);
              try {
                await updateOrderItemStatus(item.id, 'cancelled');
                try {
                  await recalculateOrderTotal(detail.id);
                } catch {
                  /* non-fatal, same as web */
                }
                await refreshDetailAndList(detail.id);
                Toast.show({type: 'success', text1: 'Item cancelled'});
              } catch (e: any) {
                Toast.show({
                  type: 'error',
                  text1: 'Could not cancel item',
                  text2: e?.message || '',
                });
              } finally {
                setActionBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const onRecalculateTotal = () => {
    if (!detail) {
      return;
    }
    void (async () => {
      setActionBusy(true);
      try {
        const r = await recalculateOrderTotal(detail.id);
        await refreshDetailAndList(detail.id);
        Toast.show({
          type: 'success',
          text1: 'Total updated',
          text2: `${r.old_total} → ${r.new_total}`,
        });
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Recalculate failed',
          text2: e?.message || '',
        });
      } finally {
        setActionBusy(false);
      }
    })();
  };

  const settleAndMaybePrint = async (
    order: RestaurantOrder,
    shouldPrint: boolean,
    paymentMethodId: number,
    transactionId?: string,
  ) => {
    setActionBusy(true);
    try {
      const payload = await settleRestaurantOrder(order, paymentMethodId, {
        ...(transactionId ? {transaction_id: transactionId} : {}),
      });
      const receiptId = receiptLabelFromPostedPayload(payload, order.no);

      let receiptPrinted = false;
      if (shouldPrint) {
        const companyInfo = await fetchCompanyInfoForReceipt();
        const receiptData = restaurantOrderToReceiptData(order, {
          username: auth.username || auth.user_id || 'Staff',
          receiptIdOverride: receiptId,
          companyInfo,
        });
        receiptPrinted =
          await PrintService.getInstance().printReceipt(receiptData);
        if (!receiptPrinted) {
          Toast.show({
            type: 'info',
            text1: 'Receipt not printed',
            text2: 'Check printer in Settings.',
          });
          try {
            await Share.share({
              message: buildReceiptText(order),
              title: `Receipt ${receiptId}`,
            });
          } catch {
            Toast.show({
              type: 'error',
              text1: 'Receipt',
              text2: 'Could not print or share receipt',
            });
          }
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Invoice posted',
        text2:
          shouldPrint && receiptPrinted
            ? `${order.no} · Receipt printed`
            : order.no,
      });
      setSettleTarget(null);
      setSelectedId(null);
      setDetail(null);
      await load();
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Could not settle check',
        text2: messageFromCaught(e) || 'Request failed',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const onCloseOrder = () => {
    if (!detail) {
      return;
    }
    const unsent = countUnsentForClose(detail);
    if (unsent > 0) {
      Alert.alert(
        'Unsent items',
        `${unsent} item(s) haven't been sent to the kitchen yet. Fire unsent items first, then close the check.`,
        [{text: 'OK'}],
      );
      return;
    }
    setSettleTarget(detail);
  };

  const onDeleteCheck = () => {
    if (!detail || !canDeleteRestaurantOrder(detail)) {
      return;
    }
    Alert.alert(
      'Delete check',
      `Permanently remove check ${detail.no}? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionBusy(true);
              try {
                await deleteRestaurantOrder(detail.id);
                setSelectedId(null);
                setDetail(null);
                await load();
                Toast.show({type: 'success', text1: 'Check deleted'});
              } catch (e: any) {
                Toast.show({
                  type: 'error',
                  text1: 'Cannot delete check',
                  text2:
                    e?.response?.data?.error ||
                    e?.message ||
                    'It may be invoiced or still has active items.',
                });
              } finally {
                setActionBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const hasCancelledLines = useMemo(
    () =>
      Boolean(
        detail?.order_items?.some(i => i.status === 'cancelled'),
      ),
    [detail?.order_items],
  );

  const listEmpty = useMemo(
    () => (
      <Text style={[styles.empty, {color: colors.textSecondary}]}>
        No open orders
      </Text>
    ),
    [colors.textSecondary],
  );

  return (
    <>
    <RestaurantScreenLayout title="Orders">
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.split}>
          <FlatList
            data={orders}
            keyExtractor={o => String(o.id)}
            style={styles.listPane}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={listEmpty}
            renderItem={({item}) => {
              const sel = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => void openDetail(item.id)}
                  style={[
                    styles.orderRow,
                    {
                      backgroundColor: sel
                        ? COLORS.primary + '22'
                        : colors.card,
                      borderColor: sel ? COLORS.primary : colors.border,
                    },
                  ]}>
                  <Text
                    style={[styles.orderNo, {color: colors.textPrimary}]}>
                    {item.no}
                  </Text>
                  <Text
                    style={[styles.orderSub, {color: colors.textSecondary}]}>
                    {item.table_number ? `Table ${item.table_number}` : '—'} ·{' '}
                    {item.status_display}
                  </Text>
                </Pressable>
              );
            }}
          />
          <ScrollView style={styles.detailPane}>
            {!selectedId ? (
              <View style={styles.hintBlock}>
                <Text style={[styles.hint, {color: colors.textSecondary}]}>
                  Select an order
                </Text>
                <Text style={[styles.hintSub, {color: colors.textSecondary}]}>
                  Tap a check on the left to view lines, fire unsent items, or close
                  the check.
                </Text>
              </View>
            ) : detailLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : detail ? (
              <>
                <Text style={[styles.detailTitle, {color: colors.textPrimary}]}>
                  {detail.no}
                </Text>
                <Text
                  style={[styles.detailMeta, {color: colors.textSecondary}]}>
                  {detail.status_display} · {detail.order_type_display}
                </Text>
                {detail.sales_invoice ? (
                  <Text
                    style={[styles.invoiceNote, {color: colors.textSecondary}]}>
                    Invoiced — delete and void items are not available here.
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => void onFire()}
                  disabled={actionBusy}
                  style={[
                    styles.fireBtn,
                    {backgroundColor: COLORS.primary},
                    actionBusy && styles.btnDisabled,
                  ]}>
                  <Text style={styles.fireBtnText}>Fire unsent items</Text>
                </Pressable>
                {canCloseOrderFromList(detail) ? (
                  <Pressable
                    onPress={onCloseOrder}
                    disabled={actionBusy}
                    style={[
                      styles.closeOrderBtn,
                      {borderColor: COLORS.primary},
                      actionBusy && styles.btnDisabled,
                    ]}>
                    <Text
                      style={[styles.closeOrderBtnText, {color: COLORS.primary}]}>
                      Close order…
                    </Text>
                  </Pressable>
                ) : null}
                {canDeleteRestaurantOrder(detail) ? (
                  <Pressable
                    onPress={onDeleteCheck}
                    disabled={actionBusy}
                    style={[
                      styles.deleteCheckBtn,
                      actionBusy && styles.btnDisabled,
                    ]}>
                    <Text style={styles.deleteCheckBtnText}>Delete check</Text>
                  </Pressable>
                ) : null}
                {hasCancelledLines && !detail.sales_invoice ? (
                  <Pressable
                    onPress={onRecalculateTotal}
                    disabled={actionBusy}
                    style={[
                      styles.secondaryBtn,
                      actionBusy && styles.btnDisabled,
                    ]}>
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        {color: COLORS.primary},
                      ]}>
                      Recalculate total
                    </Text>
                  </Pressable>
                ) : null}
                {(detail.order_items || []).map(li => {
                  const cancelled = li.status === 'cancelled';
                  const showServed =
                    li.status === 'ready' && !cancelled && !detail.sales_invoice;
                  const showCancel =
                    canCancelOrderLine(li) && !detail.sales_invoice;
                  return (
                    <View
                      key={li.id}
                      style={[
                        styles.lineRow,
                        {borderBottomColor: colors.border},
                        cancelled && styles.lineCancelled,
                      ]}>
                      <View style={styles.lineMain}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            flex: 1,
                            textDecorationLine: cancelled
                              ? 'line-through'
                              : 'none',
                          }}>
                          {li.item_name || li.item}
                        </Text>
                        <Text style={{color: colors.textSecondary}}>
                          x{li.quantity} · {li.status_display}
                        </Text>
                      </View>
                      {(showServed || showCancel) && (
                        <View style={styles.lineActions}>
                          {showServed ? (
                            <Pressable
                              onPress={() => onMarkServed(li)}
                              disabled={actionBusy}
                              style={styles.smallBtnGreen}>
                              <Text style={styles.smallBtnGreenText}>
                                Mark served
                              </Text>
                            </Pressable>
                          ) : null}
                          {showCancel ? (
                            <Pressable
                              onPress={() => onCancelLine(li)}
                              disabled={actionBusy}
                              style={styles.smallBtnDanger}>
                              <Text style={styles.smallBtnDangerText}>
                                Cancel item
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            ) : null}
          </ScrollView>
        </View>
      )}
    </RestaurantScreenLayout>
    <RestaurantCloseCheckoutSheet
      visible={settleTarget !== null}
      orderNo={settleTarget?.no ?? ''}
      itemCount={(settleTarget?.order_items || []).length}
      totalAmount={Number(settleTarget?.total_amount || 0)}
      primaryButtonColor={COLORS.primary}
      chrome={{
        surface: colors.card,
        text: colors.textPrimary,
        muted: colors.textSecondary,
        border: colors.border,
      }}
      submitting={actionBusy}
      onCancel={() => {
        if (!actionBusy) {
          setSettleTarget(null);
        }
      }}
      onConfirm={(shouldPrint, paymentMethodId, transactionId) => {
        if (!settleTarget) {
          return;
        }
        void settleAndMaybePrint(
          settleTarget,
          shouldPrint,
          paymentMethodId,
          transactionId,
        );
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {flex: 1, padding: 24, alignItems: 'center'},
  split: {flex: 1, flexDirection: 'row'},
  listPane: {flex: 1, maxWidth: '48%', paddingLeft: SIZES.padding},
  detailPane: {flex: 1.2, paddingHorizontal: SIZES.padding, paddingBottom: 24},
  orderRow: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 12,
    marginBottom: 8,
  },
  orderNo: {...FONTS.h3, fontWeight: '700'},
  orderSub: {...FONTS.body4, marginTop: 4},
  empty: {...FONTS.body3, padding: 16},
  hintBlock: {marginTop: 16},
  hint: {...FONTS.body3, fontWeight: '600'},
  hintSub: {...FONTS.body4, marginTop: 8, lineHeight: 20},
  detailTitle: {...FONTS.h2, fontWeight: '700'},
  detailMeta: {...FONTS.body3, marginTop: 6, marginBottom: 12},
  invoiceNote: {...FONTS.body4, marginBottom: 8},
  fireBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  fireBtnText: {...FONTS.body3, color: '#fff', fontWeight: '600'},
  closeOrderBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: COLORS.primary + '12',
  },
  closeOrderBtnText: {...FONTS.body3, fontWeight: '700'},
  deleteCheckBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.red,
    backgroundColor: COLORS.red + '14',
  },
  deleteCheckBtnText: {
    ...FONTS.body3,
    color: COLORS.red,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
  },
  secondaryBtnText: {...FONTS.body3, fontWeight: '600'},
  btnDisabled: {opacity: 0.55},
  lineRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  lineCancelled: {opacity: 0.72},
  lineMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  smallBtnGreen: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    marginRight: 8,
    marginBottom: 6,
  },
  smallBtnGreenText: {
    ...FONTS.body4,
    color: '#fff',
    fontWeight: '600',
  },
  smallBtnDanger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.red + '22',
    borderWidth: 1,
    borderColor: COLORS.red,
    marginBottom: 6,
  },
  smallBtnDangerText: {
    ...FONTS.body4,
    color: COLORS.red,
    fontWeight: '600',
  },
});
