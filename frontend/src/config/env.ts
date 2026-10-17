/**
 * Runtime configuration for reaching the Component 1 FastAPI backend.
 *
 * The base URL comes from EXPO_PUBLIC_API_BASE_URL in frontend/.env (not committed).
 * Expo inlines EXPO_PUBLIC_* variables at bundle time, so restart `npx expo start -c`
 * after changing .env.
 *
 *   Web (browser on this laptop)     http://127.0.0.1:8000
 *   Android emulator                  http://10.0.2.2:8000
 *   Physical phone on the same Wi-Fi  http://<laptop IPv4>:8000  (backend started with --host 0.0.0.0)
 */
import { Platform } from 'react-native';

/** Used only on web when .env is missing, so local development still works. */
const DEFAULT_WEB_BASE_URL = 'http://127.0.0.1:8000';

/** All Component 1 endpoints live under this prefix (see docs/c1_api_openapi.json). */
export const API_PREFIX = '/c1';

/**
 * Request timeout for local development. The final value for the shared frontend is
 * TBD in the integration contract (section 4.7); NFR-02 targets views within ~5 s.
 */
export const REQUEST_TIMEOUT_MS = 10_000;

function normaliseBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

// Must be read as a literal `process.env.EXPO_PUBLIC_...` expression for Expo to inline it.
const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const hasEnvBaseUrl = typeof envBaseUrl === 'string' && envBaseUrl.trim().length > 0;

/** null means "not configured": every request then fails with a clear configuration error. */
export const API_BASE_URL: string | null = hasEnvBaseUrl
  ? normaliseBaseUrl(envBaseUrl)
  : Platform.OS === 'web'
    ? DEFAULT_WEB_BASE_URL
    : null;

export const API_BASE_URL_SOURCE: string = hasEnvBaseUrl
  ? 'EXPO_PUBLIC_API_BASE_URL (.env)'
  : Platform.OS === 'web'
    ? 'built-in default for local web development'
    : 'not configured – set EXPO_PUBLIC_API_BASE_URL in frontend/.env';
