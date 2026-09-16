import {DeviceEventEmitter, NativeModules} from 'react-native';
import {formatCurrencyCompact} from '../utils/currency';

export type CustomerDisplayMode = 'idle' | 'cart' | 'paying' | 'thanks';

export type CustomerDisplayLine = {
  name: string;
  qtyLabel: string;
  amount: string;
};

export type CustomerDisplayPayload = {
  mode: CustomerDisplayMode;
  companyName: string;
  /** Absolute JPEG/PNG/GIF URI. Omit placeholders; never apply a white tint. */
  companyLogo?: string;
  heading?: string;
  message?: string;
  lines?: CustomerDisplayLine[];
  totalLabel?: string;
  totalAmount?: string;
  footer?: string;
};

export type CustomerDisplayStatus = {
  hasSecondaryDisplay: boolean;
  attached: boolean;
  displayId: number;
  displayName: string;
};

const STATUS_EVENT = 'CustomerDisplayStatus';
const PAYLOAD_EVENT = 'CustomerDisplayPayload';
const THANKS_MS = 5000;

const native = NativeModules.CustomerDisplay as
  | {
      getStatus: () => Promise<CustomerDisplayStatus>;
      show: () => Promise<CustomerDisplayStatus>;
      hide: () => Promise<CustomerDisplayStatus>;
      update: (payload: CustomerDisplayPayload) => Promise<boolean>;
    }
  | undefined;

let latestPayload: CustomerDisplayPayload = {
  mode: 'idle',
  companyName: 'Zentro',
  heading: 'Welcome',
  message: 'Your order will appear here',
};
let thanksUntil = 0;
let thanksTimer: ReturnType<typeof setTimeout> | null = null;

function emitPayload(payload: CustomerDisplayPayload) {
  latestPayload = payload;
  DeviceEventEmitter.emit(PAYLOAD_EVENT, payload);
}

export function getLatestCustomerDisplayPayload(): CustomerDisplayPayload {
  return latestPayload;
}

export function buildIdleCustomerDisplay(
  companyName: string,
  companyLogo?: string | null,
): CustomerDisplayPayload {
  return {
    mode: 'idle',
    companyName: companyName || 'Zentro',
    ...(companyLogo ? {companyLogo} : {}),
    heading: 'Welcome',
    message: 'Your order will appear here',
  };
}

export function linesFromCartItems(
  items: Array<{item_name?: string; quantity?: number; unit_price?: number}>,
): CustomerDisplayLine[] {
  return items.map(item => {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unit_price) || 0;
    return {
      name: String(item.item_name || 'Item').trim() || 'Item',
      qtyLabel: `${qty}×`,
      amount: formatCurrencyCompact(unit * qty),
    };
  });
}

export function publishCustomerDisplay(payload: CustomerDisplayPayload) {
  const now = Date.now();
  if (payload.mode === 'thanks') {
    if (thanksTimer) {
      clearTimeout(thanksTimer);
    }
    thanksUntil = now + THANKS_MS;
    emitPayload(payload);
    void native?.update(payload).catch(() => {});
    thanksTimer = setTimeout(() => {
      thanksTimer = null;
      thanksUntil = 0;
      publishCustomerDisplay(
        buildIdleCustomerDisplay(payload.companyName, payload.companyLogo),
      );
    }, THANKS_MS);
    return;
  }

  if (payload.mode === 'idle' && now < thanksUntil) {
    return;
  }

  if (
    thanksTimer &&
    (payload.mode === 'cart' || payload.mode === 'paying')
  ) {
    clearTimeout(thanksTimer);
    thanksTimer = null;
    thanksUntil = 0;
  }

  emitPayload(payload);
  void native?.update(payload).catch(() => {});
}

export function subscribeCustomerDisplay(
  listener: (payload: CustomerDisplayPayload) => void,
): () => void {
  listener(latestPayload);
  const sub = DeviceEventEmitter.addListener(PAYLOAD_EVENT, listener);
  return () => sub.remove();
}

export async function getCustomerDisplayStatus(): Promise<CustomerDisplayStatus> {
  if (!native) {
    return {
      hasSecondaryDisplay: false,
      attached: false,
      displayId: -1,
      displayName: '',
    };
  }
  try {
    return await native.getStatus();
  } catch {
    return {
      hasSecondaryDisplay: false,
      attached: false,
      displayId: -1,
      displayName: '',
    };
  }
}

export async function showCustomerDisplay(): Promise<CustomerDisplayStatus> {
  if (!native) {
    return getCustomerDisplayStatus();
  }
  try {
    const status = await native.show();
    void native.update(latestPayload).catch(() => {});
    return status;
  } catch {
    return getCustomerDisplayStatus();
  }
}

export function subscribeCustomerDisplayStatus(
  listener: (status: CustomerDisplayStatus) => void,
): () => void {
  const sub = DeviceEventEmitter.addListener(STATUS_EVENT, listener);
  return () => sub.remove();
}
