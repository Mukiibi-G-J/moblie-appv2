import {
  getAllCustomers,
  getAllItems,
  getAllPaymentMethods,
  getCustomerCount,
  getPaymentMethodCount,
  type LocalItem,
} from '../db/sqlite';
import type {Customer, PaymentMethod} from '../app.services';
import {triggerEmptyCatalogSyncInBackground} from './sync/backgroundCatalogSync';
import {getEffectiveIsOnline} from '../utils/posConnectivity';

function triggerHydrationIfOnlineAndEmpty(
  kind: 'customers' | 'paymentMethods',
  count: number,
) {
  if (!getEffectiveIsOnline() || count > 0) {
    return;
  }
  triggerEmptyCatalogSyncInBackground();
}

export async function searchItems(query: string): Promise<LocalItem[]> {
  if (!query.trim()) return [];
  const allItems = await getAllItems();
  const lowerQuery = query.toLowerCase();
  return allItems.filter(item => {
    const nameMatch = item.item_name?.toLowerCase().includes(lowerQuery);
    const barcodeMatch = item.bar_code_no?.toLowerCase().includes(lowerQuery);
    const noMatch = item.no?.toLowerCase().includes(lowerQuery);
    return nameMatch || barcodeMatch || noMatch;
  });
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const allCustomers = await getAllCustomers();
  if (!query.trim()) return allCustomers;
  const lowerQuery = query.toLowerCase();
  return allCustomers.filter(customer => {
    const c = customer as Record<string, unknown>;
    const nameMatch = String(c.name ?? '')
      .toLowerCase()
      .includes(lowerQuery);
    const phoneMatch = String(c.phone_number ?? c.phone ?? '')
      .toLowerCase()
      .includes(lowerQuery);
    const noMatch = String(c.no ?? '')
      .toLowerCase()
      .includes(lowerQuery);
    return nameMatch || phoneMatch || noMatch;
  });
}

export async function localItems(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{results: LocalItem[]; count: number}> {
  const allItems = await getAllItems();
  let filtered = allItems;

  if (params?.q) {
    const lowerQuery = params.q.toLowerCase();
    filtered = allItems.filter(item => {
      const nameMatch = item.item_name?.toLowerCase().includes(lowerQuery);
      const barcodeMatch = item.bar_code_no?.toLowerCase().includes(lowerQuery);
      const noMatch = item.no?.toLowerCase().includes(lowerQuery);
      return nameMatch || barcodeMatch || noMatch;
    });
  }

  const total = filtered.length;
  if (params?.page && params?.pageSize) {
    const start = (params.page - 1) * params.pageSize;
    filtered = filtered.slice(start, start + params.pageSize);
  }

  return {results: filtered, count: total};
}

export async function localItemById(id: string): Promise<LocalItem | null> {
  const allItems = await getAllItems();
  return (
    allItems.find(item => item.system_id === id || item.no === id) || null
  );
}

export async function getLocalPaymentMethods(): Promise<PaymentMethod[]> {
  const count = await getPaymentMethodCount();
  triggerHydrationIfOnlineAndEmpty('paymentMethods', count);
  const methods = await getAllPaymentMethods();
  if (!methods.length) {
    return [];
  }
  const {filterCollectablePaymentMethods} = await import(
    '../utils/paymentMethodDefaults'
  );
  return filterCollectablePaymentMethods(methods);
}

export async function getLocalCustomers(): Promise<Customer[]> {
  const count = await getCustomerCount();
  triggerHydrationIfOnlineAndEmpty('customers', count);
  return getAllCustomers();
}
