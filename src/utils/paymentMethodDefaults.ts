export const TRANSACTION_ID_MAX_LENGTH = 100;
export const TRANSACTION_ID_REQUIRED_MESSAGE =
  'Transaction ID is required for this payment method.';

/** True only when the payment-method master flag is explicitly on. */
function isExplicitTrueFlag(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  return false;
}

export function paymentMethodRequiresTransactionId(
  method: {requires_transaction_id?: unknown} | null | undefined,
): boolean {
  return isExplicitTrueFlag(method?.requires_transaction_id);
}

export function withNormalizedTransactionIdFlag<
  T extends {requires_transaction_id?: unknown},
>(method: T): T & {requires_transaction_id: boolean} {
  return {
    ...method,
    requires_transaction_id: paymentMethodRequiresTransactionId(method),
  };
}

export function normalizeTransactionId(
  value: string | null | undefined,
): string {
  return String(value ?? '')
    .trim()
    .slice(0, TRANSACTION_ID_MAX_LENGTH);
}

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

const LEGACY_MOBILE_MONEY_CODES = new Set(['MOBILE_MONEY', 'MM']);

/** Credit / unpaid tender — not valid when collecting a payment. */
export function isUnpaidPaymentMethod(method: {
  code?: string | null;
  description?: string | null;
}): boolean {
  const code = String(method.code || '')
    .trim()
    .toUpperCase();
  if (code === 'NOT_PAID') {
    return true;
  }
  return /not\s*paid/i.test(String(method.description ?? ''));
}

/** Generic Mobile Money replaced by Airtel Money / MTN Money. */
export function isLegacyMobileMoneyMethod(method: {
  code?: string | null;
  description?: string | null;
}): boolean {
  const code = String(method.code || '')
    .trim()
    .toUpperCase();
  if (LEGACY_MOBILE_MONEY_CODES.has(code)) {
    return true;
  }
  const desc = String(method.description ?? '')
    .trim()
    .toLowerCase();
  return desc === 'mobile money';
}

/**
 * Methods allowed when recording / posting a customer payment (Quick Pay, POS).
 * Matches webV2 `filterCollectablePaymentMethods`.
 */
export function filterCollectablePaymentMethods<
  T extends {
    code?: string | null;
    description?: string | null;
    blocked?: boolean | null;
  },
>(methods: T[]): T[] {
  if (!Array.isArray(methods)) {
    return [];
  }
  return methods.filter(
    m =>
      !m.blocked &&
      !isUnpaidPaymentMethod(m) &&
      !isLegacyMobileMoneyMethod(m),
  );
}
