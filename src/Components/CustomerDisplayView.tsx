import React, {useEffect, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import images from '../constants/images';
import type {CustomerDisplayPayload} from '../services/customerDisplay';

const C = {
  bg: '#0B3D3A',
  surface: '#0F4A46',
  muted: '#A7D4CF',
  text: '#FFFFFF',
  accent: '#5EEAD4',
};

type Props = {
  payload: CustomerDisplayPayload;
};

export default function CustomerDisplayView({payload}: Props) {
  const company = (payload.companyName || 'Zentro').toUpperCase();
  const mode = payload.mode || 'idle';
  const showTotal = mode === 'cart' || mode === 'paying';
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [payload.companyLogo]);
  const companyLogoUri =
    !logoFailed && payload.companyLogo?.trim()
      ? payload.companyLogo.trim()
      : null;
  const companyLogoSource = companyLogoUri
    ? {uri: companyLogoUri}
    : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {companyLogoSource ? (
          <Image
            source={companyLogoSource}
            style={styles.headerLogo}
            resizeMode="contain"
            onError={() => setLogoFailed(true)}
          />
        ) : null}
        <Text style={styles.company}>{company}</Text>
      </View>
      <View style={styles.body}>
        {mode === 'idle' ? (
          <View style={styles.center}>
            <Image
              source={companyLogoSource || images.logo_zentro}
              style={[
                styles.welcomeLogo,
                !companyLogoSource && styles.zentroTint,
              ]}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
            />
            <Text style={styles.welcome}>{payload.heading || 'Welcome'}</Text>
            <Text style={styles.sub}>
              {payload.message || 'Your order will appear here'}
            </Text>
          </View>
        ) : null}

        {mode === 'cart' ? (
          <View style={styles.cart}>
            <Text style={styles.heading}>{payload.heading || 'Your order'}</Text>
            <ScrollView
              style={styles.lines}
              contentContainerStyle={styles.linesContent}>
              {(payload.lines || []).map((line, index) => (
                <View key={`${line.name}-${index}`} style={styles.line}>
                  <Text style={styles.qty}>{line.qtyLabel}</Text>
                  <Text style={styles.name} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.amount}>{line.amount}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {mode === 'paying' || mode === 'thanks' ? (
          <View style={styles.center}>
            <Image
              source={companyLogoSource || images.logo_icon}
              style={[
                styles.statusLogo,
                companyLogoSource
                  ? styles.statusCompanyLogo
                  : styles.zentroTint,
              ]}
              resizeMode="contain"
              onError={() => setLogoFailed(true)}
            />
            <Text style={styles.statusTitle}>
              {payload.heading ||
                (mode === 'thanks' ? 'Thank you' : 'Please pay')}
            </Text>
            {payload.totalAmount ? (
              <Text style={styles.statusAmount}>{payload.totalAmount}</Text>
            ) : null}
            {payload.message ? (
              <Text style={styles.sub}>{payload.message}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {showTotal ? (
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>
            {payload.totalLabel || (mode === 'paying' ? 'AMOUNT DUE' : 'TOTAL')}
          </Text>
          <Text style={styles.totalAmount}>{payload.totalAmount || ''}</Text>
          {payload.footer ? (
            <Text style={styles.footer}>{payload.footer}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.brandBar}>
        <Image
          source={images.logo_icon}
          style={styles.brandIcon}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.brandTitle}>Powered by Zentro</Text>
          <Text style={styles.brandUrl}>zentroapp.app</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 48,
    height: 48,
    marginRight: 10,
  },
  company: {
    flex: 1,
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  body: {
    flex: 1,
    marginTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  welcome: {
    color: C.text,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: C.muted,
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  cart: {
    flex: 1,
  },
  heading: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  lines: {
    flex: 1,
  },
  linesContent: {
    paddingBottom: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  qty: {
    width: 40,
    color: C.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    marginRight: 10,
  },
  amount: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statusTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusAmount: {
    color: C.accent,
    fontSize: 36,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  totalBar: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  totalLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  totalAmount: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  footer: {
    color: C.muted,
    fontSize: 13,
    marginTop: 4,
  },
  welcomeLogo: {
    width: 220,
    height: 160,
    marginBottom: 16,
  },
  statusLogo: {
    width: 64,
    height: 64,
    marginBottom: 12,
  },
  statusCompanyLogo: {
    width: 140,
    height: 140,
  },
  zentroTint: {
    tintColor: '#FFFFFF',
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  brandIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
    tintColor: '#FFFFFF',
  },
  brandTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: '700',
  },
  brandUrl: {
    color: C.muted,
    fontSize: 11,
  },
});
