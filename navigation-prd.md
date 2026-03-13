# Navigation Revamp PRD

## Overview
- **Goal:** align mobile POS navigation with the web app’s module structure while streamlining daily workflows for cashiers and supervisors.
- **Scope:** refresh bottom tab labels & content, reorganize drawer menu, ensure each surface has focused, mobile-friendly views.
- **Success Criteria:** core POS tasks reachable within one tap, role-aware drawer visibility, consistent terminology/icons across mobile & web.

## Users
- **Cashier / Sales Agent:** initiates sales, looks up items/customers, checks daily progress.
- **Supervisor / Manager:** reviews reports, handles adjustments, manages staff & settings.
- **Admin / Owner:** accesses financials, configuration, and advanced reports.

## Navigation Model

### Bottom Tabs (Persistent)
1. **Home**
   - KPIs: today’s sales count & UGX total, top-selling item, pending tasks.
   - Alerts: low stock notices, pending payments.
   - Quick actions: `New Sale`, `Scan Item`, `View Reports`.
2. **Sales**
   - Default view: active cart with item list, tender summary, customer attachment.
   - Secondary: switch to sales history (recent invoices, suspended sales).
   - Fast actions: apply discount, hold/resume sale, print receipt.
3. **Items**
   - Item catalogue with search/barcode input.
   - Item detail: price, stock on hand, last sale, quick adjust (+/−).
   - Shortcuts: print label, create item (if permission permits).
4. **Customers**
   - Customer list with saved filters (all / credit / loyalty).
  - Profile: contact details, balance, last purchase, loyalty points.
   - Actions: start sale with customer, settle outstanding balance, edit profile.
5. **Reports**
   - Summary cards: sales by tender, refunds, cash-up variance.
   - Filters: today, yesterday, custom (shift/time range).
   - Drill-down: tap card to open detailed report in-place (list view with export/print).

### Drawer (Role-Aware)
Visibility mirrors `zentro-frontend` pattern—each item can carry `moduleCode` (e.g., `sales`, `financials`). The mobile store should fetch allowed modules and hide entries a user lacks.

1. **Home** (mirrors tab for familiarity).
2. **Sales Dashboard** (extended charts, targets; permission `sales.dashboard`).
3. **Payments** (`payments` module): history, reconcile, payout summary.
4. **Purchases** (`purchases` module): POs, supplier deliveries.
5. **Suppliers** (`suppliers` module): contact list, outstanding orders.
6. **Expenses** (`expenses` module): log, review, approve.
7. **Inventory Adjustments** (`inventory` / `itemJournal`): manual adjustments, audit log.
8. **Financials** (`financials` module): profit & loss, balance overview, chart of accounts (read-only on mobile).
9. **Reports Library** (`reports` module): full list of saved reports & scheduled exports.
10. **User Management** (`user_management` module): users, roles (restricted to admin roles).
11. **Settings**: tenant config, receipt printers, theme, language.
12. **Profile**: account info, switch tenant, sync status.
13. **Help & Support**: documentation, contact support.
14. **Logout**.

## Functional Requirements
- **Role-driven drawer:** respect module permissions from backend; hide Financials for cashiers while keeping it for managers/admins.
- **Report drill-down:** tapping cards shows detail list (e.g., transactions). Provide back navigation to summary.
- **State management:** bottom tabs and drawer share selection state to highlight current context.
- **Loading/error handling:** follow existing `loading`, `categoriesLoading`, optional chaining practices.
- **Icons:** reuse from `icons.js`; add `customers`, `payments`, etc. as needed.
- **Consistency:** label casing & copy mirror web app (e.g., “Sales History”, “Adjust Inventory”).

## Non-Goals
- Rebuilding underlying data services.
- Implementing entirely new modules not present on web.
- Offline-first enhancements beyond current caching behavior.

## Risks & Mitigations
- **Permission drift:** coordinate with backend team to expose module codes; add safe defaults showing only Home/Sales if permission fetch fails.
- **Screen fatigue:** keep detail screens concise; defer complex tables to reports library.
- **Asset gaps:** plan for icon additions early to avoid blocking UI work.

## Rollout Plan
1. Design review with stakeholders (screenshots/wireframes).
2. Implement navigation changes behind a feature flag if needed.
3. QA on Android/iOS devices; validate role permutations.
4. Update onboarding docs and provide quick reference guide.








