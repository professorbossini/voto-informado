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

// ── Período eleitoral (opções que só fazem sentido durante a eleição) ─────────

/** Campanha começa em 16/08 (≈ 50 dias antes do 1º turno); a eleição "acaba" 2 dias após o último turno. */
const DIAS_ANTES = 50;
const DIAS_DEPOIS = 2;

function datasDe(turnos: { turno: Turno; data: string }[]) {
  const d1 = turnos.find((t) => t.turno === 1)?.data ?? TURNOS[0].data;
  const d2 = turnos.find((t) => t.turno === 2)?.data ?? d1;
  return { d1, d2 };
}

/**
 * Durante a eleição (da campanha até 2 dias depois do último turno)? Simulador de urna e cola
 * só aparecem nesse período; somem depois e voltam sozinhos quando o site recebe a próxima
 * eleição (as datas vêm do meta.json; sem ele, do calendário de 2026).
 */
export function emPeriodoEleitoral(agora: Date = new Date(), turnos = TURNOS): boolean {
  const { d1, d2 } = datasDe(turnos);
  const ini = new Date(`${d1}T00:00:00-03:00`).getTime() - DIAS_ANTES * 86_400_000;
  const fim = new Date(`${d2}T23:59:59-03:00`).getTime() + DIAS_DEPOIS * 86_400_000;
  return agora.getTime() >= ini && agora.getTime() <= fim;
}

/** Página do 2º turno: da divulgação do 1º turno até o fim do período eleitoral. */
export function emPeriodoSegundoTurno(agora: Date = new Date(), turnos = TURNOS): boolean {
  const { d1 } = datasDe(turnos);
  return agora.getTime() >= new Date(`${d1}T${String(HORA_DIVULGACAO).padStart(2, '0')}:00:00-03:00`).getTime() && emPeriodoEleitoral(agora, turnos);
}
