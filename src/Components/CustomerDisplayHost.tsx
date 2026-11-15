import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  getCustomerDisplayStatus,
  getLatestCustomerDisplayPayload,
  publishCustomerDisplay,
  showCustomerDisplay,
  subscribeCustomerDisplay,
  subscribeCustomerDisplayStatus,
  type CustomerDisplayStatus,
} from '../services/customerDisplay';
import {getCompanyInfo} from '../services/app.services';
import {
  extractCompanyLogo,
  prepareCompanyLogoForDisplay,
} from '../utils/companyLogoUrl';

export default function CustomerDisplayHost() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<CustomerDisplayStatus>({
    hasSecondaryDisplay: false,
    attached: false,
    displayId: -1,
    displayName: '',
  });
  const companyLogoRef = useRef<string | undefined>();
  const companyNameRef = useRef<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getCompanyInfo();
        const company = res?.data?.company;
        if (cancelled || !company) {
          return;
        }
        const name =
          company.displayName?.trim() || company.name?.trim() || undefined;
        if (name) {
          companyNameRef.current = name;
        }
        const fileUri = await prepareCompanyLogoForDisplay(
          extractCompanyLogo(company),
        );
        if (cancelled || !fileUri) {
          return;
        }
        companyLogoRef.current = fileUri;
        const latest = getLatestCustomerDisplayPayload();
        publishCustomerDisplay({
          ...latest,
          companyName: name || latest.companyName,
          companyLogo: fileUri,
        });
      } catch {
        // Keep the welcome screen if company-info is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubPayload = subscribeCustomerDisplay(next => {
      const logo = companyLogoRef.current;
      const name = companyNameRef.current;
      if (
        (logo && next.companyLogo !== logo) ||
        (name && !next.companyName?.trim())
      ) {
        publishCustomerDisplay({
          ...next,
          companyName: next.companyName?.trim() ? next.companyName : name || next.companyName,
          companyLogo: logo || next.companyLogo,
        });
        return;
      }
    });
    const unsubStatus = subscribeCustomerDisplayStatus(next => {
      setStatus(next);
    });
    let cancelled = false;
    let attempts = 0;
    const tryShow = async () => {
      const next = await showCustomerDisplay();
      if (cancelled) {
        return;
      }
      setStatus(next);
      console.log('Customer display status', next);
      if (!next.attached && attempts < 8) {
        attempts += 1;
        setTimeout(() => {
          void tryShow();
        }, 1500);
      }
    };
    void tryShow();
    return () => {
      cancelled = true;
      unsubPayload();
      unsubStatus();
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    const next = await getCustomerDisplayStatus();
    setStatus(next);
    if (!next.attached && next.hasSecondaryDisplay) {
      const shown = await showCustomerDisplay();
      setStatus(shown);
    }
  }, []);

  return (
    <>
      {status.hasSecondaryDisplay && !status.attached ? (
        <View
          pointerEvents="box-none"
          style={[styles.chipWrap, {top: insets.top + 8, right: 10}]}>
          <Pressable onPress={() => void refreshStatus()} style={styles.chip}>
            <Text style={styles.chipText}>Tap to show customer screen</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    position: 'absolute',
    zIndex: 40,
  },
  chip: {
    backgroundColor: 'rgba(11, 61, 58, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: '#5EEAD4',
    fontSize: 11,
    fontWeight: '700',
  },
});
