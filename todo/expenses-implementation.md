# Expenses Module - Implementation Guide

## Overview

This guide explains how to implement expense recording functionality in ZentroApp. The Expenses module allows users to record business expenses with automatic G/L account mapping and posting capabilities.

## Module Structure

### Backend Components

**Models** (`expenses/models.py`):
- `Expense` - Main expense record
- `ExpenseType` - Expense categorization
- `ExpenseCategory` - High-level expense categories

**ViewSet** (`expenses/views.py`):
- `ExpenseViewSet` - CRUD operations with permission checks
- `ExpenseTypeViewSet` - Manage expense types
- `ExpenseCategoryViewSet` - Manage expense categories

**Serializers** (`expenses/serializers.py`):
- `ExpenseSerializer` - Main expense serializer
- `ExpenseTypeSerializer` - Expense type serializer
- `ExpenseCategorySerializer` - Category serializer

### Frontend Components

**Views**:
- `Expenses.tsx` - Main expense entry page
- `ExpenseHistory.tsx` - Posted expense history (optional)

**Services** (`src/services/ExpenseServices.ts`):
- API service methods for expense operations

## API Endpoints

### Base URL
All expense endpoints are under: `/api/expenses/`

### Main Endpoints

#### 1. List Expenses
```
GET /api/expenses/expenses/
```
**Query Parameters:**
- `page` - Page number
- `page_size` - Items per page
- `search` - Search in document_no, description, expense_type
- `status` - Filter by status (Open, Posted, Reversed)
- `expense_type` - Filter by expense type ID
- `start_date` - Filter from date
- `end_date` - Filter to date

**Response:**
```json
{
  "count": 100,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "document_no": "EXP-00001",
      "posting_date": "2025-01-15",
      "description": "Office supplies",
      "expense_type": 5,
      "expense_type_name": "Office Supplies",
      "amount": 50000,
      "payment_method": 1,
      "payment_method_name": "Cash",
      "status": "Open",
      "gl_account": 101,
      "gl_account_name": "Office Expenses",
      "balancing_account": 201,
      "balancing_account_name": "Cash",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### 2. Get Single Expense
```
GET /api/expenses/expenses/{id}/
```

#### 3. Create Expense
```
POST /api/expenses/expenses/
```
**Request Body:**
```json
{
  "posting_date": "2025-01-15",
  "document_type": "Expense",
  "description": "Office supplies purchase",
  "expense_type": 5,
  "amount": 50000,
  "payment_method": 1,
  "status": "Open"
}
```

**Notes:**
- `document_no` is auto-generated
- `gl_account` and `balancing_account` are auto-set based on expense type and payment method
- `payment_method` is optional for draft expenses (status="Open")
- `payment_method` is required when posting

#### 4. Update Expense
```
PUT /api/expenses/expenses/{id}/
PATCH /api/expenses/expenses/{id}/
```

#### 5. Delete Expense
```
DELETE /api/expenses/expenses/{id}/
```

### Custom Actions

#### Preview Posting
```
GET /api/expenses/expenses/{id}/preview_posting/
```
**Response:**
```json
{
  "expense_id": 1,
  "document_no": "EXP-00001",
  "debit_entry": {
    "gl_account": "5010",
    "gl_account_name": "Office Expenses",
    "amount": 50000,
    "description": "Office supplies"
  },
  "credit_entry": {
    "gl_account": "1010",
    "gl_account_name": "Cash",
    "amount": 50000,
    "description": "Office supplies"
  }
}
```

#### Post Expense
```
POST /api/expenses/expenses/{id}/post_expense/
```
**Response:**
```json
{
  "message": "Expense EXP-00001 posted successfully. 2 G/L entries created.",
  "expense": { /* updated expense object */ }
}
```

#### Dashboard Summary
```
GET /api/expenses/expenses/dashboard_summary/
```
**Query Parameters:**
- `days` - Number of days to include (default: 30)

**Response:**
```json
{
  "total_expenses": 500000,
  "expense_count": 25,
  "draft_count": 5,
  "top_expense_types": [...],
  "recent_expenses": [...],
  "monthly_trend": [...]
}
```

### Reference Data Endpoints

#### Get Expense Types
```
GET /api/expenses/expense-types/
```

#### Get Expense Categories
```
GET /api/expenses/expense-categories/
```

#### Get Payment Methods
```
GET /api/expenses/expenses/payment_methods/
```

## Creating an Expense

### Step-by-Step Process

1. **User fills form with:**
   - Posting date
   - Expense type (required)
   - Description
   - Amount (required, must be > 0)
   - Payment method (optional for drafts)

2. **Frontend sends POST request:**
   ```typescript
   const expenseData = {
     posting_date: "2025-01-15",
     expense_type: 5,
     description: "Office supplies",
     amount: 50000,
     payment_method: 1,
     status: "Open"
   };
   
   const response = await ExpenseServices.createExpense(expenseData);
   ```

3. **Backend processes:**
   - Validates required fields
   - Auto-generates `document_no` (if not provided)
   - Auto-sets `gl_account` from expense type
   - Auto-sets `balancing_account` from payment method
   - Creates expense record

4. **Response includes:**
   - Created expense with all fields populated
   - Auto-generated document number
   - G/L account mappings

### Auto-Generated Fields

- **document_no**: Generated from NoSeries if not provided
- **gl_account**: Set from `expense_type.gl_account` or `expense_type.category.default_gl_account`
- **balancing_account**: Set from `payment_method.gl_account`
- **status**: Defaults to "Open"

## Expense Status Flow

```
Open → Posted → Reversed
```

- **Open**: Draft expense, can be edited/deleted
- **Posted**: Posted to G/L, cannot be edited (can be reversed)
- **Reversed**: Reversed entry created, expense is closed

## Posting an Expense

### Prerequisites

1. Expense must have status = "Open"
2. Expense must have `expense_type` (sets G/L account)
3. Expense must have `payment_method` (sets balancing account)
4. Amount must be > 0

### Posting Process

1. **Preview posting** (optional):
   ```
   GET /api/expenses/expenses/{id}/preview_posting/
   ```
   Shows what G/L entries will be created

2. **Post expense**:
   ```
   POST /api/expenses/expenses/{id}/post_expense/
   ```
   Creates G/L entries:
   - **Debit**: Expense G/L account (from expense type)
   - **Credit**: Balancing account (from payment method)

3. **Result**:
   - Expense status changes to "Posted"
   - G/L entries created
   - `posted_at` and `posted_by` fields set
   - Expense becomes read-only

## Frontend Implementation Pattern

### Component Structure

```typescript
function Expenses() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const PAGE_NAME = "Expenses";
  
  // State management
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Load data
  useEffect(() => {
    loadExpenses();
    loadReferenceData();
  }, []);
  
  // CRUD operations
  const handleCreate = async (data: ExpenseFormValues) => {
    const response = await ExpenseServices.createExpense(data);
    // Refresh list
  };
  
  const handleUpdate = async (id: number, data: ExpenseFormValues) => {
    const response = await ExpenseServices.updateExpense(id, data);
    // Refresh list
  };
  
  const handleDelete = async (id: number) => {
    await ExpenseServices.deleteExpense(id);
    // Refresh list
  };
  
  const handlePost = async (id: number) => {
    await ExpenseServices.postExpense(id);
    // Refresh list
  };
  
  return (
    <BaseTable
      data={expenses}
      columns={expenseColumns}
      onEdit={canEdit(PAGE_NAME) ? handleEdit : undefined}
      onDelete={canDelete(PAGE_NAME) ? handleDelete : undefined}
    />
  );
}
```

### Form Fields

**Required Fields:**
- `expense_type` - Expense type ID
- `amount` - Amount (must be > 0)
- `posting_date` - Posting date

**Optional Fields:**
- `description` - Expense description
- `payment_method` - Payment method ID (required for posting)
- `external_document_no` - External reference number

**Auto-Generated (Read-Only):**
- `document_no` - Auto-generated document number
- `gl_account` - Set from expense type
- `balancing_account` - Set from payment method
- `status` - Defaults to "Open"

## Data Flow

```
User Input
    ↓
Frontend Form (Expenses.tsx)
    ↓
ExpenseServices.createExpense()
    ↓
POST /api/expenses/expenses/
    ↓
ExpenseViewSet.create() [Permission Check]
    ↓
ExpenseSerializer.validate()
    ↓
Expense.save() [Auto-generate document_no, set G/L accounts]
    ↓
Response with created expense
    ↓
Frontend updates Redux store
    ↓
Table refreshes
```

## Key Features

### 1. Auto G/L Account Mapping
- Expense type determines expense G/L account
- Payment method determines balancing account
- No manual G/L account selection needed

### 2. Document Number Generation
- Auto-generated from NoSeries
- Format: "EXP-00001", "EXP-00002", etc.

### 3. Status Management
- Open expenses can be edited/deleted
- Posted expenses are read-only (can be reversed)
- Reversed expenses are closed

### 4. Permission Integration
- All endpoints check permissions using Page Object ID 10601
- Frontend uses `usePermissions` hook
- Buttons show/hide based on permissions

## API Service Pattern

```typescript
class ExpenseServices {
  // List with filters
  static async getExpenses(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    expense_type?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return ApiService.fetchData({
      url: "/expenses/",
      method: "GET",
      params,
    });
  }
  
  // Create
  static async createExpense(data: Partial<Expense>) {
    return ApiService.fetchData({
      url: "/expenses/",
      method: "POST",
      data,
    });
  }
  
  // Update
  static async updateExpense(id: number, data: Partial<Expense>) {
    return ApiService.fetchData({
      url: `/expenses/${id}/`,
      method: "PUT",
      data,
    });
  }
  
  // Delete
  static async deleteExpense(id: number) {
    return ApiService.fetchData({
      url: `/expenses/${id}/`,
      method: "DELETE",
    });
  }
  
  // Post
  static async postExpense(id: number) {
    return ApiService.fetchData({
      url: `/expenses/${id}/post_expense/`,
      method: "POST",
    });
  }
  
  // Reference data
  static async getExpenseTypes() {
    return ApiService.fetchData({
      url: "/expense-types/",
      method: "GET",
    });
  }
  
  static async getPaymentMethods() {
    return ApiService.fetchData({
      url: "/expenses/payment_methods/",
      method: "GET",
    });
  }
}
```

## Validation Rules

### Required Fields
- `expense_type` - Must be selected
- `amount` - Must be greater than 0

### Conditional Requirements
- `payment_method` - Required when posting (status="Posted")
- `payment_method` - Optional for drafts (status="Open")

### Business Rules
- Only "Open" expenses can be edited or deleted
- Only "Open" expenses can be posted
- Only "Posted" expenses can be reversed
- G/L accounts must be set before posting

## Error Handling

### Common Errors

**403 Forbidden:**
- User lacks required permission
- Check permission set assignment

**400 Bad Request:**
- Missing required fields
- Invalid data format
- Business rule violation (e.g., trying to post already posted expense)

**404 Not Found:**
- Expense ID doesn't exist
- Expense type or payment method not found

### Error Response Format

```json
{
  "error": "Error message",
  "detail": "Detailed error description",
  "field": "field_name" // If field-specific error
}
```

## Integration Points

### Financials Module
- Uses `G_LAccount` for expense and balancing accounts
- Creates `GeneralLedgerEntry` records when posting

### Setup Module
- Uses `NoSeriesLines` for document number generation
- Uses `JournalSetup` for posting configuration

### Payment Methods
- Uses `PaymentMethod` model from financials app
- Payment method determines balancing account

## Testing Checklist

- [ ] Create expense with required fields
- [ ] Create expense without payment method (draft)
- [ ] Update open expense
- [ ] Delete open expense
- [ ] Preview posting
- [ ] Post expense
- [ ] Verify G/L entries created
- [ ] Verify expense becomes read-only after posting
- [ ] Test permission checks (create, edit, delete)
- [ ] Test filtering and search
- [ ] Test pagination

## Files Reference

### Backend:
- `expenses/models.py` - Expense, ExpenseType, ExpenseCategory models
- `expenses/views.py` - ExpenseViewSet with CRUD and custom actions
- `expenses/serializers.py` - Serializers for all models
- `expenses/urls.py` - URL routing
- `expenses/enums.py` - ExpenseStatus, ExpenseDocumentType enums

### Frontend:
- `src/views/expenses/Expenses.tsx` - Main expense page
- `src/services/ExpenseServices.ts` - API service methods
- `src/views/expenses/@types/expense.ts` - TypeScript types
- `src/views/expenses/store/expenseSlice.ts` - Redux slice

