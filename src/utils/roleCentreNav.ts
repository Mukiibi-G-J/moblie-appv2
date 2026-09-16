import type {AuthNavItem} from '../types/auth';

/**
 * Page-engine names (Role Centre NavItem.targetPageName) that unlock a native
 * mobile screen. Unmapped RC targets stay hidden (no native screen yet).
 */
export const MOBILE_SCREEN_NAV_TARGETS = {
  makeSale: ['SalesPOS', 'RestaurantPOS'],
  salesHistory: ['PostedSalesInvoiceList', 'SalesInvoiceList'],
  items: ['ItemList'],
  itemJournal: [
    'InventoryAdjustmentJournalList',
    'PostedInventoryAdjustmentList',
  ],
  openingBalance: ['OpeningBalanceJournalList'],
  customers: ['CustomerList'],
  suppliers: ['VendorList'],
  purchases: ['PurchaseInvoiceList', 'PostedPurchaseInvoiceList'],
  expenses: ['ExpenseList', 'PaymentHistoryList'],
  bankAccounts: ['BankAccountList'],
  payments: [
    'QuickPayment',
    'PaymentJournalList',
    'PostedPaymentJournalList',
  ],
  prepayments: ['SalesPrepaymentPercentages'],
  reports: ['FinancialReportList'],
  restaurant: [
    'RestaurantPOS',
    'RestaurantOrderList',
    'KitchenDisplay',
    'KitchenDisplayList',
    'TableList',
    'ReservationList',
    'MenuList',
    'MenuBuilder',
    'MenuItemList',
    'RestaurantDashboard',
  ],
  restaurantPos: ['RestaurantPOS'],
  restaurantOrders: ['RestaurantOrderList'],
  restaurantKitchen: ['KitchenDisplay', 'KitchenDisplayList'],
  restaurantDashboard: ['RestaurantDashboard'],
  restaurantTables: ['TableList'],
  restaurantReservations: ['ReservationList'],
  restaurantMenus: ['MenuList', 'MenuBuilder', 'MenuItemList'],
  restaurantSettings: ['RestaurantSettings'],
  userManagement: ['UsersList', 'UserSetupList', 'UserGroupsList'],
} as const;

export type MobileScreenKey = keyof typeof MOBILE_SCREEN_NAV_TARGETS;

export type RoleCentreNavOptions = {
  navItems?: AuthNavItem[] | null;
  roleCentreNavReady?: boolean;
  /** Superuser / SUPER permission — see every mapped screen. */
  bypassRoleCentreNav?: boolean;
};

const SEARCH_SECTION_ENGINE_PAGES: Record<string, readonly string[]> = {
  Sales: MOBILE_SCREEN_NAV_TARGETS.salesHistory,
  Customers: MOBILE_SCREEN_NAV_TARGETS.customers,
  Purchases: MOBILE_SCREEN_NAV_TARGETS.purchases,
  Vendors: MOBILE_SCREEN_NAV_TARGETS.suppliers,
  Financials: MOBILE_SCREEN_NAV_TARGETS.reports,
  Payments: MOBILE_SCREEN_NAV_TARGETS.payments,
  'Item Journals': MOBILE_SCREEN_NAV_TARGETS.itemJournal,
  Inventory: MOBILE_SCREEN_NAV_TARGETS.items,
};

const SEARCH_HIT_ENGINE_PAGES: Record<string, readonly string[]> = {
  ItemCard: MOBILE_SCREEN_NAV_TARGETS.items,
  SalesInvoice: MOBILE_SCREEN_NAV_TARGETS.salesHistory,
  CustomerCard: MOBILE_SCREEN_NAV_TARGETS.customers,
  PurchaseInvoice: MOBILE_SCREEN_NAV_TARGETS.purchases,
  VendorCard: MOBILE_SCREEN_NAV_TARGETS.suppliers,
  GLAccountCard: MOBILE_SCREEN_NAV_TARGETS.reports,
  PaymentJournalCard: MOBILE_SCREEN_NAV_TARGETS.payments,
  ItemJournalCard: MOBILE_SCREEN_NAV_TARGETS.itemJournal,
};

export function collectNavTargetNames(
  navItems?: AuthNavItem[] | null,
): Set<string> {
  const names = new Set<string>();
  if (!Array.isArray(navItems)) {
    return names;
  }
  for (const item of navItems) {
    const target = item?.targetPageName?.trim();
    if (target) {
      names.add(target);
    }
  }
  return names;
}

/**
 * True when at least one engine page name is on the assigned Role Centre.
 * Empty nav with ready=true hides everything. Not-ready also hides so the
 * full catalog never flashes before /api/auth/me/ loads.
 */
export function isRoleCentreNavAllowed(
  enginePageNames: string | readonly string[],
  options: RoleCentreNavOptions,
): boolean {
  if (options.bypassRoleCentreNav) {
    return true;
  }
  if (!options.roleCentreNavReady) {
    return false;
  }
  const wanted = Array.isArray(enginePageNames)
    ? enginePageNames
    : [enginePageNames];
  if (wanted.length === 0) {
    return false;
  }
  const allowed = collectNavTargetNames(options.navItems);
  return wanted.some(name => name && allowed.has(name));
}

export function isMobileScreenAllowed(
  screenKey: MobileScreenKey,
  options: RoleCentreNavOptions,
): boolean {
  return isRoleCentreNavAllowed(MOBILE_SCREEN_NAV_TARGETS[screenKey], options);
}

export function enginePagesForSearch(
  sectionTitle: string,
  hitPageName?: string | null,
): readonly string[] {
  const fromHit = hitPageName
    ? SEARCH_HIT_ENGINE_PAGES[hitPageName]
    : undefined;
  if (fromHit?.length) {
    return fromHit;
  }
  return SEARCH_SECTION_ENGINE_PAGES[sectionTitle] ?? [];
}
