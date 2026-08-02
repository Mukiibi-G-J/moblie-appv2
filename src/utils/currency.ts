export const DEFAULT_LOCAL_CURRENCY_CODE = 'UGX';

let _localCurrencyCode = DEFAULT_LOCAL_CURRENCY_CODE;

export type CurrencyOption = {
  value: string;
  label: string;
};

export function setLocalCurrencyCode(code: string | undefined | null): void {
  const normalized = code?.trim()?.toUpperCase();
  _localCurrencyCode = normalized || DEFAULT_LOCAL_CURRENCY_CODE;
}

export function getLocalCurrencyCode(): string {
  return _localCurrencyCode;
}

export function formatCurrencyLabel(prefix: string, code?: string): string {
  const currencyCode = (code || getLocalCurrencyCode()).toUpperCase();
  return `${prefix} (${currencyCode})`;
}

function parseAmount(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined) {
    return 0;
  }
  const parsed =
    typeof amount === 'string' ? Number.parseFloat(amount) : Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  options?: {includeSymbol?: boolean; currencyCode?: string},
): string {
  const value = parseAmount(amount);
  const currencyCode = (
    options?.currencyCode || getLocalCurrencyCode()
  ).toUpperCase();
  const includeSymbol = options?.includeSymbol !== false;

  if (!includeSymbol) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toLocaleString('en-US')}`;
  }
}

export function formatCurrencyCompact(
  amount: number | string | null | undefined,
  options?: {currencyCode?: string},
): string {
  const value = parseAmount(amount);
  const currencyCode = (
    options?.currencyCode || getLocalCurrencyCode()
  ).toUpperCase();
  return `${currencyCode} ${Math.round(value).toLocaleString('en-US')}`;
}

export function mapCurrenciesToOptions(
  entries: {code: string; name: string}[],
): CurrencyOption[] {
  return entries.map(entry => ({
    value: entry.code.toUpperCase(),
    label: `${entry.code.toUpperCase()}: ${entry.name}`,
  }));
}
