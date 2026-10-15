import React from 'react';
import Toast from 'react-native-toast-message';
import {appToastConfig} from './AppToast';

/** Single place for toast look + placement across the app. */
const AppToastHost = () => (
  <Toast
    config={appToastConfig}
    position="top"
    topOffset={56}
    visibilityTime={4000}
  />
);

export default AppToastHost;
