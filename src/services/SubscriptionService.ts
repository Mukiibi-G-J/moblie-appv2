/**
 * Subscription-related API calls.
 * Endpoints in /api/company/subscription/ are not blocked by subscription check.
 * See: todo/subscription-expired-mobile-handling.md
 */

import {createAxiosInstance} from '../axios/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobileMoneyInstructions {
  mobile_money_number: string;
  mobile_money_numbers?: string[];
  account_name: string;
  instructions: string;
  has_pending_verification?: boolean;
  pending_payment_reference?: string;
  has_active_subscription?: boolean;
}

export async function getMobileMoneyInstructions(): Promise<MobileMoneyInstructions | null> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.get<MobileMoneyInstructions>(
      '/api/company/subscription/mobile-money-instructions/',
    );
    return response.data;
  } catch (error) {
    console.warn('getMobileMoneyInstructions failed:', error);
    return null;
  }
}

export interface PricingPlan {
  id: number;
  name?: string;
  description?: string;
  // Backend field names vary; we treat price as a best-effort numeric value.
  price?: number;
  monthly_price?: number;
  yearly_price?: number;
}

export interface AddOn {
  id: number;
  name?: string;
  price?: number;
  monthly_price?: number;
  yearly_price?: number;
}

function pickNumber(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function extractList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data?.results && Array.isArray(data.results)) return data.results as T[];
  return [];
}

export async function getPricingPlans(): Promise<PricingPlan[]> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.get<any>('/api/company/pricing-plans/');
    return extractList<any>(response.data).map((p: any) => ({
      id: Number(p.id),
      name: p.name ?? p.plan_name ?? p.title,
      description: p.description ?? p.detail ?? undefined,
      price: pickNumber(p.price),
      monthly_price: pickNumber(p.monthly_price),
      yearly_price: pickNumber(p.yearly_price),
    }));
  } catch (error) {
    console.warn('getPricingPlans failed:', error);
    return [];
  }
}

export async function getAddOns(): Promise<AddOn[]> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.get<any>('/api/company/add-ons/');
    return extractList<any>(response.data).map((a: any) => ({
      id: Number(a.id),
      name: a.name ?? a.add_on_name ?? a.title,
      price: pickNumber(a.price),
      monthly_price: pickNumber(a.monthly_price),
      yearly_price: pickNumber(a.yearly_price),
    }));
  } catch (error) {
    console.warn('getAddOns failed:', error);
    return [];
  }
}

export async function createManualPayment(params: {
  plan_id: number;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  months: number;
  reference: string;
}): Promise<any | null> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.post(
      '/api/company/subscription/create-manual-payment/',
      params,
    );
    return response.data;
  } catch (error) {
    console.warn('createManualPayment failed:', error);
    return null;
  }
}

export async function createExtraUsersPayment(params: {
  extra_users_count: number;
  reference: string;
}): Promise<any | null> {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant);
    const response = await axiosInstance.post(
      '/api/company/subscription/create-extra-users-payment/',
      params,
    );
    return response.data;
  } catch (error) {
    console.warn('createExtraUsersPayment failed:', error);
    return null;
  }
}
