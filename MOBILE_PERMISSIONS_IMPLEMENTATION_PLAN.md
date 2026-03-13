# Mobile App Permissions Implementation Plan

## Executive Summary

This document outlines the plan to implement the **3-Layer Hybrid Access Control System** (inspired by Microsoft Business Central) in the ZentroApp mobile application, matching the web application's permission architecture.

---

## 1. Current State Analysis

### 1.1 Web Application Permission System

The web app uses a **3-Layer Hybrid Access Control System**:

#### **Layer 1: Role Center (Module Visibility)**
- **Purpose**: Controls which modules appear in navigation
- **Backend Model**: `authentication.RoleCenter`
- **JWT Field**: `role_center_modules` (array of module codes)
- **Example**: `["sales", "customers", "items", "reports"]`
- **Frontend Check**: `isModuleVisible(moduleCode)`

#### **Layer 2: Permission Sets (Page Visibility)**
- **Purpose**: Controls which pages within modules are accessible
- **Backend Models**: `permissions.PermissionSet`, `permissions.PermissionSetLine`
- **JWT Field**: `page_permissions` (object with page names as keys)
- **Structure**: `{ "Sales Dashboard": { read: true, insert: false, modify: false, delete: false } }`
- **Frontend Check**: `hasAnyPageAccess(pageName)` or `canAccessPage(pageName, action)`

#### **Layer 3: CRUD Permissions (Action Control)**
- **Purpose**: Controls what actions users can perform (create, read, update, delete)
- **JWT Structure**: `page_permissions[pageName] = { read, insert, modify, delete }`
- **Frontend Check**: `getPagePermissions(pageName)` or `canAccessPage(pageName, "read")`

### 1.2 Mobile App Current State

**Current Implementation:**
- ✅ Basic JWT token decoding
- ✅ Authority array extraction (`authority: string[]`)
- ✅ Simple module access check in drawer (`hasModuleAccess`)
- ❌ Missing: Role Center modules support
- ❌ Missing: Page-level permissions
- ❌ Missing: CRUD permission checks
- ❌ Missing: Permission hooks/utilities

**Current JWT Token Structure (Mobile):**
```typescript
{
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  authority: string[]; // Only Layer 1 (legacy)
}
```

**Required JWT Token Structure (Web):**
```typescript
{
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  authority: string[]; // Legacy module access
  roles?: string[]; // NEW
  user_groups?: UserGroup[]; // NEW
  permission_sets?: string[]; // NEW
  role_center_modules?: string[]; // NEW - Layer 1
  page_permissions?: Record<string, PagePermissions>; // NEW - Layer 2 & 3
  is_superuser?: boolean;
}
```

---

## 2. Implementation Plan

### Phase 1: Update JWT Token Decoding & State Management

#### 1.1 Update Type Definitions

**File**: `src/types/auth.ts` (create new file)

```typescript
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
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  authority: string[]; // Legacy
  roles?: string[];
  user_groups?: UserGroup[];
  permission_sets?: string[];
  role_center_modules?: string[]; // Layer 1
  page_permissions?: Record<string, PagePermissions>; // Layer 2 & 3
  is_superuser?: boolean;
  verified?: boolean;
  phone?: string;
}

export interface AuthState {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  authority: string[];
  roles?: string[];
  user_groups?: UserGroup[];
  permission_sets?: string[];
  role_center_modules?: string[];
  page_permissions?: Record<string, PagePermissions>;
  is_superuser?: boolean;
}
```

#### 1.2 Update Store/Context

**File**: `src/context/Store.tsx`

**Changes:**
1. Update `DecodeToken` interface to match `DecodedToken`
2. Update `auth` state to include all new fields
3. Update token decoding logic to extract all permission fields
4. Update `clearAuthState` to reset all fields

**Key Updates:**
```typescript
// Extract from JWT token
const user: AuthState = {
  user_id: decodedToken.user_id?.toString() || '',
  username: decodedToken.username || '',
  full_name: decodedToken.full_name || '',
  email: decodedToken.email || '',
  authority: decodedToken.authority || [],
  roles: decodedToken.roles || [],
  user_groups: decodedToken.user_groups || [],
  permission_sets: decodedToken.permission_sets || [],
  role_center_modules: decodedToken.role_center_modules || [],
  page_permissions: decodedToken.page_permissions || {},
  is_superuser: decodedToken.is_superuser || false,
};
```

---

### Phase 2: Create Permission Utilities & Hooks

#### 2.1 Create Permission Hook

**File**: `src/hooks/usePermissions.ts` (create new file)

**Purpose**: Provide permission checking functions similar to web app

**Key Functions:**
```typescript
export const usePermissions = () => {
  const {auth} = useAuth();

  // Layer 1: Module Visibility (Role Center)
  const isModuleVisible = (moduleCode: string): boolean => {
    if (auth.is_superuser) return true;
    return auth.role_center_modules?.includes(moduleCode) || false;
  };

  // Layer 2: Page Visibility
  const hasAnyPageAccess = (pageName: string): boolean => {
    if (auth.is_superuser) return true;
    const pagePerms = auth.page_permissions?.[pageName];
    if (!pagePerms) return false;
    return pagePerms.read || pagePerms.insert || pagePerms.modify || pagePerms.delete;
  };

  // Layer 3: CRUD Permissions
  const canAccessPage = (
    pageName: string,
    action: 'read' | 'insert' | 'modify' | 'delete'
  ): boolean => {
    if (auth.is_superuser) return true;
    const pagePerms = auth.page_permissions?.[pageName];
    return pagePerms?.[action] || false;
  };

  const getPagePermissions = (pageName: string): PagePermissions => {
    if (auth.is_superuser) {
      return { read: true, insert: true, modify: true, delete: true };
    }
    return auth.page_permissions?.[pageName] || {
      read: false,
      insert: false,
      modify: false,
      delete: false,
    };
  };

  // Helper functions
  const hasRole = (roleName: string): boolean => {
    return auth.roles?.includes(roleName) || false;
  };

  const isInGroup = (groupCode: string): boolean => {
    return auth.user_groups?.some(g => g.code === groupCode) || false;
  };

  const hasPermissionSet = (permissionSetCode: string): boolean => {
    return auth.permission_sets?.includes(permissionSetCode) || false;
  };

  return {
    // Layer 1
    isModuleVisible,
    // Layer 2
    hasAnyPageAccess,
    // Layer 3
    canAccessPage,
    getPagePermissions,
    // Helpers
    hasRole,
    isInGroup,
    hasPermissionSet,
  };
};
```

---

### Phase 3: Update Navigation & Drawer

#### 3.1 Update CustomDrawer

**File**: `src/navigation/CustomDrawer.tsx`

**Changes:**
1. Replace `hasModuleAccess` with `isModuleVisible` from `usePermissions`
2. Add page-level permission checks for menu items
3. Filter menu items based on both module and page permissions

**Example:**
```typescript
const {isModuleVisible, hasAnyPageAccess} = usePermissions();

const primaryItems = [
  {
    key: 'sales',
    label: constants.screens.sales,
    icon: icons.cart,
    moduleCode: 'sales', // Layer 1 check
    pageName: 'Sales History', // Layer 2 check (optional)
    action: () => {
      setSelectedTab(constants.screens.sales);
      navigation.navigate('MainLayout');
    },
    isFocused: selectedTab === constants.screens.sales,
  },
  // ... more items
].filter(item => {
  // Layer 1: Check module visibility
  if (item.moduleCode && !isModuleVisible(item.moduleCode)) {
    return false;
  }
  // Layer 2: Check page access (if pageName provided)
  if (item.pageName && !hasAnyPageAccess(item.pageName)) {
    return false;
  }
  return true;
});
```

---

### Phase 4: Update Screens with Permission Checks

#### 4.1 Update Reports Screen

**File**: `src/Screens/Reports/Reports.tsx`

**Changes:**
1. Add permission checks before showing report sections
2. Hide reports user doesn't have access to
3. Disable actions based on CRUD permissions

**Example:**
```typescript
const {canAccessPage, getPagePermissions} = usePermissions();

// Filter report sections based on permissions
const availableReports = REPORT_SECTIONS.filter(section => {
  // Map section IDs to page names
  const pageNameMap: Record<string, string> = {
    'daily-profit': 'Daily Profit Report',
    'weekly-summary': 'Weekly Summary Report',
    // ... more mappings
  };
  
  const pageName = pageNameMap[section.id];
  if (!pageName) return true; // Show if no page name mapping
  
  return canAccessPage(pageName, 'read');
});

// In render:
{availableReports.map(section => (
  <ReportSection key={section.id} {...section} />
))}
```

#### 4.2 Update Other Screens

**Files to Update:**
- `src/Screens/Items/Items.tsx` - Check create/edit/delete permissions
- `src/Screens/Customers/Customers.tsx` - Check CRUD permissions
- `src/Screens/Sales/SalesHistory.tsx` - Check read permissions
- `src/Screens/Home/Home.tsx` - Filter quick actions by permissions

**Pattern:**
```typescript
const {canAccessPage, getPagePermissions} = usePermissions();

// Check if user can create
const canCreate = canAccessPage('Customer Management', 'insert');

// Show/hide create button
{canCreate && (
  <TouchableOpacity onPress={handleCreate}>
    <Text>Create Customer</Text>
  </TouchableOpacity>
)}

// Check if user can edit
const canEdit = canAccessPage('Customer Management', 'modify');

// Disable edit button if no permission
<TouchableOpacity 
  onPress={handleEdit}
  disabled={!canEdit}
  style={{opacity: canEdit ? 1 : 0.5}}
>
  <Text>Edit</Text>
</TouchableOpacity>
```

---

### Phase 5: API Protection (Backend Already Handles This)

**Note**: The backend already implements permission checks in API endpoints using `check_object_permission()`. The mobile app should:

1. **Handle 403 Forbidden responses** gracefully
2. **Show appropriate error messages** when permissions are denied
3. **Prevent UI actions** that would result in 403 errors

**Example Error Handling:**
```typescript
try {
  const response = await fetchSalesData();
  // ... handle success
} catch (error: any) {
  if (error.response?.status === 403) {
    Toast.show({
      type: 'error',
      text1: 'Access Denied',
      text2: 'You do not have permission to view this data.',
    });
  }
}
```

---

## 3. Implementation Checklist

### Phase 1: Foundation ✅
- [ ] Create `src/types/auth.ts` with all type definitions
- [ ] Update `src/context/Store.tsx` to decode all JWT fields
- [ ] Update `AppContextType` interface
- [ ] Test JWT token decoding with all fields

### Phase 2: Permission Utilities ✅
- [ ] Create `src/hooks/usePermissions.ts`
- [ ] Implement `isModuleVisible` (Layer 1)
- [ ] Implement `hasAnyPageAccess` (Layer 2)
- [ ] Implement `canAccessPage` (Layer 3)
- [ ] Implement `getPagePermissions` (Layer 3)
- [ ] Add helper functions (hasRole, isInGroup, etc.)

### Phase 3: Navigation ✅
- [ ] Update `CustomDrawer.tsx` to use `isModuleVisible`
- [ ] Add page-level filtering to drawer items
- [ ] Update `MainLayout.tsx` if needed
- [ ] Test navigation filtering

### Phase 4: Screen Updates ✅
- [ ] Update `Reports.tsx` with permission checks
- [ ] Update `Items.tsx` with CRUD permission checks
- [ ] Update `Customers.tsx` with CRUD permission checks
- [ ] Update `SalesHistory.tsx` with read permission checks
- [ ] Update `Home.tsx` to filter quick actions

### Phase 5: Error Handling ✅
- [ ] Add 403 error handling to API calls
- [ ] Show user-friendly permission error messages
- [ ] Test error scenarios

---

## 4. Testing Strategy

### 4.1 Unit Tests
- Test `usePermissions` hook with various permission scenarios
- Test JWT token decoding with all fields
- Test permission filtering logic

### 4.2 Integration Tests
- Test navigation filtering based on permissions
- Test screen rendering based on permissions
- Test API error handling

### 4.3 Manual Testing Scenarios

1. **Superuser**: Should see all modules and have all permissions
2. **Cashier Role**: Should see Sales module, can create/edit sales, cannot delete
3. **Viewer Role**: Should see Sales module, can only read, cannot create/edit/delete
4. **Limited Access**: Should only see modules in `role_center_modules`
5. **No Permissions**: Should see minimal UI, appropriate error messages

---

## 5. Migration Strategy

### 5.1 Backward Compatibility

The implementation should maintain backward compatibility:

1. **Fallback to Authority**: If `role_center_modules` is empty/undefined, fall back to `authority` array
2. **Default Permissions**: If `page_permissions` is empty, allow access if user has module access
3. **Gradual Rollout**: Implement Layer 1 first, then Layer 2, then Layer 3

### 5.2 Rollout Plan

1. **Week 1**: Phase 1 & 2 (Foundation + Utilities)
2. **Week 2**: Phase 3 (Navigation)
3. **Week 3**: Phase 4 (Screens - Reports, Items, Customers)
4. **Week 4**: Phase 4 (Screens - Remaining) + Phase 5 (Error Handling)
5. **Week 5**: Testing & Bug Fixes

---

## 6. Key Differences: Web vs Mobile

| Feature | Web | Mobile |
|---------|-----|--------|
| **Navigation** | Sidebar menu | Bottom tabs + Drawer |
| **Route Protection** | Route guards | Screen-level checks |
| **Permission Display** | Hidden menu items | Disabled buttons/empty states |
| **Error Handling** | Redirect to 403 page | Toast messages |

---

## 7. Constants & Configuration

### 7.1 Module Codes

```typescript
// src/constants/modules.ts
export const MODULE_CODES = {
  SALES: 'sales',
  CUSTOMERS: 'customers',
  ITEMS: 'items',
  REPORTS: 'reports',
  EXPENSES: 'expenses',
  PAYMENTS: 'payments',
} as const;
```

### 7.2 Page Names Mapping

```typescript
// src/constants/pages.ts
export const PAGE_NAMES = {
  SALES_HISTORY: 'Sales History',
  CUSTOMER_MANAGEMENT: 'Customer Management',
  ITEM_MANAGEMENT: 'Item Management',
  DAILY_PROFIT_REPORT: 'Daily Profit Report',
  WEEKLY_SUMMARY_REPORT: 'Weekly Summary Report',
  // ... more mappings
} as const;
```

---

## 8. Documentation Requirements

- [ ] Update README with permission system overview
- [ ] Document `usePermissions` hook usage
- [ ] Create developer guide for adding permission checks
- [ ] Document JWT token structure

---

## 9. Success Criteria

✅ **Phase 1 Complete**: JWT token properly decoded with all permission fields  
✅ **Phase 2 Complete**: `usePermissions` hook working correctly  
✅ **Phase 3 Complete**: Navigation filtered based on permissions  
✅ **Phase 4 Complete**: All screens respect permissions  
✅ **Phase 5 Complete**: Error handling implemented  

**Final Success**: Mobile app permission system matches web app functionality, users only see and can only access what they have permissions for.

---

## 10. Next Steps

1. **Review this plan** with the team
2. **Create feature branch**: `feature/mobile-permissions-system`
3. **Start with Phase 1**: Update JWT decoding
4. **Test incrementally** after each phase
5. **Document as you go**

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: Development Team

