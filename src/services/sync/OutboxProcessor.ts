import {
  countPendingOutbox,
  enqueueOutbox,
  getOrCreateDeviceId,
  listPendingOutbox,
  updateOutboxStatus,
  updateLocalSaleSynced,
} from '../../db/sqlite';
import SyncApi from './SyncApi';
import {resolveEffectiveBranchDimensionId} from '../../utils/effectiveBranch';

type OutboxListener = (count: number) => void;
let outboxListener: OutboxListener | null = null;

export function setOutboxCountListener(listener: OutboxListener | null) {
  outboxListener = listener;
}

export async function refreshOutboxCount() {
  const count = await countPendingOutbox();
  outboxListener?.(count);
  return count;
}

export async function queueSaleCompleted(
  payload: Record<string, unknown>,
  meta: {local_id: string; system_id: string},
) {
  const {randomUUID} = await import('../../utils/randomUuid');
  const eventId = randomUUID();
  await enqueueOutbox(eventId, 'SALE_COMPLETED', {
    ...payload,
    system_id: meta.system_id,
    local_id: meta.local_id,
  });
  await refreshOutboxCount();
  return eventId;
}

export type EventPushOutcome = {
  event_id: string;
  local_id?: string;
  ok: boolean;
  error?: string;
  invoice_no?: string;
  server_sale_id?: number;
};

export async function drainOutbox(): Promise<{
  pushed: number;
  failed: number;
  errors: string[];
  outcomes: EventPushOutcome[];
}> {
  const deviceId = await getOrCreateDeviceId();
  const branchId = await resolveEffectiveBranchDimensionId();
  const pending = await listPendingOutbox();
  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];
  const outcomes: EventPushOutcome[] = [];

  if (!pending.length) {
    await refreshOutboxCount();
    return {pushed, failed, errors, outcomes};
  }

  const {results} = await SyncApi.push(
    deviceId,
    pending.map(row => ({
      event_id: row.event_id,
      event_type: row.event_type,
      payload: row.payload,
    })),
    branchId,
  );

  for (const result of results || []) {
    const eventId = result.event_id;
    const payload = pending.find(p => p.event_id === eventId)?.payload;
    const localId =
      result.local_id ||
      (payload?.local_id ? String(payload.local_id) : undefined);

    if (result.ok !== false && !result.error) {
      await updateOutboxStatus(eventId, 'synced');
      if (localId) {
        await updateLocalSaleSynced(localId, {
          server_sale_id: result.server_sale_id,
          invoice_no: result.invoice_no,
        });
      }
      pushed += 1;
      outcomes.push({
        event_id: eventId,
        local_id: localId,
        ok: true,
        invoice_no: result.invoice_no,
        server_sale_id: result.server_sale_id,
      });
    } else {
      const errMsg = result.error || 'Push failed';
      await updateOutboxStatus(eventId, 'failed', errMsg);
      errors.push(errMsg);
      failed += 1;
      outcomes.push({
        event_id: eventId,
        local_id: localId,
        ok: false,
        error: errMsg,
      });
    }
  }

  await refreshOutboxCount();
  return {pushed, failed, errors, outcomes};
}
