import type {ItemJournalLine} from './ItemJournalListItem';

export function normalizeLine(raw: Record<string, unknown>): ItemJournalLine | null {
  const id = raw.id;
  if (typeof id !== 'number') {
    return null;
  }
  const item = raw.item;
  const itemStr =
    typeof item === 'string' ? item : typeof item === 'number' ? String(item) : '';

  const rawUom = raw.item_unit_of_measure;
  let item_unit_of_measure: number | null = null;
  if (typeof rawUom === 'number' && Number.isFinite(rawUom)) {
    item_unit_of_measure = rawUom;
  } else if (
    rawUom &&
    typeof rawUom === 'object' &&
    typeof (rawUom as {id?: unknown}).id === 'number'
  ) {
    item_unit_of_measure = (rawUom as {id: number}).id;
  }

  let unit_of_measure_code = '';
  const detail = raw.unit_of_measure_detail;
  if (detail && typeof detail === 'object') {
    const code = (detail as {unit_of_measure?: unknown}).unit_of_measure;
    if (code != null) {
      unit_of_measure_code = String(code);
    }
  }

  return {
    id,
    system_id: String(raw.system_id ?? ''),
    item: itemStr,
    item_name: String(raw.item_name ?? ''),
    entry_type: String(raw.entry_type ?? ''),
    document_no: String(raw.document_no ?? ''),
    description: String(raw.description ?? ''),
    quantity: Number(raw.quantity ?? 0),
    unit_cost:
      raw.unit_cost === null || raw.unit_cost === undefined
        ? null
        : Number(raw.unit_cost),
    date: String(raw.date ?? ''),
    status: String(raw.status ?? ''),
    item_unit_of_measure,
    unit_of_measure_code,
  };
}
