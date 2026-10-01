import { useMemo, type ReactNode } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { data } from './api';
import { MetaContext, type MetaValue } from './MetaContext';

export function MetaProvider({ children }: { children: ReactNode }) {
  const { data: meta, error } = useAsync(() => data.meta(), []);
  const value = useMemo<MetaValue>(
    () => ({
      meta: meta ?? null,
      error,
      fontes: new Map((meta?.fontes ?? []).map((f) => [f.chave, f])),
    }),
    [meta, error],
  );
  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}
