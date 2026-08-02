import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS, icons} from '../../constants';
import {QuickIconPressable} from '../../Components/QuickIconPressable';
import {safeGoBack} from '../../hooks/NavigationService';
import {useTheme} from '../../context/ThemeContext';
import {useOffline} from '../../context/OfflineContext';
import {
  getLocalSaleWithLines,
  listLocalSales,
  listPendingOutbox,
  type LocalSaleDetail,
} from '../../db/sqlite';
import {runFullOfflineSync} from '../../services/sync/SyncEngine';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';

type QueueRow = {
  id: string;
  localId: string;
  title: string;
  subtitle: string;
  status: string;
  error?: string;
  totalAmount?: number;
  createdAt?: string;
};

const formatUgx = (amount: number) =>
  `UGX ${(amount || 0).toLocaleString('en-UG', {maximumFractionDigits: 0})}`;

const SyncQueue = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const offline = useOffline();
  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState<LocalSaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [outbox, sales] = await Promise.all([
        listPendingOutbox(),
        listLocalSales(),
      ]);

      const outboxRows: QueueRow[] = outbox.map(row => {
        const localId = String(row.payload?.local_id ?? row.event_id);
        const total = Number(row.payload?.total_amount ?? 0);
        return {
          id: row.event_id,
          localId,
          title: String(row.payload?.customer_name ?? 'Sale'),
          subtitle: total > 0 ? formatUgx(total) : localId.slice(0, 8) + '…',
          status: row.status,
          error: row.last_error,
          totalAmount: total,
          createdAt: row.created_at,
        };
      });

      const saleRows: QueueRow[] = sales
        .filter(s => String(s.sync_status) !== 'synced')
        .map(s => {
          const total = Number(s.total_amount ?? 0);
          return {
            id: String(s.local_id),
            localId: String(s.local_id),
            title: String(s.receipt_no ?? s.customer_name ?? 'Local sale'),
            subtitle: [
              String(s.customer_name ?? ''),
              total > 0 ? formatUgx(total) : '',
            ]
              .filter(Boolean)
              .join(' · '),
            status: String(s.sync_status ?? 'pending'),
            totalAmount: total,
            createdAt: String(s.created_at ?? ''),
          };
        });

      // One sale is stored in both outbox + local_sales — dedupe by localId.
      const byLocalId = new Map<string, QueueRow>();
      for (const row of outboxRows) {
        byLocalId.set(row.localId, row);
      }
      for (const sale of saleRows) {
        const existing = byLocalId.get(sale.localId);
        if (existing) {
          byLocalId.set(sale.localId, {
            ...sale,
            id: existing.id,
            status:
              existing.status === 'failed' ? existing.status : sale.status,
            error: existing.error ?? sale.error,
          });
        } else {
          byLocalId.set(sale.localId, sale);
        }
      }
      setRows(Array.from(byLocalId.values()));
      await offline.refreshOutboxCount();
    } finally {
      setLoading(false);
    }
  }, [offline]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (row: QueueRow) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const sale = await getLocalSaleWithLines(row.localId);
      if (!sale) {
        setDetailError('Sale details are not available locally.');
        return;
      }
      setDetail({
        ...sale,
        sync_status: row.status || sale.sync_status,
      });
    } catch (error: unknown) {
      setDetailError(
        error instanceof Error ? error.message : 'Could not load sale details',
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!getEffectiveIsOnline()) {
      Toast.show({
        type: 'info',
        text1: 'Offline',
        text2: 'Connect to the internet to sync.',
      });
      return;
    }
    setSyncing(true);
    try {
      await runFullOfflineSync((message, progress) => {
        offline.setSyncStatus('syncing');
        if (typeof progress === 'number' && progress >= 100) {
          offline.setLastSyncAt(new Date().toISOString());
        }
      });
      Toast.show({
        type: 'success',
        text1: 'Sync complete',
        text2: 'Pending sales uploaded and catalog refreshed.',
      });
      await load();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Sync failed';
      Toast.show({type: 'error', text1: 'Sync failed', text2: msg});
    } finally {
      setSyncing(false);
      offline.setSyncStatus('idle');
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: headerPaddingTop,
            borderBottomColor: colors.border,
          },
        ]}>
        <QuickIconPressable
          style={[
            styles.backBtn,
            {borderColor: colors.border, backgroundColor: colors.card},
          ]}
          onPress={() => safeGoBack(navigation, 'Home')}
          accessibilityLabel="Go back">
          <Image
            source={icons.back as any}
            style={[styles.backIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.topTitle, {color: colors.textPrimary}]}>
          Sync queue
        </Text>
        <View style={styles.topBarSpacer} />
      </View>
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.textPrimary}]}>Pending sales</Text>
        <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
          Pending: {offline.outboxCount}
          {offline.lastSyncAt
            ? ` · Last sync ${new Date(offline.lastSyncAt).toLocaleString()}`
            : ''}
        </Text>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={handleSyncNow}
          disabled={syncing}>
          {syncing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.syncBtnText}>Sync now</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, {color: colors.textSecondary}]}>
              No pending sales in the queue.
            </Text>
          ) : null
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={[styles.row, {borderColor: colors.border}]}
            onPress={() => void openDetail(item)}
            activeOpacity={0.7}>
            <View style={styles.rowHeader}>
              <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
                {item.title}
              </Text>
              <Text style={[styles.rowChevron, {color: colors.textSecondary}]}>
                ›
              </Text>
            </View>
            <Text style={[styles.rowSub, {color: colors.textSecondary}]}>
              {item.subtitle}
            </Text>
            <Text
              style={[
                styles.status,
                item.status === 'failed' ? styles.statusFailed : styles.statusPending,
              ]}>
              {item.status}
            </Text>
            {item.error ? (
              <Text style={styles.errorText}>{item.error}</Text>
            ) : null}
            <Text style={[styles.tapHint, {color: colors.textSecondary}]}>
              Tap to view details
            </Text>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={detailLoading || detail != null || detailError != null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setDetail(null);
          setDetailError(null);
        }}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {backgroundColor: colors.card, borderColor: colors.border},
            ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                Pending sale
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDetail(null);
                  setDetailError(null);
                }}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                <Text style={[styles.modalClose, {color: colors.textSecondary}]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <ActivityIndicator style={styles.modalLoader} color={COLORS.primary} />
            ) : detailError ? (
              <Text style={[styles.errorText, styles.modalBody]}>
                {detailError}
              </Text>
            ) : detail ? (
              <ScrollView style={styles.modalScroll}>
                <DetailRow
                  label="Receipt"
                  value={detail.receipt_no || '—'}
                  colors={colors}
                />
                <DetailRow
                  label="Customer"
                  value={detail.customer_name || '—'}
                  colors={colors}
                />
                <DetailRow
                  label="Total"
                  value={formatUgx(detail.total_amount)}
                  colors={colors}
                />
                {detail.branch_name ? (
                  <DetailRow
                    label="Branch"
                    value={detail.branch_name}
                    colors={colors}
                  />
                ) : null}
                <DetailRow
                  label="Status"
                  value={detail.sync_status}
                  colors={colors}
                />
                {detail.created_at ? (
                  <DetailRow
                    label="Created"
                    value={new Date(detail.created_at).toLocaleString()}
                    colors={colors}
                  />
                ) : null}
                <DetailRow
                  label="Local ID"
                  value={detail.local_id}
                  colors={colors}
                  mono
                />

                <Text style={[styles.linesTitle, {color: colors.textPrimary}]}>
                  Line items
                </Text>
                {detail.lines.length === 0 ? (
                  <Text style={[styles.rowSub, {color: colors.textSecondary}]}>
                    No line items stored.
                  </Text>
                ) : (
                  detail.lines.map((line, index) => {
                    const name = String(
                      line.item_name ?? line.name ?? line.item ?? 'Item',
                    );
                    const qty = String(line.quantity ?? '1');
                    const lineTotal = Number(
                      line.total_amount ??
                        Number(line.unit_price ?? 0) * Number(line.quantity ?? 0),
                    );
                    return (
                      <View
                        key={`${name}-${index}`}
                        style={[styles.lineRow, {borderColor: colors.border}]}>
                        <Text style={[styles.lineName, {color: colors.textPrimary}]}>
                          {name}
                        </Text>
                        <Text style={[styles.lineMeta, {color: colors.textSecondary}]}>
                          Qty {qty}
                          {lineTotal > 0 ? ` · ${formatUgx(lineTotal)}` : ''}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const DetailRow = ({
  label,
  value,
  colors,
  mono,
}: {
  label: string;
  value: string;
  colors: {textPrimary: string; textSecondary: string};
  mono?: boolean;
}) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>
      {label}
    </Text>
    <Text
      style={[
        styles.detailValue,
        {color: colors.textPrimary},
        mono && styles.detailMono,
      ]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: {flex: 1},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {width: 18, height: 18},
  topTitle: {...FONTS.h3, flex: 1, textAlign: 'center'},
  topBarSpacer: {width: 40},
  header: {padding: 16, gap: 8},
  title: {...FONTS.h2},
  subtitle: {...FONTS.body4},
  syncBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncBtnDisabled: {opacity: 0.7},
  syncBtnText: {...FONTS.body3, color: COLORS.white, fontWeight: '600'},
  empty: {textAlign: 'center', marginTop: 40, paddingHorizontal: 24},
  row: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {...FONTS.body3, fontWeight: '600', flex: 1},
  rowChevron: {...FONTS.h3, marginLeft: 8},
  rowSub: {...FONTS.body4, marginTop: 4},
  status: {...FONTS.body5, marginTop: 6, fontWeight: '600'},
  statusPending: {color: '#D97706'},
  statusFailed: {color: COLORS.red},
  errorText: {...FONTS.body5, color: COLORS.red, marginTop: 4},
  tapHint: {...FONTS.body5, marginTop: 6},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '85%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {...FONTS.h3},
  modalClose: {...FONTS.body3, fontWeight: '600'},
  modalLoader: {marginVertical: 24},
  modalScroll: {maxHeight: 480},
  modalBody: {paddingVertical: 16},
  detailRow: {marginBottom: 10},
  detailLabel: {...FONTS.body5},
  detailValue: {...FONTS.body3, marginTop: 2},
  detailMono: {fontSize: 11},
  linesTitle: {...FONTS.body3, fontWeight: '600', marginTop: 12, marginBottom: 8},
  lineRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  lineName: {...FONTS.body3, fontWeight: '600'},
  lineMeta: {...FONTS.body4, marginTop: 4},
});

export default SyncQueue;
