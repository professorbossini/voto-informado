import { createContext, useContext } from 'react';
import type { Fonte, Meta } from './types';

export interface MetaValue {
  meta: Meta | null;
  error: unknown;
  fontes: Map<string, Fonte>;
}

export const MetaContext = createContext<MetaValue>({ meta: null, error: null, fontes: new Map() });

/** Site-wide metadata: election phase, update times, UFs and the official source registry. */
export function useMeta(): MetaValue {
  return useContext(MetaContext);
}
