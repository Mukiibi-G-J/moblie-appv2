import {DeviceEventEmitter} from 'react-native';

export const POS_LOAD_UNPOSTED_EVENT = 'pos:loadUnpostedInvoice';

export type PosLoadUnpostedPayload = {
  invoiceId: number;
  /** Soft-delete the Open/Draft invoice after it is loaded into the cart. */
  deleteAfterLoad?: boolean;
};

let pendingLoad: PosLoadUnpostedPayload | null = null;

/** Queue a load for Cart (works even if Make Sale tab is not mounted yet). */
export function requestLoadUnpostedIntoPos(payload: PosLoadUnpostedPayload) {
  pendingLoad = payload;
  DeviceEventEmitter.emit(POS_LOAD_UNPOSTED_EVENT, payload);
}

export function takePendingPosLoad(): PosLoadUnpostedPayload | null {
  const next = pendingLoad;
  pendingLoad = null;
  return next;
}

export function peekPendingPosLoad(): PosLoadUnpostedPayload | null {
  return pendingLoad;
}
