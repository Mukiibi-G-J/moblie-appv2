import {__DEV__} from 'react-native';

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
