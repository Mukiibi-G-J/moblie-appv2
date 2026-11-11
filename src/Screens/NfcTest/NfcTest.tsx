import React, {useCallback, useState} from 'react';
import {
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {COLORS, FONTS, icons} from '../../constants';
import {QuickIconPressable} from '../../Components/QuickIconPressable';
import {safeGoBack} from '../../hooks/NavigationService';
import {useTheme} from '../../context/ThemeContext';
import {
  getNfcProbeStatus,
  nfcProbeAvailable,
  openNfcSettings,
  startNfcProbe,
  stopNfcProbe,
  subscribeNfcProbeTap,
  type NfcProbeTap,
} from '../../services/nfcProbe';

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const NfcTest = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {colors} = useTheme();
  const headerPaddingTop = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    12,
  );
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [taps, setTaps] = useState<NfcProbeTap[]>([]);

  const refresh = useCallback(async () => {
    if (!nfcProbeAvailable()) {
      setSupported(false);
      setEnabled(false);
      setListening(false);
      return;
    }
    const status = await getNfcProbeStatus();
    setSupported(status.supported);
    setEnabled(status.enabled);
    if (!status.supported || !status.enabled) {
      setListening(false);
      await stopNfcProbe();
      return;
    }
    const started = await startNfcProbe();
    setListening(started);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let unsubscribe = () => {};
      void refresh();
      unsubscribe = subscribeNfcProbeTap(tap => {
        setTaps(prev => [tap, ...prev].slice(0, 6));
      });
      return () => {
        unsubscribe();
        void stopNfcProbe();
        setListening(false);
      };
    }, [refresh]),
  );

  const statusLine = !nfcProbeAvailable()
    ? 'This build does not include the NFC test.'
    : supported == null
      ? 'Checking the reader…'
      : supported === false
        ? 'This phone has no NFC reader.'
        : enabled
          ? listening
            ? 'Listening. Hold a card on the NFC mark.'
            : 'Reader is on, but listening did not start.'
          : 'NFC is turned off in Android settings.';

  const latest = taps[0];

  return (
    <SafeAreaView
      style={[styles.root, {backgroundColor: colors.background}]}
      edges={['left', 'right', 'bottom']}>
      <View
        style={[
          styles.topBar,
          {paddingTop: headerPaddingTop, borderBottomColor: colors.border},
        ]}>
        <QuickIconPressable
          style={[
            styles.backBtn,
            {borderColor: colors.border, backgroundColor: colors.card},
          ]}
          onPress={() => safeGoBack(navigation, 'Home')}
          accessibilityLabel="Go back">
          <Image
            source={icons.back as any}
            style={[styles.backIcon, {tintColor: colors.textPrimary}]}
            resizeMode="contain"
          />
        </QuickIconPressable>
        <Text style={[styles.topTitle, {color: colors.textPrimary}]}>
          NFC test
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.body}>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: latest ? 'rgba(0, 184, 148, 0.12)' : colors.card,
              borderColor: latest ? 'rgba(0, 184, 148, 0.4)' : colors.border,
            },
          ]}>
          <Text style={[styles.heroTitle, {color: colors.textPrimary}]}>
            {latest
              ? latest.contactlessCard
                ? 'Card seen'
                : 'Tag seen'
              : 'Waiting for a tap'}
          </Text>
          <Text style={[styles.heroBody, {color: colors.textSecondary}]}>
            {statusLine}
          </Text>
          {latest ? (
            <Text style={[styles.heroMeta, {color: colors.textPrimary}]}>
              {formatTime(latest.at)}
              {latest.techs.length ? ` · ${latest.techs.join(', ')}` : ''}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.note, {color: colors.textSecondary}]}>
          This checks the reader on the top of the machine. It does not read
          the card number and it does not take a payment.
        </Text>

        {supported && !enabled ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={openNfcSettings}
            activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Turn on NFC</Text>
          </TouchableOpacity>
        ) : null}

        {taps.length > 1 ? (
          <View style={styles.log}>
            {taps.slice(1).map(tap => (
              <Text
                key={tap.at}
                style={[styles.logLine, {color: colors.textSecondary}]}>
                {formatTime(tap.at)} ·{' '}
                {tap.contactlessCard ? 'Card' : 'Tag'}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {width: 18, height: 18},
  topTitle: {...FONTS.h3, fontWeight: '700'},
  topBarSpacer: {width: 36},
  body: {padding: 16, gap: 14},
  hero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  heroTitle: {fontSize: 22, fontWeight: '700'},
  heroBody: {...FONTS.body3},
  heroMeta: {...FONTS.body4, fontWeight: '600'},
  note: {...FONTS.body4},
  primaryBtn: {
    backgroundColor: COLORS.primary2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {color: COLORS.white, fontWeight: '700', fontSize: 16},
  log: {gap: 6},
  logLine: {...FONTS.body4},
});

export default NfcTest;
