/**
 * Backend version-check endpoint.
 * The app calls this on every launch to determine if an update is needed.
 * Example: 'https://zentroapp-backend.com/api/app/version-check/'
 */
export const APP_UPDATE_API_URL =
  'https://zentroapp-backend.com/api/app/version-check/';

/** When true, the remote check also runs in __DEV__. Default false. */
export const APP_UPDATE_CHECK_IN_DEV = false;

/**
 * Fallback download link if the API returns no download_url.
 * Set this to your landing page or direct APK link.
 */
export const APP_DOWNLOAD_FALLBACK_URL = 'https://zentroapp-backend.com/download/';

/**
 * If the version check request fails (network, timeout), allow the app to open.
 * Recommended: true - a network failure should not block users from using the app.
 */
export const APP_UPDATE_FAIL_OPEN_ON_FETCH_ERROR = true;

/** Request timeout in milliseconds for the version check call. */
export const APP_UPDATE_FETCH_TIMEOUT_MS = 10000;
