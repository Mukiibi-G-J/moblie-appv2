import {Alert, Linking} from 'react-native';
import Toast from 'react-native-toast-message';

export const SUPPORT_NUMBERS = ['+256750440865', '+256779899789'] as const;

const normalizeDigits = (raw: string) => raw.replace(/[^\d]/g, '');

async function callNumber(raw: string) {
  const telUrl = `tel:${raw}`;
  const canOpen = await Linking.canOpenURL(telUrl);
  if (!canOpen) {
    Toast.show({
      type: 'error',
      text1: 'Unable to place call',
      text2: `This device cannot call ${raw}.`,
    });
    return;
  }
  await Linking.openURL(telUrl);
}

async function openWhatsApp(raw: string) {
  const digits = normalizeDigits(raw);
  const waUrl = `https://wa.me/${digits}`;
  const canOpen = await Linking.canOpenURL(waUrl);
  if (!canOpen) {
    Toast.show({
      type: 'error',
      text1: 'Unable to open WhatsApp',
      text2: `Could not open WhatsApp for ${raw}.`,
    });
    return;
  }
  await Linking.openURL(waUrl);
}

/** Help & Support picker — same options as More menu. */
export function showAuthSupportAlert() {
  Alert.alert(
    'Help & Support',
    'Choose support channel:',
    [
      {
        text: `Call ${SUPPORT_NUMBERS[0]}`,
        onPress: () => {
          void callNumber(SUPPORT_NUMBERS[0]);
        },
      },
      {
        text: `WhatsApp ${SUPPORT_NUMBERS[0]}`,
        onPress: () => {
          void openWhatsApp(SUPPORT_NUMBERS[0]);
        },
      },
      {
        text: `Call ${SUPPORT_NUMBERS[1]}`,
        onPress: () => {
          void callNumber(SUPPORT_NUMBERS[1]);
        },
      },
      {
        text: `WhatsApp ${SUPPORT_NUMBERS[1]}`,
        onPress: () => {
          void openWhatsApp(SUPPORT_NUMBERS[1]);
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ],
    {cancelable: true},
  );
}
