import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs an async fetcher on mount and whenever `deps` change. Returns the data,
 * loading/error state, and a `refresh` that re-runs without toggling the
 * loading flag (so polling doesn't flicker the UI).
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> & { refresh: () => void; setData: (data: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback((withLoading: boolean) => {
    if (withLoading) setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef
      .current()
      .then((data) => {
        if (mounted.current) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (mounted.current)
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : "request_failed",
          }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => run(false), [run]);
  const setData = useCallback(
    (data: T) => setState((s) => ({ ...s, data })),
    [],
  );

  return { ...state, refresh, setData };
}
