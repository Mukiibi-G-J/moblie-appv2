/**
 * usePermissions Hook
 *
 * Provides permission checking functionality based on the 3-Layer Hybrid Access Control System:
 * - Layer 1: Role Center (Module Visibility)
 * - Layer 2: Permission Sets (Page Visibility)
 * - Layer 3: CRUD Permissions (Action Control)
 *
 * Usage:
 *   const { isModuleVisible, canAccessPage, getPagePermissions } = usePermissions();
 *
 *   if (isModuleVisible('sales')) {
 *     // Show Sales module
 *   }
 *
 *   if (canAccessPage('Sales Dashboard', 'read')) {
 *     // Show Sales Dashboard
 *   }
 */

import {useAuth} from '../context/Store';
import {PagePermissions} from '../types/auth';

const MODULE_ENABLED_ALIASES: Record<string, string[]> = {
  // Match web nav config where moduleCode can differ from enabled_modules key.
  items: ['inventory'],
  suppliers: ['purchases'],
  userManagement: ['user_management'],
};

export const usePermissions = () => {
  const {auth} = useAuth();

  /** Matches web: superuser or Admin role bypasses page-level permission checks */
  const hasFullPageAccess = (): boolean =>
    !!auth && (auth.is_superuser || !!auth.roles?.includes('Admin'));

  /**
   * Layer 1: Check if a module should be visible based on Role Center configuration
   * @param moduleCode - Module code (e.g., 'sales', 'customers', 'items')
   * @returns true if module should be visible
   */
  const isModuleVisible = (moduleCode: string): boolean => {
    const enabledModules = Array.isArray(auth.enabled_modules)
      ? auth.enabled_modules
      : ['pos'];
    // Company/module subscription gate: when backend provides enabled_modules,
    // never show modules that are not enabled for this tenant.
    if (Array.isArray(enabledModules)) {
      const aliases = MODULE_ENABLED_ALIASES[moduleCode] || [];
      const enabledKeys = [moduleCode, ...aliases];
      const isEnabled = enabledKeys.some(key => enabledModules.includes(key));
      if (!isEnabled) {
        return false;
      }
    }

    // Superuser sees everything among enabled modules
    if (auth.is_superuser) return true;

    const roleCenterModules = auth.role_center_modules || [];

    // If user has role center modules, use them (primary)
    if (roleCenterModules.length > 0) {
      return roleCenterModules.includes(moduleCode);
    }

    // Fallback to authority for backward compatibility
    return auth.authority?.includes(moduleCode) || false;
  };

  /**
   * Layer 2: Check if user has ANY access (read/insert/modify/delete) to a page
   * Used for navigation filtering
   * @param pageName - Name of the page (from Objects model)
   * @returns true if user has any permission for this page
   */
  const hasAnyPageAccess = (pageName: string): boolean => {
    if (!auth) return false;

    if (hasFullPageAccess()) return true;

    // Check if user has page_permissions for this page
    const pagePerms = auth.page_permissions?.[pageName];
    if (!pagePerms) return false;

    // Return true if user has ANY permission (read, insert, modify, or delete)
    return (
      pagePerms.read || pagePerms.insert || pagePerms.modify || pagePerms.delete
    );
  };

  /**
   * Layer 3: Check if user can access a page with a specific action
   * @param pageName - Name of the page (from Objects model)
   * @param action - Permission action: 'read', 'insert', 'modify', 'delete'
   * @returns true if user has the specific permission
   */
  const canAccessPage = (
    pageName: string,
    action: 'read' | 'insert' | 'modify' | 'delete',
  ): boolean => {
    if (!auth) return false;

    if (hasFullPageAccess()) return true;

    // Check if user has page_permissions for this page
    const pagePerms = auth.page_permissions?.[pageName];
    if (!pagePerms) return false;

    return pagePerms[action] || false;
  };

  /**
   * Get all page permissions for a specific page
   * Returns the full permission object with read/insert/modify/delete flags
   * @param pageName - Name of the page
   * @returns PagePermissions object
   */
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

  /**
   * Check if user has a specific role
   * @param roleName - Name of the role
   * @returns true if user has the role
   */
  const hasRole = (roleName: string): boolean => {
    return auth.roles?.includes(roleName) || false;
  };

  /**
   * Check if user is in a specific user group
   * @param groupCode - Code of the user group
   * @returns true if user is in the group
   */
  const isInGroup = (groupCode: string): boolean => {
    if (!auth || !auth.user_groups) return false;
    return auth.user_groups.some(group => group.code === groupCode);
  };

  /**
   * Check if user is in any of the specified groups
   * @param groupCodes - Array of group codes
   * @returns true if user is in any of the groups
   */
  const isInAnyGroup = (groupCodes: string[]): boolean => {
    if (!auth || !auth.user_groups) return false;
    return groupCodes.some(code => isInGroup(code));
  };

  /**
   * Check if user has a specific permission set
   * @param permissionSetCode - Code of the permission set
   * @returns true if user has the permission set
   */
  const hasPermissionSet = (permissionSetCode: string): boolean => {
    return auth.permission_sets?.includes(permissionSetCode) || false;
  };

  /**
   * Check if user has any permission for a page (convenience method)
   * @param pageName - Name of the page
   * @returns true if user has any permission
   */
  const hasAnyPermission = (pageName: string): boolean => {
    return hasAnyPageAccess(pageName);
  };

  /**
   * Convenience methods for common CRUD checks
   */
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
    // Layer 1: Module Visibility
    isModuleVisible,

    // Layer 2: Page Visibility
    hasAnyPageAccess,
    hasAnyPermission,

    // Layer 3: CRUD Permissions
    canAccessPage,
    getPagePermissions,

    // Convenience methods
    canRead,
    canCreate,
    canEdit,
    canDelete,

    // Helper functions
    hasRole,
    isInGroup,
    isInAnyGroup,
    hasPermissionSet,
  };
};
