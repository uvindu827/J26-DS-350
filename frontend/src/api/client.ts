/**
 * Minimal GET-only JSON client for the Component 1 API.
 * - builds `${API_BASE_URL}/c1${path}?params`
 * - times out after REQUEST_TIMEOUT_MS
 * - maps every failure to ApiError
 * - optionally checks the response structure before returning it
 * No custom headers are sent, so browsers make a "simple" CORS request (no preflight).
 */
import { API_BASE_URL, API_PREFIX, REQUEST_TIMEOUT_MS } from '@/config/env';

import { ApiError, readErrorDetail } from './errors';

export type QueryValue = string | number | boolean | undefined;
export type QueryParams = Record<string, QueryValue>;
export type ResponseGuard<T> = (value: unknown) => value is T;

export function buildUrl(path: string, params?: QueryParams): string {
  if (!API_BASE_URL) {
    throw new ApiError('not-configured', 'Set EXPO_PUBLIC_API_BASE_URL in frontend/.env and restart Expo.');
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.append(key, String(value));
  }
  const query = search.toString();
  return `${API_BASE_URL}${API_PREFIX}${path}${query ? `?${query}` : ''}`;
}

export async function getJson<T>(
  path: string,
  options: { params?: QueryParams; guard?: ResponseGuard<T>; signal?: AbortSignal } = {},
): Promise<T> {
  const url = buildUrl(path, options.params);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      throw new ApiError('timeout', `No response within ${REQUEST_TIMEOUT_MS / 1000} s.`, { url });
    }
    if (options.signal?.aborted) throw err; // cancelled by the caller (e.g. screen closed)
    throw new ApiError('network', 'Network request failed.', { url, detail: err instanceof Error ? err.message : undefined });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      response.ok ? 'invalid-response' : 'http',
      response.ok ? 'Response was not valid JSON.' : `HTTP ${response.status}`,
      { status: response.status, url },
    );
  }

  if (!response.ok) {
    const detail = readErrorDetail(body);
    throw new ApiError('http', detail ?? `HTTP ${response.status}`, { status: response.status, detail, url });
  }
  if (options.guard && !options.guard(body)) {
    throw new ApiError('invalid-response', 'Response did not have the expected structure.', { url });
  }
  return body as T;
}
