import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Image,
  Alert,
  Platform,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import {COLORS, FONTS} from '../../constants';
import icons from '../../constants/icons';
import { QuickIconPressable } from '../../Components';
import {useScreenTopInset} from '../../hooks/useScreenTopInset';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Android password fields select the last digit and then ignore delete,
 * so the character stays visible. Backspace is handled explicitly, and
 * length is limited in JS instead of maxLength.
 */
function PinDigitInput({
  value,
  onChange,
  placeholder,
  editable,
  maxLength,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  editable: boolean;
  maxLength: number;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;

  return (
    <TextInput
      style={styles.pinInput}
      underlineColorAndroid="transparent"
      selectionColor={COLORS.transparentPrimary2}
      cursorColor={COLORS.primary}
      value={value}
      onChangeText={text => {
        const current = valueRef.current;
        const next = digitsOnly(text, maxLength);
        if (current.length <= 1 && next === current && next.length === 1) {
          onChange('');
          return;
        }
        onChange(next);
      }}
      onKeyPress={({nativeEvent}) => {
        if (nativeEvent.key === 'Backspace' && valueRef.current.length <= 1) {
          onChange('');
        }
      }}
      keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
      secureTextEntry
      placeholder={placeholder}
      placeholderTextColor={COLORS.gray2}
      editable={editable}
      selectTextOnFocus={false}
      contextMenuHidden
      autoCorrect={false}
      autoCapitalize="none"
    />
  );
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
  must_change_password: false,
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
  const insets = useSafeAreaInsets();
  const {auth} = useAuth();
  const isEditMode = !!user;
  const canSave = isEditMode ? canEdit : canCreate;

  const [formData, setFormData] = useState<UserFormValues>(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [groupCatalog, setGroupCatalog] = useState<Record<number, UserGroup>>({});
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [groupResults, setGroupResults] = useState<UserGroup[]>([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupLoadingMore, setGroupLoadingMore] = useState(false);
  const [groupPage, setGroupPage] = useState(1);
  const [groupHasMore, setGroupHasMore] = useState(false);
  const groupRequestRef = useRef(0);
  const [branches, setBranches] = useState<BranchListRow[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const enableMultipleBranches = auth?.enable_multiple_branches === true;
  const pinLength = auth?.pinLength === 6 ? 6 : 4;

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
        must_change_password: user.must_change_password === true,
        user_group_ids: user.user_groups?.map(g => g.id) || [],
        is_active: user.is_active,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser,
      });
    } else {
      setFormData(emptyForm());
    }
    setShowPassword(false);
    setPinModalVisible(false);
    setPinDraft('');
    setPinConfirm('');
    setPinError('');
    setPinSaved(false);
    setErrors({});
    setGroupCatalog({});
    setGroupPickerVisible(false);
    setGroupQuery('');
    setGroupResults([]);

    const rememberGroups = (groups?: UserGroup[]) => {
      if (!groups?.length) {
        return;
      }
      setGroupCatalog(prev => {
        const next = {...prev};
        for (const group of groups) {
          if (group?.id) {
            next[group.id] = group;
          }
        }
        return next;
      });
    };
    rememberGroups(user?.user_groups);

    const loadRefs = async () => {
      setLoadingRefs(true);
      try {
        const branchRows = await fetchCompanyBranches();
        setBranches(branchRows);
        if (user?.id) {
          const detail = await UserManagementService.getUser(user.id);
          setFormData(prev => ({
            ...prev,
            email: detail.email || prev.email,
            username: detail.username || prev.username,
            full_name: detail.full_name || prev.full_name,
            phone_number: detail.phone_number || prev.phone_number,
            global_dimension_1:
              detail.global_dimension_1_obj?.id ??
              detail.global_dimension_1 ??
              prev.global_dimension_1,
            can_switch_branch: detail.can_switch_branch !== false,
            must_change_password: detail.must_change_password === true,
            user_group_ids:
              detail.user_groups?.map(g => g.id) || prev.user_group_ids,
            is_active: detail.is_active,
          }));
          rememberGroups(detail.user_groups);
        }
      } catch {
        Toast.show({
          type: 'error',
          text1: 'Couldn’t load the form',
          visibilityTime: 5000,
        });
      } finally {
        setLoadingRefs(false);
      }
    };

    loadRefs();
  }, [visible, user]);

  useEffect(() => {
    if (!groupPickerVisible) {
      return;
    }
    const requestId = ++groupRequestRef.current;
    const query = groupQuery;
    setGroupSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await UserGroupService.getUserGroups({
          search: query,
          page: 1,
          pageSize: 40,
        });
        if (requestId !== groupRequestRef.current) {
          return;
        }
        setGroupResults(res.results || []);
        setGroupPage(1);
        setGroupHasMore(Boolean(res.next));
        setGroupCatalog(prev => {
          const next = {...prev};
          for (const group of res.results || []) {
            if (group?.id) {
              next[group.id] = group;
            }
          }
          return next;
        });
      } catch {
        if (requestId !== groupRequestRef.current) {
          return;
        }
        setGroupResults([]);
        setGroupHasMore(false);
      } finally {
        if (requestId === groupRequestRef.current) {
          setGroupSearchLoading(false);
        }
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [groupPickerVisible, groupQuery]);

  const loadMoreGroups = async () => {
    if (!groupHasMore || groupSearchLoading || groupLoadingMore) {
      return;
    }
    const requestId = groupRequestRef.current;
    const nextPage = groupPage + 1;
    setGroupLoadingMore(true);
    try {
      const res = await UserGroupService.getUserGroups({
        search: groupQuery,
        page: nextPage,
        pageSize: 40,
      });
      if (requestId !== groupRequestRef.current) {
        return;
      }
      setGroupResults(prev => {
        const seen = new Set(prev.map(group => group.id));
        return [
          ...prev,
          ...(res.results || []).filter(group => !seen.has(group.id)),
        ];
      });
      setGroupPage(nextPage);
      setGroupHasMore(Boolean(res.next));
      setGroupCatalog(prev => {
        const next = {...prev};
        for (const group of res.results || []) {
          if (group?.id) {
            next[group.id] = group;
          }
        }
        return next;
      });
    } catch {
      setGroupHasMore(false);
    } finally {
      setGroupLoadingMore(false);
    }
  };

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
        must_change_password: formData.must_change_password === true,
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
      const body = error?.response?.data ?? error?.data;
      const fieldErrors: Record<string, string> = {};
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const [key, value] of Object.entries(body)) {
          if (key === 'detail' || key === 'error' || key === 'message') {
            continue;
          }
          const text = Array.isArray(value)
            ? value.map(String).filter(Boolean).join(' ')
            : typeof value === 'string'
              ? value
              : '';
          if (text) {
            fieldErrors[key] = text.replace(
              /^custom user with this /i,
              'A user with this ',
            );
          }
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(prev => ({...prev, ...fieldErrors}));
      }
      const detail =
        Object.values(fieldErrors).join('\n') ||
        (typeof body?.detail === 'string' ? body.detail : '') ||
        (typeof body?.error === 'string' ? body.error : '') ||
        error?.customMessage ||
        'Failed to save user';
      Alert.alert('Could not save user', String(detail));
    } finally {
      setLoading(false);
    }
  };

  const openPinModal = () => {
    setPinDraft('');
    setPinConfirm('');
    setPinError('');
    setPinModalVisible(true);
  };

  const closePinModal = () => {
    if (pinSaving) {
      return;
    }
    setPinModalVisible(false);
  };

  const savePin = async () => {
    const pin = pinDraft.trim();
    if (pin.length !== pinLength) {
      setPinError(`PIN must be exactly ${pinLength} digits.`);
      return;
    }
    if (pin !== pinConfirm.trim()) {
      setPinError('PIN and confirm PIN must match.');
      return;
    }

    if (isEditMode && user) {
      setPinSaving(true);
      setPinError('');
      try {
        await UserManagementService.updateUser(user.id, {restaurant_pin: pin});
        setPinSaved(true);
        setFormData(prev => ({...prev, restaurant_pin: ''}));
        setPinModalVisible(false);
        Toast.show({type: 'success', text1: 'Sign-in PIN saved'});
      } catch (error: any) {
        const detail =
          error?.response?.data?.restaurant_pin?.[0] ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Could not save the PIN';
        setPinError(String(detail));
      } finally {
        setPinSaving(false);
      }
      return;
    }

    setFormData(prev => ({...prev, restaurant_pin: pin}));
    setPinSaved(true);
    setPinModalVisible(false);
  };

  const openGroupPicker = () => {
    setGroupQuery('');
    setGroupPickerVisible(true);
  };

  const toggleGroup = (groupId: number) => {
    const current = formData.user_group_ids || [];
    const next = current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId];
    setFormData(prev => ({...prev, user_group_ids: next}));
  };

  const displayName = formData.full_name.trim() || formData.username.trim() || 'New user';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'US';

  const selectedGroupIds = formData.user_group_ids || [];

  return (
    <>
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

        {loadingRefs ? (
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
              {isEditMode ? 'Edit user' : 'New user'}
            </Text>

            <View style={styles.previewSection}>
              <View style={styles.previewAvatar}>
                <Text style={styles.previewInitials}>{initials}</Text>
              </View>
              <View style={styles.previewMeta}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.previewSubtext} numberOfLines={1}>
                  {formData.email.trim() || 'Email address'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Field
                label="Full name"
                value={formData.full_name}
                onChangeText={v => setFormData(p => ({...p, full_name: v}))}
                error={errors.full_name}
                placeholder="Full name"
              />
              <Field
                label="User name"
                value={formData.username}
                onChangeText={v => setFormData(p => ({...p, username: v}))}
                error={errors.username}
                placeholder="User name"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                label="Email"
                value={formData.email}
                onChangeText={v => setFormData(p => ({...p, email: v}))}
                error={errors.email}
                placeholder="name@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                label="Phone"
                value={formData.phone_number}
                onChangeText={v => setFormData(p => ({...p, phone_number: v}))}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
              <ToggleRow
                label="Active"
                hint="Inactive users cannot sign in"
                value={formData.is_active}
                onValueChange={v => setFormData(p => ({...p, is_active: v}))}
              />
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sign-in</Text>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {isEditMode ? 'New password' : 'Password'}
                </Text>
                <View style={styles.secretRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.secretInput,
                      errors.password ? styles.inputError : null,
                    ]}
                    value={formData.password || ''}
                    onChangeText={v => setFormData(p => ({...p, password: v}))}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={
                      isEditMode ? 'Leave blank to keep the current password' : 'At least 8 characters'
                    }
                    placeholderTextColor={COLORS.gray2}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(v => !v)}
                    accessibilityLabel={
                      showPassword ? 'Hide password' : 'Show password'
                    }>
                    <Image
                      source={showPassword ? icons.eye_close : icons.eye}
                      style={styles.eyeIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : (
                  <Text style={styles.hint}>
                    Use the eye to show the password you are typing. A saved password cannot be displayed.
                  </Text>
                )}
              </View>
              <ToggleRow
                label="Change password at next login"
                hint="The user must set a new password the next time they sign in"
                value={formData.must_change_password === true}
                onValueChange={v =>
                  setFormData(p => ({...p, must_change_password: v}))
                }
              />
              <TouchableOpacity
                style={styles.pinButton}
                onPress={openPinModal}
                activeOpacity={0.85}>
                <Text style={styles.pinButtonText}>Set sign-in PIN</Text>
                <Text style={styles.pinButtonHint}>
                  {pinSaved
                    ? isEditMode
                      ? 'A new PIN was saved for this user'
                      : 'PIN will be saved when you create the user'
                    : `${pinLength}-digit PIN for quick sign-in`}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Access</Text>
              {enableMultipleBranches && branches.length > 0 ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Assigned branch</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.global_dimension_1 ?? 0}
                      onValueChange={v =>
                        setFormData(p => ({
                          ...p,
                          global_dimension_1: v === 0 ? null : Number(v),
                        }))
                      }
                      style={styles.picker}>
                      <Picker.Item label="No branch" value={0} />
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
              ) : null}
              {enableMultipleBranches ? (
                <ToggleRow
                  label="Can switch branch"
                  hint="This user can change the working branch after sign-in"
                  value={formData.can_switch_branch !== false}
                  onValueChange={v =>
                    setFormData(p => ({...p, can_switch_branch: v}))
                  }
                />
              ) : null}
              <Text style={styles.label}>User groups</Text>
              {(formData.user_group_ids || []).length === 0 ? (
                <Text style={styles.hint}>No groups assigned</Text>
              ) : (
                (formData.user_group_ids || []).map(groupId => {
                  const group = groupCatalog[groupId];
                  return (
                    <View key={groupId} style={styles.groupRow}>
                      <View style={styles.groupCopy}>
                        <Text style={styles.groupName}>
                          {group?.name || group?.code || `Group ${groupId}`}
                        </Text>
                        {group?.description ? (
                          <Text style={styles.groupHint} numberOfLines={1}>
                            {group.description}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleGroup(groupId)}
                        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
              <TouchableOpacity
                style={styles.pinButton}
                onPress={openGroupPicker}
                activeOpacity={0.85}>
                <Text style={styles.pinButtonText}>Choose user groups</Text>
                <Text style={styles.pinButtonHint}>
                  Search the full list. Only assigned groups stay on this card.
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, {paddingBottom: Math.max(insets.bottom, 16)}]}>
          <TouchableOpacity
            style={[styles.saveButton, (!canSave || loading) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading || !canSave}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Save user' : 'Create user'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={pinModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closePinModal}>
          <View style={styles.pinBackdrop}>
            <View style={styles.pinCard}>
              <Text style={styles.pinTitle}>Set sign-in PIN</Text>
              <Text style={styles.pinSubtitle}>
                {`Set a ${pinLength}-digit sign-in PIN for ${displayName}.`}
              </Text>
              <Text style={styles.label}>New PIN</Text>
              <PinDigitInput
                value={pinDraft}
                onChange={v => {
                  setPinError('');
                  setPinDraft(v);
                }}
                placeholder={`${pinLength} digits`}
                editable={!pinSaving}
                maxLength={pinLength}
              />
              <Text style={[styles.label, styles.pinLabelGap]}>Confirm PIN</Text>
              <PinDigitInput
                value={pinConfirm}
                onChange={v => {
                  setPinError('');
                  setPinConfirm(v);
                }}
                placeholder="Repeat the PIN"
                editable={!pinSaving}
                maxLength={pinLength}
              />
              {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
              <View style={styles.pinActions}>
                <TouchableOpacity
                  style={styles.pinCancel}
                  onPress={closePinModal}
                  disabled={pinSaving}>
                  <Text style={styles.pinCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pinSave, pinSaving && styles.saveButtonDisabled]}
                  onPress={() => {
                    void savePin();
                  }}
                  disabled={pinSaving}>
                  {pinSaving ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save PIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>

    <Modal
      visible={visible && groupPickerVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setGroupPickerVisible(false)}>
      <View style={styles.pageRoot}>
        <View style={[styles.pageHeader, {paddingTop: topInset}]}>
          <QuickIconPressable
            onPress={() => setGroupPickerVisible(false)}
            style={styles.headerIconButton}
            accessibilityLabel="Close user groups">
            <Image
              source={icons.cross}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </QuickIconPressable>
          <Text style={styles.pickerTitle}>User groups</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.pickerSearchWrap}>
          <TextInput
            style={styles.input}
            value={groupQuery}
            onChangeText={setGroupQuery}
            placeholder="Search by name or code"
            placeholderTextColor={COLORS.gray2}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {groupSearchLoading && groupResults.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
          </View>
        ) : (
          <FlatList
            data={groupResults}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadMoreGroups}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <Text style={styles.hint}>
                {groupQuery.trim()
                  ? 'No groups match that search'
                  : 'No user groups available'}
              </Text>
            }
            ListFooterComponent={
              groupLoadingMore ? (
                <ActivityIndicator color={COLORS.primary2} style={styles.pickerFooter} />
              ) : null
            }
            renderItem={({item}) => {
              const selected = selectedGroupIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.groupRow, selected && styles.groupRowSelected]}
                  onPress={() => toggleGroup(item.id)}
                  activeOpacity={0.8}>
                  <View style={styles.groupCopy}>
                    <Text style={styles.groupName}>{item.name || item.code}</Text>
                    {item.description ? (
                      <Text style={styles.groupHint} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.check, selected && styles.checkSelected]}>
                    {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
    </>
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
  <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={COLORS.gray2}
      {...rest}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

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
  inputError: {borderColor: COLORS.error},
  secretRow: {position: 'relative', justifyContent: 'center'},
  secretInput: {paddingRight: 52},
  eyeBtn: {
    position: 'absolute',
    right: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {width: 20, height: 20, tintColor: COLORS.gray2},
  errorText: {fontSize: 13, color: COLORS.error, marginTop: 8},
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
    marginBottom: 16,
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
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  groupRowSelected: {
    backgroundColor: COLORS.transparentPrimary,
    borderColor: COLORS.primary2,
  },
  groupCopy: {flex: 1, paddingRight: 12},
  groupName: {...FONTS.body3, color: COLORS.black, fontWeight: '600'},
  groupHint: {...FONTS.body5, color: COLORS.gray2, marginTop: 2},
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.transparentPrimary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {backgroundColor: COLORS.primary2, borderColor: COLORS.primary2},
  checkMark: {color: COLORS.white, fontSize: 14, fontWeight: '700'},
  removeText: {...FONTS.body4, color: COLORS.error, fontWeight: '600'},
  pickerTitle: {...FONTS.h3, color: COLORS.black, fontWeight: '700'},
  pickerSearchWrap: {paddingHorizontal: 20, paddingBottom: 8},
  pickerList: {paddingHorizontal: 20, paddingBottom: 24},
  pickerFooter: {marginVertical: 16},
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
  pinButton: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: COLORS.transparentPrimary,
    justifyContent: 'center',
  },
  pinButtonText: {...FONTS.body3, color: COLORS.primary3, fontWeight: '700'},
  pinButtonHint: {...FONTS.body5, color: COLORS.gray2, marginTop: 4},
  pinBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pinCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
  },
  pinTitle: {fontSize: 18, fontWeight: '700', color: COLORS.black},
  pinSubtitle: {...FONTS.body4, color: COLORS.gray2, marginTop: 6, marginBottom: 16},
  pinLabelGap: {marginTop: 12},
  pinInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    borderRadius: 14,
    paddingHorizontal: 16,
    ...FONTS.body3,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  pinActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18},
  pinCancel: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.transparentPrimary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCancelText: {...FONTS.body4, color: COLORS.black, fontWeight: '600'},
  pinSave: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  loadingBox: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default UserFormModal;
