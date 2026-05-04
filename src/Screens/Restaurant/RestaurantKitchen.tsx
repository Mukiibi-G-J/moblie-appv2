import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {useFocusEffect} from '@react-navigation/native';
import {FONTS, SIZES, COLORS} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';
import {
  fetchKitchenItems,
  startPreparingOrderItems,
  updateOrderItemStatus,
  type RestaurantOrderItem,
} from '../../services/restaurantApi';

export default function RestaurantKitchen() {
  const {colors} = useTheme();
  const [items, setItems] = useState<RestaurantOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKitchenItems();
      setItems(data || []);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Kitchen load failed',
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

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const t = setInterval(() => {
      void fetchKitchenItems()
        .then(data => setItems(data || []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const grouped = useMemo(() => {
    return {
      pending: items.filter(i => i.status === 'pending'),
      preparing: items.filter(i => i.status === 'preparing'),
      ready: items.filter(i => i.status === 'ready'),
    };
  }, [items]);

  const setBusy = (id: number, on: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const onStartPreparing = async (batch: number[]) => {
    try {
      await startPreparingOrderItems(batch);
      await load();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Start preparing failed',
        text2: e?.message || 'Item must be fired from POS first',
      });
    }
  };

  const onStatus = async (id: number, status: string) => {
    setBusy(id, true);
    try {
      await updateOrderItemStatus(id, status);
      await load();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: e?.message || '',
      });
    } finally {
      setBusy(id, false);
    }
  };

  const renderCard = (label: string, list: RestaurantOrderItem[], tone: string) => (
    <View style={styles.column}>
      <Text style={[styles.colTitle, {color: colors.textPrimary}]}>
        {label} ({list.length})
      </Text>
      <ScrollView style={styles.colScroll}>
        {list.map(it => (
          <View
            key={it.id}
            style={[
              styles.card,
              {backgroundColor: colors.card, borderColor: colors.border},
            ]}>
            <Text style={[styles.itemName, {color: colors.textPrimary}]}>
              {it.item_name || it.item}
            </Text>
            <Text style={[styles.itemMeta, {color: colors.textSecondary}]}>
              x{it.quantity} · {it.status_display}
              {it.special_instructions
                ? ` · ${it.special_instructions}`
                : ''}
            </Text>
            <View style={styles.cardActions}>
              {it.status === 'pending' ? (
                <Pressable
                  disabled={busyIds.has(it.id)}
                  onPress={() => void onStartPreparing([it.id])}
                  style={[styles.smallBtn, {backgroundColor: tone}]}>
                  <Text style={styles.smallBtnText}>Start</Text>
                </Pressable>
              ) : null}
              {it.status === 'preparing' ? (
                <Pressable
                  disabled={busyIds.has(it.id)}
                  onPress={() => void onStatus(it.id, 'ready')}
                  style={[styles.smallBtn, {backgroundColor: '#22863a'}]}>
                  <Text style={styles.smallBtnText}>Ready</Text>
                </Pressable>
              ) : null}
              {it.status === 'ready' ? (
                <Pressable
                  disabled={busyIds.has(it.id)}
                  onPress={() => void onStatus(it.id, 'served')}
                  style={[styles.smallBtn, {backgroundColor: colors.border}]}>
                  <Text style={[styles.smallBtnText, {color: colors.textPrimary}]}>
                    Served
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <RestaurantScreenLayout title="Kitchen">
      <View style={styles.toolbar}>
        <Text style={[styles.toolbarLabel, {color: colors.textSecondary}]}>
          Auto-refresh (5s)
        </Text>
        <Switch value={autoRefresh} onValueChange={setAutoRefresh} />
        <Pressable
          onPress={() => void load()}
          style={[styles.refreshBtn, {borderColor: colors.border}]}>
          <Text style={{color: COLORS.primary, fontWeight: '600'}}>Refresh</Text>
        </Pressable>
      </View>
      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          contentContainerStyle={styles.board}
          showsHorizontalScrollIndicator={false}>
          {renderCard('New', grouped.pending, COLORS.primary)}
          {renderCard('Cooking', grouped.preparing, '#0366d6')}
          {renderCard('Ready', grouped.ready, '#22863a')}
        </ScrollView>
      )}
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 8,
    gap: 12,
  },
  toolbarLabel: {...FONTS.body4},
  refreshBtn: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  centered: {padding: 24, alignItems: 'center'},
  board: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 24,
    gap: 12,
    alignItems: 'stretch',
  },
  column: {width: 280, marginRight: 12},
  colTitle: {...FONTS.h3, fontWeight: '700', marginBottom: 8},
  colScroll: {maxHeight: 480},
  card: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 10,
  },
  itemName: {...FONTS.body3, fontWeight: '700'},
  itemMeta: {...FONTS.body4, marginTop: 4},
  cardActions: {flexDirection: 'row', gap: 8, marginTop: 10},
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallBtnText: {...FONTS.body4, color: '#fff', fontWeight: '600'},
});
