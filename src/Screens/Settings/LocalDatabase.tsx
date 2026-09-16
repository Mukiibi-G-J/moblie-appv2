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
import {COLORS, FONTS, icons} from '../../constants';
import {QuickIconPressable} from '../../Components/QuickIconPressable';
import {safeGoBack} from '../../hooks/NavigationService';
import {useTheme} from '../../context/ThemeContext';
import {
  getLocalDatabaseOverview,
  getLocalTablePreview,
  type LocalTableCount,
  type LocalTablePreview,
} from '../../db/sqlite';

const LocalDatabase = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbName, setDbName] = useState('');
  const [tables, setTables] = useState<LocalTableCount[]>([]);
  const [preview, setPreview] = useState<LocalTablePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const overview = await getLocalDatabaseOverview();
      setDbName(overview.dbName);
      setTables(overview.tables);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not load local database.',
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openTable = async (tableName: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const data = await getLocalTablePreview(tableName, 50);
      setPreview(data);
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : 'Could not load table preview.',
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const totalRows = tables.reduce((sum, t) => sum + t.count, 0);

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
          onPress={() => safeGoBack(navigation, 'Settings')}
          accessibilityLabel="Go back">
          <Image
            source={icons.back as any}
            style={[styles.backIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.topTitle, {color: colors.textPrimary}]}>
          Local database
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, {color: colors.textPrimary}]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              void load();
            }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tables}
          keyExtractor={item => item.name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void onRefresh();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <View
              style={[
                styles.summaryCard,
                {backgroundColor: colors.card, borderColor: colors.border},
              ]}>
              <Text style={[styles.summaryLabel, {color: colors.textTertiary}]}>
                Database file
              </Text>
              <Text style={[styles.summaryValue, {color: colors.textPrimary}]}>
                {dbName || '—'}
              </Text>
              <Text
                style={[
                  styles.summaryMeta,
                  {color: colors.textSecondary, marginTop: 8},
                ]}>
                {tables.length} tables · {totalRows.toLocaleString()} rows
              </Text>
              <Text style={[styles.hint, {color: colors.textTertiary}]}>
                Tap a table to preview up to 50 rows stored on this device.
              </Text>
            </View>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.row,
                {backgroundColor: colors.card, borderColor: colors.border},
              ]}
              onPress={() => {
                void openTable(item.name);
              }}
              activeOpacity={0.7}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
                  {item.name}
                </Text>
                <Text
                  style={[styles.rowSubtitle, {color: colors.textSecondary}]}>
                  {item.count.toLocaleString()}{' '}
                  {item.count === 1 ? 'row' : 'rows'}
                </Text>
              </View>
              <Image
                source={icons.down_arrow as any}
                style={[
                  styles.chevron,
                  {
                    tintColor: colors.textTertiary,
                    transform: [{rotate: '-90deg'}],
                  },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              No local tables found.
            </Text>
          }
        />
      )}

      <Modal
        visible={previewLoading || preview != null || previewError != null}
        animationType="slide"
        onRequestClose={() => {
          setPreview(null);
          setPreviewError(null);
        }}>
        <SafeAreaView
          style={[styles.modalRoot, {backgroundColor: colors.background}]}
          edges={['top', 'left', 'right', 'bottom']}>
          <View
            style={[
              styles.modalHeader,
              {borderBottomColor: colors.border},
            ]}>
            <Text
              style={[styles.modalTitle, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {preview?.name ?? 'Table preview'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setPreview(null);
                setPreviewError(null);
              }}
              hitSlop={12}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {previewLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : previewError ? (
            <View style={styles.centered}>
              <Text style={[styles.errorText, {color: colors.textPrimary}]}>
                {previewError}
              </Text>
            </View>
          ) : preview ? (
            <ScrollView contentContainerStyle={styles.previewContent}>
              <Text
                style={[styles.previewMeta, {color: colors.textSecondary}]}>
                Showing {preview.shown} of {preview.count.toLocaleString()} rows
              </Text>
              {preview.rows.length === 0 ? (
                <Text
                  style={[styles.emptyText, {color: colors.textSecondary}]}>
                  This table is empty.
                </Text>
              ) : (
                preview.rows.map((row, index) => (
                  <View
                    key={`${preview.name}-${index}`}
                    style={[
                      styles.previewCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.previewSummary,
                        {color: colors.textPrimary},
                      ]}>
                      {row.summary}
                    </Text>
                    {Object.entries(row.fields).map(([key, value]) => (
                      <View key={key} style={styles.fieldBlock}>
                        <Text
                          style={[
                            styles.fieldKey,
                            {color: colors.textTertiary},
                          ]}>
                          {key}
                        </Text>
                        <Text
                          style={[
                            styles.fieldValue,
                            {color: colors.textSecondary},
                          ]}
                          selectable>
                          {value || '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {width: 18, height: 18},
  topTitle: {
    ...FONTS.h3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  topBarSpacer: {width: 40},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  listContent: {padding: 16, paddingBottom: 32},
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  summaryLabel: {...FONTS.body5, marginBottom: 4},
  summaryValue: {...FONTS.h4},
  summaryMeta: {...FONTS.body4},
  hint: {...FONTS.body5, marginTop: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  rowText: {flex: 1, paddingRight: 8},
  rowTitle: {...FONTS.h5},
  rowSubtitle: {...FONTS.body5, marginTop: 2},
  chevron: {width: 14, height: 14},
  emptyText: {...FONTS.body4, textAlign: 'center', marginTop: 24},
  errorText: {...FONTS.body3, textAlign: 'center'},
  retryBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {...FONTS.h5, color: COLORS.white},
  modalRoot: {flex: 1},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {...FONTS.h3, flex: 1, marginRight: 12},
  closeText: {...FONTS.h5, color: COLORS.primary},
  previewContent: {padding: 16, paddingBottom: 40},
  previewMeta: {...FONTS.body4, marginBottom: 12},
  previewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  previewSummary: {...FONTS.h5, marginBottom: 8},
  fieldBlock: {marginTop: 6},
  fieldKey: {...FONTS.body5, textTransform: 'uppercase'},
  fieldValue: {...FONTS.body4},
});

export default LocalDatabase;
