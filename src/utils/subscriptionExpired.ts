import type {AxiosError} from 'axios';

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
