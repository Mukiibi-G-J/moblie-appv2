/**
 * Authentication and Permission Type Definitions
 *
 * These types match the JWT token structure from the backend
 * and support the 3-Layer Hybrid Access Control System
 */

export interface PagePermissions {
  read: boolean;
  insert: boolean;
  modify: boolean;
  delete: boolean;
}

export interface UserGroup {
  code: string;
  name: string;
  default_role?: string;
  permission_sets: string[];
}

/** Field-level flags from JWT (`user_permissions`), aligned with web `DecodedToken`. */
export interface UserJwtPermissions {
  canSeeBuyingPrice: boolean;
  canSeeProfitMargin: boolean;
  canSeeItemCost: boolean;
  canEditSalesPrice?: boolean;
  canReversePurchaseInvoice?: boolean;
  canReverseSalesInvoice?: boolean;
  allowPinLogin?: boolean;
  defaultSalesUi?: 'phone' | 'pos';
  /** Admin / COMPANY_FULL only — company info, billing, modules. */
  canManageCompany?: boolean;
}

export const defaultUserJwtPermissions = (): UserJwtPermissions => ({
  canSeeBuyingPrice: true,
  canSeeProfitMargin: true,
  canSeeItemCost: true,
  canEditSalesPrice: false,
  defaultSalesUi: 'phone',
});

export interface DecodedToken {
  // Basic user info
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  verified?: boolean;
  is_superuser?: boolean;

  // Legacy authority (module-level access)
  authority: string[];

  // Layer 1: Role Center (Module Visibility)
  role_center_modules?: string[];

  // Layer 2 & 3: Permission Sets & Page Permissions
  roles?: string[];
  user_groups?: UserGroup[];
  permission_sets?: string[];
  page_permissions?: Record<string, PagePermissions>;
  user_permissions?: Partial<UserJwtPermissions>;
  // Branch switching (multi-branch)
  /** Assigned branch from JWT (same as web `DecodedToken.global_dimension_1`). */
  global_dimension_1?: {
    id: number;
    code: string;
    description?: string;
  } | null;
  enable_multiple_branches?: boolean;
  can_switch_branch?: boolean;

  /** Company modules from JWT (web parity). */
  enabled_modules?: string[];
  schema_name?: string;
  local_currency_code?: string;
  /** Company restaurant PIN length from JWT. */
  pin_length?: 4 | 6;
  /** SUPER permission set — bypasses page and Role Centre nav checks. */
  has_super_permission?: boolean;

  // Token metadata
  exp?: number;
  iat?: number;
  jti?: string;
  token_type?: string;
}

/** Sidebar / More-menu entry from GET /api/auth/me/ (Role Centre NavItem). */
export interface AuthNavItem {
  name: string;
  caption: string;
  imageUrl: string;
  targetPageName: string;
  ribbonTab?: string;
  desktopOnly?: boolean;
}

/** Session payload from GET /api/auth/me/ — same contract as web V2 / desktop. */
export interface AuthMeSession {
  roleCentrePageId: number | null;
  profile?: {code: string; description: string} | null;
  enabledModules?: string[];
  /** Admin / COMPANY_FULL only — same claim as web session.canManageCompany. */
  canManageCompany?: boolean;
  user?: {
    id: number;
    email: string;
    fullName: string;
    username: string;
    role: string;
  };
  navItems?: AuthNavItem[];
}

export interface AuthState {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  verified?: boolean;
  is_superuser?: boolean;

  // Legacy authority
  authority: string[];

  // Layer 1: Role Center
  role_center_modules?: string[];

  // Layer 2 & 3: Permissions
  roles?: string[];
  user_groups?: UserGroup[];
  permission_sets?: string[];
  page_permissions?: Record<string, PagePermissions>;
  userPermissions: UserJwtPermissions;

  // Branch switching (multi-branch)
  global_dimension_1?: {
    id: number;
    code: string;
    description?: string;
  } | null;
  enable_multiple_branches?: boolean;
  can_switch_branch?: boolean;

  enabled_modules?: string[];
  schema_name?: string;
  localCurrencyCode?: string;
  /** Company restaurant PIN length (default 4). */
  pinLength?: 4 | 6;
  /** From GET /api/auth/profile/ — cached locally after upload. */
  avatar_url?: string;
  /** SUPER permission set from JWT — bypasses page and Role Centre nav. */
  has_super_permission?: boolean;
  /** Application Role Centre page id from GET /api/auth/me/. */
  roleCentrePageId?: number | null;
  applicationProfileCode?: string | null;
  applicationProfileDescription?: string | null;
  /** Role Centre NavItems. Empty + ready means hide business modules. */
  navItems?: AuthNavItem[];
  /**
   * True after /api/auth/me/ (or a cached copy) has been applied.
   * False must not flash the full catalog.
   */
  roleCentreNavReady?: boolean;
}
