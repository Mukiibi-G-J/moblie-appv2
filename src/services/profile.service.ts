import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

export const USER_AVATAR_STORAGE_KEY = 'user.avatar_url';

export type UserProfile = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone_number: string;
  roles: string[];
  authority: string[];
  avatar_url?: string | null;
  is_staff: boolean;
  is_active: boolean;
  last_login?: string | null;
};

export type UpdateUserProfilePayload = {
  full_name?: string;
  email?: string;
  phone_number?: string;
};

function imageFormFieldsFromUri(imageUri: string): {
  fileName: string;
  fileType: string;
} {
  let fileName = 'avatar.jpg';
  let fileType = 'jpeg';

  if (imageUri.startsWith('content://')) {
    fileName = `avatar_${Date.now()}.jpg`;
    fileType = 'jpeg';
  } else if (imageUri.startsWith('file://')) {
    const pathParts = imageUri.split('/');
    fileName = pathParts.pop() || 'avatar.jpg';
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'png') {
      fileType = 'png';
    } else if (extension === 'gif') {
      fileType = 'gif';
    } else if (extension === 'webp') {
      fileType = 'webp';
    }
  }

  return {fileName, fileType};
}

function throwAvatarUploadError(error: any): never {
  const apiError =
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.message;
  if (error?.response?.status === 413) {
    throw new Error('Image is too large. Please choose one under 5MB.');
  }
  if (error?.response?.status === 415 || error?.response?.status === 400) {
    throw new Error(
      typeof apiError === 'string'
        ? apiError
        : 'Please upload a JPEG, PNG, or GIF image.',
    );
  }
  if (error?.response?.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }
  throw new Error(
    typeof apiError === 'string' ? apiError : 'Failed to upload profile picture.',
  );
}

async function authApi() {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  return createAxiosInstance(tenant);
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const api = await authApi();
  const res = await api.get('/api/auth/profile/');
  return res.data as UserProfile;
}

export async function updateUserProfile(
  payload: UpdateUserProfilePayload,
): Promise<UserProfile> {
  const api = await authApi();
  const res = await api.put('/api/auth/update-profile/', payload);
  return res.data as UserProfile;
}

export async function uploadUserAvatar(
  imageUri: string,
): Promise<{avatar_url?: string | null}> {
  try {
    const api = await authApi();
    const formData = new FormData();
    const {fileName, fileType} = imageFormFieldsFromUri(imageUri);

    formData.append('avatar', {
      uri: imageUri,
      type: `image/${fileType}`,
      name: fileName,
    } as any);

    const res = await api.post('/api/auth/upload-avatar/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const avatarUrl = res.data?.avatar_url ?? null;
    if (avatarUrl) {
      await AsyncStorage.setItem(USER_AVATAR_STORAGE_KEY, avatarUrl);
    }
    return {avatar_url: avatarUrl};
  } catch (error) {
    throwAvatarUploadError(error);
  }
}

export async function removeUserAvatar(): Promise<void> {
  const api = await authApi();
  await api.post('/api/auth/remove-avatar/');
  await AsyncStorage.removeItem(USER_AVATAR_STORAGE_KEY);
}

export async function readCachedAvatarUrl(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(USER_AVATAR_STORAGE_KEY);
  return raw?.trim() || null;
}

export async function cacheAvatarUrl(url: string | null | undefined): Promise<void> {
  const trimmed = url?.trim();
  if (trimmed) {
    await AsyncStorage.setItem(USER_AVATAR_STORAGE_KEY, trimmed);
  } else {
    await AsyncStorage.removeItem(USER_AVATAR_STORAGE_KEY);
  }
}
