import type { Turno } from './apuracao';

/**
 * Calendário oficial das Eleições 2026 (Res. TSE 23.738/2024), em horário de Brasília
 * (UTC−3, sem horário de verão). Votação das 8h às 17h em todo o país; o TSE só
 * divulga resultados depois das 17h, quando fecham as últimas seções.
 */
export const TURNOS: { turno: Turno; data: string }[] = [
  { turno: 1, data: '2026-10-04' },
  { turno: 2, data: '2026-10-25' },
];

const HORA_ABERTURA = 8;
const HORA_DIVULGACAO = 17;
/** A noite da apuração vai até a madrugada seguinte: a contagem costuma terminar depois da meia-noite. */
const HORAS_NOITE_APURACAO = 13;

function brasilia(data: string, hora: number): Date {
  return new Date(`${data}T${String(hora).padStart(2, '0')}:00:00-03:00`);
}

export function aberturaUrnas(turno: Turno): Date {
  return brasilia(TURNOS[turno - 1].data, HORA_ABERTURA);
}

/** Momento em que o TSE começa a divulgar os resultados do turno. */
export function inicioDivulgacao(turno: Turno): Date {
  return brasilia(TURNOS[turno - 1].data, HORA_DIVULGACAO);
}

/**
 * Turno cuja apuração está sendo divulgada agora (dia da votação, a partir das 17h de
 * Brasília, até a madrugada seguinte), ou `null` nos demais momentos.
 */
export function noiteDeApuracao(agora: Date = new Date()): Turno | null {
  for (const { turno } of TURNOS) {
    const ini = inicioDivulgacao(turno).getTime();
    const t = agora.getTime();
    if (t >= ini && t < ini + HORAS_NOITE_APURACAO * 3_600_000) return turno;
  }
  return null;
}

/** Último turno cuja divulgação já começou (para abrir a apuração no turno certo), ou `null`. */
export function turnoMaisRecente(agora: Date = new Date()): Turno | null {
  let atual: Turno | null = null;
  for (const { turno } of TURNOS) if (agora.getTime() >= inicioDivulgacao(turno).getTime()) atual = turno;
  return atual;
}

/** Próxima abertura de urnas ainda por vir (contagem regressiva), ou `null` depois do 2º turno. */
export function proximaVotacao(agora: Date = new Date()): { turno: Turno; abertura: Date; data: string } | null {
  for (const { turno, data } of TURNOS) {
    // Até o fim da votação daquele dia, a "próxima" ainda é ela.
    if (agora.getTime() < inicioDivulgacao(turno).getTime()) return { turno, abertura: aberturaUrnas(turno), data };
  }
  return null;
}

/** "Hoje (Brasília) é dia de votação" — mesmo antes das 17h. */
export function diaDeVotacao(agora: Date = new Date()): Turno | null {
  const hoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return TURNOS.find((t) => t.data === hoje)?.turno ?? null;
}
