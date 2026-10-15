# Navigation Revamp Task Breakdown

## 1. Research & Alignment
- Audit current mobile screens (`Home`, `Cart`, `Items`, `Reports`, etc.) to map to new tab targets.
- Pull module permission structure from backend to confirm `moduleCode` values for drawer filtering.
- Identify missing icons; plan asset additions.

## 2. Constants & Routing Foundations
- Update `src/constants/constants.ts` with new `screens` keys and `bottom_tabs` order.
- Extend `src/constants/icons.js` with any new assets; import into `constants/index.ts` if needed.
- Verify route names exist in `AppNavigator`/screen stacks; create placeholder screens where gaps exist (`Customers`, extended `Reports` detail).

## 3. Bottom Tab Implementation
- Refactor `MainLayout` tab list to render `Home`, `Sales`, `Items`, `Customers`, `Reports`.
- Ensure `FlatList` content switches to corresponding components:
  - `Sales` → reuse `Cart` screen.
  - `Items` → link to `Items` screen (add wrapper if necessary).
  - `Customers` → hook to existing or new customers screen.
  - `Reports` → build summary view with drill-down support.
- Add state management for new tabs (animation flex/color values, navigation).

## 4. Reports Drill-Down
- Design summary cards component with tap handlers.
- Create detail list view (modal or stacked screen) showing detailed transactions/metrics.
- Wire to existing report services; include date range selectors.

## 5. Drawer Menu Rework
- Rebuild item list in `CustomDrawer.tsx` reflecting PRD order.
- Integrate role-based visibility: fetch permitted `moduleCode`s (or reuse context) and hide unauthorized items.
- Ensure navigation targets each drawer entry (e.g., `Payments`, `Purchases`, `Financials`).

## 6. Supporting Screens
- Implement lightweight screens if missing:
  - `Customers` list/detail (reuse existing services/components if available).
  - `Payments`, `Purchases`, `Expenses` summary variants optimized for mobile.
  - `Financials` overview (read-only KPIs).
- Share loading/error patterns from existing screens.

## 7. QA & Polishing
- Validate navigation flows on both platforms, portrait & landscape.
- Test role variations (cashier vs manager) to confirm drawer visibility.
- Confirm icons & labels comply with design guidelines.
- Update snapshot/unit tests if present (navigation, reducers).

## 8. Documentation & Handoff
- Capture screenshots of new navigation patterns.
- Update README / internal docs with navigation map.
- Provide quick reference for support teams outlining tab/drawer destinations.



