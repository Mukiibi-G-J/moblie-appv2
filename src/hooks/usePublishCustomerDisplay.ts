import {useEffect, useRef} from 'react';
import {
  buildIdleCustomerDisplay,
  publishCustomerDisplay,
  type CustomerDisplayPayload,
} from '../services/customerDisplay';

/**
 * Keeps the customer-facing display in sync while a POS screen is mounted.
 * On unmount, returns the second screen to the welcome state.
 */
export function usePublishCustomerDisplay(
  payload: CustomerDisplayPayload,
) {
  const companyRef = useRef(payload.companyName);
  const logoRef = useRef(payload.companyLogo);
  companyRef.current = payload.companyName;
  logoRef.current = payload.companyLogo;

  useEffect(() => {
    publishCustomerDisplay(payload);
  }, [payload]);

  useEffect(() => {
    return () => {
      publishCustomerDisplay(
        buildIdleCustomerDisplay(companyRef.current, logoRef.current),
      );
    };
  }, []);
}
