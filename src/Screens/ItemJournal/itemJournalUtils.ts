import type {ItemJournalLine} from './ItemJournalListItem';

export function normalizeLine(raw: Record<string, unknown>): ItemJournalLine | null {
  const id = typeof raw.id === 'number' ? raw.id : Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  const item = raw.item;
  const itemFromObject =
    item && typeof item === 'object'
      ? String(
          (item as {no?: unknown; item_no?: unknown}).no ??
            (item as {item_no?: unknown}).item_no ??
            '',
        )
      : '';
  const itemStr = (
    typeof item === 'string'
      ? item
      : typeof item === 'number'
        ? String(item)
        : itemFromObject || String(raw.item_no ?? raw.item__no ?? '')
  ).trim();

  const itemNameFromObject =
    item && typeof item === 'object'
      ? String((item as {item_name?: unknown}).item_name ?? '')
      : '';
  const item_name = String(
    raw.item_name ??
      raw.item__item_name ??
      itemNameFromObject ??
      raw.description ??
      '',
  ).trim();

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
  if (!unit_of_measure_code) {
    unit_of_measure_code = String(
      raw.unit_of_measure_code ??
        raw.item_unit_of_measure__unit_of_measure__code ??
        '',
    );
  }

  const unitCostRaw = raw.unit_cost ?? raw.unit_amount;

  return {
    id,
    system_id: String(raw.system_id ?? raw.SystemId ?? ''),
    item: itemStr,
    item_name,
    entry_type: String(raw.entry_type ?? ''),
    document_no: String(raw.document_no ?? ''),
    description: String(raw.description ?? ''),
    quantity: Number(raw.quantity ?? 0),
    unit_cost:
      unitCostRaw === null || unitCostRaw === undefined
        ? null
        : Number(unitCostRaw),
    date: String(raw.date ?? ''),
    status: String(raw.status ?? ''),
    item_unit_of_measure,
    unit_of_measure_code,
  };
}
