import type {AxiosError} from 'axios';

export type SubscriptionExpiryKind = 'trial' | 'subscription';

export type SubscriptionExpiredPayload = {
  expiryKind: SubscriptionExpiryKind;
  lockDate: string | null;
  detail?: string | null;
};

/** Backend 402 payload when trial/subscription access is locked. */
export function isSubscriptionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const ax = error as AxiosError<{code?: string}>;
  const status = ax.response?.status;
  const code = ax.response?.data?.code;
  return status === 402 || code === 'subscription_expired';
}

/** Parse expiry_kind / lock_date from a 402 response (web BaseService parity). */
export function getSubscriptionExpiredPayload(
  error: unknown,
): SubscriptionExpiredPayload {
  const ax = error as AxiosError<{
    expiry_kind?: string;
    lock_date?: string | null;
    detail?: string;
  }>;
  const data = ax?.response?.data;
  return {
    expiryKind: data?.expiry_kind === 'trial' ? 'trial' : 'subscription',
    lockDate: data?.lock_date ?? null,
    detail: data?.detail ?? null,
  };
}
