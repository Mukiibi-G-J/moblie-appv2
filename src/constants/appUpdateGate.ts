/**
 * Remote minimum native build (Android versionCode / iOS CFBundleVersion).
 * Host a JSON file at APP_UPDATE_CONFIG_URL, for example:
 * { "minBuild": 42, "iosStoreUrl": "https://apps.apple.com/app/id...", "androidStoreUrl": "https://play.google.com/store/apps/details?id=..." }
 *
 * Leave APP_UPDATE_CONFIG_URL empty to disable the check (typical for local dev until you host the file).
 */
export const APP_UPDATE_CONFIG_URL = '';

/** When true, the remote check also runs in __DEV__. Default false so Metro builds are not blocked. */
export const APP_UPDATE_CHECK_IN_DEV = false;

/**
 * Used when the JSON omits a store URL, or when fetch fails and APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR is false.
 * Set your real store links before enabling fail-closed behavior.
 */
export const APP_UPDATE_IOS_STORE_URL_FALLBACK = '';
export const APP_UPDATE_ANDROID_STORE_URL_FALLBACK = '';

/**
 * If the config request fails (network, timeout, invalid JSON), allow the app to open.
 * Set false only if you always set platform fallbacks above and accept blocking when offline.
 */
export const APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR = true;
