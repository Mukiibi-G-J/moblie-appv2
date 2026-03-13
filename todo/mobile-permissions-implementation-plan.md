# Mobile App Permissions Implementation Plan

## Overview

This plan outlines how to implement the **3-Layer Hybrid Access Control System** in the React Native mobile app, matching the web application's permission architecture as described in `permissions-implementation-guide.md`.

## Current State Analysis

### ✅ Already Implemented

1. **Foundation Layer**

   - ✅ `usePermissions` hook exists (`src/hooks/usePermissions.ts`)
   - ✅ JWT token decoding extracts all permission fields (`src/context/Store.tsx`)
   - ✅ Type definitions complete (`src/types/auth.ts`)
   - ✅ Navigation filtering in drawer (`src/navigation/CustomDrawer.tsx`)

2. **Permission Utilities**

   - ✅ `isModuleVisible(moduleCode)` - Layer 1
   - ✅ `hasAnyPageAccess(pageName)` - Layer 2
   - ✅ `canAccessPage(pageName, action)` - Layer 3
   - ✅ `canRead`, `canCreate`, `canEdit`, `canDelete` - Convenience methods

3. **Partial Screen Implementation**
   - ✅ Reports screen uses permissions (`src/Screens/Reports/Reports.tsx`)
   - ✅ Home screen uses `isModuleVisible` for navigation

### ❌ Missing Implementation

1. **Page Name Constants**

   - ❌ No centralized page name constants file
   - ❌ Screens don't define their `PAGE_NAME` constant
   - ❌ Inconsistent page name usage

2. **Route Protection**

   - ❌ No route guard component (like web's `AppRoute.tsx`)
   - ❌ Screens can be accessed directly without permission checks
   - ❌ No redirect/error handling for unauthorized access

3. **Screen-Level Permission Checks**

   - ❌ Most screens don't check permissions before rendering
   - ❌ No access denied UI component
   - ❌ Screens render even without read permission

4. **Action-Level Permission Checks**

   - ❌ Buttons/actions don't check permissions
   - ❌ Create/Edit/Delete buttons visible without permission
   - ❌ No disabled state for unauthorized actions

5. **Error Handling**
   - ❌ No handling for 403 Forbidden API responses
   - ❌ No user-friendly error messages for permission denials

## Implementation Plan

### Phase 1: Page Name Constants & Configuration

**Goal**: Create centralized page name constants matching backend page objects.

**Files to Create/Update:**

1. **`src/constants/pageNames.ts`** (NEW)

   ```typescript
   /**
    * Page Name Constants
    *
    * These must match the page names defined in:
    * web/zentro-backend/base/management/commands/populate_page_objects.py
    *
    * Format: PAGE_NAME = "Exact Page Name from Backend"
    */

   export const PAGE_NAMES = {
     // Sales Module (10001-10099)
     SALES_DASHBOARD: 'Sales Dashboard',
     SALES_HISTORY: 'Sales History',
     SALES_INVOICE: 'Sales Invoice',

     // Customers Module (10101-10199)
     CUSTOMER_MANAGEMENT: 'Customer Management',
     CUSTOMER_LIST: 'Customer List',

     // Items Module (10201-10299)
     ITEM_MANAGEMENT: 'Item Management',
     ITEM_LIST: 'Item List',
     ITEM_CATEGORIES: 'Item Categories',

     // Purchases Module (10301-10399)
     PURCHASE_ORDERS: 'Purchase Orders',
     PURCHASE_INVOICES: 'Purchase Invoices',
     SUPPLIERS: 'Suppliers',

     // Payments Module (10401-10499)
     PAYMENTS: 'Payments',
     MY_WALLET: 'My Wallet',

     // Financials Module (10501-10599)
     FINANCIALS: 'Financials',
     ACCOUNTING: 'Accounting',

     // Expenses Module (10601-10699)
     EXPENSES: 'Expenses',
     EXPENSE_TYPES: 'Expense Types',

     // Reports Module
     REPORTS: 'Reports',
     DAILY_PROFIT_REPORT: 'Daily Profit Report',
     WEEKLY_SUMMARY_REPORT: 'Weekly Summary Report',
     MONTHLY_SUMMARY_REPORT: 'Monthly Summary Report',
     PRODUCT_PROFITABILITY_REPORT: 'Product Profitability Report',
     EXPENSE_BREAKDOWN_REPORT: 'Expense Breakdown Report',

     // Inventory Module
     ITEM_JOURNAL: 'Item Journal',
     INVENTORY_ADJUSTMENT: 'Inventory Adjustment',

     // Settings Module
     SETTINGS: 'Settings',
     USER_MANAGEMENT: 'User Management',
   } as const;

   export type PageName = (typeof PAGE_NAMES)[keyof typeof PAGE_NAMES];
   ```

2. **Update `src/constants/permissions.ts`** (if exists)
   - Merge with page names or reference from `pageNames.ts`
   - Ensure consistency

**Tasks:**

- [ ] Create `src/constants/pageNames.ts` with all page names
- [ ] Verify page names match backend `populate_page_objects.py`
- [ ] Export page names as constants
- [ ] Document the mapping

---

### Phase 2: Route Protection Component

**Goal**: Create a route guard component that checks permissions before allowing screen access.

**Files to Create:**

1. **`src/Components/ProtectedScreen.tsx`** (NEW)

   ```typescript
   /**
    * ProtectedScreen Component
    *
    * Wraps screens to enforce permission checks before rendering.
    * Similar to web's AppRoute.tsx but for React Native screens.
    *
    * Usage:
    *   <ProtectedScreen pageName={PAGE_NAMES.ITEMS} requiredAction="read">
    *     <ItemsScreen />
    *   </ProtectedScreen>
    */

   import React from 'react';
   import {View, Text, StyleSheet} from 'react-native';
   import {usePermissions} from '../hooks/usePermissions';
   import {COLORS, FONTS, SIZES} from '../constants';
   import {PAGE_NAMES, PageName} from '../constants/pageNames';

   interface ProtectedScreenProps {
     pageName: PageName;
     requiredAction?: 'read' | 'insert' | 'modify' | 'delete';
     children: React.ReactNode;
     fallback?: React.ReactNode;
   }

   export const ProtectedScreen: React.FC<ProtectedScreenProps> = ({
     pageName,
     requiredAction = 'read',
     children,
     fallback,
   }) => {
     const {canAccessPage, isModuleVisible} = usePermissions();

     // Extract module code from page name (if needed for Layer 1 check)
     // For now, we'll rely on Layer 2 & 3 checks

     // Check if user has required permission
     const hasAccess = canAccessPage(pageName, requiredAction);

     if (!hasAccess) {
       // Return custom fallback or default access denied UI
       if (fallback) {
         return <>{fallback}</>;
       }

       return (
         <View style={styles.container}>
           <View style={styles.content}>
             <Text style={styles.title}>Access Denied</Text>
             <Text style={styles.message}>
               You don't have permission to access this page.
             </Text>
             <Text style={styles.detail}>
               Required: {requiredAction} permission for {pageName}
             </Text>
           </View>
         </View>
       );
     }

     return <>{children}</>;
   };

   const styles = StyleSheet.create({
     container: {
       flex: 1,
       backgroundColor: COLORS.lightGray1,
       justifyContent: 'center',
       alignItems: 'center',
       padding: SIZES.padding,
     },
     content: {
       backgroundColor: COLORS.white,
       borderRadius: SIZES.radius,
       padding: SIZES.padding * 2,
       alignItems: 'center',
       maxWidth: 400,
     },
     title: {
       ...FONTS.h2,
       color: COLORS.error,
       marginBottom: SIZES.base,
     },
     message: {
       ...FONTS.body3,
       color: COLORS.black,
       textAlign: 'center',
       marginBottom: SIZES.base,
     },
     detail: {
       ...FONTS.body4,
       color: COLORS.gray,
       textAlign: 'center',
     },
   });
   ```

2. **Update `App.tsx`** to use ProtectedScreen

   ```typescript
   import {ProtectedScreen} from './src/Components/ProtectedScreen';
   import {PAGE_NAMES} from './src/constants/pageNames';

   // Wrap screens with ProtectedScreen
   <Stack.Screen
     name="Items"
     component={(props: any) => (
       <ProtectedScreen pageName={PAGE_NAMES.ITEM_MANAGEMENT}>
         <Items {...props} />
       </ProtectedScreen>
     )}
   />;
   ```

**Tasks:**

- [ ] Create `src/Components/ProtectedScreen.tsx`
- [ ] Add access denied UI
- [ ] Update `App.tsx` to wrap all screens
- [ ] Test route protection

---

### Phase 3: Screen-Level Permission Checks

**Goal**: Add permission checks at the beginning of each screen component.

**Pattern to Apply:**

```typescript
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

const Items = () => {
  const {canRead, canCreate, canEdit, canDelete} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.ITEM_MANAGEMENT;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Text>Access Denied</Text>
      </View>
    );
  }

  // Rest of component...
};
```

**Screens to Update:**

1. **`src/Screens/Items/Items.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks for buttons

2. **`src/Screens/Customers/Customers.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks

3. **`src/Screens/Sales/SalesHistory.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Verify existing permission usage

4. **`src/Screens/Purchases/Purchases.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks

5. **`src/Screens/Suppliers/Suppliers.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks

6. **`src/Screens/Expenses/Expenses.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks

7. **`src/Screens/Financials/Financials.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks

8. **`src/Screens/Payments/Payments.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check
   - [ ] Add create/edit/delete permission checks

9. **`src/Screens/MyWallet/MyWallet.tsx`**

   - [ ] Add `PAGE_NAME` constant
   - [ ] Add read permission check

10. **`src/Screens/ItemJournal/ItemJournal.tsx`**

    - [ ] Add `PAGE_NAME` constant
    - [ ] Add read permission check
    - [ ] Add create/edit/delete permission checks

11. **`src/Screens/UserManagement/UserManagement.tsx`**

    - [ ] Add `PAGE_NAME` constant
    - [ ] Add read permission check
    - [ ] Add create/edit/delete permission checks

12. **`src/Screens/Settings/Settings.tsx`**
    - [ ] Add `PAGE_NAME` constant
    - [ ] Add read permission check

**Tasks:**

- [ ] Update all screens with permission checks
- [ ] Add `PAGE_NAME` constant to each screen
- [ ] Add early return for no read permission
- [ ] Test each screen with different permission levels

---

### Phase 4: Action-Level Permission Checks

**Goal**: Hide/disable buttons and actions based on permissions.

**Pattern to Apply:**

```typescript
const {canCreate, canEdit, canDelete} = usePermissions();
const PAGE_NAME = PAGE_NAMES.ITEM_MANAGEMENT;

// Create Button
{
  canCreate(PAGE_NAME) && (
    <TouchableOpacity onPress={handleCreate}>
      <Text>Create Item</Text>
    </TouchableOpacity>
  );
}

// Edit Button
<TouchableOpacity
  onPress={handleEdit}
  disabled={!canEdit(PAGE_NAME)}
  style={{opacity: canEdit(PAGE_NAME) ? 1 : 0.5}}>
  <Text>Edit</Text>
</TouchableOpacity>;

// Delete Button
{
  canDelete(PAGE_NAME) && (
    <TouchableOpacity onPress={handleDelete}>
      <Text>Delete</Text>
    </TouchableOpacity>
  );
}
```

**Components to Update:**

1. **Create Buttons**

   - [ ] Items screen - "Add Item" button
   - [ ] Customers screen - "Add Customer" button
   - [ ] Purchases screen - "New Purchase" button
   - [ ] Suppliers screen - "Add Supplier" button
   - [ ] Expenses screen - "Add Expense" button
   - [ ] All other create actions

2. **Edit Buttons**

   - [ ] Items screen - Edit item button
   - [ ] Customers screen - Edit customer button
   - [ ] All edit modals/actions

3. **Delete Buttons**

   - [ ] Items screen - Delete item button
   - [ ] Customers screen - Delete customer button
   - [ ] All delete actions

4. **Special Actions**
   - [ ] Sales - Post/Complete sale button
   - [ ] Purchases - Post purchase button
   - [ ] Payments - Process payment button
   - [ ] Item Journal - Post adjustment button

**Tasks:**

- [ ] Add permission checks to all create buttons
- [ ] Add permission checks to all edit buttons
- [ ] Add permission checks to all delete buttons
- [ ] Add disabled states for unauthorized actions
- [ ] Test button visibility with different permissions

---

### Phase 5: API Error Handling

**Goal**: Handle 403 Forbidden responses gracefully and show user-friendly messages.

**Files to Update:**

1. **`src/axios/axios.ts`** - Add 403 error handling

   ```typescript
   // In response interceptor
   if (error.response?.status === 403) {
     const errorMessage =
       error.response?.data?.detail ||
       'You do not have permission to perform this action.';

     Toast.show({
       type: 'error',
       text1: 'Access Denied',
       text2: errorMessage,
       position: 'bottom',
     });

     return Promise.reject({
       ...error,
       customMessage: errorMessage,
     });
   }
   ```

2. **Create `src/utils/permissionErrors.ts`** (NEW)

   ```typescript
   /**
    * Permission Error Utilities
    *
    * Provides consistent error handling for permission-related API errors
    */

   import Toast from 'react-native-toast-message';

   export const handlePermissionError = (error: any, action: string) => {
     if (error.response?.status === 403) {
       const message =
         error.response?.data?.detail ||
         `You do not have permission to ${action}.`;

       Toast.show({
         type: 'error',
         text1: 'Access Denied',
         text2: message,
         position: 'bottom',
       });

       return true; // Error was handled
     }
     return false; // Error was not a permission error
   };
   ```

**Usage in Screens:**

```typescript
try {
  await createItem(itemData);
} catch (error: any) {
  if (handlePermissionError(error, 'create items')) {
    return; // Error already handled
  }
  // Handle other errors...
}
```

**Tasks:**

- [ ] Update axios interceptor for 403 errors
- [ ] Create permission error utility
- [ ] Update all API calls to handle 403 errors
- [ ] Test error messages

---

### Phase 6: Permission-Aware Components

**Goal**: Create reusable components that automatically check permissions.

**Files to Create:**

1. **`src/Components/PermissionButton.tsx`** (NEW)

   ```typescript
   /**
    * PermissionButton Component
    *
    * Button that automatically hides if user doesn't have permission
    *
    * Usage:
    *   <PermissionButton
    *     pageName={PAGE_NAMES.ITEMS}
    *     action="insert"
    *     onPress={handleCreate}
    *     title="Create Item"
    *   />
    */

   import React from 'react';
   import {TouchableOpacity, Text, StyleSheet} from 'react-native';
   import {usePermissions} from '../hooks/usePermissions';
   import {PageName} from '../constants/pageNames';

   interface PermissionButtonProps {
     pageName: PageName;
     action: 'read' | 'insert' | 'modify' | 'delete';
     onPress: () => void;
     title: string;
     disabled?: boolean;
     style?: any;
     // ... other button props
   }

   export const PermissionButton: React.FC<PermissionButtonProps> = ({
     pageName,
     action,
     onPress,
     title,
     disabled = false,
     style,
     ...props
   }) => {
     const {canAccessPage} = usePermissions();

     const hasPermission = canAccessPage(pageName, action);

     if (!hasPermission) {
       return null; // Don't render if no permission
     }

     return (
       <TouchableOpacity
         onPress={onPress}
         disabled={disabled}
         style={[styles.button, style, disabled && styles.disabled]}
         {...props}>
         <Text style={styles.text}>{title}</Text>
       </TouchableOpacity>
     );
   };
   ```

2. **`src/Components/PermissionGuard.tsx`** (NEW)

   ```typescript
   /**
    * PermissionGuard Component
    *
    * Conditionally renders children based on permission
    *
    * Usage:
    *   <PermissionGuard pageName={PAGE_NAMES.ITEMS} action="insert">
    *     <CreateButton />
    *   </PermissionGuard>
    */

   import React from 'react';
   import {usePermissions} from '../hooks/usePermissions';
   import {PageName} from '../constants/pageNames';

   interface PermissionGuardProps {
     pageName: PageName;
     action: 'read' | 'insert' | 'modify' | 'delete';
     children: React.ReactNode;
     fallback?: React.ReactNode;
   }

   export const PermissionGuard: React.FC<PermissionGuardProps> = ({
     pageName,
     action,
     children,
     fallback = null,
   }) => {
     const {canAccessPage} = usePermissions();

     if (!canAccessPage(pageName, action)) {
       return <>{fallback}</>;
     }

     return <>{children}</>;
   };
   ```

**Tasks:**

- [ ] Create `PermissionButton` component
- [ ] Create `PermissionGuard` component
- [ ] Update screens to use these components
- [ ] Document usage patterns

---

### Phase 7: Testing & Documentation

**Goal**: Ensure all permission checks work correctly and document the implementation.

**Testing Checklist:**

1. **Module Visibility (Layer 1)**

   - [ ] Test drawer shows/hides modules based on role center
   - [ ] Test navigation filtering
   - [ ] Test with different role centers

2. **Page Visibility (Layer 2)**

   - [ ] Test screens show/hide based on page permissions
   - [ ] Test direct navigation to protected screens
   - [ ] Test with different permission sets

3. **Action Permissions (Layer 3)**

   - [ ] Test create buttons show/hide
   - [ ] Test edit buttons show/hide/disable
   - [ ] Test delete buttons show/hide
   - [ ] Test API calls return 403 when unauthorized

4. **Error Handling**
   - [ ] Test 403 error messages
   - [ ] Test access denied UI
   - [ ] Test error recovery

**Documentation:**

1. **Create `src/docs/permissions-guide.md`**

   - Document the 3-layer system
   - Provide usage examples
   - List all page names
   - Troubleshooting guide

2. **Update README**
   - Add permissions section
   - Link to guide

**Tasks:**

- [ ] Test all permission scenarios
- [ ] Create documentation
- [ ] Update README
- [ ] Create troubleshooting guide

---

## Implementation Order

### Recommended Sequence:

1. **Phase 1** - Page Name Constants (Foundation)
2. **Phase 2** - Route Protection (Security)
3. **Phase 3** - Screen-Level Checks (Core)
4. **Phase 4** - Action-Level Checks (UX)
5. **Phase 5** - API Error Handling (Robustness)
6. **Phase 6** - Reusable Components (Efficiency)
7. **Phase 7** - Testing & Documentation (Quality)

---

## Key Principles

1. **Consistency**: Use the same pattern across all screens
2. **Security**: Always check permissions, never trust client-side only
3. **UX**: Hide unauthorized actions, don't just disable them
4. **Error Handling**: Provide clear, actionable error messages
5. **Performance**: Permission checks should be fast (they're just object lookups)

---

## Page Name Mapping Reference

When implementing, ensure page names match exactly with backend:

**Backend File**: `web/zentro-backend/base/management/commands/populate_page_objects.py`

**Format**: `(object_id, "Page Name", module_code, description, route)`

**Example**:

```python
(10201, "Item Management", "items", "Item management page", "/app/items"),
```

**Mobile Constant**:

```typescript
export const PAGE_NAMES = {
  ITEM_MANAGEMENT: 'Item Management', // Must match exactly
};
```

---

## Success Criteria

✅ All screens check read permission before rendering  
✅ All create/edit/delete buttons check permissions  
✅ Route protection prevents unauthorized access  
✅ 403 errors are handled gracefully  
✅ Permission checks are consistent across app  
✅ Documentation is complete  
✅ All tests pass

---

## Notes

- The backend already handles permission checks in API endpoints
- Mobile app should prevent UI actions that would result in 403 errors
- Permission checks are fast (object lookups), so no performance concerns
- Superusers automatically have all permissions
- Fallback to `authority` array for backward compatibility

---

## Estimated Timeline

- **Phase 1**: 2 hours
- **Phase 2**: 3 hours
- **Phase 3**: 8 hours (12 screens × ~40 min each)
- **Phase 4**: 6 hours
- **Phase 5**: 2 hours
- **Phase 6**: 3 hours
- **Phase 7**: 4 hours

**Total**: ~28 hours

---

## Next Steps

1. Review this plan
2. Start with Phase 1 (Page Name Constants)
3. Implement phases sequentially
4. Test after each phase
5. Document as you go
