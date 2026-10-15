/**
 * usePermissions Hook
 *
 * 3-layer access control plus Role Centre nav from GET /api/auth/me/:
 * - Company enabled_modules (plan / add-on gate)
 * - Role Centre navItems (which native screens appear)
 * - Permission sets (page CRUD)
 *
 * Usage:
 *   const { isModuleVisible, canAccessMobileNav, hasAnyPageAccess } = usePermissions();
 *
 *   if (isModuleVisible('sales') && canAccessMobileNav('makeSale', PAGE_NAMES.SALES)) {
 *     // Show Make Sale
 *   }
 */

import {useAuth} from '../context/Store';
import {PagePermissions} from '../types/auth';
import {resolveCanManageCompany} from '../utils/companyAccess';
import {
  isMobileScreenAllowed,
  isRoleCentreNavAllowed,
  type MobileScreenKey,
} from '../utils/roleCentreNav';

const MODULE_ENABLED_ALIASES: Record<string, string[]> = {
  // Bidirectional: moduleCode on nav can differ from enabled_modules / JWT keys.
  items: ['inventory'],
  inventory: ['items'],
  suppliers: ['purchases'],
  purchases: ['suppliers'],
  userManagement: ['user_management'],
  user_management: ['userManagement'],
  reports: ['financials'],
  financials: ['reports'],
};

function moduleKeys(moduleCode: string): string[] {
  const aliases = MODULE_ENABLED_ALIASES[moduleCode] || [];
  return [moduleCode, ...aliases];
}

export const usePermissions = () => {
  const {auth} = useAuth();

  const bypassRoleCentreNav = (): boolean =>
    !!auth &&
    (!!auth.is_superuser || !!auth.has_super_permission);

  /** Matches web: superuser or Admin role bypasses page-level permission checks */
  const hasFullPageAccess = (): boolean =>
    !!auth &&
    (auth.is_superuser ||
      !!auth.has_super_permission ||
      !!auth.roles?.includes('Admin'));

  /**
   * Company/module subscription gate only — Role Centre nav is a separate check.
   */
  const isModuleVisible = (moduleCode: string): boolean => {
    const enabledModules = Array.isArray(auth.enabled_modules)
      ? auth.enabled_modules
      : ['pos'];
    const isEnabled = moduleKeys(moduleCode).some(key =>
      enabledModules.includes(key),
    );
    if (!isEnabled) {
      return false;
    }
    return true;
  };

  const hasAnyPageAccess = (pageName: string): boolean => {
    if (!auth) return false;

    if (hasFullPageAccess()) return true;

    const pagePerms = auth.page_permissions?.[pageName];
    if (!pagePerms) return false;

    return (
      pagePerms.read || pagePerms.insert || pagePerms.modify || pagePerms.delete
    );
  };

  const canAccessPage = (
    pageName: string,
    action: 'read' | 'insert' | 'modify' | 'delete',
  ): boolean => {
    if (!auth) return false;

    if (hasFullPageAccess()) return true;

    const pagePerms = auth.page_permissions?.[pageName];
    if (!pagePerms) return false;

    return pagePerms[action] || false;
  };

  const getPagePermissions = (pageName: string): PagePermissions => {
    if (!auth || !auth.page_permissions) {
      return {read: false, insert: false, modify: false, delete: false};
    }

    if (hasFullPageAccess()) {
      return {read: true, insert: true, modify: true, delete: true};
    }

    return (
      auth.page_permissions[pageName] || {
        read: false,
        insert: false,
        modify: false,
        delete: false,
      }
    );
  };

  const roleCentreNavOptions = () => ({
    navItems: auth.navItems,
    roleCentreNavReady: auth.roleCentreNavReady,
    bypassRoleCentreNav: bypassRoleCentreNav(),
  });

  /**
   * Role Centre allowlist + optional Layer 2 page permissions.
   * Admin still needs the screen on the assigned Role Centre (unless SUPER).
   */
  const canAccessMobileScreen = (
    enginePageNames: string | readonly string[],
    pageName?: string | string[],
  ): boolean => {
    if (!isRoleCentreNavAllowed(enginePageNames, roleCentreNavOptions())) {
      return false;
    }
    if (!pageName) {
      return true;
    }
    const names = Array.isArray(pageName) ? pageName : [pageName];
    return names.some(name => hasAnyPageAccess(name));
  };

  const canAccessMobileNav = (
    screenKey: MobileScreenKey,
    pageName?: string | string[],
  ): boolean => {
    if (!isMobileScreenAllowed(screenKey, roleCentreNavOptions())) {
      return false;
    }
    if (!pageName) {
      return true;
    }
    const names = Array.isArray(pageName) ? pageName : [pageName];
    return names.some(name => hasAnyPageAccess(name));
  };

  const hasRole = (roleName: string): boolean => {
    return auth.roles?.includes(roleName) || false;
  };

  const isInGroup = (groupCode: string): boolean => {
    if (!auth || !auth.user_groups) return false;
    return auth.user_groups.some(group => group.code === groupCode);
  };

  const isInAnyGroup = (groupCodes: string[]): boolean => {
    if (!auth || !auth.user_groups) return false;
    return groupCodes.some(code => isInGroup(code));
  };

  const hasPermissionSet = (permissionSetCode: string): boolean => {
    return auth.permission_sets?.includes(permissionSetCode) || false;
  };

  /** Company info, billing, and module/plan screens — not the Admin role name. */
  const canManageCompany = resolveCanManageCompany(auth);

  const hasAnyPermission = (pageName: string): boolean => {
    return hasAnyPageAccess(pageName);
  };

  const canRead = (pageName: string): boolean => {
    return canAccessPage(pageName, 'read');
  };

  const canCreate = (pageName: string): boolean => {
    return canAccessPage(pageName, 'insert');
  };

  const canEdit = (pageName: string): boolean => {
    return canAccessPage(pageName, 'modify');
  };

  const canDelete = (pageName: string): boolean => {
    return canAccessPage(pageName, 'delete');
  };

  return {
    isModuleVisible,
    hasAnyPageAccess,
    hasAnyPermission,
    canAccessPage,
    getPagePermissions,
    canAccessMobileScreen,
    canAccessMobileNav,
    canRead,
    canCreate,
    canEdit,
    canDelete,
    hasRole,
    isInGroup,
    isInAnyGroup,
    hasPermissionSet,
    canManageCompany,
  };
};
