import { useCallback, useEffect, useRef, useState } from 'react';
import { buscarApuracao, finalistasDe, temSegundoTurno, urlApuracao, type Apuracao, type CandidatoApurado, type CargoApuracao, type Turno } from '@/data/apuracao';
import { data as api } from '@/data/api';
import { inicioDivulgacao } from '@/data/calendario';
import { useAsync } from '@/hooks/useAsync';
import { useCola, useLocalState } from '@/data/localStore';
import { ufDoPonto } from '@/data/localizacao';
import { isNativeApp } from '@/native/platform';

/** De quanto em quanto tempo a apuração é consultada de novo (o CDN do TSE segura ~1 min). */
export const INTERVALO_MS = 60_000;

/**
 * Consultas ao TSE compartilhadas entre componentes: a mesma URL pedida por dois
 * cartões no mesmo minuto vira uma única requisição.
 */
const recentes = new Map<string, { em: number; p: Promise<Apuracao | null> }>();

function consultar(turno: Turno, cargo: CargoApuracao, uf: string, forcar = false): Promise<Apuracao | null> {
  const url = urlApuracao(turno, cargo, uf);
  const r = recentes.get(url);
  if (r && !forcar && Date.now() - r.em < INTERVALO_MS - 5_000) return r.p;
  const p = buscarApuracao(turno, cargo, uf);
  recentes.set(url, { em: Date.now(), p });
  p.catch(() => recentes.delete(url));
  return p;
}

export interface EstadoApuracao {
  data: Apuracao | null;
  /** Primeira consulta ainda em andamento. */
  loading: boolean;
  /** O TSE ainda não publicou este arquivo (404). */
  naoPublicado: boolean;
  error: string | null;
  /** Quando este aparelho consultou o TSE pela última vez. */
  consultadoEm: Date | null;
  atualizar: () => void;
}

/**
 * Apuração de um cargo, reconsultada a cada minuto enquanto a aba está visível
 * (e parada depois da totalização final). `uf` vazio = desligado.
 */
export function useApuracao(turno: Turno, cargo: CargoApuracao, uf: string | null): EstadoApuracao {
  const chave = uf ? `${turno}|${cargo}|${uf}` : '';
  const [st, setSt] = useState<{ chave: string; data: Apuracao | null; naoPublicado: boolean; error: string | null; consultadoEm: Date | null; carregou: boolean }>(
    { chave, data: null, naoPublicado: false, error: null, consultadoEm: null, carregou: false },
  );
  const [tick, setTick] = useState(0);
  const forcar = useRef(false);

  // Trocou de cargo/UF/turno: zera o estado durante a renderização (sem piscar dado velho).
  if (st.chave !== chave) setSt({ chave, data: null, naoPublicado: false, error: null, consultadoEm: null, carregou: false });

  const final = st.data?.final ?? false;

  useEffect(() => {
    if (!uf) return;
    let vivo = true;
    const rodar = () => {
      const f = forcar.current;
      forcar.current = false;
      consultar(turno, cargo, uf, f).then(
        (data) => vivo && setSt((s) => (s.chave !== chave ? s : { ...s, data: data ?? s.data, naoPublicado: !data && !s.data, error: null, consultadoEm: new Date(), carregou: true })),
        (e: unknown) =>
          vivo &&
          setSt((s) =>
            s.chave !== chave ? s : { ...s, error: e instanceof Error && e.name !== 'TypeError' ? e.message : 'Não foi possível falar com o servidor do TSE agora.', consultadoEm: new Date(), carregou: true },
          ),
      );
    };
    rodar();
    if (final) return () => void (vivo = false);
    const t = setInterval(() => document.visibilityState === 'visible' && rodar(), INTERVALO_MS);
    const onVisivel = () => document.visibilityState === 'visible' && rodar();
    document.addEventListener('visibilitychange', onVisivel);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisivel);
    };
  }, [turno, cargo, uf, chave, final, tick]);

  const atualizar = useCallback(() => {
    forcar.current = true;
    setTick((t) => t + 1);
  }, []);

  return { data: st.data, loading: Boolean(uf) && !st.carregou, naoPublicado: st.naoPublicado, error: st.error, consultadoEm: st.consultadoEm, atualizar };
}

/**
 * Apuração no turno pedido; no 2º turno, cai para o 1º quando o cargo não tem 2º turno
 * (Senado, deputados) ou quando o TSE não publicou 2º turno para aquela disputa.
 */
export function useApuracaoDoTurno(turno: Turno, cargo: CargoApuracao, uf: string | null) {
  const pede2 = turno === 2 && temSegundoTurno(cargo);
  const t2 = useApuracao(2, cargo, pede2 ? uf : null);
  const precisa1 = !pede2 || (!t2.loading && t2.naoPublicado);
  const t1 = useApuracao(1, cargo, precisa1 ? uf : null);
  const usado = pede2 && !precisa1 ? t2 : t1;
  return {
    ...usado,
    loading: pede2 ? t2.loading || (precisa1 && t1.loading) : t1.loading,
    turnoExibido: (pede2 && !precisa1 ? 2 : 1) as Turno,
    /** Mostrando o 1º turno porque não há (ou ainda não há) 2º turno publicado. */
    caiuPara1: turno === 2 && !(pede2 && !precisa1),
  };
}

// ── Estado do eleitor (fica só no aparelho) ──────────────────────────────────

export type OrigemUf = 'gps' | 'manual' | 'cola';
export type StatusLocal = 'ocioso' | 'buscando' | 'negado' | 'indisponivel' | 'fora';

/**
 * UF de quem visita: a escolhida antes, a da "cola", ou a detectada pela localização
 * do aparelho (com permissão do navegador). A posição é convertida em UF no próprio
 * aparelho e descartada; só a sigla fica salva.
 */
export function useUfUsuario({ detectarSozinho }: { detectarSozinho: boolean }) {
  const [salvo, setSalvo] = useLocalState<{ uf: string; origem: OrigemUf } | null>('vi:uf', null);
  const [jaPediu, setJaPediu] = useLocalState<boolean>('vi:uf-pediu', false);
  const { cola } = useCola();
  const [status, setStatus] = useState<StatusLocal>('ocioso');

  const atual: { uf: string; origem: OrigemUf } | null = salvo ?? (cola.uf ? { uf: cola.uf, origem: 'cola' } : null);

  const detectar = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('indisponivel');
      return;
    }
    setStatus('buscando');
    setJaPediu(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uf = ufDoPonto(pos.coords.latitude, pos.coords.longitude);
        if (uf) {
          setSalvo({ uf, origem: 'gps' });
          setStatus('ocioso');
        } else setStatus('fora');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'negado' : 'indisponivel'),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
    );
  }, [setSalvo, setJaPediu]);

  // Primeira visita à apuração sem estado conhecido: pergunta uma vez ao navegador.
  // Se a permissão já foi negada antes, não insiste.
  useEffect(() => {
    if (!detectarSozinho || atual || jaPediu) return;
    let cancel = false;
    // No app, quem pergunta é o próprio Android (o WebView não informa o estado da permissão).
    const perm: Promise<PermissionStatus | null> = isNativeApp
      ? Promise.resolve(null)
      : (navigator.permissions?.query?.({ name: 'geolocation' as PermissionName }) ?? Promise.resolve(null));
    perm.then(
      (p) => {
        if (cancel) return;
        if (p?.state === 'denied') setStatus('negado');
        else detectar();
      },
      () => !cancel && detectar(),
    );
    return () => void (cancel = true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectarSozinho]);

  const escolher = useCallback((uf: string) => setSalvo({ uf, origem: 'manual' }), [setSalvo]);

  return { uf: atual?.uf ?? null, origem: atual?.origem ?? null, status, detectar, escolher };
}

/** Candidaturas que a pessoa quer acompanhar na apuração (só no aparelho). */
export interface Acompanhado {
  sq: string;
  cargo: CargoApuracao;
  /** UF da disputa; "BR" para Presidente. */
  uf: string;
  nome: string;
  numero: string;
  partido: string;
}

export const MAX_ACOMPANHAR = 6;

export function useAcompanhar() {
  const [lista, setLista] = useLocalState<Acompanhado[]>('vi:acompanhar', []);
  const adicionar = useCallback(
    (a: Acompanhado) => setLista((prev) => [a, ...prev.filter((x) => x.sq !== a.sq)].slice(0, MAX_ACOMPANHAR)),
    [setLista],
  );
  const remover = useCallback((sq: string) => setLista((prev) => prev.filter((x) => x.sq !== sq)), [setLista]);
  return { lista, adicionar, remover, tem: (sq: string) => lista.some((x) => x.sq === sq) };
}

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const;

/**
 * Apuração do cargo em todas as 27 UFs (para o mapa), reconsultada a cada minuto.
 * Deputados estaduais e distritais aparecem juntos: o DF usa o distrital.
 * No 2º turno, UF sem disputa fica `null`.
 */
export function useMapaApuracao(turno: Turno, cargo: CargoApuracao, ligado: boolean) {
  const [porUf, setPorUf] = useState<{ chave: string; dados: Record<string, Apuracao | null> }>({ chave: '', dados: {} });
  const chave = `${turno}|${cargo}`;
  if (porUf.chave !== chave && Object.keys(porUf.dados).length) setPorUf({ chave, dados: {} });

  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    const cargoDa = (uf: string): CargoApuracao => (cargo === 'deputado-estadual' || cargo === 'deputado-distrital' ? (uf === 'DF' ? 'deputado-distrital' : 'deputado-estadual') : cargo);
    let tudoFinal = false;
    const rodar = () =>
      Promise.all(UFS.map((uf) => consultar(turno, cargoDa(uf), uf).then((a) => [uf, a] as const, () => [uf, undefined] as const))).then((pares) => {
        if (!vivo) return;
        // Todas as UFs com totalização final: não há mais o que consultar.
        tudoFinal = pares.every(([, a]) => a?.final);
        setPorUf((prev) => {
          const base = prev.chave === chave ? prev.dados : {};
          const dados = { ...base };
          // erro de rede numa UF: mantém o último dado bom dela
          for (const [uf, a] of pares) if (a !== undefined) dados[uf] = a;
          return { chave, dados };
        });
      });
    rodar();
    const t = setInterval(() => !tudoFinal && document.visibilityState === 'visible' && rodar(), INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [turno, cargo, chave, ligado]);

  return porUf.chave === chave ? porUf.dados : {};
}

// ── Finalistas do 2º turno ────────────────────────────────────────────────────

export interface DisputaFinal {
  /** "BR" (Presidente) ou a UF (Governador). */
  uf: string;
  cargo: 'presidente' | 'governador';
  /** SQs em ordem alfabética do nome na urna. */
  sqs: string[];
  /** Votos do 1º turno, quando vieram da apuração ao vivo. */
  votos1: Record<string, Pick<CandidatoApurado, 'votos' | 'pct' | 'posicao'>>;
  /** 'tse' = lido agora do TSE; 'site' = do arquivo publicado pelo site (segundo-turno.json). */
  origem: 'tse' | 'site';
}

/**
 * Disputas de 2º turno com os finalistas confirmados pelo TSE (situação "2º turno" no
 * arquivo do 1º turno), lidas ao vivo, mais as que o site já publicou. Presidente primeiro,
 * depois as UFs em ordem alfabética. Antes das 17h de 4/10 não consulta nada.
 */
export function useFinalistas(ligado = true) {
  // Momento da montagem (estável entre renderizações).
  const [divulgando] = useState(() => Date.now() >= inicioDivulgacao(1).getTime());
  const ativo = ligado && divulgando;
  const pres = useApuracao(1, 'presidente', ativo ? 'BR' : null);
  const gov = useMapaApuracao(1, 'governador', ativo);
  const publicado = useAsync(() => (ligado ? api.segundoTurno().catch(() => null) : Promise.resolve(null)), [ligado]);

  const disputas: DisputaFinal[] = [];
  const add = (uf: string, cargo: DisputaFinal['cargo'], ap: Apuracao | null | undefined) => {
    const f = finalistasDe(ap);
    if (f.length >= 2) disputas.push({ uf, cargo, sqs: f.map((c) => c.sq), votos1: Object.fromEntries(f.map((c) => [c.sq, { votos: c.votos, pct: c.pct, posicao: c.posicao }])), origem: 'tse' });
  };
  add('BR', 'presidente', pres.data);
  for (const uf of UFS) add(uf, 'governador', gov[uf]);
  // O que o site já publicou e o TSE (ainda) não mostrou ao vivo, p.ex. se o TSE estiver fora do ar.
  for (const d of publicado.data?.disputas ?? []) {
    if ((d.cargo === 'presidente' || d.cargo === 'governador') && !disputas.some((x) => x.uf === d.uf && x.cargo === d.cargo)) {
      const cands = [...d.candidatos].sort((a, b) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR'));
      disputas.push({ uf: d.uf, cargo: d.cargo, sqs: cands.map((c) => c.sq), votos1: {}, origem: 'site' });
    }
  }
  disputas.sort((a, b) => Number(a.cargo !== 'presidente') - Number(b.cargo !== 'presidente') || a.uf.localeCompare(b.uf));

  return {
    disputas,
    presidente: disputas.find((d) => d.cargo === 'presidente') ?? null,
    governador: (uf: string | null | undefined) => (uf ? (disputas.find((d) => d.cargo === 'governador' && d.uf === uf) ?? null) : null),
    carregando: (ativo && pres.loading) || publicado.loading,
  };
}

