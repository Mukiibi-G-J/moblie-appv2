# Tracking Code Implementation Plan

## Overview

- Align the mobile sales flow with the web frontend behaviour so items that require tracking data enforce it before a sale posts, while optional items proceed unhindered.
- Store and transmit the selected tracking codes alongside each sales line when creating invoices from the cart.

## Current Observations

- `src/Components/SalesCompletionModal.tsx` sends every invoice line with `tracking_code: ''`; there is no UI to view or capture lot/serial data.
- `src/Screens/Sales/Sales.tsx` only displays aggregated invoice data and never exposes tracking requirements.
- The cart state (`src/context/CartStore.tsx` and `src/Screens/Cart/Cart.tsx`) does not track per-item lot/serial selections or the backend metadata that marks an item as tracking-controlled.
- REST services in `src/services/app.services.ts` return item details, but the cart pipeline drops any `tracking_code` information pulled from the item catalogue.

## Incremental Tasks & Completion Checklist

1. Surface Tracking Metadata in Cart Items

   - [x] Audit item load pipeline (`src/services/app.services.ts`, `src/Screens/Items/Items.tsx`, and `CartStore`) to confirm where `tracking_code` data is available or dropped.
   - [x] Extend the `CartItem` type and reducer to include:
     - [x] `trackingDetails?: TrackingConfig` (flags from backend).
     - [x] `selectedTrackingCode?: string | null`.
   - [x] Update item-add logic (`Cart.tsx`, barcode flows) to populate the new fields from the source item.

2. Add UI to Capture Tracking Codes

   - [ ] Design indicator styles in `Cart.tsx` showing when an item requires tracking but none is chosen (red badge).
   - [ ] Build tracking picker modal component (new under `src/Components/TrackingCodePicker.tsx` or nested in cart) that lists available lots/serials for the selected item.
   - [ ] Wire picker actions to update `selectedTrackingCode` in cart state.

3. Fetch Available Tracking Entries

   - [ ] Confirm existing API endpoint (likely `/api/items/{id}/tracking-options/` or similar) from backend/web reference.
   - [ ] Implement service helper (e.g., `fetchItemTrackingOptions(itemId)`) in `src/services/app.services.ts`.
   - [ ] Call helper when picker opens, handle loading/error states.

4. Validate Before Completing Sales

   - [ ] Introduce `validateTrackingCodes` helper in `SalesCompletionModal`.
   - [ ] Block submission when `trackingDetails` requires lot/serial/expiry and `selectedTrackingCode` is empty.
   - [ ] Show toast/error and highlight offending items; allow continuation when all required codes exist.

5. Persist Tracking Codes in Invoice Payloads

   - [ ] Replace hard-coded `tracking_code: ''` in sales invoice payload with `selectedTrackingCode || ''`.
   - [ ] Ensure optional items (no requirements) continue sending empty strings without failing backend validation.

6. Test End-to-End Scenarios

   - [ ] Item with required tracking but none selected → validation stops the sale.
   - [ ] Required tracking with selection → sale completes and payload includes code.
   - [ ] Item without tracking requirements → sale succeeds without prompts.
   - [ ] Mixed cart items → validation applies per-line correctly.
   - [ ] Regression test: posting, drafts, receipt printing still function normally.

7. Documentation & Cleanup
   - [ ] Update `tracking-code-plan.md` status sections after each major task.
   - [ ] Add inline comments where new logic is non-obvious (especially in cart reducer and modal flow).
   - [ ] Consider optional enhancements (cache, barcode sync) once primary flow is verified.
 