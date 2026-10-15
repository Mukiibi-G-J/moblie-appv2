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
import {PageName} from '../constants/pageNames';

function AccessDenied({detail}: {detail: string}) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.message}>
          You don't have permission to access this page.
        </Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

interface ProtectedScreenProps {
  /** Single page or any-of (e.g. menus hub: Restaurant Menus | Menu Management | Layout Editor). */
  pageName: PageName | PageName[];
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

  const pageNames = Array.isArray(pageName) ? pageName : [pageName];

  // First check if user has any access to at least one page (Layer 2)
  const hasPageAccess = pageNames.some(p => hasAnyPageAccess(p));

  // Then check if user has the specific action on at least one page (Layer 3)
  const hasActionPermission = pageNames.some(p =>
    canAccessPage(p, requiredAction),
  );

  // User needs both page access and the specific action permission
  const hasAccess = hasPageAccess && hasActionPermission;

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <AccessDenied
        detail={`Required: ${requiredAction} permission for one of: ${pageNames.join(
          ', ',
        )}`}
      />
    );
  }

  return <>{children}</>;
};

/**
 * Company info, billing, and module/plan screens. Uses the JWT/session
 * canManageCompany claim — not the Admin role name and not missing-key = allowed.
 */
export const CompanyBillingGate: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({children, fallback}) => {
  const {canManageCompany} = usePermissions();
  if (canManageCompany) {
    return <>{children}</>;
  }
  if (fallback) {
    return <>{fallback}</>;
  }
  return (
    <AccessDenied detail="Company & billing is limited to users with company management access." />
  );
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

