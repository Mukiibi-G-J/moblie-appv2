import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import {QuickIconPressable} from '../../Components';
import {COLORS, FONTS, SIZES, icons} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import {useAppContext} from '../../context/Store';
import {safeGoBack} from '../../hooks/NavigationService';
import {invalidateQueryCache} from '../../query/queryClient';
import {
  cacheAvatarUrl,
  fetchUserProfile,
  removeUserAvatar,
  updateUserProfile,
  uploadUserAvatar,
  type UserProfile,
} from '../../services/profile.service';
import {
  loadRoleCentreSettings,
  switchRoleCentre,
  type ApplicationProfileOption,
  type RoleCentreSettings,
} from '../../services/roleCentre.service';
import {
  resolveProfileAvatarSrc,
} from '../../utils/profileAvatar';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const app = useAppContext();
  const auth = app?.auth;
  const patchAuth = app?.patchAuth;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleCentre, setRoleCentre] = useState<RoleCentreSettings | null>(null);
  const [roleCentreLoading, setRoleCentreLoading] = useState(false);
  const [roleCentreError, setRoleCentreError] = useState<string | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUserProfile();
      setProfile(data);
      setFullName(data.full_name || '');
      setEmail(data.email || '');
      setPhoneNumber(data.phone_number || '');
      await cacheAvatarUrl(data.avatar_url);
      patchAuth?.({
        avatar_url: data.avatar_url ?? undefined,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone_number,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not load profile',
        text2: 'Pull to refresh or try again later.',
        position: 'top',
      });
    } finally {
      setLoading(false);
    }
  }, [patchAuth]);

  const loadRoleCentre = useCallback(async () => {
    setRoleCentreLoading(true);
    setRoleCentreError(null);
    try {
      const settings = await loadRoleCentreSettings();
      setRoleCentre(settings);
    } catch (e: unknown) {
      setRoleCentre(null);
      setRoleCentreError(
        e instanceof Error ? e.message : 'Could not load Role Centre options.',
      );
    } finally {
      setRoleCentreLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadRoleCentre();
  }, [loadProfile, loadRoleCentre]);

  const handleSelectRoleCentre = useCallback(
    async (option: ApplicationProfileOption) => {
      if (!roleCentre || switchingRole) {
        return;
      }
      if (option.code === roleCentre.currentCode) {
        setRoleModalVisible(false);
        return;
      }
      setSwitchingRole(true);
      try {
        await switchRoleCentre(roleCentre.systemId, option.code, {
          role: roleCentre.currentCode,
        });
        setRoleCentre(prev =>
          prev
            ? {
                ...prev,
                currentCode: option.code,
                currentDescription: option.description,
              }
            : prev,
        );
        setRoleModalVisible(false);
        invalidateQueryCache();
        Toast.show({
          type: 'success',
          text1: 'Role Centre updated',
          text2: option.description,
          position: 'top',
        });
      } catch (e: unknown) {
        Toast.show({
          type: 'error',
          text1: 'Could not switch profile',
          text2:
            e instanceof Error ? e.message : 'Please try again or use the web app.',
          position: 'top',
        });
      } finally {
        setSwitchingRole(false);
      }
    },
    [roleCentre, switchingRole],
  );

  const avatarSrc = useMemo(
    () =>
      resolveProfileAvatarSrc(
        profile?.avatar_url,
        profile?.email || profile?.username || auth?.email,
        200,
      ),
    [profile, auth?.email],
  );

  const hasUploadedAvatar = Boolean(profile?.avatar_url?.trim());

  const isProfileDirty = useMemo(() => {
    if (!profile) {
      return false;
    }
    return (
      fullName.trim() !== (profile.full_name || '').trim() ||
      email.trim() !== (profile.email || '').trim() ||
      phoneNumber.trim() !== (profile.phone_number || '').trim()
    );
  }, [profile, fullName, email, phoneNumber]);

  const handlePickerResponse = useCallback(
    async (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert(
          'Error',
          response.errorMessage || 'Could not open the image picker.',
        );
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      const mime = (asset.type || '').toLowerCase();
      if (mime && !ALLOWED_IMAGE_TYPES.has(mime)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid image',
          text2: 'Please upload a JPEG, PNG, or GIF image.',
          position: 'top',
        });
        return;
      }

      if (asset.fileSize != null && asset.fileSize > MAX_AVATAR_BYTES) {
        Toast.show({
          type: 'error',
          text1: 'File too large',
          text2: 'Please upload an image smaller than 5MB.',
          position: 'top',
        });
        return;
      }

      setUploading(true);
      try {
        const result = await uploadUserAvatar(asset.uri);
        await loadProfile();
        patchAuth?.({avatar_url: result.avatar_url ?? undefined});
        Toast.show({
          type: 'success',
          text1: 'Profile picture updated',
          position: 'top',
        });
      } catch (e: unknown) {
        Toast.show({
          type: 'error',
          text1: 'Upload failed',
          text2: e instanceof Error ? e.message : 'Could not upload image.',
          position: 'top',
        });
      } finally {
        setUploading(false);
      }
    },
    [loadProfile, patchAuth],
  );

  const pickFromLibrary = useCallback(async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85,
        includeBase64: false,
        selectionLimit: 1,
        maxWidth: 1024,
        maxHeight: 1024,
      });
      await handlePickerResponse(response);
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  }, [handlePickerResponse]);

  const pickFromCamera = useCallback(async () => {
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        quality: 0.85,
        includeBase64: false,
        maxWidth: 1024,
        maxHeight: 1024,
        saveToPhotos: false,
      });
      await handlePickerResponse(response);
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  }, [handlePickerResponse]);

  const handleChangePhoto = () => {
    if (uploading) {
      return;
    }
    Alert.alert('Profile picture', 'Choose a source', [
      {text: 'Photo library', onPress: () => void pickFromLibrary()},
      {text: 'Take photo', onPress: () => void pickFromCamera()},
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const handleRemovePhoto = () => {
    if (!hasUploadedAvatar || uploading) {
      return;
    }
    Alert.alert(
      'Remove profile picture',
      'Your generated avatar will be shown instead.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploading(true);
            try {
              await removeUserAvatar();
              setProfile(prev =>
                prev ? {...prev, avatar_url: null} : prev,
              );
              patchAuth?.({avatar_url: undefined});
              Toast.show({
                type: 'success',
                text1: 'Profile picture removed',
                position: 'top',
              });
            } catch (e: unknown) {
              Toast.show({
                type: 'error',
                text1: 'Remove failed',
                text2:
                  e instanceof Error
                    ? e.message
                    : 'Could not remove profile picture.',
                position: 'top',
              });
            } finally {
              setUploading(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveProfile = async () => {
    if (!profile || saving || !isProfileDirty) {
      return;
    }
    if (!fullName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Full name required',
        position: 'top',
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim(),
      });
      setProfile(updated);
      patchAuth?.({
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone_number,
      });
      Toast.show({
        type: 'success',
        text1: 'Profile updated',
        position: 'top',
      });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2:
          e?.response?.data?.error ||
          e?.message ||
          'Could not update profile.',
        position: 'top',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeOuter, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View style={[styles.root, {backgroundColor: colors.background}]}>
        <View
          style={[
            styles.topHeader,
            {
              paddingTop: headerPaddingTop,
              borderBottomColor: colors.border,
            },
          ]}>
          <QuickIconPressable
            style={[
              styles.headerRoundButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            onPress={() => safeGoBack(navigation, 'Home')}
            accessibilityLabel="Go back">
            <Image
              source={icons.back as any}
              style={[styles.headerRoundIcon, {tintColor: colors.textPrimary}]}
            />
          </QuickIconPressable>
          <Text style={[styles.topTitle, {color: colors.textPrimary}]}>
            My profile
          </Text>
          <View style={styles.headerTrailingSpacer} />
        </View>

        {loading && !profile ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary2} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View
              style={[
                styles.card,
                {backgroundColor: colors.card, borderColor: colors.border},
              ]}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Profile picture
              </Text>
              <Text style={[styles.sectionHint, {color: colors.textSecondary}]}>
                Same as the web app — visible on your account across devices.
              </Text>

              <View style={styles.avatarRow}>
                <TouchableOpacity
                  onPress={handleChangePhoto}
                  disabled={uploading}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile picture">
                  <View style={styles.avatarOuter}>
                    {hasUploadedAvatar ? (
                      <Image
                        source={{uri: avatarSrc}}
                        style={styles.avatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatarFallback,
                          {backgroundColor: colors.screenMuted},
                        ]}>
                        <Image
                          source={{uri: avatarSrc}}
                          style={styles.avatarImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                    {uploading ? (
                      <View style={styles.avatarOverlay}>
                        <ActivityIndicator color={COLORS.white} />
                      </View>
                    ) : (
                      <View style={styles.avatarEditBadge}>
                        <Image
                          source={icons.update}
                          style={styles.avatarEditIcon}
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.avatarActions}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, uploading && styles.btnDisabled]}
                    onPress={handleChangePhoto}
                    disabled={uploading}
                    activeOpacity={0.85}>
                    <Text style={styles.primaryBtnText}>
                      {uploading ? 'Uploading…' : 'Upload photo'}
                    </Text>
                  </TouchableOpacity>
                  {hasUploadedAvatar ? (
                    <TouchableOpacity
                      style={[
                        styles.secondaryBtn,
                        {borderColor: colors.border},
                        uploading && styles.btnDisabled,
                      ]}
                      onPress={handleRemovePhoto}
                      disabled={uploading}
                      activeOpacity={0.85}>
                      <Text
                        style={[
                          styles.secondaryBtnText,
                          {color: colors.textPrimary},
                        ]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            <View
              style={[
                styles.card,
                {backgroundColor: colors.card, borderColor: colors.border},
              ]}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Personal information
              </Text>

              <Text style={[styles.label, {color: colors.textSecondary}]}>
                Full name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full name"
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.label, {color: colors.textSecondary}]}>
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.label, {color: colors.textSecondary}]}>
                Phone number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+256700000000"
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[
                  styles.saveProfileBtn,
                  (!isProfileDirty || saving) && styles.btnDisabled,
                ]}
                disabled={!isProfileDirty || saving}
                onPress={() => void handleSaveProfile()}
                activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.saveProfileBtnText}>Save changes</Text>
                )}
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.card,
                {backgroundColor: colors.card, borderColor: colors.border},
              ]}>
              <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                Role Centre
              </Text>
              <Text style={[styles.sectionHint, {color: colors.textSecondary}]}>
                Same as web User settings. Admins (SUPER) can switch between all
                profiles; other users only see profiles they are allowed to use.
              </Text>

              {roleCentreLoading && !roleCentre ? (
                <ActivityIndicator color={COLORS.primary2} />
              ) : roleCentreError && !roleCentre ? (
                <View style={styles.roleCentreErrorWrap}>
                  <Text style={[styles.rolesText, {color: colors.textSecondary}]}>
                    {roleCentreError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, {borderColor: colors.border}]}
                    onPress={() => void loadRoleCentre()}
                    activeOpacity={0.85}>
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        {color: colors.textPrimary},
                      ]}>
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={[styles.label, {color: colors.textSecondary}]}>
                    Current profile
                  </Text>
                  <Text style={[styles.roleCurrent, {color: colors.textPrimary}]}>
                    {roleCentre?.currentDescription ||
                      roleCentre?.currentCode ||
                      'Not set'}
                  </Text>
                  {roleCentre?.canSwitch ? (
                    <TouchableOpacity
                      style={styles.saveProfileBtn}
                      onPress={() => setRoleModalVisible(true)}
                      disabled={switchingRole}
                      activeOpacity={0.85}>
                      <Text style={styles.saveProfileBtnText}>
                        Switch profile
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[
                        styles.rolesText,
                        {color: colors.textSecondary, marginTop: 8},
                      ]}>
                      Only one profile is available for your account. An
                      administrator can assign additional Role Centre access.
                    </Text>
                  )}
                </>
              )}
            </View>

            {profile?.roles?.length ? (
              <View
                style={[
                  styles.card,
                  {backgroundColor: colors.card, borderColor: colors.border},
                ]}>
                <Text style={[styles.sectionTitle, {color: colors.textPrimary}]}>
                  Roles
                </Text>
                <Text style={[styles.rolesText, {color: colors.textSecondary}]}>
                  {profile.roles.join(', ')}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}

        <Modal
          visible={roleModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            switchingRole ? null : setRoleModalVisible(false)
          }>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => (switchingRole ? null : setRoleModalVisible(false))}>
            <Pressable
              style={[
                styles.modalSheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
              onPress={e => e.stopPropagation()}>
              <Text style={[styles.modalTitle, {color: colors.textPrimary}]}>
                Switch Role Centre
              </Text>
              <Text style={[styles.modalHint, {color: colors.textSecondary}]}>
                Choose the application profile to use. This matches switching
                Role Centre on the web.
              </Text>
              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled">
                {(roleCentre?.profiles ?? []).map(option => {
                  const selected = option.code === roleCentre?.currentCode;
                  return (
                    <TouchableOpacity
                      key={option.code}
                      style={[
                        styles.modalRow,
                        {borderBottomColor: colors.border},
                        selected && styles.modalRowSelected,
                      ]}
                      disabled={switchingRole}
                      onPress={() => void handleSelectRoleCentre(option)}
                      activeOpacity={0.85}>
                      <View style={styles.modalRowText}>
                        <Text
                          style={[
                            styles.modalRowTitle,
                            {color: colors.textPrimary},
                          ]}>
                          {option.description}
                        </Text>
                        <Text
                          style={[
                            styles.modalRowCode,
                            {color: colors.textSecondary},
                          ]}>
                          {option.code}
                        </Text>
                      </View>
                      {selected ? (
                        <Text
                          style={[
                            styles.modalCurrentBadge,
                            {color: colors.textSecondary},
                          ]}>
                          Current
                        </Text>
                      ) : switchingRole ? (
                        <ActivityIndicator color={COLORS.primary2} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.modalCloseBtn,
                  {backgroundColor: colors.screenMuted},
                ]}
                disabled={switchingRole}
                onPress={() => setRoleModalVisible(false)}
                activeOpacity={0.85}>
                <Text
                  style={[styles.modalCloseBtnText, {color: colors.textPrimary}]}>
                  Close
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeOuter: {flex: 1},
  root: {flex: 1},
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRoundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRoundIcon: {width: 20, height: 20},
  topTitle: {
    flex: 1,
    textAlign: 'center',
    ...FONTS.h3,
    fontWeight: '700',
  },
  headerTrailingSpacer: {width: 40, height: 40},
  scroll: {flex: 1},
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    ...FONTS.h4,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHint: {
    ...FONTS.body4,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.white,
  },
  avatarActions: {
    flex: 1,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  btnDisabled: {opacity: 0.55},
  label: {
    ...FONTS.body4,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...FONTS.body3,
  },
  saveProfileBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primary2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveProfileBtnText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '700',
  },
  rolesText: {
    ...FONTS.body4,
    lineHeight: 20,
  },
  roleCurrent: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  roleCentreErrorWrap: {
    gap: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    maxHeight: '75%',
  },
  modalTitle: {
    ...FONTS.h3,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalHint: {
    ...FONTS.body4,
    marginBottom: 12,
    lineHeight: 20,
  },
  modalList: {
    maxHeight: 360,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  modalRowSelected: {
    opacity: 1,
  },
  modalRowText: {
    flex: 1,
  },
  modalRowTitle: {
    ...FONTS.body3,
    fontWeight: '600',
  },
  modalRowCode: {
    ...FONTS.body5,
    marginTop: 2,
  },
  modalCurrentBadge: {
    ...FONTS.body5,
    fontWeight: '700',
  },
  modalCloseBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    ...FONTS.body3,
    fontWeight: '700',
  },
});

export default ProfileScreen;
