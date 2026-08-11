import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {FONTS, SIZES} from '../../constants';
import {useTheme} from '../../context/ThemeContext';
import RestaurantScreenLayout from './RestaurantScreenLayout';
import {
  getRestaurantPinStatus,
  type RestaurantPinStatusResponse,
} from '../../services/restaurantPinApi';

const BRAND = '#005151';

type PinStatus = RestaurantPinStatusResponse | null;

export default function RestaurantSettings() {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const [pinStatus, setPinStatus] = useState<PinStatus>(null);
  const [pinLoading, setPinLoading] = useState(true);
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPinLoading(true);
    setPinError(false);
    getRestaurantPinStatus()
      .then(data => {
        if (!cancelled) {
          setPinStatus(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPinError(true);
          setPinStatus(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPinLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goPinSetup = (params: {
    fromSettings: true;
    pinSetupMode?: 'change' | 'renew';
  }) => {
    navigation.navigate('RestaurantPinSetup', params);
  };

  const showPinSection =
    pinLoading || pinError || pinStatus?.eligible === true;

  const renderPinCard = () => {
    if (pinLoading && pinStatus == null && !pinError) {
      return (
        <View
          style={[
            styles.card,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔑</Text>
            <View style={styles.cardTextCol}>
              <ActivityIndicator color={BRAND} style={styles.inlineSpinner} />
              <Text style={[styles.cardMuted, {color: colors.textSecondary}]}>
                Loading PIN status…
              </Text>
            </View>
          </View>
        </View>
      );
    }

    if (pinError) {
      return (
        <View
          style={[
            styles.card,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔑</Text>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardBody, {color: colors.textPrimary}]}>
                Could not load PIN status
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, {backgroundColor: BRAND}]}
            onPress={() => {
              setPinError(false);
              setPinLoading(true);
              getRestaurantPinStatus()
                .then(data => setPinStatus(data))
                .catch(() => {
                  setPinError(true);
                  setPinStatus(null);
                })
                .finally(() => setPinLoading(false));
            }}>
            <Text style={styles.btnPrimaryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!pinStatus) {
      return null;
    }

    if (!pinStatus.eligible) {
      return null;
    }

    if (pinStatus.has_pin && pinStatus.pin_expired) {
      return (
        <View
          style={[
            styles.card,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔑</Text>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
                Quick PIN — Expired
              </Text>
              <Text style={[styles.cardBody, {color: colors.textSecondary}]}>
                Your PIN has expired. Set a new one.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, {backgroundColor: BRAND}]}
            onPress={() =>
              goPinSetup({fromSettings: true, pinSetupMode: 'renew'})
            }>
            <Text style={styles.btnPrimaryText}>Renew PIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!pinStatus.has_pin) {
      return (
        <View
          style={[
            styles.card,
            {backgroundColor: colors.card, borderColor: colors.border},
          ]}>
          <View style={styles.cardRow}>
            <Text style={styles.cardIcon}>🔑</Text>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
                Quick PIN
              </Text>
              <Text style={[styles.cardBody, {color: colors.textSecondary}]}>
                Not set up yet
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btnPrimary, {backgroundColor: BRAND}]}
            onPress={() => goPinSetup({fromSettings: true})}>
            <Text style={styles.btnPrimaryText}>Set up quick PIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.card,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>🔑</Text>
          <View style={styles.cardTextCol}>
            <Text style={[styles.cardTitle, {color: colors.textPrimary}]}>
              Quick PIN ✓ Active
            </Text>
            <Text style={[styles.cardBody, {color: colors.textSecondary}]}>
              Tap to change your PIN for this device
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.btnSecondary,
            {borderColor: BRAND, backgroundColor: colors.background},
          ]}
          onPress={() =>
            goPinSetup({fromSettings: true, pinSetupMode: 'change'})
          }>
          <Text style={[styles.btnSecondaryText, {color: BRAND}]}>
            Change PIN
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <RestaurantScreenLayout title="Restaurant settings">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {showPinSection ? renderPinCard() : null}

        <View style={styles.note}>
          <Text style={[styles.noteText, {color: colors.textSecondary}]}>
            Location defaults, service modes, and more are configured on web.
            Mobile will surface additional toggles here over time.
          </Text>
        </View>
      </ScrollView>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: SIZES.padding * 1.5,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 16,
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIcon: {
    fontSize: 28,
    lineHeight: 34,
  },
  cardTextCol: {
    flex: 1,
    gap: 4,
  },
  inlineSpinner: {alignSelf: 'flex-start'},
  cardTitle: {
    ...FONTS.h3,
    fontWeight: '700',
  },
  cardBody: {
    ...FONTS.body3,
    lineHeight: 22,
  },
  cardMuted: {
    ...FONTS.body4,
    marginTop: 4,
  },
  btnPrimary: {
    minHeight: 48,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    ...FONTS.body3,
  },
  btnSecondary: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  btnSecondaryText: {
    fontWeight: '600',
    ...FONTS.body3,
  },
  note: {marginTop: 20},
  noteText: {...FONTS.body4, lineHeight: 20},
});
