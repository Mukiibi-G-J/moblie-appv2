/**
 * Parity with web `useRestaurantPinRoutePrompt` (Layouts.tsx): when the user opens any
 * restaurant module screen, re-check PIN status and navigate to setup if needed.
 * Handles deferred PIN after branch selection and reload where login-time flags are gone.
 */
import React, {useCallback, useEffect, useRef} from 'react';
import {useAppContext, useAuth} from '../context/Store';
import {navigationRef} from '../hooks/NavigationService';
import {shouldDefinitivelySkipRestaurantPinFromClientJwt} from '../utils/restaurantPinOffer';
import {getRestaurantPinStatus} from '../services/restaurantPinApi';
import {
  getRestaurantPinPromptDismissed,
  getRestaurantPinConfiguredThisSession,
  setRestaurantPinConfiguredThisSession,
} from '../storage/restaurantDeviceStorage';

function getActiveRouteName(state: any): string | undefined {
  if (!state?.routes || state.index == null) {
    return undefined;
  }
  const route = state.routes[state.index];
  if (route.state?.routes?.length) {
    const nested = getActiveRouteName(route.state);
    if (nested) {
      return nested;
    }
  }
  return route.name as string | undefined;
}

function isRestaurantModuleRoute(name?: string): boolean {
  if (!name) {
    return false;
  }
  if (name === 'RestaurantPinSignIn' || name === 'RestaurantPinSetup') {
    return false;
  }
  if (name === 'RestaurantHub') {
    return true;
  }
  return name.startsWith('Restaurant');
}

const RestaurantPinRouteGate = () => {
  const {accessToken} = useAuth();
  const ctx = useAppContext();
  const branchPending = ctx?.branchSession?.branchSelectionPending === true;
  const auth = ctx?.auth;
  const inFlightRef = useRef(false);
  const accessTokenRef = useRef(accessToken);
  const branchPendingRef = useRef(branchPending);
  const authRef = useRef(auth);
  const statusCheckedThisRestaurantVisitRef = useRef(false);

  accessTokenRef.current = accessToken;
  branchPendingRef.current = branchPending;
  authRef.current = auth;

  const syncRouteFlagFromState = useCallback(() => {
    const nav = navigationRef.current;
    if (!nav?.isReady()) {
      return;
    }
    const routeName = getActiveRouteName(nav.getRootState());
    if (!isRestaurantModuleRoute(routeName)) {
      statusCheckedThisRestaurantVisitRef.current = false;
    }
  }, []);

  const handleState = useCallback(() => {
    void (async () => {
      syncRouteFlagFromState();

      const tokenOk = accessTokenRef.current;
      const pending = branchPendingRef.current;
      const a = authRef.current;

      if (!tokenOk || pending) {
        return;
      }

      const navInner = navigationRef.current;
      if (!navInner?.isReady()) {
        return;
      }
      const routeName = getActiveRouteName(navInner.getRootState());

      if (!isRestaurantModuleRoute(routeName)) {
        return;
      }
      if (routeName === 'RestaurantPinSetup' || routeName === 'SelectBranch') {
        return;
      }

      if (statusCheckedThisRestaurantVisitRef.current) {
        return;
      }
      if (inFlightRef.current) {
        return;
      }

      if (await getRestaurantPinPromptDismissed()) {
        statusCheckedThisRestaurantVisitRef.current = true;
        return;
      }
      if (await getRestaurantPinConfiguredThisSession()) {
        statusCheckedThisRestaurantVisitRef.current = true;
        return;
      }

      if (
        shouldDefinitivelySkipRestaurantPinFromClientJwt(
          a?.enabled_modules,
          a?.role_center_modules,
          a?.authority,
        )
      ) {
        statusCheckedThisRestaurantVisitRef.current = true;
        return;
      }

      inFlightRef.current = true;
      try {
        const d = await getRestaurantPinStatus();
        statusCheckedThisRestaurantVisitRef.current = true;
        if (!d?.eligible) {
          return;
        }
        if (d.has_pin && !d.pin_expired) {
          await setRestaurantPinConfiguredThisSession(true);
          return;
        }
        const navReady = navigationRef.current;
        const current = getActiveRouteName(navReady?.getRootState());
        if (
          current === 'RestaurantPinSetup' ||
          !isRestaurantModuleRoute(current)
        ) {
          return;
        }
        navReady?.navigate('RestaurantPinSetup' as never);
      } catch {
        statusCheckedThisRestaurantVisitRef.current = false;
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [syncRouteFlagFromState]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    let attempts = 0;
    const tryAttach = () => {
      if (cancelled) {
        return;
      }
      if (++attempts > 1200) {
        return;
      }
      const n = navigationRef.current as {
        addListener?: (e: string, cb: () => void) => () => void;
        isReady?: () => boolean;
      } | null;
      if (!n?.addListener || !n.isReady?.()) {
        requestAnimationFrame(tryAttach);
        return;
      }
      unsub = n.addListener('state', handleState);
      handleState();
    };

    tryAttach();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [handleState]);

  useEffect(() => {
    handleState();
  }, [
    accessToken,
    branchPending,
    auth?.user_id,
    auth?.enabled_modules,
    auth?.role_center_modules,
    handleState,
  ]);

  return null;
};

export default RestaurantPinRouteGate;
