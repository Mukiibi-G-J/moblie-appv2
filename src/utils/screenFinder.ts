export type ScreenFinderItem = {
  key: string;
  label: string;
  section: string;
  keywords?: string;
};

/** Menu actions that are not screens. */
export const SCREEN_FINDER_SKIP_KEYS = new Set([
  'logout',
  'appearance',
  'support',
]);

const ROW_KEYWORDS: Record<string, string> = {
  salesHistory: 'invoices receipts posted sales',
  reports: 'financial reports',
  profitLoss: 'p and l pnl profit and loss income statement',
  balanceSheet: 'balance sheet assets liabilities',
  items: 'stock products catalog inventory',
  stockAdjustments: 'stock adjustment inventory journal adjust',
  openingBalance: 'opening stock balance',
  customers: 'clients debtors',
  suppliers: 'vendors creditors',
  purchases: 'purchase orders buying',
  expenses: 'expense spending',
  bankAccounts: 'bank cash accounts',
  quickPayment: 'pay payment quick pay',
  prepayments: 'deposits prepayment advance',
  restaurant: 'dining food service',
  companyBilling: 'billing business company details subscription',
  generalSetup:
    'general ledger setup gl setup g/l setup vat currency branches',
  userManagement: 'users staff roles',
  myProfile: 'profile account photo',
  syncQueue: 'sync offline queue outbox',
  settings: 'settings preferences printer print',
  printerConfig: 'printer print receipt bluetooth usb sunmi thermal',
  receiptLayout:
    'receipt layout template look design format slip how the receipt looks',
  nfcTest: 'nfc tap card',
  availableModules: 'modules plan subscription',
  'restaurant-pos': 'sale register order tables checks',
  'restaurant-printer': 'receipt printer print',
  'restaurant-orders': 'checks open orders service',
  'restaurant-kitchen': 'kds kitchen tickets display',
  'restaurant-dash': 'dashboard sales',
  'restaurant-tables': 'tables floor plan seating',
  'restaurant-res': 'bookings reservations',
  'restaurant-menus': 'menu builder items',
  'restaurant-settings': 'restaurant configuration',
};

export function keywordsForScreen(key: string): string {
  return ROW_KEYWORDS[key] ?? '';
}

function normalizeFinderText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterScreens<T extends ScreenFinderItem>(
  items: T[],
  query: string,
): T[] {
  const q = normalizeFinderText(query);
  if (!q) {
    return [];
  }
  return items.filter(item => {
    const haystack = normalizeFinderText(
      `${item.label} ${item.section} ${item.keywords ?? ''}`,
    );
    return haystack.includes(q);
  });
}
