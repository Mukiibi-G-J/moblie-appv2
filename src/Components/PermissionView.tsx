/**
 * PermissionView Component
 *
 * Conditionally renders children based on permission.
 * Useful for wrapping sections of UI that require specific permissions.
 *
 * Usage:
 *   <PermissionView pageName={PAGE_NAMES.ITEMS} action="modify">
 *     <EditForm />
 *   </PermissionView>
 *
 *   <PermissionView
 *     pageName={PAGE_NAMES.ITEMS}
 *     action="delete"
 *     fallback={<Text>No delete permission</Text>}
 *   >
 *     <DeleteButton />
 *   </PermissionView>
 */

import React from 'react';
import {View, ViewProps} from 'react-native';
import {usePermissions} from '../hooks/usePermissions';
import {PageName} from '../constants/pageNames';

interface PermissionViewProps extends ViewProps {
  pageName: PageName;
  action: 'read' | 'insert' | 'modify' | 'delete';
  children: React.ReactNode;
  /**
   * Component to render when user doesn't have permission
   */
  fallback?: React.ReactNode;
  /**
   * If true, children will still render but with reduced opacity when no permission
   */
  showWithReducedOpacity?: boolean;
}

export const PermissionView: React.FC<PermissionViewProps> = ({
  pageName,
  action,
  children,
  fallback = null,
  showWithReducedOpacity = false,
  style,
  ...viewProps
}) => {
  const {canAccessPage} = usePermissions();
  const hasPermission = canAccessPage(pageName, action);

  // If no permission and not showing with reduced opacity, return fallback or null
  if (!hasPermission && !showWithReducedOpacity) {
    return <>{fallback}</>;
  }

  // If showing with reduced opacity, wrap in View with opacity
  if (!hasPermission && showWithReducedOpacity) {
    return (
      <View style={[{opacity: 0.5}, style]} {...viewProps}>
        {children}
      </View>
    );
  }

  // Has permission, render normally
  return (
    <View style={style} {...viewProps}>
      {children}
    </View>
  );
};

