/**
 * PermissionButton Component
 *
 * A generic permission-aware button that automatically hides if user doesn't have permission.
 * Can wrap any button component or render a TouchableOpacity directly.
 *
 * Usage:
 *   <PermissionButton
 *     pageName={PAGE_NAMES.ITEMS}
 *     action="insert"
 *     onPress={handleCreate}
 *   >
 *     <Text>Create Item</Text>
 *   </PermissionButton>
 *
 *   <PermissionButton
 *     pageName={PAGE_NAMES.ITEMS}
 *     action="modify"
 *     onPress={handleEdit}
 *     renderButton={(props) => <CustomButton title="Edit" {...props} />}
 *   />
 */

import React from 'react';
import {TouchableOpacity, TouchableOpacityProps, View} from 'react-native';
import {usePermissions} from '../hooks/usePermissions';
import {PageName} from '../constants/pageNames';

interface PermissionButtonProps extends Omit<TouchableOpacityProps, 'onPress'> {
  pageName: PageName;
  action: 'read' | 'insert' | 'modify' | 'delete';
  onPress: () => void;
  children?: React.ReactNode;
  /**
   * Optional render function for custom button components
   * Receives the onPress handler and other props
   */
  renderButton?: (props: {onPress: () => void; disabled?: boolean}) => React.ReactNode;
  /**
   * If true, button will be disabled instead of hidden when no permission
   */
  disableInsteadOfHide?: boolean;
  /**
   * Fallback component to show when no permission (if disableInsteadOfHide is false)
   */
  fallback?: React.ReactNode;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  pageName,
  action,
  onPress,
  children,
  renderButton,
  disableInsteadOfHide = false,
  fallback = null,
  ...touchableProps
}) => {
  const {canAccessPage} = usePermissions();
  const hasPermission = canAccessPage(pageName, action);

  // If no permission and we should hide, return null or fallback
  if (!hasPermission && !disableInsteadOfHide) {
    return <>{fallback}</>;
  }

  // If using custom render function
  if (renderButton) {
    return (
      <>
        {renderButton({
          onPress: hasPermission ? onPress : () => {},
          disabled: !hasPermission,
        })}
      </>
    );
  }

  // Default: render TouchableOpacity
  return (
    <TouchableOpacity
      {...touchableProps}
      onPress={hasPermission ? onPress : undefined}
      disabled={!hasPermission || touchableProps.disabled}>
      {children}
    </TouchableOpacity>
  );
};

