import { useCallback, useEffect, useState } from 'react';
import { data } from '@/data/api';
import { useLocalState } from '@/data/localStore';
import { municipioDoPonto, ufDoPonto } from '@/data/localizacao';
import { isNativeApp } from '@/native/platform';

/** Sem município escolhido nem localização: São Paulo (código do município no TSE). */
export const MUN_PADRAO = { uf: 'SP', mun: '71072' };

/** Brasília (código do município no TSE): o DF não tem malha municipal, é um município só. */
export const MUN_BRASILIA = { uf: 'DF', mun: '97012' };

export type StatusMunicipio = 'ocioso' | 'buscando' | 'negado' | 'indisponivel' | 'fora' | 'df';

/**
 * Município da pessoa pela localização (Câmara Municipal no plenário, emendas no município). Como
 * a UF na apuração, o cálculo é feito no aparelho (malha municipal do IBGE publicada no site): a
 * posição não sai dele. Fica guardado só o código do município.
 */
export function useMunicipioUsuario(ativo: boolean) {
  const [salvo, setSalvo] = useLocalState<{ uf: string; mun: string } | null>('vi:municipio', null);
  const [pediu, setPediu] = useLocalState<boolean>('vi:municipio-pediu', false);
  const [status, setStatus] = useState<StatusMunicipio>('ocioso');

  const detectar = useCallback(
    (aoAchar?: () => void) => {
      if (!('geolocation' in navigator)) {
        setStatus('indisponivel');
        return;
      }
      setStatus('buscando');
      setPediu(true);
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const uf = ufDoPonto(coords.latitude, coords.longitude);
          if (!uf) return setStatus('fora');
          if (uf === 'DF') return setStatus('df');
          try {
            const mun = municipioDoPonto(coords.latitude, coords.longitude, await data.malhaMunicipal(uf));
            if (!mun) return setStatus('fora');
            setSalvo({ uf, mun });
            setStatus('ocioso');
            aoAchar?.();
          } catch {
            setStatus('indisponivel');
          }
        },
        (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'negado' : 'indisponivel'),
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
      );
    },
    [setSalvo, setPediu],
  );

  // Ao abrir a página: com a permissão já dada, confere de novo (a pessoa pode ter mudado de
  // cidade); sem ela, pergunta uma vez só e não insiste se já foi negada.
  useEffect(() => {
    if (!ativo) return;
    let cancel = false;
    const perm: Promise<PermissionStatus | null> = isNativeApp
      ? Promise.resolve(null)
      : (navigator.permissions?.query?.({ name: 'geolocation' as PermissionName }) ?? Promise.resolve(null));
    perm.then(
      (p) => {
        if (cancel) return;
        if (p?.state === 'denied') setStatus('negado');
        else if (p?.state === 'granted' || (!salvo && !pediu)) detectar();
      },
      () => !cancel && !salvo && !pediu && detectar(),
    );
    return () => void (cancel = true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  return { salvo, status, detectar };
}
