# Home Screen - Permission-Aware Implementation Guide

## Overview
All Home screen components must respect the 3-layer permission system:
1. **Layer 1**: Module Visibility (Role Center)
2. **Layer 2**: Page Visibility (Permission Sets)
3. **Layer 3**: CRUD Permissions (Actions)

## Permission Checks for Each Section

### 1. KPI Cards Section
```typescript
// Check if user can see sales KPIs
const canViewKPIs = 
  isModuleVisible('sales') && 
  (hasAnyPageAccess('Sales Dashboard') || hasAnyPageAccess('Sales'));

// If false, hide entire KPI section
```

**API Endpoint**: `/api/sales-dashboard/kpi_metrics/`
**Required Permission**: Read access to Sales Dashboard or Sales page

### 2. Recent Transactions
```typescript
// Check if user can view sales history
const canViewTransactions = 
  isModuleVisible('sales') && 
  (hasAnyPageAccess('Sales History') || hasAnyPageAccess('Sales'));

// If false, hide section or show "No access" message
```

**API Endpoint**: `/api/sales/?limit=10&ordering=-created_at`
**Required Permission**: Read access to Sales History or Sales page

### 3. Quick Actions (Options Component)
Each action needs individual permission check:

```typescript
// Sales action
const canAccessSales = 
  isModuleVisible('sales') && hasAnyPageAccess('Sales');

// Items action
const canAccessItems = 
  isModuleVisible('items') && hasAnyPageAccess('Items');

// Print Labels action
const canPrintLabels = 
  isModuleVisible('items') && canRead('Items');

// Cart action
const canAccessCart = 
  isModuleVisible('sales') && canCreate('Sales');
```

**Filter**: Only show actions user has permission for

### 4. Low Stock Alerts
```typescript
// Check if user can view items
const canViewItems = 
  isModuleVisible('items') && hasAnyPageAccess('Items');

// If false, hide alerts section
```

**API Endpoint**: `/api/items/?low_stock=true` or calculate from items
**Required Permission**: Read access to Items page

## Implementation Pattern

### Example: KPI Cards with Permissions
```typescript
import { usePermissions } from '../../hooks/usePermissions';

const Home = () => {
  const { 
    isModuleVisible, 
    hasAnyPageAccess 
  } = usePermissions();

  // Check permissions
  const canViewKPIs = 
    isModuleVisible('sales') && 
    (hasAnyPageAccess('Sales Dashboard') || hasAnyPageAccess('Sales'));

  const renderQuickStats = () => {
    // Don't render if no permission
    if (!canViewKPIs) {
      return null;
    }

    // ... rest of KPI rendering
  };

  return (
    <View>
      {canViewKPIs && renderQuickStats()}
      {/* ... other sections */}
    </View>
  );
};
```

## API Endpoints Summary

| Section | Endpoint | Method | Permission Required |
|---------|----------|--------|-------------------|
| KPI Metrics | `/api/sales-dashboard/kpi_metrics/` | GET | Sales Dashboard (read) |
| Today's Sales | `/api/sales/?document_date__gte={today}` | GET | Sales (read) |
| Recent Transactions | `/api/sales/?limit=10&ordering=-created_at` | GET | Sales History (read) |
| Low Stock Items | `/api/items/?low_stock=true` | GET | Items (read) |

## Error Handling

### When Permission Denied:
1. **Hide the section** (preferred for clean UI)
2. **Show "No access" message** (if section structure must remain)
3. **Log to console** (for debugging)

### When API Fails:
1. **Show error message** to user
2. **Retry mechanism** (optional)
3. **Fallback to cached data** (if available)

## Testing Checklist

- [ ] User with full permissions sees all sections
- [ ] User with only sales module sees sales sections
- [ ] User with only items module sees items sections
- [ ] User with no permissions sees only header and quick actions (if any)
- [ ] Superuser sees everything
- [ ] API errors are handled gracefully
- [ ] Loading states are shown
- [ ] Empty states are shown when no data

## Next Steps

1. ✅ Update Home.tsx to import usePermissions
2. ✅ Add permission checks to each section
3. ✅ Create API service functions with error handling
4. ✅ Implement KPI Cards with permissions
5. ✅ Implement Recent Transactions with permissions
6. ✅ Update Quick Actions to be permission-aware
7. ✅ Add Low Stock Alerts with permissions



