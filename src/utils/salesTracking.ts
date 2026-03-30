import type {CartItem, SelectedTrackingDetails} from '../@types/types.dto';

export type RawLedgerEntry = {
  lot_no?: string;
  remaining_quantity?: number;
  document_no?: string;
  entry_type?: string;
  document_type?: string;
  expiry_date?: string;
};

export type TrackingLotOption = {
  lot_no: string;
  remaining_quantity: number;
  expiry_date?: string;
  document_no?: string;
};

export function itemRequiresTracking(item: CartItem): boolean {
  const tc = item.tracking_code;
  if (!tc) {
    return false;
  }
  return !!(
    tc.require_lot_no ||
    tc.require_serial_no ||
    tc.require_expiry_date
  );
}

/** Match web Sales: only enforce lot selection for inventory items. */
export function shouldEnforceTrackingSelection(item: CartItem): boolean {
  if (item.type && item.type !== 'Inventory') {
    return false;
  }
  return itemRequiresTracking(item);
}

export function buildFifoTrackingOptions(
  allEntries: RawLedgerEntry[],
): TrackingLotOption[] {
  const validEntries = allEntries
    .filter((entry: RawLedgerEntry) => {
      const hasLotNo = entry.lot_no && String(entry.lot_no).trim() !== '';
      const hasRemainingQty = (entry.remaining_quantity ?? 0) > 0;
      const isSalesEntry =
        (entry.document_no && String(entry.document_no).startsWith('SIN-')) ||
        entry.entry_type === 'Sale' ||
        entry.document_type === 'Sales';

      return hasLotNo && hasRemainingQty && !isSalesEntry;
    })
    .map((entry: RawLedgerEntry) => ({
      lot_no: String(entry.lot_no),
      document_no: entry.document_no,
      remaining_quantity: entry.remaining_quantity ?? 0,
      expiry_date: entry.expiry_date,
    }));

  const sortedEntries = [...validEntries].sort((a, b) => {
    const dateA = new Date(a.expiry_date || '9999-12-31');
    const dateB = new Date(b.expiry_date || '9999-12-31');
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    return (a.lot_no || '').localeCompare(b.lot_no || '');
  });

  const fifoEntries: TrackingLotOption[] = [];
  const usedLots = new Set<string>();

  for (const entry of sortedEntries) {
    const lotKey = entry.lot_no;
    if (!usedLots.has(lotKey)) {
      fifoEntries.push(entry);
      usedLots.add(lotKey);
    } else {
      const existingEntry = fifoEntries.find(e => e.lot_no === lotKey);
      if (existingEntry) {
        const existingDate = new Date(
          existingEntry.expiry_date || '9999-12-31',
        );
        const currentDate = new Date(entry.expiry_date || '9999-12-31');
        if (currentDate < existingDate) {
          const index = fifoEntries.findIndex(e => e.lot_no === lotKey);
          fifoEntries[index] = entry;
        }
      }
    }
  }

  return fifoEntries;
}

export type CartTrackingValidation = {ok: true} | {ok: false; message: string};

export function validateCartTracking(cartItems: CartItem[]): CartTrackingValidation {
  const missing = cartItems.filter(
    item =>
      shouldEnforceTrackingSelection(item) &&
      !(item.selectedTrackingCode && String(item.selectedTrackingCode).trim()),
  );

  if (missing.length === 0) {
    return {ok: true};
  }

  const labels = missing.map(item => {
    const tc = item.tracking_code;
    const reqs: string[] = [];
    if (tc?.require_lot_no) {
      reqs.push('lot');
    }
    if (tc?.require_serial_no) {
      reqs.push('serial');
    }
    if (tc?.require_expiry_date) {
      reqs.push('expiry');
    }
    return `${item.item_name} (${reqs.join(', ') || 'tracking'})`;
  });

  return {
    ok: false,
    message: `Select tracking (lot) for: ${labels.join('; ')}`,
  };
}

export function trackingDetailsFromOption(
  option: TrackingLotOption,
): SelectedTrackingDetails {
  return {
    lotNo: option.lot_no,
    expiryDate: option.expiry_date ?? null,
    code: option.lot_no,
  };
}
