import {Alert, InteractionManager} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

/**
 * User-facing errors: native Alert (readable, dismissible) instead of
 * short toast text that is easy to miss behind modals / tab bars.
 */
export function showUserError(
  title: string,
  message: string,
  options?: {
    /** Extra OK-side action, e.g. "View unposted". */
    secondaryAction?: {label: string; onPress: () => void};
  },
) {
  const body =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : 'Something went wrong. Please try again.';

  InteractionManager.runAfterInteractions(() => {
    const buttons: {
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }[] = [
      {
        text: 'Copy error',
        onPress: () => {
          try {
            Clipboard.setString(`${title}\n${body}`);
            Toast.show({
              type: 'success',
              text1: 'Copied',
              text2: 'Paste it when you contact support.',
              visibilityTime: 2000,
            });
          } catch {
            /* ignore */
          }
        },
      },
    ];

    if (options?.secondaryAction) {
      buttons.push({
        text: options.secondaryAction.label,
        onPress: options.secondaryAction.onPress,
      });
    }

    buttons.push({text: 'OK', style: 'cancel'});

    Alert.alert(title, body, buttons, {cancelable: true});
  });
}

/** Short non-blocking success (toast is fine for these). */
export function showUserSuccess(title: string, message?: string) {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    visibilityTime: 2000,
    position: 'top',
  });
}

export function showUserInfo(title: string, message?: string) {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message,
    visibilityTime: 3000,
    position: 'top',
  });
}
