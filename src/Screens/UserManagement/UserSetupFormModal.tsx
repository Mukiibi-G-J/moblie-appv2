import React, {useEffect, useState} from 'react';
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
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS} from '../../constants';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {UserSetup, UserSetupFormValues} from '../../@types/userSetup';
import {UserSetupService} from '../../services/UserSetupService';
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
  canPostPreviousDates: true,
  canReversePurchaseInvoice: true,
  canReverseSalesInvoice: true,
  canReverseItemJournal: true,
  canViewOnlyTheirSales: false,
});

const UserSetupFormModal: React.FC<UserSetupFormModalProps> = ({
  visible,
  onClose,
  setup,
  onSave,
  canCreate,
  canEdit,
}) => {
  const topInset = useScreenTopInset();
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
        canPostPreviousDates: setup.canPostPreviousDates,
        canReversePurchaseInvoice: setup.canReversePurchaseInvoice,
        canReverseSalesInvoice: setup.canReverseSalesInvoice,
        canReverseItemJournal: setup.canReverseItemJournal ?? true,
        canViewOnlyTheirSales: setup.canViewOnlyTheirSales,
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
          text1: 'Error',
          text2: 'Failed to load users',
        });
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [visible, setup]);

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    if (!isEditMode && userId === '') {
      Toast.show({type: 'error', text1: 'Select a user'});
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
        text1: 'Error',
        text2:
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to save user setup',
      });
    } finally {
      setLoading(false);
    }
  };

  const permissionRows: {key: keyof typeof flags; label: string}[] = [
    {key: 'canSeeBuyingPrice', label: 'Can see buying price'},
    {key: 'canSeeProfitMargin', label: 'Can see profit margin'},
    {key: 'canSeeItemCost', label: 'Can see item cost'},
    {key: 'canPostPreviousDates', label: 'Can post previous dates'},
    {key: 'canReversePurchaseInvoice', label: 'Can reverse purchase invoice'},
    {key: 'canReverseSalesInvoice', label: 'Can reverse sales invoice'},
    {key: 'canReverseItemJournal', label: 'Can reverse item journal'},
    {key: 'canViewOnlyTheirSales', label: 'View only their sales'},
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, {paddingTop: topInset}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditMode ? 'Edit User Setup' : 'New User Setup'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={loading || !canSave}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={[styles.saveText, !canSave && styles.disabledText]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {loadingUsers ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={styles.label}>User *</Text>
              {isEditMode ? (
                <Text style={styles.readonly}>
                  {setup?.fullName || setup?.username} ({setup?.email})
                </Text>
              ) : (
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={userId}
                    onValueChange={v => setUserId(v === '' ? '' : Number(v))}>
                    <Picker.Item label="Select user" value="" />
                    {users.map(u => (
                      <Picker.Item
                        key={u.id}
                        label={`${u.full_name || u.username} (${u.email})`}
                        value={u.id}
                      />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            {permissionRows.map(row => (
              <View key={row.key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{row.label}</Text>
                <Switch
                  value={!!flags[row.key]}
                  onValueChange={v =>
                    setFlags(prev => ({...prev, [row.key]: v}))
                  }
                  trackColor={{false: COLORS.lightGray2, true: COLORS.primary}}
                />
              </View>
            ))}

            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Optional notes"
                placeholderTextColor={COLORS.gray}
              />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.white},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray2,
  },
  title: {...FONTS.h3, color: COLORS.black},
  cancelText: {...FONTS.body3, color: COLORS.gray},
  saveText: {...FONTS.body3, color: COLORS.primary, fontWeight: '600'},
  disabledText: {opacity: 0.4},
  form: {flex: 1, padding: 16},
  field: {marginBottom: 16},
  label: {...FONTS.body4, color: COLORS.gray, marginBottom: 6},
  readonly: {...FONTS.body3, color: COLORS.black},
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...FONTS.body3,
    color: COLORS.black,
  },
  notesInput: {minHeight: 80, textAlignVertical: 'top'},
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.lightGray2,
  },
  toggleLabel: {...FONTS.body4, color: COLORS.black, flex: 1, paddingRight: 12},
  loadingBox: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default UserSetupFormModal;
