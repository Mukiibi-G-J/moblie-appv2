# Home Screen Implementation Plan

## Current State
✅ Header with welcome, user info, date, store status
✅ Quick Actions (Options component)
❌ KPI Cards (commented out)
❌ Recent Transactions (placeholder)
❌ Alerts/Notifications

## Recommended Home Screen Structure

### 1. **Header Section** (Already Implemented ✅)
- Welcome message
- User name
- Role badge
- Current date
- Store status (Open/Closed)

### 2. **KPI Cards Section** (Priority 1 - High Impact)
Display today's key metrics in cards:

#### Main KPI Card (Large, Prominent)
- **Today's Revenue**
  - Amount in UGX
  - Trend indicator (↑/↓) with percentage change vs yesterday
  - "Compared to yesterday" text

#### Secondary KPI Cards (2-3 smaller cards in a row)
- **Orders Today**
  - Count of sales invoices today
  - Subtext: "X completed"
  
- **Products Sold**
  - Total quantity of items sold today
  - Progress bar showing % of total inventory
  
- **Low Stock Alerts** (if applicable)
  - Count of items with low stock
  - Red badge/alert style

### 3. **Quick Actions** (Already Implemented ✅)
- Sales
- Items
- Print Labels
- Cart

**Improvement**: Make it role-based, show only actions user has permission for

### 4. **Recent Transactions** (Priority 2)
List of last 5-10 sales transactions:
- Invoice number
- Customer name (if any)
- Amount
- Time/Date
- Status (Paid/Pending)
- Tap to view details

### 5. **Alerts & Notifications** (Priority 3)
- Low stock items (if any)
- Pending payments
- Important system notifications
- Tap to view details

## Data Requirements

### API Endpoints Needed:
1. **Today's Sales Summary**
   - Endpoint: `/api/sales-dashboard/kpi_metrics/` or similar
   - Returns:
     - Today's revenue
     - Today's order count
     - Yesterday's revenue (for comparison)
     - Growth percentage

2. **Today's Products Sold**
   - Endpoint: `/api/sales-dashboard/` with today's date filter
   - Or calculate from sales invoice lines

3. **Low Stock Items**
   - Endpoint: `/api/items/?low_stock=true` or similar
   - Returns count or list

4. **Recent Transactions**
   - Endpoint: `/api/sales-invoices/?limit=10&ordering=-created_at`
   - Returns last 10 invoices

## Permission Requirements

### KPI Cards Section
- **Requires**: `canRead('Sales Dashboard')` OR `canRead('Sales')`
- **Check**: `isModuleVisible('sales')` AND `hasAnyPageAccess('Sales Dashboard')`
- **If no permission**: Hide entire KPI section

### Recent Transactions
- **Requires**: `canRead('Sales History')` OR `canRead('Sales')`
- **Check**: `isModuleVisible('sales')` AND `hasAnyPageAccess('Sales History')`
- **If no permission**: Hide section or show "No access" message

### Quick Actions
- **Sales**: `isModuleVisible('sales')` AND `hasAnyPageAccess('Sales')`
- **Items**: `isModuleVisible('items')` AND `hasAnyPageAccess('Items')`
- **Print Labels**: `isModuleVisible('items')` AND `canRead('Items')`
- **Cart**: `isModuleVisible('sales')` AND `canCreate('Sales')`

### Low Stock Alerts
- **Requires**: `canRead('Items')`
- **Check**: `isModuleVisible('items')` AND `hasAnyPageAccess('Items')`
- **If no permission**: Hide alerts

## Implementation Steps

### Step 1: Create KPI Cards Component (WITH PERMISSIONS)
- Uncomment and enhance the existing `renderQuickStats` function
- **Add permission check**: Only render if user has sales read access
- Connect to API for real data
- Add loading states
- Add error handling
- **Hide entire section if no permission**

### Step 2: Create Recent Transactions Component
- Create new component or section
- Fetch recent sales invoices
- Display in a scrollable list
- Add navigation to invoice details

### Step 3: Create Alerts Component
- Fetch low stock items
- Display alert cards
- Add navigation to items screen

### Step 4: Enhance Quick Actions
- Make it role-based
- Add more actions if needed
- Improve styling

## Design Guidelines

### KPI Cards:
- Use card-based design with shadows
- Primary color for main metric
- Green for positive trends, red for negative
- Icons for each metric
- Responsive layout (2 columns for secondary cards)

### Recent Transactions:
- Clean list design
- Alternating row colors or card-based
- Show key info at a glance
- Pull-to-refresh support

### Alerts:
- Red/orange accent colors
- Badge with count
- Clear call-to-action

## Mobile-Specific Considerations

1. **Performance**: 
   - Lazy load data
   - Cache where appropriate
   - Show loading skeletons

2. **Offline Support**:
   - Show cached data when offline
   - Indicate offline status

3. **Pull to Refresh**:
   - Allow users to refresh all data

4. **Empty States**:
   - Show helpful messages when no data
   - Guide users to take action

## Priority Order

1. **KPI Cards** - Most important, shows business health at a glance
2. **Recent Transactions** - Helps users see recent activity
3. **Alerts** - Important but less critical
4. **Enhanced Quick Actions** - Nice to have

