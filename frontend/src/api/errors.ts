/**
 * One error type for every way a request can fail, so screens can always show
 * "unavailable" instead of partial or stale data (integration contract v1.1, 4.7–4.8).
 */

export type ApiErrorKind =
  | 'not-configured' // no base URL
  | 'network' // backend not running, wrong address, blocked by the browser
  | 'timeout' // no answer within REQUEST_TIMEOUT_MS
  | 'http' // 400 / 422 / 405 / 5xx
  | 'invalid-response'; // not JSON, or not the expected structure

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly detail?: string;
  readonly url?: string;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; detail?: string; url?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status;
    this.detail = opts.detail;
    this.url = opts.url;
  }
}

/** Turns a FastAPI error body (400: string detail, 422: list of validation items) into text. */
export function readErrorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('detail' in body)) return undefined;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return undefined;
        const { loc, msg } = item as { loc?: unknown; msg?: unknown };
        const field = Array.isArray(loc) ? loc.filter((p) => p !== 'query').join('.') : '';
        return typeof msg === 'string' ? (field ? `${field}: ${msg}` : msg) : undefined;
      })
      .filter((p): p is string => Boolean(p));
    return parts.length ? parts.join('; ') : undefined;
  }
  return undefined;
}

/** Plain-language title and explanation for the unavailable state. */
export function describeApiError(error: unknown): { title: string; message: string; technical?: string } {
  if (!(error instanceof ApiError)) {
    return { title: 'Unexpected error', message: 'Something went wrong while loading data.', technical: String(error) };
  }
  const technical = [error.status ? `HTTP ${error.status}` : undefined, error.detail, error.url]
    .filter(Boolean)
    .join(' · ');
  switch (error.kind) {
    case 'not-configured':
      return { title: 'API address not set', message: error.message, technical };
    case 'network':
      return {
        title: 'Cannot reach the forecast service',
        message: 'The Component 1 backend did not respond. Check that FastAPI is running and the API address is correct.',
        technical,
      };
    case 'timeout':
      return { title: 'The forecast service took too long', message: error.message, technical };
    case 'http':
      if (error.status === 400) return { title: 'Request outside the available data', message: error.detail ?? error.message, technical };
      if (error.status === 422) return { title: 'Invalid request', message: error.detail ?? error.message, technical };
      return { title: 'The forecast service returned an error', message: error.message, technical };
    case 'invalid-response':
      return {
        title: 'Unexpected response',
        message: 'The service answered, but not in the expected format, so nothing is shown.',
        technical,
      };
  }
}
