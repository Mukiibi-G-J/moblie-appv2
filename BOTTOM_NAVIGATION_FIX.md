# Bottom Navigation Fix Documentation

## Issue
The bottom navigation bar was not working - clicking tabs did not navigate to the correct pages, and scrolling between pages did not update the active tab indicator.

## Root Cause
The issue was caused by a `useEffect` hook in `MainLayout.tsx` that was resetting the `selectedTab` state to `home` on every component mount:

```typescript
useEffect(() => {
  setSelectedTab(constants.screens.home);
}, []);
```

This `useEffect` was interfering with tab selection because:
1. When a user clicked a tab, `setSelectedTab` would be called with the new tab name
2. The component would re-render
3. The `useEffect` would run again and reset `selectedTab` back to `home`
4. This created a conflict where the tab selection was immediately overridden

## Solution
Removed the problematic `useEffect` hook. The `selectedTab` state is now properly managed by:
- Initial state in `CustomDrawer`: `useState(constants.screens.home)`
- Tab button clicks: `onPress={() => setSelectedTab(tabName)}`
- The `useEffect` that handles scrolling and animations (which depends on `selectedTab`)

## Additional Fixes Applied
1. **Switched from `scrollToIndex` to `scrollToOffset`**: More reliable for horizontal FlatList scrolling
2. **Added `getItemLayout` and `onScrollToIndexFailed`**: Required props for `scrollToIndex` (though we're now using `scrollToOffset`)
3. **Fixed `CustomDrawer` state management**: Changed from context-based to local `useState` to match git version
4. **Fixed `isModuleVisible` import**: Added missing import in `CustomDrawerContent`

## Files Modified
- `src/Screens/MainLayout.tsx`: Removed problematic `useEffect`, switched to `scrollToOffset`
- `src/navigation/CustomDrawer.tsx`: Fixed state management and imports

## Testing
After the fix:
- ✅ Clicking tabs navigates to the correct page
- ✅ Tab indicator updates correctly
- ✅ No console errors related to scrolling
- ✅ Navigation works smoothly







