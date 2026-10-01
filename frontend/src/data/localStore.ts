import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tiny localStorage-backed store for per-viewer conveniences (comparison list,
 * "cola" de votação). Nothing here ever leaves the device. Every access is wrapped
 * in try/catch: private windows or blocked storage just fall back to memory.
 */
const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: memory copy is enough for this session */
  }
  listeners.get(key)?.forEach((l) => l());
}

export function useLocalState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(cb);
      listeners.set(key, set);
      const onStorage = (e: StorageEvent) => e.key === key && cb();
      window.addEventListener('storage', onStorage);
      return () => {
        set.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = (() => {
        const r = read(key);
        try {
          return r ? (JSON.parse(r) as T) : fallback;
        } catch {
          return fallback;
        }
      })();
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(current) : next;
      write(key, JSON.stringify(resolved));
    },
    // fallback is a literal at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

export const MAX_COMPARAR = 4;

/** Candidates picked for side-by-side comparison (max 4, by SQ). */
export function useComparar() {
  const [lista, setLista] = useLocalState<string[]>('vi:comparar', []);
  const toggle = useCallback(
    (sq: string) =>
      setLista((prev) => (prev.includes(sq) ? prev.filter((s) => s !== sq) : [...prev, sq].slice(-MAX_COMPARAR))),
    [setLista],
  );
  return { lista, toggle, set: setLista, has: (sq: string) => lista.includes(sq) };
}

/** "Cola": the voter's own picks, per office, kept only on this device. */
export interface Cola {
  uf: string | null;
  /** cargo key → candidate SQ (senador uses 'senador-1' and 'senador-2'). */
  escolhas: Record<string, string>;
}

export function useCola() {
  const [cola, setCola] = useLocalState<Cola>('vi:cola', { uf: null, escolhas: {} });
  return { cola, setCola };
}
