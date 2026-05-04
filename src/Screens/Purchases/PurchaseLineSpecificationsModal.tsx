import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  COLORS,
  FONTS,
  SIZES,
  ICON_BUTTON_ACTIVE_OPACITY,
  ICON_BUTTON_HIT_SLOP,
} from '../../constants';
import type {ItemDetailByNo} from '../../services/app.services';
import {
  checkPurchaseTrackingLot,
  createPurchaseTrackingSpecification,
  deletePurchaseTrackingSpecification,
  getPurchaseLineTrackingSpecifications,
  getPurchaseLineTrackingSummary,
  updatePurchaseTrackingSpecification,
  type PurchaseTrackingSpecification,
  type PurchaseTrackingSummary,
} from '../../services/app.services';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  purchaseId: number;
  lineId: number;
  itemPk: number;
  itemNo: string;
  itemName: string;
  trackingInfo: NonNullable<ItemDetailByNo['tracking_code']>;
  readOnly?: boolean;
};

function toYmd(raw?: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PurchaseLineSpecificationsModal: React.FC<Props> = ({
  visible,
  onClose,
  purchaseId,
  lineId,
  itemPk,
  itemNo,
  itemName,
  trackingInfo,
  readOnly = false,
}) => {
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specs, setSpecs] = useState<PurchaseTrackingSpecification[]>([]);
  const [summary, setSummary] = useState<PurchaseTrackingSummary | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lotCheck, setLotCheck] = useState<{
    exists?: boolean;
    expiry_date?: string;
  } | null>(null);
  const lotDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    serial_no: '',
    lot_no: '',
    expiry_date: '',
    quantity_base: '1',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [specsResult, summaryResult] = await Promise.allSettled([
        getPurchaseLineTrackingSpecifications(lineId),
        getPurchaseLineTrackingSummary(lineId),
      ]);
      if (specsResult.status === 'fulfilled') {
        setSpecs(specsResult.value);
      } else {
        setSpecs([]);
      }
      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
      }
      const errs: string[] = [];
      if (specsResult.status === 'rejected') {
        const e = specsResult.reason as any;
        const d = e?.response?.data;
        const chunk =
          d?.detail ??
          d?.error ??
          (d && typeof d === 'object' ? JSON.stringify(d) : null) ??
          e?.message;
        if (Array.isArray(chunk)) {
          errs.push(...chunk.map(String));
        } else if (chunk) {
          errs.push(String(chunk));
        }
      }
      if (summaryResult.status === 'rejected') {
        const e = summaryResult.reason as any;
        const d = e?.response?.data;
        const chunk = d?.detail ?? d?.error ?? e?.message;
        if (Array.isArray(chunk)) {
          errs.push(...chunk.map(String));
        } else if (chunk) {
          errs.push(String(chunk));
        }
      }
      if (errs.length > 0) {
        Alert.alert('Load issue', errs.join('\n'));
      }
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => {
    if (visible && lineId) {
      setEditingId(null);
      setForm({
        serial_no: '',
        lot_no: '',
        expiry_date: '',
        quantity_base: '1',
        description: '',
      });
      setLotCheck(null);
      load();
    }
  }, [visible, lineId, load]);

  const runLotCheck = useCallback(
    async (lot: string) => {
      if (!lot || lot.length < 2 || !itemPk) {
        setLotCheck(null);
        return;
      }
      try {
        const res = await checkPurchaseTrackingLot(lot, itemPk);
        setLotCheck(res);
      } catch {
        setLotCheck(null);
      }
    },
    [itemPk],
  );

  useEffect(() => {
    if (!visible || readOnly || !trackingInfo.require_lot_no) {
      return;
    }
    const lot = form.lot_no.trim();
    if (lotDebounceRef.current) {
      clearTimeout(lotDebounceRef.current);
    }
    if (!lot) {
      setLotCheck(null);
      return;
    }
    lotDebounceRef.current = setTimeout(() => runLotCheck(lot), 500);
    return () => {
      if (lotDebounceRef.current) {
        clearTimeout(lotDebounceRef.current);
      }
    };
  }, [form.lot_no, visible, readOnly, trackingInfo.require_lot_no, runLotCheck]);

  const validateForm = (): boolean => {
    if (trackingInfo.require_serial_no && !form.serial_no.trim()) {
      Alert.alert('Validation', 'Serial number is required for this item.');
      return false;
    }
    if (trackingInfo.require_lot_no && !form.lot_no.trim()) {
      Alert.alert('Validation', 'Lot number is required for this item.');
      return false;
    }
    if (trackingInfo.require_expiry_date && !form.expiry_date.trim()) {
      Alert.alert('Validation', 'Expiry date is required for this item.');
      return false;
    }
    const qb = parseInt(form.quantity_base, 10);
    if (!Number.isFinite(qb) || qb < 1) {
      Alert.alert('Validation', 'Enter a valid quantity (base units).');
      return false;
    }
    if (
      lotCheck?.exists &&
      lotCheck.expiry_date &&
      form.expiry_date.trim()
    ) {
      const exp = toYmd(form.expiry_date);
      const expected = toYmd(lotCheck.expiry_date);
      if (exp && expected && exp !== expected) {
        Alert.alert(
          'Validation',
          'Expiry date must match the existing lot record.',
        );
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (readOnly || !validateForm()) {
      return;
    }
    setSaving(true);
    try {
      const qty = parseInt(form.quantity_base, 10);
      const payload: Record<string, unknown> = {
        item: itemPk,
        purchase_invoice: purchaseId,
        purchase_invoice_line: lineId,
        serial_no: form.serial_no.trim() || undefined,
        lot_no: form.lot_no.trim() || undefined,
        expiry_date: form.expiry_date.trim()
          ? toYmd(form.expiry_date.trim())
          : undefined,
        quantity_base: qty,
        description: form.description.trim() || '—',
      };

      if (editingId) {
        await updatePurchaseTrackingSpecification(editingId, payload);
      } else {
        await createPurchaseTrackingSpecification(payload);
      }

      await load();
      setEditingId(null);
      setForm({
        serial_no: '',
        lot_no: '',
        expiry_date: '',
        quantity_base: '1',
        description: '',
      });
      setLotCheck(null);
    } catch (e: any) {
      const d = e?.response?.data;
      let msg = '';
      if (d?.error != null) {
        msg = Array.isArray(d.error) ? d.error.join('\n') : String(d.error);
      } else if (d && typeof d === 'object' && !Array.isArray(d)) {
        msg = Object.values(d)
          .flat()
          .map(v => (Array.isArray(v) ? v.join(', ') : String(v)))
          .join('\n');
      }
      if (!msg) {
        msg = e?.message || 'Failed to save specification';
      }
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: PurchaseTrackingSpecification) => {
    if (readOnly || !s.id) {
      return;
    }
    setEditingId(s.id);
    setForm({
      serial_no: s.serial_no || '',
      lot_no: s.lot_no || '',
      expiry_date: s.expiry_date ? String(s.expiry_date).slice(0, 10) : '',
      quantity_base: String(s.quantity_base ?? 1),
      description: s.description || '',
    });
  };

  const handleDelete = (id: number) => {
    if (readOnly) {
      return;
    }
    Alert.alert(
      'Remove specification',
      'Delete this tracking row?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deletePurchaseTrackingSpecification(id);
              if (editingId === id) {
                setEditingId(null);
                setForm({
                  serial_no: '',
                  lot_no: '',
                  expiry_date: '',
                  quantity_base: '1',
                  description: '',
                });
              }
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Delete failed');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: '92%',
            },
          ]}>
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>
              Item specifications
            </Text>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={ICON_BUTTON_ACTIVE_OPACITY}
              hitSlop={ICON_BUTTON_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Done">
              <Text style={[styles.closeText, {color: COLORS.primary}]}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            {itemName} · {itemNo}
          </Text>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}>
              {summary ? (
                <View
                  style={[
                    styles.summaryBox,
                    {backgroundColor: colors.screenMuted},
                  ]}>
                  <View style={styles.summaryRow}>
                    <SummaryCell
                      label="Expected"
                      value={String(summary.expected_quantity)}
                      colors={colors}
                    />
                    <SummaryCell
                      label="Allocated"
                      value={String(summary.total_quantity)}
                      colors={colors}
                    />
                    <SummaryCell
                      label="Remaining"
                      value={String(summary.remaining_quantity)}
                      colors={colors}
                      warn={summary.remaining_quantity < 0}
                    />
                    <SummaryCell
                      label="Rows"
                      value={String(summary.specifications_count)}
                      colors={colors}
                    />
                  </View>
                </View>
              ) : null}

              <Text style={[styles.sectionLabel, {color: colors.textPrimary}]}>
                Current specifications
              </Text>
              {specs.length === 0 ? (
                <Text style={[styles.empty, {color: colors.textSecondary}]}>
                  No specifications yet. Add serial / lot / expiry below (same
                  as web).
                </Text>
              ) : (
                specs.map(s => (
                  <View
                    key={s.id}
                    style={[
                      styles.specCard,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.inputBackground,
                      },
                    ]}>
                    <Text style={[styles.specLine, {color: colors.textPrimary}]}>
                      Qty base: {s.quantity_base ?? '—'}
                      {s.serial_no ? ` · SN: ${s.serial_no}` : ''}
                      {s.lot_no ? ` · Lot: ${s.lot_no}` : ''}
                    </Text>
                    {s.expiry_date ? (
                      <Text
                        style={[styles.specMeta, {color: colors.textSecondary}]}>
                        Expiry: {String(s.expiry_date).slice(0, 10)}
                      </Text>
                    ) : null}
                    {!readOnly && s.id ? (
                      <View style={styles.specActions}>
                        <TouchableOpacity onPress={() => handleEdit(s)}>
                          <Text style={styles.link}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(s.id!)}>
                          <Text style={styles.dangerLink}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              {!readOnly ? (
                <>
                  <Text
                    style={[
                      styles.sectionLabel,
                      {color: colors.textPrimary, marginTop: SIZES.base * 2},
                    ]}>
                    {editingId ? 'Edit specification' : 'Add specification'}
                  </Text>
                  {trackingInfo.require_serial_no ? (
                    <Field
                      label="Serial no."
                      value={form.serial_no}
                      onChangeText={v => setForm(f => ({...f, serial_no: v}))}
                      colors={colors}
                    />
                  ) : null}
                  {trackingInfo.require_lot_no ? (
                    <Field
                      label="Lot no."
                      value={form.lot_no}
                      onChangeText={v => setForm(f => ({...f, lot_no: v}))}
                      colors={colors}
                    />
                  ) : null}
                  {trackingInfo.require_lot_no &&
                  lotCheck?.exists &&
                  lotCheck.expiry_date ? (
                    <Text style={[styles.hint, {color: colors.textSecondary}]}>
                      Known lot: expiry locked to{' '}
                      {String(lotCheck.expiry_date).slice(0, 10)}
                    </Text>
                  ) : null}
                  {trackingInfo.require_expiry_date ? (
                    <Field
                      label="Expiry (YYYY-MM-DD)"
                      value={form.expiry_date}
                      onChangeText={v => setForm(f => ({...f, expiry_date: v}))}
                      colors={colors}
                      editable={!(lotCheck?.exists && !!lotCheck.expiry_date)}
                    />
                  ) : null}
                  <Field
                    label="Quantity (base)"
                    value={form.quantity_base}
                    onChangeText={v => setForm(f => ({...f, quantity_base: v}))}
                    colors={colors}
                    keyboardType="number-pad"
                  />
                  <Field
                    label="Description"
                    value={form.description}
                    onChangeText={v => setForm(f => ({...f, description: v}))}
                    colors={colors}
                  />

                  <View style={styles.formActions}>
                    {editingId ? (
                      <TouchableOpacity
                        style={[styles.secondaryBtn, {borderColor: colors.border}]}
                        onPress={() => {
                          setEditingId(null);
                          setForm({
                            serial_no: '',
                            lot_no: '',
                            expiry_date: '',
                            quantity_base: '1',
                            description: '',
                          });
                          setLotCheck(null);
                        }}>
                        <Text style={{color: colors.textSecondary}}>Cancel edit</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        {opacity: saving ? 0.6 : 1},
                        !editingId && styles.primaryBtnFlex,
                      ]}
                      onPress={handleSave}
                      disabled={saving}>
                      {saving ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <Text style={styles.primaryBtnText}>
                          {editingId ? 'Update' : 'Add'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text
                  style={[
                    styles.readOnlyNote,
                    {color: colors.textSecondary},
                  ]}>
                  Posted purchases: specifications are read-only.
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

function SummaryCell({
  label,
  value,
  colors,
  warn,
}: {
  label: string;
  value: string;
  colors: {textPrimary: string; textSecondary: string};
  warn?: boolean;
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          {color: warn ? COLORS.error : colors.textPrimary},
        ]}>
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  colors,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  colors: {textPrimary: string; textSecondary: string; inputBackground: string; border: string};
  keyboardType?: 'default' | 'number-pad';
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            color: colors.textPrimary,
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
            opacity: editable ? 1 : 0.55,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...FONTS.h3,
    fontWeight: '700',
  },
  closeText: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  subtitle: {
    ...FONTS.body4,
    marginTop: 8,
    marginBottom: 4,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  summaryBox: {
    borderRadius: SIZES.radius,
    padding: 12,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCell: {
    width: '48%',
    marginBottom: 8,
  },
  summaryLabel: {
    ...FONTS.body5,
    fontSize: 11,
  },
  summaryValue: {
    ...FONTS.h4,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionLabel: {
    ...FONTS.body3,
    fontWeight: '600',
    marginBottom: 8,
  },
  empty: {
    ...FONTS.body4,
    marginBottom: 12,
  },
  specCard: {
    borderWidth: 1,
    borderRadius: SIZES.radius,
    padding: 12,
    marginBottom: 8,
  },
  specLine: {
    ...FONTS.body4,
    fontWeight: '600',
  },
  specMeta: {
    ...FONTS.body5,
    marginTop: 4,
  },
  specActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  link: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dangerLink: {
    ...FONTS.body4,
    color: COLORS.error,
    fontWeight: '600',
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    ...FONTS.body5,
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: SIZES.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...FONTS.body3,
  },
  hint: {
    ...FONTS.body5,
    marginBottom: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: SIZES.radius,
    borderWidth: 1,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primaryBtnFlex: {
    flex: 1,
  },
  primaryBtnText: {
    ...FONTS.button,
    color: COLORS.white,
    fontWeight: '700',
  },
  readOnlyNote: {
    ...FONTS.body4,
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default PurchaseLineSpecificationsModal;
