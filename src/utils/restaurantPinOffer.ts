declare const __DEV__: boolean;

/**
 * Mirrors web `shouldOfferRestaurantPinFromToken` (restaurantDeviceStorage.ts).
 */
export function shouldOfferRestaurantPinFromToken(
  roleCenterModules: string[] | undefined,
  enabledModules: string[] | undefined,
  authority: string[] | undefined,
): boolean {
  const r = roleCenterModules || [];
  const e = enabledModules || [];
  const a = authority || [];
  if (!e.includes('restaurant')) {
    if (__DEV__) {
      console.log('[RestaurantPIN] offerPIN: skip — no restaurant module', {
        enabled_modules: e,
      });
    }
    return false;
  }
  if (a.includes('admin')) {
    return true;
  }
  return r.includes('restaurant');
}

/**
 * When `enabled_modules` is missing from the JWT (undefined/null), the client cannot
 * conclusively skip the PIN prompt — the gate should call the status API instead.
 */
export function shouldDefinitivelySkipRestaurantPinFromClientJwt(
  enabled_modules: string[] | undefined | null,
  role_center_modules: string[] | undefined,
  authority: string[] | undefined,
): boolean {
  if (enabled_modules === undefined || enabled_modules === null) {
    return false;
  }
  return !shouldOfferRestaurantPinFromToken(
    role_center_modules,
    enabled_modules,
    authority,
  );
}
