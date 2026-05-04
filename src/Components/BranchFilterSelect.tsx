import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONTS} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {useAppContext} from '../context/Store';
import {fetchCompanyBranches, type BranchListRow} from '../services/branchProfile.service';

type Props = {
  /** null => All branches, number => specific branch, undefined => not initialised */
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Optional: hide even if can-switch is true. */
  disabled?: boolean;
};

export const BranchFilterSelect: React.FC<Props> = ({value, onChange, disabled}) => {
  const {colors} = useTheme();
  const app = useAppContext();

  const canSwitchBranch =
    app?.branchSession?.enable_multiple_branches === true &&
    app?.branchSession?.can_switch_branch !== false;

  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<BranchListRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchCompanyBranches();
      setBranches(list);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canSwitchBranch) return;
    void load();
  }, [canSwitchBranch, load]);

  const label = useMemo(() => {
    if (value === null) return 'All branches';
    if (typeof value === 'number') {
      const match = branches.find((b) => b.id === value);
      return match?.description || match?.code || 'Branch';
    }
    return 'Branch';
  }, [branches, value]);

  if (!canSwitchBranch || disabled) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.pill,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Text style={[styles.pillText, {color: colors.textPrimary}]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, {backgroundColor: colors.card, borderColor: colors.border}]}
            onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>Filter branch</Text>
            <Text style={[styles.hint, {color: colors.textSecondary}]}>
              Choose “All branches” or a specific branch for this report.
            </Text>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                style={[
                  styles.row,
                  {borderBottomColor: colors.border},
                ]}>
                <Text style={[styles.rowText, {color: colors.textPrimary}]}>
                  All branches
                </Text>
                {value === null ? (
                  <Text style={[styles.check, {color: COLORS.primary2}]}>✓</Text>
                ) : null}
              </Pressable>

              {branches.map((b) => (
                <Pressable
                  key={String(b.id)}
                  onPress={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                  style={[styles.row, {borderBottomColor: colors.border}]}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.rowText, {color: colors.textPrimary}]}>
                      {b.description || b.code}
                    </Text>
                    <Text style={[styles.rowSubText, {color: colors.textSecondary}]}>
                      {b.code}
                    </Text>
                  </View>
                  {value === b.id ? (
                    <Text style={[styles.check, {color: COLORS.primary2}]}>✓</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setOpen(false)}
              style={[styles.closeBtn, {backgroundColor: colors.screenMuted}]}>
              <Text style={[styles.closeBtnText, {color: colors.textPrimary}]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
  },
  pillText: {
    ...FONTS.body4,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    maxHeight: '75%',
  },
  title: {
    ...FONTS.h3,
    fontWeight: '800',
  },
  hint: {
    ...FONTS.body4,
    marginTop: 6,
    marginBottom: 10,
  },
  list: {
    marginTop: 6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  rowText: {
    ...FONTS.body4,
    fontWeight: '700',
  },
  rowSubText: {
    ...FONTS.body5,
    marginTop: 2,
  },
  check: {
    fontWeight: '900',
    fontSize: 16,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  closeBtnText: {
    ...FONTS.body4,
    fontWeight: '700',
  },
});

