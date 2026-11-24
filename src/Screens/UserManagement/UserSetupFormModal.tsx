import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
import {QuickIconPressable} from '../../Components';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {UserSetup, UserSetupFormValues} from '../../@types/userSetup';
import {UserSetupService} from '../../services/UserSetupService';
import {normalizeSalesUiMode, type SalesUiMode} from '../../utils/salesUiMode';
import {UserManagementService} from '../../services/UserManagementService';
import {User} from '../../@types/userManagement';

interface UserSetupFormModalProps {
  visible: boolean;
  onClose: () => void;
  setup: UserSetup | null;
  onSave: () => void;
  canCreate: boolean;
  canEdit: boolean;
}

const defaultFlags = (): Omit<UserSetupFormValues, 'user' | 'notes'> => ({
  canSeeBuyingPrice: true,
  canSeeProfitMargin: true,
  canSeeItemCost: true,
  canEditSalesPrice: false,
  canPostPreviousDates: true,
  canReversePurchaseInvoice: true,
  canReverseSalesInvoice: true,
  canReverseItemJournal: true,
  canViewOnlyTheirSales: false,
  defaultSalesUi: 'phone',
});

type FlagKey = Exclude<keyof ReturnType<typeof defaultFlags>, 'defaultSalesUi'>;

const PRICING_ROWS: {key: FlagKey; label: string; hint: string}[] = [
  {
    key: 'canSeeBuyingPrice',
    label: 'See buying price',
    hint: 'Show item buying prices to this user',
  },
  {
    key: 'canSeeProfitMargin',
    label: 'See profit margin',
    hint: 'Show margin on sales',
  },
  {
    key: 'canSeeItemCost',
    label: 'See item cost',
    hint: 'Show cost on item screens',
  },
  {
    key: 'canEditSalesPrice',
    label: 'Edit sales price',
    hint: 'Allow changing the price while selling',
  },
];

const POSTING_ROWS: {key: FlagKey; label: string; hint: string}[] = [
  {
    key: 'canPostPreviousDates',
    label: 'Post previous dates',
    hint: 'Allow documents dated before today',
  },
  {
    key: 'canReversePurchaseInvoice',
    label: 'Reverse purchase invoice',
    hint: 'Allow reversing a posted purchase',
  },
  {
    key: 'canReverseSalesInvoice',
    label: 'Reverse sales invoice',
    hint: 'Allow reversing a posted sale',
  },
  {
    key: 'canReverseItemJournal',
    label: 'Reverse item journal',
    hint: 'Allow reversing a posted item journal',
  },
];

const UserSetupFormModal: React.FC<UserSetupFormModalProps> = ({
  visible,
  onClose,
  setup,
  onSave,
  canCreate,
  canEdit,
}) => {
  const topInset = useScreenTopInset();
  const insets = useSafeAreaInsets();
  const isEditMode = !!setup;
  const canSave = isEditMode ? canEdit : canCreate;

  const [userId, setUserId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState(defaultFlags());
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (setup) {
      setUserId(setup.user);
      setNotes(setup.notes || '');
      setFlags({
        canSeeBuyingPrice: setup.canSeeBuyingPrice,
        canSeeProfitMargin: setup.canSeeProfitMargin,
        canSeeItemCost: setup.canSeeItemCost,
        canEditSalesPrice: setup.canEditSalesPrice ?? false,
        canPostPreviousDates: setup.canPostPreviousDates,
        canReversePurchaseInvoice: setup.canReversePurchaseInvoice,
        canReverseSalesInvoice: setup.canReverseSalesInvoice,
        canReverseItemJournal: setup.canReverseItemJournal ?? true,
        canViewOnlyTheirSales: setup.canViewOnlyTheirSales,
        defaultSalesUi: normalizeSalesUiMode(setup.defaultSalesUi),
      });
    } else {
      setUserId('');
      setNotes('');
      setFlags(defaultFlags());
    }

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const [usersRes, withoutSetup] = await Promise.all([
          UserManagementService.getUsers({page_size: 200}),
          UserSetupService.getUsersWithoutSetup(),
        ]);
        const all = (usersRes.results || []).filter(
          u => u.username !== 'debug_admin',
        );
        if (!setup) {
          const withoutIds = new Set(withoutSetup.map(u => u.id));
          setUsers(all.filter(u => withoutIds.has(u.id)));
        } else {
          setUsers(all);
        }
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Couldn’t load users',
          visibilityTime: 5000,
        });
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [visible, setup]);

  const selectedUser = useMemo(() => {
    if (setup) {
      return {
        name: setup.fullName || setup.username || 'User',
        email: setup.email || '',
      };
    }
    const match = users.find(u => u.id === userId);
    return {
      name: match?.full_name || match?.username || 'Select a user',
      email: match?.email || 'No user selected',
    };
  }, [setup, userId, users]);

  const initials =
    selectedUser.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'US';

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    if (!isEditMode && userId === '') {
      Toast.show({
        type: 'error',
        text1: 'Select a user first',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      const payload: UserSetupFormValues = {
        user: Number(userId),
        notes: notes.trim(),
        ...flags,
      };

      if (isEditMode && setup) {
        const {user: _u, ...patch} = payload;
        await UserSetupService.updateUserSetup(setup.id, patch);
        Toast.show({type: 'success', text1: 'User setup updated'});
      } else {
        await UserSetupService.createUserSetup(payload);
        Toast.show({type: 'success', text1: 'User setup created'});
      }
      onSave();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1:
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Couldn’t save this user setup',
        visibilityTime: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderFlags = (rows: {key: FlagKey; label: string; hint: string}[]) =>
    rows.map(row => (
      <ToggleRow
        key={row.key}
        label={row.label}
        hint={row.hint}
        value={!!flags[row.key]}
        onValueChange={v => setFlags(prev => ({...prev, [row.key]: v}))}
      />
    ));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={styles.pageRoot}>
        <View style={[styles.pageHeader, {paddingTop: topInset}]}>
          <QuickIconPressable
            onPress={onClose}
            disabled={loading}
            style={styles.headerIconButton}
            accessibilityLabel="Close">
            <Image
              source={icons.cross}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <View style={styles.headerSpacer} />
        </View>

        {loadingUsers ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>
              {isEditMode ? 'Edit user setup' : 'New user setup'}
            </Text>

            <View style={styles.previewSection}>
              <View style={styles.previewAvatar}>
                <Text style={styles.previewInitials}>{initials}</Text>
              </View>
              <View style={styles.previewMeta}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {selectedUser.name}
                </Text>
                <Text style={styles.previewSubtext} numberOfLines={1}>
                  {selectedUser.email || 'Email address'}
                </Text>
              </View>
            </View>

            {!isEditMode ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>User</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Person</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={userId === '' ? 0 : userId}
                      onValueChange={v => setUserId(v === 0 ? '' : Number(v))}
                      style={styles.picker}>
                      <Picker.Item label="Select a user" value={0} />
                      {users.map(u => (
                        <Picker.Item
                          key={u.id}
                          label={u.full_name || u.username}
                          value={u.id}
                        />
                      ))}
                    </Picker>
                  </View>
                  {users.length === 0 ? (
                    <Text style={styles.hint}>
                      Every user already has a setup. Use Create missing setups if someone is missing.
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {!isEditMode ? <View style={styles.sectionDivider} /> : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prices</Text>
              {renderFlags(PRICING_ROWS)}
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Posting</Text>
              {renderFlags(POSTING_ROWS)}
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sales</Text>
              <ToggleRow
                label="View only their sales"
                hint="Limit sales history to documents this user created"
                value={!!flags.canViewOnlyTheirSales}
                onValueChange={v =>
                  setFlags(prev => ({...prev, canViewOnlyTheirSales: v}))
                }
              />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Default sales screen</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={flags.defaultSalesUi || 'phone'}
                    onValueChange={(v: SalesUiMode) =>
                      setFlags(prev => ({...prev, defaultSalesUi: v}))
                    }
                    style={styles.picker}>
                    <Picker.Item label="Phone" value="phone" />
                    <Picker.Item label="Point of Sale" value="pos" />
                  </Picker>
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Optional notes"
                  placeholderTextColor={COLORS.gray2}
                />
              </View>
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 16)}]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!canSave || loading) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading || !canSave}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Save setup' : 'Create setup'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ToggleRow = ({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleCopy}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{false: COLORS.lightGray2, true: COLORS.primary2}}
      thumbColor={COLORS.white}
    />
  </View>
);

const styles = StyleSheet.create({
  pageRoot: {flex: 1, backgroundColor: COLORS.white},
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {width: 16, height: 16, tintColor: COLORS.primary3},
  headerSpacer: {width: 48},
  scrollView: {flex: 1},
  scrollContent: {paddingHorizontal: 20, paddingBottom: 24},
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 12,
    marginBottom: 18,
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.transparentPrimary,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    marginBottom: 28,
  },
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInitials: {color: COLORS.white, fontSize: 22, fontWeight: '700'},
  previewMeta: {flex: 1, marginLeft: 14},
  previewName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 4,
  },
  previewSubtext: {...FONTS.body4, color: COLORS.secondary2},
  section: {marginBottom: 8},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary3,
    marginBottom: 14,
  },
  sectionDivider: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.transparentPrimary,
    marginTop: 8,
    marginBottom: 26,
  },
  fieldGroup: {marginBottom: 16},
  label: {
    ...FONTS.body4,
    color: COLORS.black,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  notesInput: {minHeight: 110, textAlignVertical: 'top'},
  hint: {...FONTS.body5, color: COLORS.gray2, marginTop: 4},
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  toggleCopy: {flex: 1, paddingRight: 12},
  toggleLabel: {...FONTS.body3, color: COLORS.black, fontWeight: '600'},
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  picker: {width: '100%', backgroundColor: COLORS.white, color: COLORS.black},
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.transparentPrimary,
    backgroundColor: COLORS.white,
  },
  saveButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {opacity: 0.5},
  saveButtonText: {...FONTS.body3, color: COLORS.white, fontWeight: '700'},
  loadingBox: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default UserSetupFormModal;
