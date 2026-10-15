# Loans & Prepayments Guide

## Overview

This guide covers two finance workspaces:

- **Loans**: register loans, post them to GL, and capture repayments.
- **Prepayments**: customer deposits with card + lines flow, posting to sales and final invoices.

Use it when working in `zentro-frontend/src/views/loans/Loans.tsx` and `zentro-frontend/src/views/prepayments/Prepayments.tsx` or when adding backend support in `zentro-backend/loans` and `zentro-backend/prepayment`.

## Permissions & Navigation

- **Page Object IDs**
  - Loans: `10806` Loan Registration, `10807` Loan Repayment (history pages 10808/10809).
  - Prepayments: `11001` Prepayments.
- **Permission sets** (see `permissions/management/commands/setup_page_permissions.py`)
  - Loans: `LOANS_FULL` (RIMD), `LOANS_BASIC` (RI), `LOANS_VIEW_ONLY` (R).
  - Prepayments: `PREPAYMENTS_FULL` (RIMD), `PREPAYMENTS_VIEW_ONLY` (R).
- **Routes**
  - Loans: `/app/loans`, `/app/loans/repayments`.
  - Prepayments: `/app/prepayments`.
- Frontend checks `usePermissions` + `pageName` to hide create/edit/delete/post buttons.

## Loans Module (Loan Registration + Repayments)

### Backend API

- Base URLs (prefixed with `/api/` by backend; omit `/api/` on frontend services):
  - Loans CRUD: `GET/POST /loans/loans/`, `GET/PATCH/DELETE /loans/loans/<id>/`.
  - Loan posting: `GET /loans/loans/<id>/preview_posting/`, `POST /loans/loans/<id>/post_loan/`.
  - Repayments CRUD: `GET/POST /loans/loan-repayments/`, `GET/PATCH/DELETE /loans/loan-repayments/<id>/`.
  - Repayment posting: `GET /loans/loan-repayments/<id>/preview_posting/`, `POST /loans/loan-repayments/<id>/post_repayment/`.
- Permissions enforced per action using `PAGE_OBJECT_ID` (`10806` loans, `10807` repayments).
- Number series:
  - Loans: uses `JournalSetup` with `JournalType.LOAN`; fallback `LOAN-YYYYMMDDHHMMSS`.
  - Repayments: uses `NoSeries` code `LOANREP`; fallback `LOANREP-YYYYMMDDHHMMSS`.
  - Seed helpers: `python manage.py tenant_command seed_loan_no_series --schema=<tenant>` and `seed_loan_accounts` for GL accounts (`5110`, `5320`).
- Validation highlights:
  - Positive `loan_amount`, `repayment_period` > 0, `interest_rate` 0–100.
  - `repayment_account="Bank/Mobile Money"` requires `bank_account` when posting; with `Cash`, `bank_account` must be empty.
  - Repayments: `amount_paid` > 0, `payment_date` cannot precede `loan.disbursement_date`; same bank rule as above.
- Posting:
  - Preview builds journal lines via `LoanPostingProcessor` / `LoanRepaymentPostingProcessor`.
  - Posting wraps in transaction and finalizes via `LoanPostingFinalPoster` / `LoanRepaymentPostingFinalPoster`.
  - Sets `posted=true`, `posted_date`, `posted_by`, `status="Posted"`.

### Frontend (Loans.tsx)

- **Listing**
  - `BaseTable` with pagination, search debounce (500ms), ordering, filters (loan type, status, posted, date range, lender, repayment account).
  - Defaults to status `Open`.
  - Data source: `LoanServices.getLoans`.
- **Create/Edit modal**
  - `Formik` form with `AutoSaveField` per input; allows partial PATCH while typing.
  - Initial minimal create allowed with just `lenderName`; backend fills safe defaults.
  - Fields: loanType, lenderName, loanAmount, disbursementDate, interestRate, repaymentPeriod, repaymentAccount, bankAccount (required for Bank/Mobile), purpose, status.
  - Bank accounts fetched via `BankAccountServices.getBankAccounts` (page_size=1000).
- **Actions**
  - Create button guarded by `canCreate("Loan Registration")`.
  - Edit/delete guarded by `canEdit/canDelete`.
  - Delete uses `LoanServices.deleteLoan` then refreshes table.
  - Posting: confirm dialog → `LoanServices.previewPosting` (optional) → `postLoan`. Requires modify permission; once posted, buttons disabled.
- **State**
  - Redux slice `loans` for data, filters, tableData, currentRecord; reducer injected in component.
  - Keeps `tableDataRef` to avoid stale pagination on refresh.

### Loan Repayments (if building UI)

- Similar CRUD/post flow with endpoints above.
- Must select `loan` first; payment method/bank account follow same validation rules.
- Posting calculates principal/interest split and writes GL entries.

## Prepayments Module (Card + Lines)

### Backend API

- Endpoints (ModelViewSet in `prepayment/views.py`, `PAGE_OBJECT_ID=11001`):
  - List/create: `GET/POST /prepayments/`
  - Detail/update/delete: `GET/PATCH/DELETE /prepayments/<id>/`
  - Lines upsert/delete: `POST /prepayments/<id>/update_lines/` (mixed create/update/delete; see `prepayment_card_lines` rule).
  - Preview/post document: `POST /prepayments/<id>/preview/`, `POST /prepayments/<id>/post/` (payment method required, excludes NOT_PAID).
  - Installments: `POST /prepayments/<id>/installments/` (adds installment amount → deposit math).
  - Final invoice: `POST /prepayments/<id>/preview-final-invoice/`, `POST /prepayments/<id>/post-final-invoice/` (allows NOT_PAID method).
- Validation:
  - Delete blocked if posted invoices exist.
  - Lines normalize item/UOM (code, id, or object), recompute amounts, aggregate totals after save.
  - Totals recalculated via `Preayment.recalculate_totals`.

### Frontend (Prepayments.tsx)

- **Listing**
  - `BaseTable` with pagination/sort/search/status filter (All, Draft, Posted, Cancelled).
  - Data source: `PrepaymentService.fetchPrepayments`.
- **Card form**
  - `BaseCard` modal for create/edit; uses Redux store (`prepaymentsActions`) and Formik via `formikRef`.
  - Opens in create/edit modes; `handleCloseCard` resets state and refreshes list.
- **Lines**
  - `PrepaymentLinesSection` provides editable table (item & UOM pickers, autosave on blur).
  - Lines persisted with `update_lines` endpoint; camelCase accepted (unitPrice/unitOfMeasure).
  - Delete lines by sending `is_deleted: true`; backend hard-deletes before upsert.
- **Posting flows**
  - Posting prepayment requires selecting a payment method (filters out `NOT_PAID`); modal opens before posting.
  - `postPrepayment` returns posted invoice no + transaction no, closes card, refreshes list.
  - Final invoice path supports `NOT_PAID` and refreshes detail if open.
  - `preview` and `previewFinalInvoice` show ledger preview via `PostingPreviewModal`.
- **Installments**
  - `InstallmentModal` triggered via window event `openInstallmentModal`; posts amount to `/installments/`, updates deposit fields.
- **Payment methods**
  - Uses `PaymentMethodServices.getPaymentMethods`; preselects customer default when available.

### Payload shapes (frontend services)

- `updatePrepaymentLines(id, lines)`:
  ```json
  {
    "id": 10,
    "system_id": "<optional>",
    "lines": [
      {"id": 6807, "quantity": 2, "unit_price": 1000},
      {"id": 6808, "is_deleted": true},
      {"item": "ITM-000001", "quantity": 1, "unit_price": 500}
    ]
  }
  ```
- Posting with payment method:
  - Prepayment: `{ "payment_method_id": <id> }` (must not be NOT_PAID).
  - Final invoice: `{ "payment_method_id": <id or null> }` (NOT_PAID allowed).

## Quick references

- Frontend services:
  - `LoanServices` (CRUD, preview/post loan & repayment, bank accounts) in `zentro-frontend/src/services/LoanServices.ts`.
  - `PrepaymentService` (list/detail, update_lines, preview/post, final invoice, installments) in `zentro-frontend/src/services/PrepaymentService.ts`.
- Components:
  - Loans page: `zentro-frontend/src/views/loans/Loans.tsx`.
  - Prepayments page: `zentro-frontend/src/views/prepayments/Prepayments.tsx` plus `components/PrepaymentLinesSection.tsx`, `InstallmentModal`, `PostingPreviewModal`.
- Backend:
  - Loans models/serializers/views in `zentro-backend/loans/`.
  - Prepayments models/serializers/views in `zentro-backend/prepayment/`.

## Mobile Implementation Checklist (Loans & Prepayments)

### Shared mobile patterns (mirror `Expenses` and `Payments`)- Multi-tenant axios: reuse `createAxiosInstance` + tenant from `AsyncStorage` with fallback `https://zentroapp-backend.com`.
- Permissions: guard screens with `usePermissions` + `PAGE_NAMES`; add new page names matching backend (`Loan Registration`, `Loan Repayment`, `Prepayments`) before wiring UI.
- Loading UX: `loading` main spinner with context text (e.g., "Loading loans..."), `searchLoading` for search bar indicator, extra loading states for pickers (bank accounts, payment methods, categories).
- Lists: use `FlatList` with `page/page_size`, infinite scroll (`hasMore`), `RefreshControl`, debounce search 500ms, reset state on errors (`setItems([])`, `setTotalPages(0)`), handle invalid page by resetting to page 1.
- Data safety: always check `response?.data?.results` arrays; use optional chaining on ids; format currency as `UGX ${(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`.
- UI components: follow `Expenses`/`Payments` patterns (`Header`, Toast errors, confirmation `Alert` before destructive/post actions, modal forms).

### Loans (Registration + Repayments) — Mobile

- Endpoints (prepend `/api/` in mobile services): loans CRUD `/loans/loans/` and `/loans/loans/<id>/`; posting `/loans/loans/<id>/preview_posting/`, `/loans/loans/<id>/post_loan/`; repayments CRUD `/loans/loan-repayments/`, `/loans/loan-repayments/<id>/`; posting `/loans/loan-repayments/<id>/preview_posting/`, `/loans/loan-repayments/<id>/post_repayment/`.
- Services: create `LoanServices` mirroring Expense/Payment service style (clean payloads, optional chaining, array guards). Include helpers for bank accounts and number-series defaults if exposed. Respect multi-tenant base URL.
- Screens:
  - Loan list: default status `Open`; filters for status, posted, loan type, repayment account, date range, lender; search debounce 500ms; summary cards optional (total amount, open count) following `Expenses` pattern; navigate to history of posted loans.
  - Create/Edit modal: allow minimal create with `lenderName`; fields `loanType`, `lenderName`, `loanAmount`, `disbursementDate`, `interestRate`, `repaymentPeriod`, `repaymentAccount`, `bankAccount`, `purpose`, `status`. Disable edits when posted. Use pickers for accounts; load bank accounts with its own spinner.
  - Validation: `loan_amount > 0`, `repayment_period > 0`, `0 <= interest_rate <= 100`; if `repayment_account="Bank/Mobile Money"` require `bank_account`, if `Cash` ensure `bank_account` empty; block posting when missing bank rule.
  - Posting: confirm dialog, optional preview modal; call `postLoan`, then refresh list and disable edit/delete/post on posted items.
- Repayments:
  - Require selecting a loan first; reuse bank account validation above.
  - Fields: `amount_paid > 0`, `payment_date >= disbursement_date`, payment method/bank account rule identical to loans.
  - Posting splits principal/interest; after post mark as posted and lock record.
- Permissions: use `canRead/canCreate/canEdit/canDelete` with new page names; hide FAB/actions when lacking rights.

### Prepayments (Card + Lines) — Mobile

- Endpoints: list/create `/prepayments/`, detail `/prepayments/<id>/`, lines `/prepayments/<id>/update_lines/`, posting `/prepayments/<id>/preview/`, `/prepayments/<id>/post/`, installments `/prepayments/<id>/installments/`, final invoice preview/post `/prepayments/<id>/preview-final-invoice/`, `/prepayments/<id>/post-final-invoice/`.
- Services: create `PrepaymentService` like web payloads (accept camelCase); guard `response?.data?.results` and reset state on error; include helpers for items/UOM normalization if needed; multi-tenant axios.
- Screens:
  - List: `BaseTable`-like `FlatList` with pagination, search debounce, status filter (All/Draft/Posted/Cancelled); main spinner "Loading prepayments...", search spinner in bar.
  - Card modal/screen: create/edit using Formik-like state; fields for customer, payment method, deposit totals, status, document nos (read-only). Provide "open detail" actions to edit lines.
  - Lines section: editable table for item + UOM pickers; upsert via `update_lines` with `is_deleted` flag; recompute totals client-side for display; save on blur/tap similar to web autosave.
  - Posting flows: require payment method (not `NOT_PAID`) for prepayment posting; use modal to select method; on success refresh list and close card. Final invoice path allows `NOT_PAID`.
  - Installments: modal triggered by button; post amount to `/installments/` then refresh card totals.
- Validations: prevent delete if posted invoices exist; recompute totals after lines save; ensure payment method present before posting (except final invoice).
- Permissions & guards: add `PAGE_NAMES` entries for `Prepayments`; gate screen; hide create/edit/delete/post buttons when permissions fail.

### Implementation breadcrumbs from existing mobile modules

- List/search/loading patterns: see `src/Screens/Expenses/Expenses.tsx` and `src/Screens/Payments/Payments.tsx` for debounce, invalid-page handling, `hasMore`, spinners, and permission guards.
- Form + posting patterns: see `src/Screens/Expenses/ExpenseFormModal.tsx` for validation, post confirmations, and optional fields handling; mirror confirmation + Toast flows for loans/prepayments.