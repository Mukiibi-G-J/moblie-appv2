function isValidEmail(value: string): boolean {
  // {{ edit_1 }}
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(value).toLowerCase());
}

function validateEmail(
  value: string,
  setEmailError: (error: string) => void,
): void {
  // {{ edit_2 }}
  if (value == '') {
    setEmailError('');
  } else if (isValidEmail(value)) {
    setEmailError('');
  } else {
    setEmailError('Invalid Email');
  }
}

function validatePassword(
  value: string,
  setPasswordError: (error: string) => void,
): void {
  if (value.length < 8) {
    setPasswordError('Password must be 8 characters');
    return;
  }

  if (!/[A-Z]/.test(value)) {
    if (/\p{Lu}/u.test(value)) {
      setPasswordError(
        'Password must use standard English uppercase letters (A-Z)',
      );
    } else {
      setPasswordError(
        'Password must contain at least one uppercase letter (A-Z)',
      );
    }
    return;
  }

  if (!/[a-z]/.test(value)) {
    setPasswordError(
      'Password must contain at least one lowercase letter (a-z)',
    );
    return;
  }

  if (!/[0-9]/.test(value)) {
    setPasswordError('Password must contain at least one number');
    return;
  }

  setPasswordError('');
}

function validateInput(
  value: string,
  minLength: number,
  setError: (error: string) => void,
): void {
  // {{ edit_4 }}
  if (value.length < minLength) {
    setError('Invalid Input');
  } else {
    setError('');
  }
}

/**
 * Maps authority roles to user-friendly display names
 * @param authority - Array of authority roles from the JWT token
 * @returns User-friendly role name
 */
export const getRoleDisplayName = (authority: string[]): string => {
  if (!authority || authority.length === 0) {
    return 'User';
  }

  // Map authority roles to display names
  const roleMap: {[key: string]: string} = {
    admin: 'Admin',
    manager: 'Manager',
    cashier: 'Cashier',
    staff: 'Staff',
    superuser: 'Super User',
  };

  // Return the first matching role, or the first authority if no mapping exists
  for (const role of authority) {
    if (roleMap[role.toLowerCase()]) {
      return roleMap[role.toLowerCase()];
    }
  }

  // If no mapping found, capitalize the first authority role
  return authority[0].charAt(0).toUpperCase() + authority[0].slice(1);
};

const utils = {
  isValidEmail,
  validateEmail,
  validatePassword,
  validateInput,
  // calculateAngle
};

export default utils;
