/**
 * PermissionTextButton Component
 *
 * Permission-aware wrapper for TextButton component.
 * Automatically hides the button if user doesn't have permission.
 *
 * Usage:
 *   <PermissionTextButton
 *     pageName={PAGE_NAMES.ITEMS}
 *     action="insert"
 *     onPress={handleCreate}
 *     label="Create Item"
 *     buttonContainerStyle={styles.button}
 *     labelStyle={styles.label}
 *   />
 */

import React from 'react';
import {usePermissions} from '../hooks/usePermissions';
import {PageName} from '../constants/pageNames';
import TextButton from './TextButton';

interface PermissionTextButtonProps {
  pageName: PageName;
  action: 'read' | 'insert' | 'modify' | 'delete';
  onPress: () => void;
  label: string;
  buttonContainerStyle: object;
  labelStyle: object;
  label2?: string;
  label2Style?: object;
  disabled?: boolean;
  /**
   * If true, button will be disabled instead of hidden when no permission
   */
  disableInsteadOfHide?: boolean;
}

export const PermissionTextButton: React.FC<PermissionTextButtonProps> = ({
  pageName,
  action,
  onPress,
  label,
  buttonContainerStyle,
  labelStyle,
  label2 = '',
  label2Style,
  disabled = false,
  disableInsteadOfHide = false,
}) => {
  const {canAccessPage} = usePermissions();
  const hasPermission = canAccessPage(pageName, action);

  // If no permission and we should hide, return null
  if (!hasPermission && !disableInsteadOfHide) {
    return null;
  }

  return (
    <TextButton
      onPress={hasPermission ? onPress : () => {}}
      label={label}
      buttonContainerStyle={buttonContainerStyle}
      labelStyle={labelStyle}
      label2={label2}
      label2Style={label2Style}
      disabled={!hasPermission || disabled}
    />
  );
};

