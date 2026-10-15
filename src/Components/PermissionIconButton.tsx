/**
 * PermissionIconButton Component
 *
 * Permission-aware wrapper for IconButton component.
 * Automatically hides the button if user doesn't have permission.
 *
 * Usage:
 *   <PermissionIconButton
 *     pageName={PAGE_NAMES.ITEMS}
 *     action="delete"
 *     onPress={handleDelete}
 *     icon={icons.delete}
 *     containerStyle={styles.iconButton}
 *   />
 */

import React from 'react';
import {usePermissions} from '../hooks/usePermissions';
import {PageName} from '../constants/pageNames';
import IconButton from './IconButton';

interface PermissionIconButtonProps {
  pageName: PageName;
  action: 'read' | 'insert' | 'modify' | 'delete';
  onPress: () => void;
  icon: any;
  containerStyle?: object;
  iconStyle?: object;
  /**
   * If true, button will be disabled instead of hidden when no permission
   */
  disableInsteadOfHide?: boolean;
}

export const PermissionIconButton: React.FC<PermissionIconButtonProps> = ({
  pageName,
  action,
  onPress,
  icon,
  containerStyle,
  iconStyle,
  disableInsteadOfHide = false,
}) => {
  const {canAccessPage} = usePermissions();
  const hasPermission = canAccessPage(pageName, action);

  // If no permission and we should hide, return null
  if (!hasPermission && !disableInsteadOfHide) {
    return null;
  }

  return (
    <IconButton
      onPress={hasPermission ? onPress : () => {}}
      icon={icon}
      containerStyle={containerStyle}
      iconStyle={iconStyle}
    />
  );
};

