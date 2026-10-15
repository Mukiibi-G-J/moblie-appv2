/**
 * Shop-owner Balance Sheet labels (mirrors backend balance_sheet_labels.py).
 * Used as a fallback when the API still returns Chart of Accounts names.
 */

const FRIENDLY_BY_NO: Record<string, string> = {
  '1002': 'What you own',
  '1003': 'Property and equipment',
  '1005': 'Buildings, vehicles, and equipment',
  '1110': 'Land and buildings',
  '1310': 'Vehicles',
  '1395': 'Total buildings, vehicles, and equipment',
  '1999': 'Total property and equipment',
  '2000': 'Cash, stock, and money owed to you',
  '2100': 'Stock',
  '2110': 'Stock for sale',
  '2140': 'Goods being made',
  '2190': 'Total stock',
  '2300': 'Money customers owe you',
  '2310': 'Money customers owe you',
  '2390': 'Total money customers owe you',
  '2900': 'Cash and bank',
  '2910': 'Cash',
  '2920': 'Bank',
  '2930': 'Mobile money',
  '2990': 'Total cash and bank',
  '2995': 'Total cash, stock, and money owed to you',
  '2999': 'Total what you own',
  '3100': 'Your money in the business',
  '3110': "Owner's capital",
  '3120': 'Saved profits',
  '3195': 'Profit this year',
  '3199': 'Total your money in the business',
  '5000': 'What you owe',
  '5100': 'Long-term loans',
  '5110': 'Bank loans',
  '5290': 'Total long-term loans',
  '5300': 'Bills due soon',
  '5310': 'Credit line',
  '5350': 'Customer deposits',
  '5360': 'Customer deposits (no VAT)',
  '5390': 'Total customer deposits',
  '5400': 'Money you owe suppliers',
  '5410': 'Money you owe suppliers',
  '5490': 'Total money you owe suppliers',
  '5600': 'VAT',
  '5780': 'VAT to pay',
  '5790': 'Total VAT',
  '5995': 'Total bills due soon',
  '5997': 'Total what you owe',
  CURRENT_PROFIT: 'Money made this period (Profit or Loss)',
};

const FRIENDLY_BY_NAME: Record<string, string> = {
  assets: 'What you own',
  'fixed assets': 'Property and equipment',
  'resale items': 'Stock for sale',
  'wip account finished goods': 'Goods being made',
  inventory: 'Stock',
  'accounts receivable': 'Money customers owe you',
  'customers domestic': 'Money customers owe you',
  'liquid assets': 'Cash and bank',
  'bank lcy': 'Bank',
  'mobile money accounts': 'Mobile money',
  'stockholders equity': 'Your money in the business',
  "stockholder's equity": 'Your money in the business',
  'capital stock': "Owner's capital",
  'retained earnings': 'Saved profits',
  'net income for the year': 'Profit this year',
  liabilities: 'What you owe',
  'long term liabilities': 'Long-term loans',
  'long-term liabilities': 'Long-term loans',
  'long term bank loans': 'Bank loans',
  'long-term bank loans': 'Bank loans',
  'short term liabilities': 'Bills due soon',
  'short-term liabilities': 'Bills due soon',
  'revolving credit': 'Credit line',
  'sales prepayments': 'Customer deposits',
  'customer prepayments vat 0%': 'Customer deposits (no VAT)',
  'accounts payable': 'Money you owe suppliers',
  'vendors domestic': 'Money you owe suppliers',
  'vat payable': 'VAT to pay',
  'current period profit loss': 'Money made this period (Profit or Loss)',
  'current period profit/loss': 'Money made this period (Profit or Loss)',
};

const normalizeName = (name: string) =>
  name
    .replace(/[^\w%]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export function friendlyBalanceSheetName(
  no?: string | null,
  name?: string | null,
): string {
  const accountNo = String(no || '').trim();
  if (accountNo && FRIENDLY_BY_NO[accountNo]) {
    return FRIENDLY_BY_NO[accountNo];
  }
  const original = String(name || '').trim();
  const key = normalizeName(original);
  if (key && FRIENDLY_BY_NAME[key]) {
    return FRIENDLY_BY_NAME[key];
  }
  return original || accountNo || 'Account';
}
