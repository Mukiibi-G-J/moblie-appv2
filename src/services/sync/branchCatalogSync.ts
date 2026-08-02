import {
  getAllBranches,
  getBranchCount,
  saveBranches,
  setSyncMeta,
  type BranchRow,
} from '../../db/sqlite';
import {fetchSalesSetupBranchConfig} from '../branchProfile.service';
import {getEffectiveIsOnline} from '../../utils/posConnectivity';
import type {SyncProgressHandler} from './itemsSync';

const LAST_BRANCHES_SYNC_KEY = 'last_branches_sync_at';

let branchSyncInFlight: Promise<void> | null = null;

async function runBranchSync<T>(fn: () => Promise<T>): Promise<T> {
  if (branchSyncInFlight) {
    await branchSyncInFlight;
    throw new Error('A branch sync is already running.');
  }
  let release!: () => void;
  branchSyncInFlight = new Promise<void>(resolve => {
    release = resolve;
  });
  try {
    return await fn();
  } finally {
    release();
    branchSyncInFlight = null;
  }
}

export async function syncFullBranchesToLocal(options?: {
  force?: boolean;
  onProgress?: SyncProgressHandler;
}): Promise<{skipped: boolean; reason?: string; count?: number}> {
  const online = getEffectiveIsOnline();
  if (!online) {
    const cached = await getAllBranches();
    if (cached.length) {
      return {skipped: true, reason: 'offline', count: cached.length};
    }
    return {skipped: true, reason: 'offline'};
  }

  try {
    await runBranchSync(async () => {
      options?.onProgress?.('Downloading branches…', 5);
      const setup = await fetchSalesSetupBranchConfig();
      const branches: BranchRow[] = (setup.branch_values || []).map(b => ({
        id: b.id,
        code: b.code,
        description: b.description || b.code,
      }));
      if (branches.length) {
        await saveBranches(branches);
      }
      await setSyncMeta(LAST_BRANCHES_SYNC_KEY, new Date().toISOString());
      options?.onProgress?.(
        `Cached ${branches.length} branch${branches.length === 1 ? '' : 'es'}`,
        100,
      );
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already running')) {
      return {skipped: true, reason: 'already_running'};
    }
    const cached = await getAllBranches();
    if (cached.length) {
      return {skipped: true, reason: 'fetch_failed', count: cached.length};
    }
    throw err;
  }

  const count = await getBranchCount();
  return {skipped: false, count};
}

export function syncFullBranchesToLocalInBackground(): void {
  void syncFullBranchesToLocal().catch(err => {
    console.warn('[branchCatalogSync] background sync failed:', err);
  });
}

export async function saveBranchesFromSetupPayload(setup: unknown): Promise<number> {
  const values =
    (setup as {branch_values?: unknown[]})?.branch_values ??
    (setup as {data?: {branch_values?: unknown[]}})?.data?.branch_values ??
    [];
  const branches: BranchRow[] = Array.isArray(values)
    ? values
        .map((v: Record<string, unknown>) => ({
          id: Number(v.id),
          code: String(v.code ?? '').trim(),
          description: String(v.description ?? v.code ?? '').trim(),
        }))
        .filter(b => Number.isFinite(b.id) && b.code.length > 0)
    : [];
  if (branches.length) {
    await saveBranches(branches);
    await setSyncMeta(LAST_BRANCHES_SYNC_KEY, new Date().toISOString());
  }
  return branches.length;
}
