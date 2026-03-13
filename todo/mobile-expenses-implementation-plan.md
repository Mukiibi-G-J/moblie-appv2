# Mobile Expenses Module - Implementation Plan

## Overview

This plan outlines the implementation of the Expenses module for the React Native mobile app, following the web implementation patterns described in `expenses-implementation.md` while adapting to mobile-specific UI/UX patterns.

## Current State

- ✅ Basic Expenses screen exists (`src/Screens/Expenses/Expenses.tsx`) with permission checks
- ✅ Page name constant defined (`PAGE_NAMES.EXPENSES`)
- ✅ Permission system integrated (`usePermissions` hook)
- ❌ No service layer for expenses
- ❌ No type definitions
- ❌ No UI implementation (just placeholder)

## Implementation Phases

### Phase 1: Foundation Setup (Service Layer & Types)

#### 1.1 Create Type Definitions
**File:** `src/@types/expense.ts`

```typescript
export interface Expense {
  id: number;
  document_no: string;
  posting_date: string;
  description?: string;
  expense_type: number;
  expense_type_name?: string;
  amount: number;
  payment_method?: number;
  payment_method_name?: string;
  status: 'Open' | 'Posted' | 'Reversed';
  gl_account?: number;
  gl_account_name?: string;
  balancing_account?: number;
  balancing_account_name?: string;
  external_document_no?: string;
  created_at?: string;
  updated_at?: string;
  posted_at?: string;
  posted_by?: number;
}

export interface ExpenseType {
  id: number;
  name: string;
  code?: string;
  category?: number;
  gl_account?: number;
}

export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  gl_account?: number;
}

export interface ExpenseFormValues {
  posting_date: string;
  expense_type: number | null;
  description: string;
  amount: string; // String for input, converted to number
  payment_method: number | null;
  external_document_no?: string;
  status?: 'Open' | 'Posted';
}

export interface PostingPreview {
  expense_id: number;
  document_no: string;
  debit_entry: {
    gl_account: string;
    gl_account_name: string;
    amount: number;
    description: string;
  };
  credit_entry: {
    gl_account: string;
    gl_account_name: string;
    amount: number;
    description: string;
  };
}
```

#### 1.2 Create Expense Service
**File:** `src/services/ExpenseServices.ts`

Following the pattern from `app.services.ts` and web `ExpenseServices.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';
import {Expense, ExpenseType, PaymentMethod, PostingPreview} from '../@types/expense';

interface ExpenseListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: 'Open' | 'Posted' | 'Reversed';
  expense_type?: number;
  start_date?: string;
  end_date?: string;
}

interface PaginatedExpenseResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Expense[];
}

export const ExpenseServices = {
  // Get expenses list with filters
  async getExpenses(params?: ExpenseListParams): Promise<PaginatedExpenseResponse> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.get('/api/expenses/expenses/', {params});
      
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data;
      }
      return {count: 0, next: null, previous: null, results: []};
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }
  },

  // Get single expense
  async getExpense(id: number): Promise<Expense> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.get(`/api/expenses/expenses/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching expense:', error);
      throw error;
    }
  },

  // Create expense
  async createExpense(data: Partial<Expense>): Promise<Expense> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.post('/api/expenses/expenses/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  },

  // Update expense
  async updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.put(`/api/expenses/expenses/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  },

  // Delete expense
  async deleteExpense(id: number): Promise<void> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      await axiosInstance.delete(`/api/expenses/expenses/${id}/`);
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  },

  // Get expense types
  async getExpenseTypes(): Promise<ExpenseType[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.get('/api/expenses/expense-types/');
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      return [];
    } catch (error) {
      console.error('Error fetching expense types:', error);
      throw error;
    }
  },

  // Get payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.get('/api/expenses/expenses/payment_methods/');
      if (response?.data?.results && Array.isArray(response.data.results)) {
        return response.data.results;
      }
      return [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  },

  // Preview posting
  async previewPosting(id: number): Promise<PostingPreview> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.get(`/api/expenses/expenses/${id}/preview_posting/`);
      return response.data;
    } catch (error) {
      console.error('Error previewing posting:', error);
      throw error;
    }
  },

  // Post expense
  async postExpense(id: number): Promise<{message: string; expense: Expense}> {
    try {
      const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
      const axiosInstance = createAxiosInstance(tenant);
      
      const response = await axiosInstance.post(`/api/expenses/expenses/${id}/post_expense/`);
      return response.data;
    } catch (error) {
      console.error('Error posting expense:', error);
      throw error;
    }
  },
};
```

---

### Phase 2: Main Expenses Screen (List View)

#### 2.1 Screen Structure
**File:** `src/Screens/Expenses/Expenses.tsx`

Following the pattern from `Items.tsx`:

**Key Features:**
- FlatList for expenses
- Search bar at top
- Filter chips (Status, Date Range)
- Pull-to-refresh
- Pagination (load more)
- FAB (Floating Action Button) for create (if permission)
- Empty state
- Loading states

**Components Needed:**
1. Expense list item component
2. Expense form modal
3. Filter modal
4. Post expense confirmation modal
5. Preview posting modal

#### 2.2 Expense List Item Component
**File:** `src/Screens/Expenses/ExpenseListItem.tsx`

Display:
- Document No (bold)
- Expense Type Name
- Amount (UGX formatted)
- Status badge (Open/Posted/Reversed)
- Posting Date
- Payment Method (if posted)
- Action buttons (Edit/Delete/Post) based on permissions and status

#### 2.3 State Management

```typescript
const [expenses, setExpenses] = useState<Expense[]>([]);
const [loading, setLoading] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Posted' | 'Reversed'>('All');
const [dateFrom, setDateFrom] = useState<string | null>(null);
const [dateTo, setDateTo] = useState<string | null>(null);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
const [isFormModalVisible, setIsFormModalVisible] = useState(false);
const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
const [isPostModalVisible, setIsPostModalVisible] = useState(false);
```

---

### Phase 3: Expense Form Modal

#### 3.1 Form Structure
**File:** `src/Screens/Expenses/ExpenseFormModal.tsx`

**Fields:**
1. **Document No** (Read-only, auto-generated)
   - TextInput, disabled
   - Shows "Auto-generated" when creating new

2. **Posting Date** (Required)
   - Date picker (use `@react-native-community/datetimepicker`)
   - Default: today

3. **Expense Type** (Required)
   - Picker dropdown
   - Load from `expenseTypes` state
   - Shows name, code optional

4. **Description** (Optional)
   - TextInput, multiline

5. **Amount** (Required)
   - TextInput, numeric keyboard
   - Format: UGX with commas
   - Validation: > 0

6. **Payment Method** (Optional for Open, Required for Posted)
   - Picker dropdown
   - Load from `paymentMethods` state
   - Disabled if status is "Posted"

7. **External Document No** (Optional)
   - TextInput

8. **Status** (Read-only for existing)
   - Badge display
   - Can't change after posting

**Form Validation:**
- Expense Type: Required
- Amount: Required, > 0
- Posting Date: Required
- Payment Method: Required if posting

**Actions:**
- Save (creates/updates expense)
- Cancel (closes modal)
- Post (only if status is "Open", shows confirmation)

#### 3.2 Form Component Pattern

Following mobile patterns from `Items.tsx` EditItemModal:

```typescript
interface ExpenseFormModalProps {
  visible: boolean;
  onClose: () => void;
  expense: Expense | null; // null for create, Expense for edit
  onSave: (expense: Expense) => void;
  expenseTypes: ExpenseType[];
  paymentMethods: PaymentMethod[];
  canEdit: boolean;
  canDelete: boolean;
  canPost: boolean;
}
```

---

### Phase 4: Filter & Search

#### 4.1 Search Bar
- TextInput at top of list
- Debounced search (500ms)
- Searches: document_no, description, expense_type_name
- Clear button when text entered

#### 4.2 Filter Modal
**File:** `src/Screens/Expenses/ExpenseFilterModal.tsx`

**Filters:**
1. **Status**
   - Radio buttons: All, Open, Posted, Reversed

2. **Date Range**
   - Date picker for "From Date"
   - Date picker for "To Date"
   - Clear button

3. **Expense Type**
   - Multi-select or single select
   - Load from expenseTypes

**Actions:**
- Apply Filters
- Clear All
- Cancel

---

### Phase 5: Post Expense Flow

#### 5.1 Post Confirmation Modal
**File:** `src/Screens/Expenses/PostExpenseModal.tsx`

**Shows:**
- Expense details summary
- Preview of G/L entries (from preview_posting API)
- Confirmation message
- Warning if payment method missing

**Actions:**
- Confirm Post
- Cancel
- Preview Posting (shows detailed G/L preview)

#### 5.2 Preview Posting Modal
**File:** `src/Screens/Expenses/PreviewPostingModal.tsx`

**Shows:**
- Debit Entry:
  - G/L Account (code + name)
  - Amount
  - Description
- Credit Entry:
  - G/L Account (code + name)
  - Amount
  - Description

**Actions:**
- Post Now
- Cancel

---

### Phase 6: UI Components & Styling

#### 6.1 Status Badge Component
**File:** `src/Screens/Expenses/ExpenseStatusBadge.tsx`

```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'Open':
      return COLORS.warning; // Yellow/Orange
    case 'Posted':
      return COLORS.success; // Green
    case 'Reversed':
      return COLORS.error; // Red
    default:
      return COLORS.gray;
  }
};
```

#### 6.2 Amount Display
- Format: `UGX {(amount || 0).toFixed(0).toLocaleString()}`
- Large, bold for emphasis
- Color: COLORS.primary or COLORS.black

#### 6.3 Empty State
- Icon
- Message: "No expenses found"
- Sub-message: "Tap + to create your first expense"
- Only show create button if has permission

---

### Phase 7: Permission Integration

#### 7.1 Permission Checks

```typescript
const {canRead, canCreate, canEdit, canDelete} = usePermissions();
const PAGE_NAME = PAGE_NAMES.EXPENSES;

// Early return if no read permission
if (!canRead(PAGE_NAME)) {
  return <AccessDeniedView />;
}

// Hide create button if no create permission
const showCreateButton = canCreate(PAGE_NAME);

// Hide edit/delete buttons if no permissions
const canEditExpense = canEdit(PAGE_NAME);
const canDeleteExpense = canDelete(PAGE_NAME);

// Post permission (usually same as edit for expenses)
const canPostExpense = canEdit(PAGE_NAME);
```

#### 7.2 Action Button Visibility

- **Create FAB**: Only if `canCreate(PAGE_NAME)`
- **Edit Button**: Only if `canEdit(PAGE_NAME)` AND status is "Open"
- **Delete Button**: Only if `canDelete(PAGE_NAME)` AND status is "Open"
- **Post Button**: Only if `canEdit(PAGE_NAME)` AND status is "Open"

---

### Phase 8: Error Handling & Loading States

#### 8.1 Loading States
- **Initial Load**: Full screen spinner with "Loading expenses..."
- **Refresh**: Pull-to-refresh indicator
- **Load More**: Footer spinner in FlatList
- **Form Submit**: Button disabled, spinner in button
- **Post Expense**: Loading overlay on modal

#### 8.2 Error Handling
- **403 Forbidden**: Show permission error, hide action buttons
- **400 Bad Request**: Show validation errors in form
- **404 Not Found**: Show "Expense not found" message
- **Network Error**: Show retry button
- **Generic Error**: Show error toast with message

#### 8.3 Success Feedback
- **Create**: Toast "Expense created successfully"
- **Update**: Toast "Expense updated successfully"
- **Delete**: Toast "Expense deleted successfully"
- **Post**: Toast with message from API (includes G/L entry count)

---

### Phase 9: Data Flow & API Integration

#### 9.1 Load Expenses Flow

```
Component Mount
    ↓
useEffect(() => {
  loadExpenseTypes();
  loadPaymentMethods();
  loadExpenses();
}, [])
    ↓
ExpenseServices.getExpenses(params)
    ↓
Update state: setExpenses(response.results)
    ↓
Render FlatList
```

#### 9.2 Create Expense Flow

```
User taps Create FAB
    ↓
Open ExpenseFormModal (expense = null)
    ↓
User fills form
    ↓
User taps Save
    ↓
Validate form
    ↓
ExpenseServices.createExpense(data)
    ↓
Success: Close modal, refresh list, show toast
    ↓
Error: Show validation errors
```

#### 9.3 Post Expense Flow

```
User taps Post button
    ↓
Check: status === "Open" AND payment_method exists
    ↓
If missing payment method: Show error, open form
    ↓
If valid: Open PostExpenseModal
    ↓
User confirms
    ↓
ExpenseServices.postExpense(id)
    ↓
Success: Refresh list, show toast, close modal
    ↓
Error: Show error message
```

---

### Phase 10: File Structure

```
src/
├── Screens/
│   └── Expenses/
│       ├── Expenses.tsx                    # Main screen
│       ├── ExpenseListItem.tsx            # List item component
│       ├── ExpenseFormModal.tsx           # Create/Edit form
│       ├── ExpenseFilterModal.tsx         # Filter modal
│       ├── PostExpenseModal.tsx           # Post confirmation
│       ├── PreviewPostingModal.tsx       # G/L preview
│       └── ExpenseStatusBadge.tsx         # Status badge component
├── services/
│   └── ExpenseServices.ts                 # API service layer
└── @types/
    └── expense.ts                          # TypeScript types
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `src/@types/expense.ts` with all interfaces
- [ ] Create `src/services/ExpenseServices.ts` with all methods
- [ ] Test API endpoints connectivity
- [ ] Verify tenant context handling

### Phase 2: Main Screen
- [ ] Implement Expenses.tsx with FlatList
- [ ] Add search bar with debounce
- [ ] Add pull-to-refresh
- [ ] Add pagination (load more)
- [ ] Add empty state
- [ ] Add loading states
- [ ] Add FAB for create (with permission check)

### Phase 3: List Item
- [ ] Create ExpenseListItem.tsx
- [ ] Display all expense fields
- [ ] Add status badge
- [ ] Format amount (UGX)
- [ ] Add action buttons (Edit/Delete/Post)
- [ ] Handle item press (open form for edit)

### Phase 4: Form Modal
- [ ] Create ExpenseFormModal.tsx
- [ ] Implement all form fields
- [ ] Add date picker for posting_date
- [ ] Add picker for expense_type
- [ ] Add picker for payment_method
- [ ] Add numeric input for amount (with formatting)
- [ ] Add form validation
- [ ] Handle create mode
- [ ] Handle edit mode
- [ ] Disable fields when status is "Posted"
- [ ] Add Save button
- [ ] Add Cancel button
- [ ] Add Post button (conditional)

### Phase 5: Filters
- [ ] Create ExpenseFilterModal.tsx
- [ ] Add status filter (radio buttons)
- [ ] Add date range pickers
- [ ] Add expense type filter
- [ ] Implement Apply Filters
- [ ] Implement Clear All
- [ ] Update main screen to use filters

### Phase 6: Post Expense
- [ ] Create PostExpenseModal.tsx
- [ ] Create PreviewPostingModal.tsx
- [ ] Implement preview_posting API call
- [ ] Display G/L entries preview
- [ ] Implement post_expense API call
- [ ] Handle success/error
- [ ] Refresh list after posting

### Phase 7: Permissions
- [ ] Add permission checks to main screen
- [ ] Hide/show FAB based on create permission
- [ ] Hide/show action buttons based on permissions
- [ ] Disable actions for posted expenses
- [ ] Show access denied view if no read permission

### Phase 8: Error Handling
- [ ] Add try-catch to all API calls
- [ ] Show error toasts
- [ ] Handle 403 errors (permissions)
- [ ] Handle 400 errors (validation)
- [ ] Handle network errors
- [ ] Add retry mechanisms

### Phase 9: Polish
- [ ] Add animations (modal transitions)
- [ ] Add haptic feedback on actions
- [ ] Optimize FlatList performance
- [ ] Add skeleton loaders
- [ ] Test on different screen sizes
- [ ] Test with different permission levels

### Phase 10: Testing
- [ ] Test create expense
- [ ] Test edit expense (Open status)
- [ ] Test delete expense (Open status)
- [ ] Test post expense
- [ ] Test filter by status
- [ ] Test filter by date range
- [ ] Test search
- [ ] Test pagination
- [ ] Test pull-to-refresh
- [ ] Test permission restrictions
- [ ] Test error scenarios

---

## Key Differences from Web Implementation

### 1. Form Pattern
- **Web**: Auto-save on blur for each field
- **Mobile**: Explicit Save button (better UX for mobile)

### 2. Layout
- **Web**: Two-column grid, card-based
- **Mobile**: Single column list, modal forms

### 3. Date Picker
- **Web**: Custom date picker component
- **Mobile**: Native `@react-native-community/datetimepicker`

### 4. Select/Picker
- **Web**: Custom Select component
- **Mobile**: `@react-native-picker/picker` or custom modal picker

### 5. Currency Formatting
- **Web**: Formatted in display components
- **Mobile**: Same pattern, but ensure proper formatting for numeric inputs

### 6. Navigation
- **Web**: Route-based navigation
- **Mobile**: Modal-based for forms (better UX)

---

## API Endpoint Mapping

All endpoints use base path: `/api/expenses/`

| Action | Method | Endpoint | Mobile Service Method |
|--------|--------|----------|----------------------|
| List | GET | `/api/expenses/expenses/` | `ExpenseServices.getExpenses()` |
| Get One | GET | `/api/expenses/expenses/{id}/` | `ExpenseServices.getExpense()` |
| Create | POST | `/api/expenses/expenses/` | `ExpenseServices.createExpense()` |
| Update | PUT | `/api/expenses/expenses/{id}/` | `ExpenseServices.updateExpense()` |
| Delete | DELETE | `/api/expenses/expenses/{id}/` | `ExpenseServices.deleteExpense()` |
| Get Types | GET | `/api/expenses/expense-types/` | `ExpenseServices.getExpenseTypes()` |
| Get Payment Methods | GET | `/api/expenses/expenses/payment_methods/` | `ExpenseServices.getPaymentMethods()` |
| Preview Posting | GET | `/api/expenses/expenses/{id}/preview_posting/` | `ExpenseServices.previewPosting()` |
| Post Expense | POST | `/api/expenses/expenses/{id}/post_expense/` | `ExpenseServices.postExpense()` |

---

## Dependencies

### Required Packages
- `@react-native-community/datetimepicker` - Date picker
- `@react-native-picker/picker` - Picker component (or custom modal picker)
- `react-native-toast-message` - Toast notifications (already installed)

### Optional Packages
- `react-native-gesture-handler` - For better gestures (already installed)
- `react-native-reanimated` - For animations (already installed)

---

## Notes

1. **Currency Formatting**: Always use UGX format with no decimals: `UGX {(amount || 0).toFixed(0).toLocaleString()}`

2. **Status Management**: 
   - Only "Open" expenses can be edited/deleted
   - Only "Open" expenses can be posted
   - Posted expenses are read-only

3. **Payment Method**:
   - Optional when creating draft (status="Open")
   - Required when posting
   - Show warning if missing when trying to post

4. **G/L Account Mapping**:
   - Auto-set from expense type (expense account)
   - Auto-set from payment method (balancing account)
   - No manual selection needed

5. **Document Number**:
   - Auto-generated by backend
   - Read-only field
   - Format: "EXP-00001", "EXP-00002", etc.

---

## Success Criteria

✅ User can view list of expenses with filters and search  
✅ User can create new expense (with permissions)  
✅ User can edit open expenses (with permissions)  
✅ User can delete open expenses (with permissions)  
✅ User can post expenses (with permissions)  
✅ User can preview G/L entries before posting  
✅ All actions respect permission system  
✅ Proper error handling and user feedback  
✅ Mobile-optimized UI/UX  
✅ Follows existing mobile app patterns  

---

## Next Steps

1. Start with Phase 1 (Foundation) - Create types and services
2. Implement Phase 2 (Main Screen) - Basic list view
3. Add Phase 3 (Form Modal) - Create/edit functionality
4. Add Phase 4 (Filters) - Search and filter
5. Add Phase 5 (Post Flow) - Post expense functionality
6. Polish and test (Phases 6-10)

---

## References

- Web Implementation: `web/zentro-frontend/src/views/expenses/Expenses.tsx`
- Web Service: `web/zentro-frontend/src/services/ExpenseServices.ts`
- Implementation Guide: `todo/expenses-implementation.md`
- Mobile Patterns: `src/Screens/Items/Items.tsx`
- Mobile Services: `src/services/app.services.ts`
- Permission System: `src/hooks/usePermissions.ts`

