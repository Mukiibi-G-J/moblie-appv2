import React, {useEffect} from 'react';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {COLORS} from '../../constants';

/**
 * Legacy route kept for deep links / old navigations.
 * Payment now uses Marz collections on SubscriptionPage (webV2 parity).
 */
export default function MobileMoneyPaymentInstructions() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  useEffect(() => {
    const params = route.params ?? {};
    navigation.replace('Subscription', {
      fromExpiredModal: !!params.fromExpired,
      fromBillingRenewal: !!params.fromBillingRenewal,
      expiryKind: params.expiryKind,
      lockDate: params.lockDate,
    });
  }, [navigation, route.params]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={COLORS.primary2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});
