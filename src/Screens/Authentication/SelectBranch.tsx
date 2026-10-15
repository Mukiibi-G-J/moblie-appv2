import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AuthLayout from '../../Components/layouts/AuthLayout';
import {COLORS, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {
  fetchCompanyBranches,
  fetchUserProfileBranchFields,
  type BranchListRow,
} from '../../services/branchProfile.service';
import {
  getPinSetupPending,
} from '../../storage/restaurantDeviceStorage';

type BranchOption = {
  id: number;
  code: string;
  description: string;
};

const SelectBranch = () => {
  const {colors} = useTheme();
  const ctx = useAppContext();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const canSwitch =
    ctx?.branchSession.enable_multiple_branches === true &&
    ctx?.branchSession.can_switch_branch !== false;

  const load = useCallback(async () => {
    if (!ctx?.auth?.user_id) {
      setBranches([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profile, list] = await Promise.all([
        fetchUserProfileBranchFields(),
        fetchCompanyBranches(),
      ]);

      const normalized: BranchOption[] = (list || []).map((b: BranchListRow) => ({
        id: b.id,
        code: b.code,
        description: b.description || b.code,
      }));
      setBranches(normalized);

      const preferredCode = profile.dimension_1;
      const preferred = preferredCode
        ? normalized.find((b) => b.code === preferredCode)
        : undefined;
      const sessionBranch = ctx?.branchSession?.active_branch;
      const jwtBranch = ctx?.auth?.global_dimension_1;
      setSelectedId(
        sessionBranch?.id ??
          jwtBranch?.id ??
          preferred?.id ??
          normalized[0]?.id ??
          null,
      );
    } catch (e) {
      setBranches([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [ctx?.auth?.user_id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Safety: if multi-branch is off (or user is locked), do not block the app here.
  useEffect(() => {
    if (!ctx) return;
    if (!canSwitch) {
      void ctx.setBranchSelectionPending(false);
    }
  }, [canSwitch, ctx]);

  const title = 'Select branch';
  const subtitle = 'Choose the branch you want to work with';

  const handleConfirm = useCallback(async () => {
    if (!ctx) return;
    if (selectedId == null) return;

    const branch = branches.find((b) => b.id === selectedId);
    if (!branch) return;

    setConfirming(true);
    try {
      await ctx.setActiveBranch({
        id: branch.id,
        code: branch.code,
        description: branch.description || '',
      });
      await ctx.setBranchSelectionPending(false);
      const pinPending = await getPinSetupPending();
      if (pinPending) {
        navigation.reset({
          index: 0,
          routes: [{name: 'RestaurantPinSetup'}],
        });
        return;
      }
      navigation.reset({
        index: 0,
        routes: [{name: 'Home'}],
      });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not select branch',
        text2: e?.message || 'Please try again.',
      });
      return;
    } finally {
      setConfirming(false);
    }
  }, [branches, ctx, navigation, selectedId]);

  const emptyMessage = useMemo(() => {
    if (!canSwitch) {
      return 'Branch selection is not required for your account.';
    }
    return 'No branches available. Contact your administrator.';
  }, [canSwitch]);

  return (
    <AuthLayout title={title} subtitle={subtitle} showBackButton={false}>
      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={COLORS.primary2} />
          <Text style={[styles.stateText, {color: colors.textSecondary}]}>
            Loading branches…
          </Text>
        </View>
      ) : branches.length === 0 ? (
        <View style={styles.stateWrap}>
          <Image source={icons.company} style={[styles.stateIcon, {tintColor: colors.iconMuted}]} />
          <Text style={[styles.stateText, {color: colors.textSecondary}]}>
            {emptyMessage}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, {borderColor: colors.border}]}
            onPress={() => void load()}
            disabled={confirming}
            activeOpacity={0.85}>
            <Text style={[styles.retryBtnText, {color: colors.textPrimary}]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.list} contentContainerStyle={{paddingBottom: 12}}>
            {branches.map((item) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.card,
                      borderColor: selected ? COLORS.primary2 : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedId(item.id)}>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, {color: colors.textPrimary}]}>
                      {item.description || item.code}
                    </Text>
                    <Text style={[styles.rowSubtitle, {color: colors.textSecondary}]}>
                      {item.code}
                    </Text>
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
              (confirming || selectedId == null) && styles.confirmBtnDisabled,
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
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  stateIcon: {
    width: 44,
    height: 44,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  stateText: {
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: {
    fontWeight: '600',
  },
  list: {
    marginTop: 8,
    maxHeight: 420,
  },
  row: {
    borderWidth: 1,
    borderRadius: 16,
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
    marginTop: 10,
    minHeight: 54,
    borderRadius: 18,
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

export default SelectBranch;

