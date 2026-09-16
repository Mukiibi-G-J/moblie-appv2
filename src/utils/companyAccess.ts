/**
 * Company / billing access — matches V2 JWT `user_permissions.canManageCompany`
 * and the explicit company-page denies in permission_claims.py.
 *
 * Do not treat a missing page_permissions key as allowed (the native app used
 * to). Do not grant access from the Admin role name alone.
 */

export const COMPANY_BILLING_PAGE_NAMES = [
  'CompanyCard',
  'CompanySubscriptionCard',
  'CompanyBillingHistoryList',
  'CompanyPaymentMethodList',
  'Company Management',
  'Company & Billing',
  'Company Settings',
  'All Modules & Plans',
  'Modules & Plans',
] as const;

type CrudFlags = {
  read?: boolean;
  insert?: boolean;
  modify?: boolean;
  delete?: boolean;
};

export type CompanyAccessAuth = {
  is_superuser?: boolean;
  has_super_permission?: boolean;
  userPermissions?: {canManageCompany?: boolean};
  page_permissions?: Record<string, CrudFlags | undefined>;
};

function crudGranted(perms: CrudFlags | undefined): boolean {
  if (!perms) {
    return false;
  }
  return Boolean(perms.read || perms.insert || perms.modify || perms.delete);
}

export function resolveCanManageCompany(
  auth: CompanyAccessAuth | null | undefined,
): boolean {
  if (!auth) {
    return false;
  }
  if (auth.is_superuser || auth.has_super_permission) {
    return true;
  }
  if (auth.userPermissions?.canManageCompany === true) {
    return true;
  }
  if (auth.userPermissions?.canManageCompany === false) {
    return false;
  }
  return COMPANY_BILLING_PAGE_NAMES.some(name =>
    crudGranted(auth.page_permissions?.[name]),
  );
}
