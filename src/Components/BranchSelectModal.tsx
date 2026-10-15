import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {COLORS} from '../constants';
import {useTheme} from '../context/ThemeContext';
import {useAppContext, useAuth} from '../context/Store';
import {
  fetchCompanyBranches,
  fetchSalesSetupBranchConfig,
} from '../services/branchProfile.service';
import {shouldShowBranchSelectModal} from '../utils/branchSelection';
import {navigationRef} from '../hooks/NavigationService';
import {getPinSetupPending} from '../storage/restaurantDeviceStorage';

type BranchOption = {
  id: number;
  code: string;
  description: string;
};

async function loadBranchOptions(): Promise<BranchOption[]> {
  try {
    const setup = await fetchSalesSetupBranchConfig();
    if (setup.branch_values.length > 0) {
      return setup.branch_values;
    }
  } catch {
    /* fall through */
  }
  const companyBranches = await fetchCompanyBranches();
  return companyBranches;
}

const BranchSelectModal = () => {
  const {colors} = useTheme();
  const {accessToken} = useAuth();
  const ctx = useAppContext();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const showModal = shouldShowBranchSelectModal(
    ctx?.branchSession,
    Boolean(accessToken),
  );

  const multiBranchEnabled =
    ctx?.branchSession?.enable_multiple_branches === true;
  const canSwitchBranch = ctx?.branchSession?.can_switch_branch !== false;

  const defaultBranchId =
    ctx?.branchSession?.active_branch?.id ??
    ctx?.auth?.global_dimension_1?.id ??
    null;

  const setPendingRef = useRef(ctx?.setBranchSelectionPending);
  const setActiveBranchRef = useRef(ctx?.setActiveBranch);
  setPendingRef.current = ctx?.setBranchSelectionPending;
  setActiveBranchRef.current = ctx?.setActiveBranch;

  // Safety: if multi-branch is disabled (or user can't switch), clear pending so we don't stick.
  useEffect(() => {
    if (!ctx) {
      return;
    }
    if (!multiBranchEnabled || !canSwitchBranch) {
      if (ctx.branchSession?.branchSelectionPending) {
        void ctx.setBranchSelectionPending(false);
      }
    }
  }, [canSwitchBranch, ctx, multiBranchEnabled]);

  // Match web BranchSelectModal: one fetch when modal opens — no context refresh here.
  useEffect(() => {
    if (!showModal || !multiBranchEnabled || !canSwitchBranch) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const values = await loadBranchOptions();
        if (cancelled) {
          return;
        }
        setBranches(values);
        setSelectedId(defaultBranchId ?? values[0]?.id ?? null);
      } catch (e: unknown) {
        if (cancelled) {
          return;
        }
        setBranches([]);
        setSelectedId(null);
        setLoadError(
          e instanceof Error ? e.message : 'Could not load branches.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showModal,
    multiBranchEnabled,
    canSwitchBranch,
    defaultBranchId,
    reloadKey,
  ]);

  const handleRetry = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (selectedId == null) {
      return;
    }

    const branch = branches.find((b) => b.id === selectedId);
    if (!branch) {
      return;
    }

    setConfirming(true);
    try {
      await setActiveBranchRef.current?.({
        id: branch.id,
        code: branch.code,
        description: branch.description || '',
      });
      await setPendingRef.current?.(false);

      const pinPending = await getPinSetupPending();
      if (pinPending && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('RestaurantPinSetup' as never);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      Toast.show({
        type: 'error',
        text1: 'Could not select branch',
        text2: message,
      });
    } finally {
      setConfirming(false);
    }
  }, [branches, selectedId]);

  if (!showModal) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} />
        <View style={[styles.card, {backgroundColor: colors.card}]}>
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            Select Branch
          </Text>
          <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
            Choose the branch you want to work with
          </Text>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={COLORS.primary2} />
            </View>
          ) : branches.length === 0 ? (
            <View style={styles.stateWrap}>
              <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
                {loadError
                  ? loadError
                  : 'No branches are configured. Please contact your administrator to set up branches.'}
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, {borderColor: colors.border}]}
                onPress={handleRetry}
                disabled={confirming}
                activeOpacity={0.85}>
                <Text style={[styles.retryBtnText, {color: colors.textPrimary}]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}>
                {branches.map((branch) => {
                  const selected = selectedId === branch.id;
                  return (
                    <TouchableOpacity
                      key={String(branch.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.row,
                        {
                          borderColor: selected
                            ? COLORS.primary2
                            : colors.border,
                          backgroundColor: selected
                            ? `${COLORS.primary2}12`
                            : colors.background,
                        },
                      ]}
                      onPress={() => setSelectedId(branch.id)}>
                      <View style={styles.rowText}>
                        <Text
                          style={[
                            styles.rowTitle,
                            {color: colors.textPrimary},
                          ]}>
                          {branch.code}
                        </Text>
                        {branch.description &&
                        branch.description !== branch.code ? (
                          <Text
                            style={[
                              styles.rowSubtitle,
                              {color: colors.textSecondary},
                            ]}
                            numberOfLines={1}>
                            {branch.description}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? (
                        <Text style={styles.selectedBadge}>Selected</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (confirming || selectedId == null) &&
                    styles.confirmBtnDisabled,
                ]}
                onPress={() => void handleConfirm()}
                disabled={confirming || selectedId == null}
                activeOpacity={0.88}>
                {confirming ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  stateWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: {
    fontWeight: '600',
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  selectedBadge: {
    color: COLORS.primary2,
    fontWeight: '700',
    fontSize: 12,
  },
  confirmBtn: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default BranchSelectModal;
