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
import {User, UserFormValues, UserGroup} from '../../@types/userManagement';
import {UserManagementService} from '../../services/UserManagementService';
import {UserGroupService} from '../../services/UserGroupService';
import {BranchListRow, fetchCompanyBranches} from '../../services/branchProfile.service';
import {useAuth} from '../../context/Store';

interface UserFormModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  onSave: () => void;
  canCreate: boolean;
  canEdit: boolean;
}

const emptyForm = (): UserFormValues => ({
  email: '',
  username: '',
  full_name: '',
  phone_number: '',
  password: '',
  restaurant_pin: '',
  global_dimension_1: null,
  can_switch_branch: true,
  user_group_ids: [],
  is_active: true,
  is_staff: false,
  is_superuser: false,
});

const UserFormModal: React.FC<UserFormModalProps> = ({
  visible,
  onClose,
  user,
  onSave,
  canCreate,
  canEdit,
}) => {
  const topInset = useScreenTopInset();
  const {auth} = useAuth();
  const isEditMode = !!user;
  const canSave = isEditMode ? canEdit : canCreate;

  const [formData, setFormData] = useState<UserFormValues>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [branches, setBranches] = useState<BranchListRow[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const enableMultipleBranches = auth?.enable_multiple_branches === true;
  const isRestaurantEnabled = (auth?.enabled_modules || []).includes('restaurant');

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (user) {
      setFormData({
        email: user.email || '',
        username: user.username || '',
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        password: '',
        restaurant_pin: '',
        global_dimension_1:
          user.global_dimension_1_obj?.id ??
          user.global_dimension_1 ??
          null,
        can_switch_branch: user.can_switch_branch !== false,
        user_group_ids: user.user_groups?.map(g => g.id) || [],
        is_active: user.is_active,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser,
      });
    } else {
      setFormData(emptyForm());
    }
    setErrors({});

    const loadRefs = async () => {
      setLoadingRefs(true);
      try {
        const [groupsRes, branchRows] = await Promise.all([
          UserGroupService.getUserGroups(),
          fetchCompanyBranches(),
        ]);
        setUserGroups(groupsRes.results || []);
        setBranches(branchRows);
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load form options',
        });
      } finally {
        setLoadingRefs(false);
      }
    };

    loadRefs();
  }, [visible, user]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.email.trim()) {
      next.email = 'Email is required';
    }
    if (!formData.username.trim()) {
      next.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      next.username = 'Username must be at least 3 characters';
    }
    if (!formData.full_name.trim()) {
      next.full_name = 'Full name is required';
    }
    if (!isEditMode && (!formData.password || formData.password.length < 8)) {
      next.password = 'Password must be at least 8 characters';
    }
    if (
      formData.restaurant_pin &&
      (formData.restaurant_pin.length < 4 || formData.restaurant_pin.length > 6)
    ) {
      next.restaurant_pin = 'Restaurant PIN must be 4–6 digits';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!canSave || !validate()) {
      return;
    }

    setLoading(true);
    try {
      const payload: UserFormValues = {
        email: formData.email.trim(),
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        global_dimension_1: formData.global_dimension_1 ?? null,
        can_switch_branch: formData.can_switch_branch,
        user_group_ids: formData.user_group_ids || [],
        is_active: formData.is_active,
        is_staff: formData.is_staff,
        is_superuser: formData.is_superuser,
      };

      if (formData.password?.trim()) {
        payload.password = formData.password.trim();
      }
      if (formData.restaurant_pin?.trim()) {
        payload.restaurant_pin = formData.restaurant_pin.trim();
      }

      if (isEditMode && user) {
        await UserManagementService.updateUser(user.id, payload);
        Toast.show({type: 'success', text1: 'User updated'});
      } else {
        await UserManagementService.createUser(payload);
        Toast.show({type: 'success', text1: 'User created'});
      }
      onSave();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        Object.values(error?.response?.data || {})
          .flat()
          .join('\n') ||
        'Failed to save user';
      Toast.show({type: 'error', text1: 'Error', text2: String(detail)});
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    const current = formData.user_group_ids || [];
    const next = current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId];
    setFormData(prev => ({...prev, user_group_ids: next}));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, {paddingTop: topInset}]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditMode ? 'Edit User' : 'New User'}</Text>
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

        {loadingRefs ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            <Field
              label="Email *"
              value={formData.email}
              onChangeText={v => setFormData(p => ({...p, email: v}))}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Username *"
              value={formData.username}
              onChangeText={v => setFormData(p => ({...p, username: v}))}
              error={errors.username}
              autoCapitalize="none"
            />
            <Field
              label="Full name *"
              value={formData.full_name}
              onChangeText={v => setFormData(p => ({...p, full_name: v}))}
              error={errors.full_name}
            />
            <Field
              label="Phone"
              value={formData.phone_number}
              onChangeText={v => setFormData(p => ({...p, phone_number: v}))}
              keyboardType="phone-pad"
            />
            <Field
              label={isEditMode ? 'New password (optional)' : 'Password *'}
              value={formData.password || ''}
              onChangeText={v => setFormData(p => ({...p, password: v}))}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
            />
            {isRestaurantEnabled && (
              <Field
                label="Restaurant PIN (optional)"
                value={formData.restaurant_pin || ''}
                onChangeText={v =>
                  setFormData(p => ({
                    ...p,
                    restaurant_pin: v.replace(/\D/g, ''),
                  }))
                }
                error={errors.restaurant_pin}
                keyboardType="number-pad"
                maxLength={6}
              />
            )}

            {enableMultipleBranches && branches.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Assigned branch</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={formData.global_dimension_1 ?? ''}
                    onValueChange={v =>
                      setFormData(p => ({
                        ...p,
                        global_dimension_1: v === '' ? null : Number(v),
                      }))
                    }>
                    <Picker.Item label="None" value="" />
                    {branches.map(b => (
                      <Picker.Item
                        key={b.id}
                        label={b.description || b.code}
                        value={b.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {enableMultipleBranches && (
              <ToggleRow
                label="Can switch branch"
                value={formData.can_switch_branch !== false}
                onValueChange={v =>
                  setFormData(p => ({...p, can_switch_branch: v}))
                }
              />
            )}

            <ToggleRow
              label="Active"
              value={formData.is_active}
              onValueChange={v => setFormData(p => ({...p, is_active: v}))}
            />

            <View style={styles.field}>
              <Text style={styles.label}>User groups</Text>
              {userGroups.length === 0 ? (
                <Text style={styles.hint}>No user groups available</Text>
              ) : (
                userGroups.map(group => {
                  const selected = (formData.user_group_ids || []).includes(
                    group.id,
                  );
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => toggleGroup(group.id)}>
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const Field = ({
  label,
  value,
  onChangeText,
  error,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  [key: string]: any;
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={COLORS.gray}
      {...rest}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

const ToggleRow = ({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={styles.toggleRow}>
    <Text style={styles.label}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{false: COLORS.lightGray2, true: COLORS.primary}}
    />
  </View>
);

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
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...FONTS.body3,
    color: COLORS.black,
  },
  inputError: {borderColor: COLORS.error},
  errorText: {...FONTS.body5, color: COLORS.error, marginTop: 4},
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
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.lightGray2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {...FONTS.body4, color: COLORS.black},
  chipTextSelected: {color: COLORS.white},
  hint: {...FONTS.body4, color: COLORS.gray},
  loadingBox: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default UserFormModal;
