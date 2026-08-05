import type {
  CartItem,
  SelectedTrackingDetails,
  TrackingCodeRequirement,
} from '../@types/types.dto';

export type RawLedgerEntry = {
  lot_no?: string;
  serial_no?: string;
  remaining_quantity?: number;
  document_no?: string;
  entry_type?: string;
  document_type?: string;
  expiry_date?: string;
  open?: boolean;
};

export type TrackingLotOption = {
  /** Lot number (lot mode) or serial number (serial mode). */
  lot_no: string;
  serial_no?: string;
  remaining_quantity: number;
  expiry_date?: string;
  document_no?: string;
};

export function normalizeTrackingCode(
  raw: unknown,
): TrackingCodeRequirement | null {
  if (!raw) {
    return null;
  }
  let value: any = raw;
  if (Array.isArray(value)) {
    value = value.length > 0 ? value[0] : null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  return {
    system_id: value.system_id != null ? String(value.system_id) : undefined,
    code: value.code != null ? String(value.code) : undefined,
    description:
      value.description != null ? String(value.description) : undefined,
    require_serial_no: Boolean(value.require_serial_no),
    require_lot_no: Boolean(value.require_lot_no),
    require_expiry_date: Boolean(value.require_expiry_date),
  };
}

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

/** Match web Sales: only enforce lot/serial selection for inventory items. */
export function shouldEnforceTrackingSelection(item: CartItem): boolean {
  if (item.type && item.type !== 'Inventory') {
    return false;
  }
  return itemRequiresTracking(item);
}

export function itemRequiresLot(item: CartItem): boolean {
  return Boolean(item.tracking_code?.require_lot_no);
}

export function itemRequiresSerial(item: CartItem): boolean {
  return Boolean(item.tracking_code?.require_serial_no);
}

function isSalesOutboundEntry(entry: RawLedgerEntry): boolean {
  return (
    (entry.document_no && String(entry.document_no).startsWith('SIN-')) ||
    entry.entry_type === 'Sale' ||
    entry.document_type === 'Sales'
  );
}

export function buildFifoTrackingOptions(
  allEntries: RawLedgerEntry[],
): TrackingLotOption[] {
  const validEntries = allEntries
    .filter((entry: RawLedgerEntry) => {
      const hasLotNo = entry.lot_no && String(entry.lot_no).trim() !== '';
      const hasRemainingQty = (entry.remaining_quantity ?? 0) > 0;
      return hasLotNo && hasRemainingQty && !isSalesOutboundEntry(entry);
    })
    .map((entry: RawLedgerEntry) => ({
      lot_no: String(entry.lot_no).trim(),
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
    const lotKey = entry.lot_no.toUpperCase();
    if (!usedLots.has(lotKey)) {
      fifoEntries.push(entry);
      usedLots.add(lotKey);
    } else {
      const existingEntry = fifoEntries.find(
        e => e.lot_no.toUpperCase() === lotKey,
      );
      if (existingEntry) {
        existingEntry.remaining_quantity += entry.remaining_quantity;
        const existingDate = new Date(
          existingEntry.expiry_date || '9999-12-31',
        );
        const currentDate = new Date(entry.expiry_date || '9999-12-31');
        if (currentDate < existingDate) {
          existingEntry.expiry_date = entry.expiry_date;
          existingEntry.document_no = entry.document_no;
        }
      }
    }
  }

  return fifoEntries;
}

/** Available serials in stock — one option per serial (web POS parity). */
export function buildAvailableSerialOptions(
  allEntries: RawLedgerEntry[],
): TrackingLotOption[] {
  const bySerial = new Map<string, TrackingLotOption>();

  for (const entry of allEntries) {
    const serial = String(entry.serial_no || '').trim();
    if (!serial) {
      continue;
    }
    if ((entry.remaining_quantity ?? 0) <= 0) {
      continue;
    }
    if (isSalesOutboundEntry(entry)) {
      continue;
    }
    const key = serial.toUpperCase();
    const existing = bySerial.get(key);
    if (!existing) {
      bySerial.set(key, {
        lot_no: serial,
        serial_no: serial,
        document_no: entry.document_no,
        remaining_quantity: entry.remaining_quantity ?? 0,
        expiry_date: entry.expiry_date,
      });
    } else {
      existing.remaining_quantity += entry.remaining_quantity ?? 0;
    }
  }

  return Array.from(bySerial.values()).sort((a, b) =>
    a.lot_no.localeCompare(b.lot_no),
  );
}

export type CartTrackingValidation = {ok: true} | {ok: false; message: string};

export function validateCartTracking(cartItems: CartItem[]): CartTrackingValidation {
  const problems: string[] = [];

  for (const item of cartItems) {
    if (!shouldEnforceTrackingSelection(item)) {
      continue;
    }
    const tc = item.tracking_code;
    const labels: string[] = [];

    if (tc?.require_lot_no) {
      const lot = (item.selectedTrackingCode || '').trim();
      if (!lot) {
        labels.push('lot');
      }
    }

    if (tc?.require_serial_no) {
      const serials = Array.isArray(item.selectedSerialNos)
        ? item.selectedSerialNos.filter(s => String(s || '').trim())
        : [];
      const qty = Math.max(1, Number(item.quantity) || 1);
      if (serials.length !== qty) {
        labels.push(`serial (${serials.length}/${qty})`);
      }
    }

    if (labels.length) {
      problems.push(`${item.item_name} (${labels.join(', ')})`);
    }
  }

  if (problems.length === 0) {
    return {ok: true};
  }

  return {
    ok: false,
    message: `Select tracking for: ${problems.join('; ')}`,
  };
}

export function trackingDetailsFromOption(
  option: TrackingLotOption,
  mode: 'lot' | 'serial' = 'lot',
): SelectedTrackingDetails {
  if (mode === 'serial') {
    return {
      serialNo: option.serial_no || option.lot_no,
      expiryDate: option.expiry_date ?? null,
      code: option.serial_no || option.lot_no,
    };
  }
  return {
    lotNo: option.lot_no,
    expiryDate: option.expiry_date ?? null,
    code: option.lot_no,
  };
}
