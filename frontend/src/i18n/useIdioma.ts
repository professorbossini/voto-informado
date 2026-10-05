import { useLocalState } from '@/data/localStore';
import { ORIGINAL } from './idiomas';

/** Idioma escolhido (fica no aparelho; com login, no perfil criptografado). */
export function useIdioma() {
  return useLocalState<string>('vi:idioma', ORIGINAL);
}
