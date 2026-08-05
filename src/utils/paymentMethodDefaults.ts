/**
 * Prefer Cash CST (then CASH / description match) as the default POS tender.
 */
export function pickDefaultCashPaymentMethod<
  T extends {
    code?: string | null;
    description?: string | null;
    requires_amount_received?: boolean | null;
  },
>(methods: T[]): T | null {
  if (!Array.isArray(methods) || methods.length === 0) {
    return null;
  }
  const byCode = (code: string) =>
    methods.find(m => String(m.code || '').trim().toUpperCase() === code);

  return (
    byCode('CST') ??
    byCode('CASH') ??
    methods.find(m => /cash/i.test(String(m.description || ''))) ??
    methods.find(m => m.requires_amount_received) ??
    methods[0] ??
    null
  );
}
