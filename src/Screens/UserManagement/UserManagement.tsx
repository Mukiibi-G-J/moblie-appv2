import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {COLORS, FONTS, SIZES} from '../../constants';
import Header from '../../Components/Header';
import {usePermissions} from '../../hooks/usePermissions';
import {PAGE_NAMES} from '../../constants/pageNames';

const UserManagement: React.FC = () => {
  const {canRead} = usePermissions();
  const PAGE_NAME = PAGE_NAMES.USER_MANAGEMENT;

  // Early return if no read permission
  if (!canRead(PAGE_NAME)) {
    return (
      <View style={styles.container}>
        <Header title="User Management" />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedMessage}>
            You don't have permission to view user management.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="User Management" />
      <View style={styles.content}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>
          User, role, and permission management coming soon...
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.black,
    marginBottom: SIZES.base,
  },
  subtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
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

export default UserManagement;



