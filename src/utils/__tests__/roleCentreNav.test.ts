import type {AuthNavItem} from '../../types/auth';
import {
  enginePagesForSearch,
  isMobileScreenAllowed,
  isRoleCentreNavAllowed,
  type MobileScreenKey,
} from '../roleCentreNav';

function nav(targets: string[]): AuthNavItem[] {
  return targets.map(targetPageName => ({
    name: targetPageName || 'NavHome',
    caption: targetPageName || 'Home',
    imageUrl: '',
    targetPageName,
  }));
}

const CASHIER_NAV = nav([
  '',
  'SalesPOS',
  'CustomerList',
  'ItemList',
  'PostedSalesInvoiceList',
  'UserSettingsList',
]);

const WAREHOUSE_NAV = nav([
  '',
  'ItemList',
  'InventoryAdjustmentJournalList',
  'OpeningBalanceJournalList',
  'StockTakingJournalList',
  'PostedStockTakingList',
  'PostedInventoryAdjustmentList',
  'ExpiryReport',
  'InventoryValueMovementReport',
  'VendorList',
  'PurchaseInvoiceList',
  'PostedPurchaseInvoiceList',
]);

const ALL_SCREENS: MobileScreenKey[] = [
  'makeSale',
  'salesHistory',
  'items',
  'itemJournal',
  'openingBalance',
  'customers',
  'suppliers',
  'purchases',
  'expenses',
  'bankAccounts',
  'payments',
  'prepayments',
  'reports',
  'restaurant',
  'userManagement',
];

function allowedScreens(
  navItems: AuthNavItem[],
  extra?: {roleCentreNavReady?: boolean; bypassRoleCentreNav?: boolean},
): MobileScreenKey[] {
  return ALL_SCREENS.filter(key =>
    isMobileScreenAllowed(key, {
      navItems,
      roleCentreNavReady: extra?.roleCentreNavReady ?? true,
      bypassRoleCentreNav: extra?.bypassRoleCentreNav,
    }),
  );
}

describe('roleCentreNav allowlist', () => {
  it('lets a Cashier see Home POS, customers, items, and sales history only', () => {
    expect(allowedScreens(CASHIER_NAV).sort()).toEqual(
      ['customers', 'items', 'makeSale', 'salesHistory'].sort(),
    );
  });

  it('lets Warehouse see items, journals, vendors, and purchases — not POS or reports', () => {
    expect(allowedScreens(WAREHOUSE_NAV).sort()).toEqual(
      [
        'itemJournal',
        'items',
        'openingBalance',
        'purchases',
        'suppliers',
      ].sort(),
    );
    expect(isMobileScreenAllowed('makeSale', {
      navItems: WAREHOUSE_NAV,
      roleCentreNavReady: true,
    })).toBe(false);
    expect(isMobileScreenAllowed('reports', {
      navItems: WAREHOUSE_NAV,
      roleCentreNavReady: true,
    })).toBe(false);
  });

  it('hides business modules when navItems is empty and ready', () => {
    expect(
      allowedScreens([], {roleCentreNavReady: true}),
    ).toEqual([]);
  });

  it('does not flash the full catalog before Role Centre session is ready', () => {
    expect(
      allowedScreens(CASHIER_NAV, {roleCentreNavReady: false}),
    ).toEqual([]);
    expect(
      isRoleCentreNavAllowed('SalesPOS', {
        navItems: CASHIER_NAV,
        roleCentreNavReady: false,
      }),
    ).toBe(false);
  });

  it('SUPER / superuser bypass sees mapped screens even with empty nav', () => {
    expect(
      isMobileScreenAllowed('makeSale', {
        navItems: [],
        roleCentreNavReady: true,
        bypassRoleCentreNav: true,
      }),
    ).toBe(true);
    expect(
      isMobileScreenAllowed('purchases', {
        navItems: CASHIER_NAV,
        roleCentreNavReady: true,
        bypassRoleCentreNav: true,
      }),
    ).toBe(true);
  });

  it('maps global search hits to Role Centre engine pages', () => {
    expect(enginePagesForSearch('Inventory', 'ItemCard')).toEqual(['ItemList']);
    expect(enginePagesForSearch('Sales', 'SalesInvoice')).toEqual([
      'PostedSalesInvoiceList',
      'SalesInvoiceList',
    ]);
    expect(enginePagesForSearch('Vendors')).toEqual(['VendorList']);
  });
});
