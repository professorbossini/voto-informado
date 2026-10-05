import { useState } from 'react';
import { useMeta } from './MetaContext';
import { emPeriodoEleitoral, emPeriodoSegundoTurno, TURNOS } from './calendario';

/** Período eleitoral pelas datas da eleição carregada pelo site (meta.json). */
export function usePeriodoEleitoral() {
  const { meta } = useMeta();
  const [agora] = useState(() => new Date());
  const turnos = meta?.eleicao ? [{ turno: 1 as const, data: meta.eleicao.data_1turno }, { turno: 2 as const, data: meta.eleicao.data_2turno }] : TURNOS;
  return { eleicao: emPeriodoEleitoral(agora, turnos), segundoTurno: emPeriodoSegundoTurno(agora, turnos) };
}
