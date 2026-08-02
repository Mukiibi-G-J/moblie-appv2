import {
  applyBootstrapItems,
  saveCustomers,
  savePaymentMethods,
  saveBootstrapCache,
  setSyncMeta,
  getSyncMeta,
  type LocalItem,
} from '../../db/sqlite';
import {saveBranchesFromSetupPayload} from './branchCatalogSync';
import SyncApi from './SyncApi';
import {getOrCreateDeviceId} from '../../db/sqlite';
import {resolveEffectiveBranchDimensionId} from '../../utils/effectiveBranch';

export async function runBootstrap() {
  const deviceId = await getOrCreateDeviceId();
  const branchId = await resolveEffectiveBranchDimensionId();
  const data = await SyncApi.bootstrap(deviceId, branchId);

  const items = (data.items || []) as LocalItem[];
  const itemOnHand = data.item_on_hand || [];
  await applyBootstrapItems(items, itemOnHand);

  if (data.customers?.length) {
    await saveCustomers(data.customers);
  }
  if (data.payment_methods?.length) {
    await savePaymentMethods(data.payment_methods);
  }

  await saveBootstrapCache({
    sales_setup: data.sales_setup,
    company_info: data.company_info,
  });

  if (data.cursor) {
    await setSyncMeta('last_pull_cursor', String(data.cursor));
  }

  if (data.sales_setup?.branch_values?.length) {
    await saveBranchesFromSetupPayload(data.sales_setup);
  }

  return data;
}

export async function runIncrementalPull() {
  const since =
    (await getSyncMeta('last_pull_cursor')) || '1970-01-01T00:00:00Z';
  const changes = await SyncApi.pullChanges(since);
  const branchId = await resolveEffectiveBranchDimensionId();

  const itemsBlock = changes.items;
  if (itemsBlock?.results?.length) {
    await applyBootstrapItems(
      itemsBlock.results,
      itemsBlock.results.map((item: Record<string, unknown>) => ({
        item_system_id: String(item.system_id),
        branch_id: branchId,
        quantity: Number(item.inventory ?? 0),
        item_no: String(item.no ?? ''),
      })),
    );
  }

  const customersBlock = changes.customers;
  if (customersBlock?.results?.length) {
    await saveCustomers(customersBlock.results);
  }

  const pmBlock = changes.payment_methods;
  if (pmBlock?.results?.length) {
    await savePaymentMethods(pmBlock.results);
  }

  if (changes.cursor) {
    await setSyncMeta('last_pull_cursor', String(changes.cursor));
  }
}
