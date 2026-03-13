/**
 * Permission Error Utilities
 *
 * Provides consistent error handling for permission-related API errors
 */

import Toast from 'react-native-toast-message';

/**
 * Handle permission errors (403 Forbidden) from API responses
 * @param error - The error object from axios/API call
 * @param action - Description of the action being performed (e.g., 'create items', 'edit customer')
 * @returns true if the error was a permission error and was handled, false otherwise
 */
export const handlePermissionError = (error: any, action?: string): boolean => {
  if (error.response?.status === 403) {
    const message =
      error.response?.data?.detail ||
      (action
        ? `You do not have permission to ${action}.`
        : 'You do not have permission to perform this action.');

    Toast.show({
      type: 'error',
      text1: 'Access Denied',
      text2: message,
      position: 'bottom',
    });

    return true; // Error was handled
  }
  return false; // Error was not a permission error
};

/**
 * Check if an error is a permission error
 * @param error - The error object
 * @returns true if the error is a 403 Forbidden error
 */
export const isPermissionError = (error: any): boolean => {
  return error.response?.status === 403;
};

