import {View, Text, StyleSheet} from 'react-native';
import React from 'react';
import {COLORS, FONTS, SIZES} from '../../constants';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

const MyWallet = () => {
  const {canRead} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.PAYMENTS; // MyWallet uses Payments page permission

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view your wallet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>MyWallet</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray1,
  },
  text: {
    ...FONTS.h3,
    color: COLORS.black,
    padding: SIZES.padding,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: SIZES.radius,
  },
  accessDeniedTitle: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
export default MyWallet