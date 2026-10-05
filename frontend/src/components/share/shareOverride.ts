import { useSyncExternalStore } from 'react';

/**
 * Endereço a compartilhar quando a página guarda o estado fora da URL (ex.: a lista do Comparar
 * fica no aparelho). As páginas registram com useShareOverride; o padrão é a própria URL.
 */
let override: string | null = null;
const ouvintes = new Set<() => void>();
export function setShareOverride(path: string | null) {
  override = path;
  ouvintes.forEach((l) => l());
}
export function useShareOverride() {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => override,
    () => null,
  );
}
