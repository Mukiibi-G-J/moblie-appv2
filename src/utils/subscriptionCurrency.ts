/** SaaS catalog display helpers. Payment always charged in UGX. */

export const SUBSCRIPTION_UGX_PER_USD = 3700;

export type SubscriptionDisplayCurrency = 'UGX' | 'USD';

export function formatSubscriptionPrice(
  amountUgx: number,
  currency: SubscriptionDisplayCurrency,
  rate = SUBSCRIPTION_UGX_PER_USD,
): string {
  if (currency === 'USD') {
    const usd = !Number.isFinite(amountUgx) || rate <= 0 ? 0 : amountUgx / rate;
    return `$${usd.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `UGX ${Math.round(amountUgx || 0).toLocaleString('en-UG')}`;
}
