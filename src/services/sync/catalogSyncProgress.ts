import {useEffect, useState} from 'react';
import type {SyncProgressHandler} from './itemsSync';

export type CatalogSliceId =
  | 'items'
  | 'customers'
  | 'payment_methods'
  | 'branches';

export type CatalogSliceStatus =
  | 'idle'
  | 'downloading'
  | 'done'
  | 'error'
  | 'skipped';

export type CatalogSliceState = {
  status: CatalogSliceStatus;
  message: string;
  percent?: number;
  saved?: number;
  total?: number;
};

export type CatalogSyncProgress = {
  active: boolean;
  slices: Record<CatalogSliceId, CatalogSliceState>;
};

const IDLE_SLICE: CatalogSliceState = {status: 'idle', message: ''};

const SLICE_IDS: CatalogSliceId[] = [
  'items',
  'customers',
  'payment_methods',
  'branches',
];

function emptySlices(): Record<CatalogSliceId, CatalogSliceState> {
  return {
    items: {...IDLE_SLICE},
    customers: {...IDLE_SLICE},
    payment_methods: {...IDLE_SLICE},
    branches: {...IDLE_SLICE},
  };
}

let state: CatalogSyncProgress = {
  active: false,
  slices: emptySlices(),
};

const listeners = new Set<(next: CatalogSyncProgress) => void>();

function snapshot(): CatalogSyncProgress {
  return {
    active: state.active,
    slices: {
      items: {...state.slices.items},
      customers: {...state.slices.customers},
      payment_methods: {...state.slices.payment_methods},
      branches: {...state.slices.branches},
    },
  };
}

function emit() {
  const next = snapshot();
  listeners.forEach(listener => listener(next));
}

function refreshActive() {
  state.active = SLICE_IDS.some(
    id => state.slices[id].status === 'downloading',
  );
}

function parseCachedCounts(message: string): {saved?: number; total?: number} {
  const match = message.match(/Cached\s+(\d+)(?:\s*\/\s*(\d+))?/i);
  if (!match) {
    return {};
  }
  return {
    saved: Number(match[1]),
    total: match[2] ? Number(match[2]) : undefined,
  };
}

export function getCatalogSyncProgress(): CatalogSyncProgress {
  return snapshot();
}

export function subscribeCatalogSyncProgress(
  listener: (next: CatalogSyncProgress) => void,
): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function beginCatalogSlice(
  slice: CatalogSliceId,
  message = 'Downloading…',
) {
  state.slices[slice] = {
    status: 'downloading',
    message,
    percent: 1,
  };
  refreshActive();
  emit();
}

export function updateCatalogSlice(
  slice: CatalogSliceId,
  message: string,
  percent?: number,
) {
  const parsed = parseCachedCounts(message);
  const previous = state.slices[slice];
  state.slices[slice] = {
    status: 'downloading',
    message,
    percent:
      typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : previous.percent,
    saved: parsed.saved ?? previous.saved,
    total: parsed.total ?? previous.total,
  };
  refreshActive();
  emit();
}

export function finishCatalogSlice(
  slice: CatalogSliceId,
  status: Exclude<CatalogSliceStatus, 'idle' | 'downloading'>,
  message: string,
) {
  const previous = state.slices[slice];
  state.slices[slice] = {
    ...previous,
    status,
    message,
    percent: status === 'done' ? 100 : previous.percent,
  };
  refreshActive();
  emit();
}

export function reportCatalogSlice(
  slice: CatalogSliceId,
  onProgress?: SyncProgressHandler,
): SyncProgressHandler {
  return (message, percent) => {
    updateCatalogSlice(slice, message, percent);
    onProgress?.(message, percent);
  };
}

export function useCatalogSyncProgress(): CatalogSyncProgress {
  const [progress, setProgress] = useState(getCatalogSyncProgress);
  useEffect(() => subscribeCatalogSyncProgress(setProgress), []);
  return progress;
}
