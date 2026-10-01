import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

const sameDeps = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/**
 * Minimal data-fetching hook. For bigger apps, swap for TanStack Query:
 * the `api` client works with it as-is.
 */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);
  const [prevDeps, setPrevDeps] = useState(deps);

  // Deps changed: flag loading during render instead of inside the effect.
  if (!sameDeps(prevDeps, deps)) {
    setPrevDeps(deps);
    setState((s) => ({ ...s, loading: true, error: null }));
  }

  useEffect(() => {
    const controller = new AbortController();
    fn(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ data, error: null, loading: false }),
      (error: unknown) =>
        !controller.signal.aborted && setState({ data: undefined, error, loading: false }),
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);

  const setData = useCallback(
    (updater: (prev: T | undefined) => T) => setState((s) => ({ ...s, data: updater(s.data) })),
    [],
  );

  return { ...state, reload, setData };
}
