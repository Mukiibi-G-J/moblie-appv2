/**
 * Permission Constants
 *
 * Module codes for permission checking (Layer 1: Role Center)
 * Page names are now in src/constants/pageNames.ts
 */

// Module Codes (Layer 1: Role Center)
export const MODULE_CODES = {
  SALES: 'sales',
  CUSTOMERS: 'customers',
  ITEMS: 'items',
  REPORTS: 'reports',
  EXPENSES: 'expenses',
  PAYMENTS: 'payments',
  INVENTORY: 'inventory',
  PURCHASES: 'purchases',
  SUPPLIERS: 'suppliers',
  FINANCIALS: 'financials',
  USER_MANAGEMENT: 'userManagement',
  COMPANY: 'company',
  ROLES: 'roles',
  PROFILE: 'profile',
} as const;

// Re-export page names from pageNames.ts for backward compatibility
export {PAGE_NAMES, REPORT_PAGE_MAPPING, type PageName} from './pageNames';

