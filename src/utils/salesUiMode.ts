/** POS vs phone sales UI preference (User Setup + local override). */

export type SalesUiMode = 'pos' | 'phone';

export function normalizeSalesUiMode(value: unknown): SalesUiMode {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (
    raw === 'pos' ||
    raw === 'desktop' ||
    raw === 'point of sale' ||
    raw === 'point_of_sale' ||
    raw === 'point-of-sale'
  ) {
    return 'pos';
  }
  return 'phone';
}

export function salesUiStorageKey(
  userId: string | number | null | undefined,
): string {
  if (userId == null || String(userId).trim() === '') {
    return 'sales_ui_mode:anon';
  }
  return `sales_ui_mode:${userId}`;
}
