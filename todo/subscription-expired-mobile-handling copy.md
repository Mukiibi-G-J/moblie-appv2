# Subscription Expired Handling – Mobile App Guide

## Overview

This guide explains how the ZentroApp backend signals **subscription/trial expiry** and how the **mobile app** should handle it. When a tenant's trial or subscription has ended, the backend returns **402 Payment Required** (not 401 or 403) so the app can redirect users to the subscription page **without logging them out** or showing permission errors.

---

## Backend Behavior

### When Does 402 Occur?

The backend uses **`SubscriptionCheckMiddleware`** to block API requests when:

- The tenant has no subscription, or
- `subscription_end_date` has passed (including “0 days remaining” = today)

The check runs **after** authentication. The user is still logged in; only access to business APIs is blocked.

### 402 Response Format

All blocked requests return the same JSON body and HTTP status:

```json
{
  "code": "subscription_expired",
  "detail": "Your trial period has ended. Please proceed to the subscription page to continue."
}
```

**HTTP Status:** `402` (Payment Required)

**Structure:**

| Field   | Type   | Description                                                                 |
|---------|--------|-----------------------------------------------------------------------------|
| `code`  | string | Always `"subscription_expired"` – use this for programmatic detection       |
| `detail`| string | User-facing message – safe to show in UI or as fallback if no custom copy   |

### Why 402 Instead of 401/403?

- **401 Unauthorized** – Triggers logout/session-expired flows. We intentionally avoid this so the user stays logged in.
- **403 Forbidden** – Used for permission errors and often shows a permission modal. We treat subscription expiry separately.
- **402 Payment Required** – Clearly signals “subscription required” and lets the app show a subscription-specific flow without affecting auth/permission logic.

---

## API Paths That Bypass the Check

These paths **do not** return 402 even when the subscription is expired:

| Pattern                     | Purpose                                          |
|-----------------------------|--------------------------------------------------|
| `/api/auth/`                | Login, token refresh, logout                     |
| `/api/company/subscription` | Subscription status, mobile-money-instructions   |
| `/api/company/subscriptions`| Subscription listing                             |
| `/api/company/pricing-plans`| Pricing plans for subscription page              |
| `/api/company/add-ons`      | Add-on plans                                     |
| `/api/company/starter-*`    | Starter pack flow                                |
| `/admin/`                   | Admin panel                                      |
| `/static/`, `/media/`       | Static assets                                    |

All **other** `/api/` endpoints (customers, items, sales, financials, etc.) are subject to the subscription check and will return 402 when expired.

---

## Mobile App Implementation

### 1. HTTP Client / API Layer

Handle 402 in your API client (e.g. Axios interceptor, fetch wrapper):

```typescript
// Pseudocode – adapt to your HTTP client
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;

    if (status === 402) {
      const code = data?.code;      // "subscription_expired"
      const detail = data?.detail;  // User-facing message

      // Dispatch to subscription flow – do NOT logout or treat as 403
      onSubscriptionExpired({ code, detail });
      return Promise.reject(error);
    }

    // ... handle 401, 403, etc.
    return Promise.reject(error);
  }
);
```

### 2. Recommended Behavior on 402

- Do **not** log the user out (no 401-style handling).
- Do **not** show a generic permission error (no 403-style handling).
- Show a subscription-specific message and give a clear path to pay (e.g. “Proceed to Subscription”).
- Navigate to the subscription page (WebView or deep link) when the user chooses to continue.

### 3. Avoid Multiple Modals

Multiple API calls can fail with 402 at once (customers, sales, items, etc.). To avoid several modals or repeated prompts:

- Use a **single global handler** for 402.
- Debounce or coalesce: on first 402, show one modal/navigation and ignore further 402s until the flow completes.
- Example: set a flag like `subscriptionExpiredModalShown` and skip showing again until the user returns from the subscription flow or dismisses.

### 4. Subscription Page Navigation

The web app’s subscription flows are:

- **Main subscription page:** `{BASE_URL}/subscription`
- **Mobile Money instructions (pending verification):** `{BASE_URL}/subscription/mobile-money?fromExpired=1`

In the mobile app, you can:

- Open these URLs in a **WebView**, or
- Use a **deep link** if the app supports it, or
- Show a native screen that instructs the user to continue on the web.

Ensure `BASE_URL` matches the environment (e.g. staging vs production).

### 5. Before Redirecting: Check for Pending Verification

Before showing the subscription-expired modal or navigating to the main subscription page, call:

```
GET /api/company/subscription/mobile-money-instructions/
```

(This endpoint is **not** blocked by the subscription check.)

If the response has `has_pending_verification: true`:

- **Redirect directly** to `{BASE_URL}/subscription/mobile-money?fromExpired=1`
- That page will show the "Payment submitted" state (see next section)

If `has_pending_verification` is false or the call fails:

- Show your subscription-expired modal/screen with a "Proceed to Payment" button
- That button navigates to `{BASE_URL}/subscription`

### 6. Payment Submitted / Verification Pending Screen

When the user has **already submitted** a mobile money payment (or is redirected with `fromExpired=1` and has a pending payment), the mobile-money page displays:

| Element | Content |
|---------|---------|
| **Heading** | Payment submitted |
| **Message** | We will verify your payment and activate your subscription shortly. You will receive an email when it is ready. |
| **Reference** | Your payment reference: **ZENTRO-{tenant}-{REF}** (e.g. `ZENTRO-semuna-033957FF`) |
| **Footer** | You can close this page. We will contact you once verification is complete. |

**User actions:**

- User can **close the page** – they stay logged in; subscription remains inactive until admin verifies the payment.
- User receives an **email** when verification is complete.
- On next app launch, 402 will trigger again → redirect to mobile-money → same "Payment submitted" screen (no need to pay again).

**When does this screen appear?**

1. **After submitting payment** – User completes the mobile money form (enters transaction reference) and taps submit. The page switches to this confirmation view.
2. **When returning with pending verification** – User previously submitted but hasn't been verified yet. Next 402 → app redirects to mobile-money → `getMobileMoneyInstructions` returns `has_pending_verification: true` and `pending_payment_reference` → page shows this screen.

### 7. User Is Already on Subscription Page

If the user is already on the subscription page (or equivalent screen), avoid showing another modal. The web app checks `currentPath.includes("/subscription")` and skips the subscription-expired modal in that case. The mobile app should do the same (e.g. skip showing the modal when the current screen is the subscription flow).

---

## Error Object Shape in Practice

Typical error object when a request fails with 402:

```json
{
  "data": {
    "code": "subscription_expired",
    "detail": "Your trial period has ended. Please proceed to the subscription page to continue."
  },
  "message": "Request failed with status code 402",
  "method": "get",
  "status": 402,
  "statusText": undefined,
  "url": "/api/customers/"
}
```

**Detection logic:**

- `status === 402` – HTTP layer
- `data?.code === "subscription_expired"` – confirm subscription expiry (as opposed to other future 402 cases)

---

## Affected Endpoints (Examples)

When the subscription is expired, these (and similar) endpoints return 402:

- `/api/customers/`
- `/api/items/`
- `/api/sales/`
- `/api/categories/`
- `/api/financials/payment-methods/`
- `/api/customer-ledger/receivables_dashboard/`
- …and all other tenant business APIs except the bypassed paths above

---

## JWT Token and Subscription Info

The JWT includes subscription metadata:

```json
{
  "subscription": {
    "plan": "...",
    "status": "trial" | "active" | "pending" | ...,
    "is_trial": true | false,
    "is_active": true | false,
    "trial_end_date": "2025-03-15",
    "subscription_end_date": "2025-03-15"
  }
}
```

You can use this to show warnings or pre-empt expiry (e.g. “Trial ends in X days”), but **do not rely on it alone** for access control. The backend’s subscription check is the source of truth. API calls will still return 402 if the subscription has expired, regardless of JWT contents.

---

## Summary Checklist

| Item | Action |
|------|--------|
| 402 status | Treat as subscription expired, not auth or permission failure |
| `code: "subscription_expired"` | Use for programmatic detection |
| `detail` | Use as fallback user-facing message |
| Logout | Do **not** trigger on 402 |
| Permission modal | Do **not** show on 402 |
| Multiple 402s | Consolidate into a single subscription flow (debounce/flag) |
| Subscription page | Navigate to `/subscription` or `/subscription/mobile-money?fromExpired=1` |
| Pending verification | Call `getMobileMoneyInstructions`; if `has_pending_verification`, go to mobile-money page |
| Payment submitted screen | Show reference, "You can close this page", wait for email |
| Already on subscription | Skip showing another modal |

---

## Related Files

- **Backend middleware:** `zentro-backend/utils/subscription_middleware.py`
- **Backend mobile-money instructions:** `zentro-backend/company/views.py` (`get_mobile_money_instructions`)
- **Web reference:** `zentro-frontend/src/services/BaseService.ts` (402 interceptor, `has_pending_verification` check)
- **Payment submitted UI:** `zentro-frontend/src/views/Subscription/MobileMoneyPaymentInstructions.tsx`
- **Subscription state:** `zentro-frontend/src/store/slices/subscriptionExpiredSlice.ts`
