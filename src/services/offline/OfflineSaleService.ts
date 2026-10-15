import {
  getAllBranches,
  getOrCreateDeviceId,
  listPendingOutbox,
  saveLocalSale,
} from '../../db/sqlite';
import {
  buildSalesInvoicePayload,
  cartItemToLine,
  type CartLineForPayload,
} from '../../utils/buildSalesInvoicePayload';
import {queueSaleCompleted} from '../sync/OutboxProcessor';
import {runSyncCycle} from '../sync/SyncEngine';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import {resolveEffectiveBranchDimensionId} from '../../utils/effectiveBranch';
import {randomUUID} from '../../utils/randomUuid';
import type {CartItem} from '../../@types/types.dto';
import AsyncStorage from '@react-native-async-storage/async-storage';

let receiptSeq = 1;

export type SaleSyncStatus = 'posted' | 'pending' | 'failed';

export interface CompleteOfflineSaleResult {
  localId: string;
  systemId: string;
  receiptNo: string;
  payload: ReturnType<typeof buildSalesInvoicePayload>;
  syncStatus: SaleSyncStatus;
  syncError?: string;
  serverInvoiceNo?: string;
  pendingSync: boolean;
}

async function resolveBranchLabel(branchId: number | null): Promise<{
  id: number | null;
  name: string | null;
}> {
  if (branchId == null) return {id: null, name: null};
  const branches = await getAllBranches();
  const match = branches.find(b => b.id === branchId);
  if (match) {
    return {id: match.id, name: match.description || match.code};
  }
  try {
    const raw = await AsyncStorage.getItem('branch.active_branch');
    if (raw) {
      const parsed = JSON.parse(raw) as {id?: number; description?: string; code?: string};
      if (parsed.id === branchId) {
        return {
          id: branchId,
          name: parsed.description || parsed.code || null,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {id: branchId, name: null};
}

async function resolveSyncStatusFromOutbox(
  eventId: string,
  localId: string,
): Promise<
  Pick<CompleteOfflineSaleResult, 'syncStatus' | 'syncError' | 'serverInvoiceNo'>
> {
  const pending = await listPendingOutbox();
  const row = pending.find(
    r => r.event_id === eventId || r.payload?.local_id === localId,
  );
  if (!row) {
    return {syncStatus: 'posted'};
  }
  if (row.status === 'failed') {
    return {
      syncStatus: 'failed',
      syncError: row.last_error || 'Sync failed',
    };
  }
  return {syncStatus: 'pending'};
}

export async function completeOfflineSale(options: {
  cartItems: CartItem[];
  customerName: string;
  customerId?: number | null;
  paymentMethodId?: number | null;
  amountReceived: number;
  changeAmount: number;
  documentDate?: string;
  transactionId?: string | null;
}): Promise<CompleteOfflineSaleResult> {
  const localId = randomUUID();
  const systemId = randomUUID();
  await getOrCreateDeviceId();
  const shortDevice = (await getOrCreateDeviceId()).slice(0, 8);
  const receiptNo = `OFF-${shortDevice}-${receiptSeq++}`;

  const lines: CartLineForPayload[] = options.cartItems.map(cartItemToLine);

  const payload = buildSalesInvoicePayload({
    systemId,
    customerId: options.customerId,
    customerName: options.customerName,
    paymentMethodId: options.paymentMethodId,
    amountReceived: options.amountReceived,
    changeAmount: options.changeAmount,
    lines,
    documentDate: options.documentDate,
    transactionId: options.transactionId,
  });

  const total = options.cartItems.reduce(
    (s, l) => s + l.unit_price * l.quantity,
    0,
  );

  const branchId = await resolveEffectiveBranchDimensionId();
  const branch = await resolveBranchLabel(branchId);

  await saveLocalSale({
    local_id: localId,
    system_id: systemId,
    receipt_no: receiptNo,
    customer_name: options.customerName,
    total_amount: total,
    payload: {...payload, local_id: localId},
    lines: payload.lines as Record<string, unknown>[],
    branch_id: branch.id,
    branch_name: branch.name,
  });

  const eventId = await queueSaleCompleted(
    {...payload, local_id: localId},
    {local_id: localId, system_id: systemId},
  );

  const online = getEffectiveIsOnline();
  let syncStatus: SaleSyncStatus = 'pending';
  let syncError: string | undefined;
  let serverInvoiceNo: string | undefined;

  if (online) {
    try {
      const cycle = await runSyncCycle();
      if (cycle.skipped) {
        syncStatus = 'pending';
      } else {
        const outcomes = cycle.pushResult?.outcomes ?? [];
        const outcome = outcomes.find(o => o.event_id === eventId);
        if (outcome?.ok) {
          syncStatus = 'posted';
          serverInvoiceNo = outcome.invoice_no;
        } else if (outcome && !outcome.ok) {
          syncStatus = 'failed';
          syncError = outcome.error || 'Sync failed';
        } else {
          const fromOutbox = await resolveSyncStatusFromOutbox(eventId, localId);
          syncStatus = fromOutbox.syncStatus;
          syncError = fromOutbox.syncError;
          serverInvoiceNo = fromOutbox.serverInvoiceNo;
        }
      }
    } catch (error: unknown) {
      const fromOutbox = await resolveSyncStatusFromOutbox(eventId, localId);
      syncStatus = fromOutbox.syncStatus === 'posted' ? 'failed' : fromOutbox.syncStatus;
      syncError =
        fromOutbox.syncError ||
        (error instanceof Error ? error.message : 'Sync failed');
    }
  }

  return {
    localId,
    systemId,
    receiptNo,
    payload,
    syncStatus,
    syncError,
    serverInvoiceNo,
    pendingSync: syncStatus !== 'posted',
  };
}
