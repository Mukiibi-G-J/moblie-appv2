import AsyncStorage from '@react-native-async-storage/async-storage';
import {setTenant} from './tenant';

export const LOGIN_DRAFT_TENANT = '@zentro_login_draft_tenant';
export const LOGIN_DRAFT_EMAIL = '@zentro_login_draft_email';
export const LOGIN_DRAFT_PASSWORD = '@zentro_login_draft_password';
export const LOGIN_DRAFT_LOGIN_METHOD = '@zentro_login_draft_login_method';

export type LoginDraftMethod = 'email' | 'phone';

/** After company creation — pre-fill sign-in with the slug + email from signup. */
export async function seedLoginCredentialsAfterSignup(
  companyName: string,
  email: string,
): Promise<void> {
  const schema = companyName.trim().toLowerCase();
  const normalizedEmail = email.trim();
  await setTenant(schema, normalizedEmail);
  await AsyncStorage.multiSet([
    [LOGIN_DRAFT_TENANT, schema],
    [LOGIN_DRAFT_EMAIL, normalizedEmail],
  ]);
  await AsyncStorage.removeItem(LOGIN_DRAFT_PASSWORD);
}
