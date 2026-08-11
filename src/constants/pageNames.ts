/**
 * Page Name Constants
 *
 * These must match the page names defined in:
 * web/zentro-backend/base/management/commands/populate_page_objects.py
 *
 * Format: PAGE_NAME = "Exact Page Name from Backend"
 *
 * IMPORTANT: Page names must match EXACTLY with backend (case-sensitive)
 */

export const PAGE_NAMES = {
  // ============================================
  // SALES MODULE PAGES (10001-10099)
  // ============================================
  SALES_DASHBOARD: 'Sales Dashboard',
  SALES: 'Sales',
  SALES_INVOICE_PAGE: 'Sales Invoice Page',
  SALES_HISTORY: 'Sales History',

  // ============================================
  // CUSTOMERS MODULE PAGES (10101-10199)
  // ============================================
  CUSTOMER_MANAGEMENT: 'Customer Management',

  // ============================================
  // ITEMS MODULE PAGES (10201-10299)
  // ============================================
  ITEMS: 'Items',
  ITEM_CATEGORIES: 'Item Categories',
  ADJUST_INVENTORY: 'Adjust Inventory',
  ADJUST_INVENTORY_HISTORY: 'Adjust Inventory History',

  // ============================================
  // PURCHASES MODULE PAGES (10301-10399)
  // ============================================
  PURCHASES: 'Purchases',
  PURCHASE_HISTORY: 'Purchase History',

  // ============================================
  // SUPPLIERS MODULE PAGES (10303)
  // ============================================
  SUPPLIERS: 'Suppliers',

  // ============================================
  // PAYMENTS MODULE PAGES (10401-10499)
  // ============================================
  PAYMENTS: 'Payments',
  PAYMENT_HISTORY: 'Payment History',
  /** Matches backend page object name (object ID 10406) */
  QUICK_PAYMENT: 'QuickPayment',

  // ============================================
  // FINANCIALS MODULE PAGES (10501-10599)
  // ============================================
  CHART_OF_ACCOUNTS: 'Chart of Accounts',
  FINANCIAL_REPORTS: 'Financial Reports',
  PROFIT_AND_LOSS: 'Profit & Loss',
  BALANCE_SHEET: 'Balance Sheet',

  // ============================================
  // EXPENSES MODULE PAGES (10601-10699)
  // ============================================
  EXPENSES: 'Expenses',
  EXPENSE_HISTORY: 'Expense History',

  // ============================================
  // COMPANY/SETTINGS PAGES (10701-10799)
  // ============================================
  COMPANY_MANAGEMENT: 'Company Management',
  ROLE_MANAGEMENT: 'Role Management',
  PROFILE_SETTINGS: 'Profile Settings',

  // ============================================
  // USER MANAGEMENT MODULE PAGES (10801-10899)
  // ============================================
  USER_MANAGEMENT: 'User Management',
  USER_SETUP: 'User Setup',
  USER_GROUP_MANAGEMENT: 'User Group Management',
  PERMISSION_SET_MANAGEMENT: 'Permission Set Management',
  USER_ROLES_MANAGEMENT: 'User Roles Management',
  ROLE_CENTER_MANAGEMENT: 'Role Center Management',

  // ============================================
  // CONFIGURATION PACKAGES MODULE PAGES (10901-10999)
  // ============================================
  CONFIGURATION_PACKAGES: 'Configuration Packages',

  // ============================================
  // REPORTS MODULE (Additional - may not be in backend yet)
  // ============================================
  REPORTS: 'Reports',
  DAILY_PROFIT_REPORT: 'Daily Profit Report',
  WEEKLY_SUMMARY_REPORT: 'Weekly Summary Report',
  MONTHLY_SUMMARY_REPORT: 'Monthly Summary Report',
  PRODUCT_PROFITABILITY_REPORT: 'Product Profitability Report',
  EXPENSE_BREAKDOWN_REPORT: 'Expense Breakdown Report',

  // ============================================
  // INVENTORY MODULE (Additional - for mobile app)
  // ============================================
  ITEM_JOURNAL: 'Item Journal',
  INVENTORY_ADJUSTMENT: 'Inventory Adjustment',

  // ============================================
  // BANK ACCOUNTS
  // ============================================
  BANK_ACCOUNT_MANAGEMENT: 'Bank Account Management',
  BANK_ACCOUNT_LEDGER_ENTRIES: 'Bank Account Ledger Entries',

  // ============================================
  // LOANS & PREPAYMENTS (Mobile additions)
  // ============================================
  LOAN_REGISTRATION: 'Loan Registration',
  LOAN_REPAYMENT: 'Loan Repayment',
  PREPAYMENTS: 'Prepayments',

  // ============================================
  // RESTAURANT MODULE (populate_page_objects 10710–10722)
  // ============================================
  RESTAURANT_DASHBOARD: 'Restaurant Dashboard',
  RESTAURANT_TABLE_MANAGEMENT: 'Table Management',
  RESTAURANT_RESERVATIONS: 'Reservations',
  RESTAURANT_ORDERS: 'Orders',
  RESTAURANT_MENU_MANAGEMENT: 'Menu Management',
  RESTAURANT_KITCHEN_DISPLAY: 'Kitchen Display',
  RESTAURANT_SETTINGS: 'Restaurant Settings',
  RESTAURANT_POS: 'Restaurant POS',
  RESTAURANT_MENU_LAYOUT_EDITOR: 'Menu Layout Editor',
  RESTAURANT_MENUS: 'Restaurant Menus',
} as const;

/**
 * Type for page names - ensures type safety
 */
export type PageName = (typeof PAGE_NAMES)[keyof typeof PAGE_NAMES];

/**
 * Restaurant module enabled + any of these pages => show Restaurant hub entry (mobile Home / More).
 * Matches tiles in RestaurantHub.tsx.
 */
export const RESTAURANT_MODULE_ENTRY_PAGE_NAMES: readonly PageName[] = [
  PAGE_NAMES.RESTAURANT_DASHBOARD,
  PAGE_NAMES.RESTAURANT_POS,
  PAGE_NAMES.RESTAURANT_ORDERS,
  PAGE_NAMES.RESTAURANT_KITCHEN_DISPLAY,
  PAGE_NAMES.RESTAURANT_TABLE_MANAGEMENT,
  PAGE_NAMES.RESTAURANT_RESERVATIONS,
  PAGE_NAMES.RESTAURANT_MENUS,
  PAGE_NAMES.RESTAURANT_MENU_MANAGEMENT,
  PAGE_NAMES.RESTAURANT_MENU_LAYOUT_EDITOR,
  PAGE_NAMES.RESTAURANT_SETTINGS,
];

/**
 * Helper function to get page name by key
 * @param key - The key from PAGE_NAMES object
 * @returns The page name string
 */
export const getPageName = (key: keyof typeof PAGE_NAMES): PageName => {
  return PAGE_NAMES[key];
};

/**
 * Helper function to check if a string is a valid page name
 * @param pageName - The page name to check
 * @returns true if the page name exists in PAGE_NAMES
 */
export const isValidPageName = (pageName: string): pageName is PageName => {
  return Object.values(PAGE_NAMES).includes(pageName as PageName);
};

/**
 * Report Section to Page Name Mapping
 * Used for mapping report IDs to their corresponding page names
 */
export const REPORT_PAGE_MAPPING: Record<string, PageName> = {
  'daily-profit': PAGE_NAMES.DAILY_PROFIT_REPORT,
  'weekly-summary': PAGE_NAMES.WEEKLY_SUMMARY_REPORT,
  'monthly-summary': PAGE_NAMES.MONTHLY_SUMMARY_REPORT,
  'product-profitability': PAGE_NAMES.PRODUCT_PROFITABILITY_REPORT,
  'expense-breakdown': PAGE_NAMES.EXPENSE_BREAKDOWN_REPORT,
};
