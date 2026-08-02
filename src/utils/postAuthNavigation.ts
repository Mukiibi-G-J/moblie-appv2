import AsyncStorage from '@react-native-async-storage/async-storage';
import {jwtDecode} from 'jwt-decode';
import Toast from 'react-native-toast-message';
import type {NavigationProp} from '@react-navigation/native';
import type {AppContextType} from '../context/Store';
import type {DecodedToken} from '../types/auth';
import type {RootStackParamList} from '../@types/types.dto';
import {setVerifiedEmail} from './tenant';
import {LOGIN_DRAFT_PASSWORD} from './loginCredentials';
import {shouldOfferRestaurantPinFromToken} from './restaurantPinOffer';
import {getRestaurantPinStatus} from '../services/restaurantPinApi';
import {
  setPinSetupPending,
  RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
} from '../storage/restaurantDeviceStorage';

export type PostCredentialLoginResult = 'otp' | 'home' | 'failed';

type LoginAndRouteParams = {
  context: AppContextType | null;
  navigation: NavigationProp<RootStackParamList>;
  credential: string;
  password: string;
  tenant: string;
  otpToast?: boolean;
};

/** Password login → OTP (unverified) or authenticated app (verified). */
export async function loginAndRouteAfterCredentials({
  context,
  navigation,
  credential,
  password,
  tenant,
  otpToast = true,
}: LoginAndRouteParams): Promise<PostCredentialLoginResult> {
  const schemaTenant = tenant.trim().toLowerCase();
  const response = await context?.login({
    email: credential.trim(),
    password,
    tenant: schemaTenant,
  });

  if (!response?.access) {
    return 'failed';
  }

  const dec = jwtDecode<DecodedToken>(response.access);

  if (dec.verified === false) {
    const otpEmail = (dec.email || credential).trim();
    navigation.reset({
      index: 0,
      routes: [{name: 'Otp', params: {email: otpEmail}}],
    });
    if (otpToast) {
      Toast.show({
        type: 'info',
        text1: 'Verify your account',
        text2: 'Enter the code we sent to your phone or email.',
      });
    }
    return 'otp';
  }

  await setVerifiedEmail(true);

  try {
    if (
      shouldOfferRestaurantPinFromToken(
        dec.role_center_modules,
        dec.enabled_modules,
        dec.authority,
      )
    ) {
      const status = await getRestaurantPinStatus(response.access);
      if (status.eligible && (!status.has_pin || status.pin_expired)) {
        const willShowBranchPicker =
          dec.enable_multiple_branches === true &&
          dec.can_switch_branch !== false;
        const branchPendingRaw = await AsyncStorage.getItem(
          'branch.branchSelectionPending',
        );
        const branchPending = branchPendingRaw === '1';
        if (willShowBranchPicker && branchPending) {
          await setPinSetupPending(true);
        } else {
          await AsyncStorage.setItem(
            RESTAURANT_SHOW_PIN_SETUP_IMMEDIATE_KEY,
            '1',
          );
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  await AsyncStorage.removeItem(LOGIN_DRAFT_PASSWORD);
  return 'home';
}
