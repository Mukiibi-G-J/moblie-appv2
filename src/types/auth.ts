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

  // Token metadata
  exp?: number;
  iat?: number;
  jti?: string;
  token_type?: string;
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
}
