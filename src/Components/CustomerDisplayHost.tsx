import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CustomerDisplayView from './CustomerDisplayView';
import {
  getCustomerDisplayStatus,
  getLatestCustomerDisplayPayload,
  publishCustomerDisplay,
  showCustomerDisplay,
  subscribeCustomerDisplay,
  subscribeCustomerDisplayStatus,
  type CustomerDisplayPayload,
  type CustomerDisplayStatus,
} from '../services/customerDisplay';
import {getCompanyInfo} from '../services/app.services';
import {
  extractCompanyLogo,
  prepareCompanyLogoForDisplay,
} from '../utils/companyLogoUrl';

export default function CustomerDisplayHost() {
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const [payload, setPayload] = useState<CustomerDisplayPayload>(
    getLatestCustomerDisplayPayload,
  );
  const [status, setStatus] = useState<CustomerDisplayStatus>({
    hasSecondaryDisplay: false,
    attached: false,
    displayId: -1,
    displayName: '',
  });
  const [previewHidden, setPreviewHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
      setPayload(next);
    });
    const unsubStatus = subscribeCustomerDisplayStatus(next => {
      setStatus(next);
      if (next.hasSecondaryDisplay) {
        setPreviewHidden(false);
      }
    });
    let cancelled = false;
    void (async () => {
      const next = await showCustomerDisplay();
      if (!cancelled) {
        setStatus(next);
      }
    })();
    return () => {
      cancelled = true;
      unsubPayload();
      unsubStatus();
    };
  }, []);

  useEffect(() => {
    if (payload.mode === 'idle') {
      setPreviewHidden(false);
    }
  }, [payload.mode]);

  const refreshStatus = useCallback(async () => {
    const next = await getCustomerDisplayStatus();
    setStatus(next);
    if (!next.attached && next.hasSecondaryDisplay) {
      const shown = await showCustomerDisplay();
      setStatus(shown);
    }
  }, []);

  const showPreview =
    !status.hasSecondaryDisplay &&
    payload.mode !== 'idle' &&
    !previewHidden;
  const pipW = Math.min(280, Math.round(width * 0.42));
  const pipH = Math.min(210, Math.round(height * 0.28));

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

      {showPreview ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.pipWrap,
            {bottom: insets.bottom + 72, right: 10, width: pipW, height: pipH},
          ]}>
          <Pressable
            onPress={() => setExpanded(true)}
            style={styles.pipCard}
            accessibilityLabel="Open customer screen preview">
            <View style={styles.pipHeader}>
              <Text style={styles.pipTitle}>Customer screen</Text>
              <Pressable
                onPress={() => setPreviewHidden(true)}
                hitSlop={8}
                accessibilityLabel="Hide customer preview">
                <Text style={styles.pipClose}>Hide</Text>
              </Pressable>
            </View>
            <View style={styles.pipBody} pointerEvents="none">
              <CustomerDisplayView payload={payload} />
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={expanded}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}>
        <View style={styles.modalRoot}>
          <CustomerDisplayView payload={payload} />
          <Pressable
            onPress={() => setExpanded(false)}
            style={[styles.modalClose, {top: insets.top + 10}]}>
            <Text style={styles.modalCloseText}>Close preview</Text>
          </Pressable>
        </View>
      </Modal>
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
  pipWrap: {
    position: 'absolute',
    zIndex: 50,
  },
  pipCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#5EEAD4',
    backgroundColor: '#0B3D3A',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },
  pipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F4A46',
  },
  pipTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pipClose: {
    color: '#5EEAD4',
    fontSize: 11,
    fontWeight: '700',
  },
  pipBody: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#0B3D3A',
  },
  modalClose: {
    position: 'absolute',
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
