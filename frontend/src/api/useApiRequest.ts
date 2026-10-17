/**
 * Loading / success / error state for one API request.
 * - `key` identifies the request; when it changes the request runs again and old data is
 *   cleared, so data for a different request is never shown as the current one.
 * - In-flight requests are cancelled when the key changes or the screen unmounts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from './errors';

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T; elapsedMs: number; receivedAt: Date }
  | { status: 'error'; error: unknown };

export function useApiRequest<T>(
  key: string,
  request: (signal: AbortSignal) => Promise<T>,
): RequestState<T> & { reload: () => void } {
  const [state, setState] = useState<RequestState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(request);

  useEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    const controller = new AbortController();
    const started = Date.now();
    setState({ status: 'loading' });
    requestRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ status: 'success', data, elapsedMs: Date.now() - started, receivedAt: new Date() });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', error: error ?? new ApiError('network', 'Unknown error') });
        }
      },
    );
    return () => controller.abort();
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
