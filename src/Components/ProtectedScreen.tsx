/**
 * ProtectedScreen Component
 *
 * Wraps screens to enforce permission checks before rendering.
 * Similar to web's AppRoute.tsx but for React Native screens.
 *
 * This component implements Layer 2 & 3 of the permission system:
 * - Layer 2: Checks if user has any access to the page
 * - Layer 3: Checks if user has the specific action permission
 *
 * Usage:
 *   <ProtectedScreen pageName={PAGE_NAMES.ITEMS} requiredAction="read">
 *     <ItemsScreen />
 *   </ProtectedScreen>
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {usePermissions} from '../hooks/usePermissions';
import {COLORS, FONTS, SIZES} from '../constants';
import {PAGE_NAMES, PageName} from '../constants/pageNames';

interface ProtectedScreenProps {
  pageName: PageName;
  requiredAction?: 'read' | 'insert' | 'modify' | 'delete';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedScreen: React.FC<ProtectedScreenProps> = ({
  pageName,
  requiredAction = 'read',
  children,
  fallback,
}) => {
  const {canAccessPage, hasAnyPageAccess} = usePermissions();

  // First check if user has any access to the page (Layer 2)
  const hasPageAccess = hasAnyPageAccess(pageName);

  // Then check if user has the specific action permission (Layer 3)
  const hasActionPermission = canAccessPage(pageName, requiredAction);

  // User needs both page access and the specific action permission
  const hasAccess = hasPageAccess && hasActionPermission;

  if (!hasAccess) {
    // Return custom fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Return default access denied UI
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Access Denied</Text>
          <Text style={styles.message}>
            You don't have permission to access this page.
          </Text>
          <Text style={styles.detail}>
            Required: {requiredAction} permission for {pageName}
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  content: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.base,
    textAlign: 'center',
  },
  message: {
    ...FONTS.body3,
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  detail: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

