import { data } from '@/data/api';
import { useAsync } from '@/hooks/useAsync';
import { buildBallot, type Ballot } from './ballot';

/** Loads every list needed to fill a ballot for one UF (president included). */
export function useBallot(uf: string | null) {
  return useAsync<Ballot | null>(async () => {
    if (!uf) return null;
    const [presidente, majoritarios, deputados, partidos] = await Promise.all([
      data.presidente(),
      data.majoritarios(uf),
      data.deputados(uf),
      data.partidos(),
    ]);
    return buildBallot(presidente, majoritarios, deputados, partidos);
  }, [uf]);
}
