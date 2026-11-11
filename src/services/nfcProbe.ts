import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

export type NfcProbeStatus = {
  supported: boolean;
  enabled: boolean;
};

export type NfcProbeTap = {
  techs: string[];
  contactlessCard: boolean;
  at: number;
};

type NfcProbeNative = {
  getStatus: () => Promise<NfcProbeStatus>;
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  openSettings: () => void;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const native: NfcProbeNative | undefined = NativeModules.NfcProbe;

const emitter =
  Platform.OS === 'android' && native
    ? new NativeEventEmitter(NativeModules.NfcProbe)
    : null;

export function nfcProbeAvailable(): boolean {
  return Platform.OS === 'android' && native != null;
}

export async function getNfcProbeStatus(): Promise<NfcProbeStatus> {
  if (!native) {
    return {supported: false, enabled: false};
  }
  return native.getStatus();
}

export async function startNfcProbe(): Promise<boolean> {
  if (!native) {
    return false;
  }
  return native.start();
}

export async function stopNfcProbe(): Promise<void> {
  if (!native) {
    return;
  }
  await native.stop();
}

export function openNfcSettings(): void {
  native?.openSettings();
}

export function subscribeNfcProbeTap(
  listener: (tap: NfcProbeTap) => void,
): () => void {
  if (!emitter) {
    return () => {};
  }
  const sub = emitter.addListener('NfcProbeTap', listener);
  return () => sub.remove();
}
