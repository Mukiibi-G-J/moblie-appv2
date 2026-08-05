/**
 * Subscription / Marz collection APIs.
 * Payment gateway flow matches zentroapp-webV2 (initiate-collection + status poll).
 * Endpoints under /api/company/subscription/ bypass the 402 middleware.
 */

import {createAxiosInstance} from '../axios/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {USE_TEST_ENV} from '../config/api.config';

/** GET /api/company/overview/ — same payload as web Company page. */
export interface SubscriptionOverview {
  id: number;
  plan: string;
  status: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  trial_period_end_date?: string;
  is_paid?: boolean;
  payment_gateway?: string;
  billing_cycle?: string;
  is_trial_active?: boolean;
  is_active?: boolean;
  days_remaining: number;
  in_grace_period?: boolean;
  grace_days_remaining?: number | null;
  access_lock_date?: string | null;
  payment_due_date?: string | null;
}

export interface StarterPackOverview {
  has_starter_pack: boolean;
  message?: string;
  offer_name?: string;
  free_period_active?: boolean;
  free_period_days_remaining?: number;
  subscription_active?: boolean;
  subscription_days_remaining?: number;
  subscription_end_date?: string | null;
  free_period_end_date?: string | null;
  order_status?: string;
}

export interface CompanyOverview {
  subscription: SubscriptionOverview | null;
  starter_pack: StarterPackOverview;
  settings?: {
    localCurrencyCode: string;
  };
}

export type CollectionMethod = 'mobile_money' | 'card';
export type BillingCycle = 'monthly' | 'yearly';

export interface InitiateCollectionPayload {
  plan_id: number;
  months: number;
  billing_cycle: BillingCycle;
  method: CollectionMethod;
  phone_number?: string;
  /** Absolute URL — required for card (Marz return after gateway). */
  return_url?: string;
  /** Dev only: Marz charge in UGX (500–10_000_000). Ignored outside development. */
  test_amount_ugx?: number;
}

export interface InitiateCollectionResponse {
  billing_history_id: number;
  reference: string;
  status: string;
  amount: string;
  catalog_amount?: string;
  charged_amount?: string;
  test_mode?: boolean;
  product: string;
  method: CollectionMethod;
  redirect_url?: string | null;
  payment_type?: string | null;
  message?: string;
  error?: string;
}

export interface CollectionStatusResponse {
  reference: string;
  status:
    | 'pending'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'pending_verification'
    | string;
  amount: string;
  catalog_amount?: string;
  charged_amount?: string;
  test_mode?: boolean;
  product: string;
  method?: string;
  marz_status?: string | null;
  failure_reason?: string | null;
  failure_message?: string | null;
  subscription_active: boolean;
  billing_history_id: number;
}

export interface PricingPlan {
  id: number;
  name?: string;
  description?: string;
  price?: number;
  monthly_price?: number;
  yearly_price?: number;
  annual_price?: number;
  is_popular?: boolean;
}

function pickNumber(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return undefined;
}

function extractList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data?.results && Array.isArray(data.results)) return data.results as T[];
  return [];
}

async function tenantAxios() {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  return createAxiosInstance(tenant);
}

export async function getCompanyOverview(): Promise<CompanyOverview | null> {
  try {
    const axiosInstance = await tenantAxios();
    const response = await axiosInstance.get<CompanyOverview>(
      '/api/company/overview/',
    );
    return response.data;
  } catch (error) {
    console.warn('getCompanyOverview failed:', error);
    return null;
  }
}

/**
 * Current company subscription (bypasses 402 middleware).
 * Prefer this over overview when renewing after expiry.
 */
export async function getCurrentSubscription(): Promise<SubscriptionOverview | null> {
  try {
    const axiosInstance = await tenantAxios();
    const response = await axiosInstance.get<any>('/api/company/subscriptions/');
    const list = extractList<any>(response.data);
    const first = list[0];
    if (!first) return null;
    return {
      id: Number(first.id),
      plan: String(first.plan ?? ''),
      status: String(first.status ?? ''),
      subscription_start_date: first.subscription_start_date,
      subscription_end_date: first.subscription_end_date,
      trial_period_end_date: first.trial_period_end_date,
      is_paid: first.is_paid,
      payment_gateway: first.payment_gateway,
      billing_cycle: first.billing_cycle,
      is_trial_active: first.is_trial_active,
      is_active: first.is_active,
      days_remaining: Number(first.days_remaining ?? 0),
      in_grace_period: first.in_grace_period,
      grace_days_remaining: first.grace_days_remaining,
      access_lock_date: first.access_lock_date,
      payment_due_date: first.payment_due_date,
    };
  } catch (error) {
    console.warn('getCurrentSubscription failed:', error);
    return null;
  }
}

export async function getPricingPlans(): Promise<PricingPlan[]> {
  try {
    const axiosInstance = await tenantAxios();
    const response = await axiosInstance.get<any>(
      '/api/company/pricing-plans/',
    );
    return extractList<any>(response.data).map((p: any) => {
      const monthly = pickNumber(p.price) ?? pickNumber(p.monthly_price);
      const yearly =
        pickNumber(p.annual_price) ??
        pickNumber(p.yearly_price) ??
        pickNumber(p.annual_price_display);
      return {
        id: Number(p.id),
        name: p.name ?? p.plan_name ?? p.title,
        description: p.description ?? p.detail ?? undefined,
        price: monthly,
        monthly_price: monthly,
        yearly_price: yearly,
        annual_price: yearly,
        is_popular: !!p.is_popular,
      };
    });
  } catch (error) {
    console.warn('getPricingPlans failed:', error);
    return [];
  }
}

/** Start Marz collection (MoMo USSD prompt or card redirect). */
export async function initiateSubscriptionCollection(
  payload: InitiateCollectionPayload,
): Promise<InitiateCollectionResponse> {
  const axiosInstance = await tenantAxios();
  const body: InitiateCollectionPayload = {...payload};
  if (USE_TEST_ENV && body.test_amount_ugx == null) {
    body.test_amount_ugx = 500;
  }
  const response = await axiosInstance.post<InitiateCollectionResponse>(
    '/api/company/subscription/initiate-collection/',
    body,
  );
  return response.data;
}

/** Poll Marz / billing status for a collection reference. */
export async function getCollectionStatus(
  reference: string,
): Promise<CollectionStatusResponse> {
  const axiosInstance = await tenantAxios();
  const response = await axiosInstance.get<CollectionStatusResponse>(
    '/api/company/subscription/collection-status/',
    {params: {reference}},
  );
  return response.data;
}

/** Normalize Uganda phone to +256… (backend also normalizes). */
export function normalizeUgPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('256') && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return `+256${digits.slice(1, 10)}`;
  }
  if (digits.length === 9 && /^[7]/.test(digits)) {
    return `+256${digits}`;
  }
  if (phone.trim().startsWith('+') && digits.length >= 12) {
    return `+${digits}`;
  }
  return phone.trim();
}
