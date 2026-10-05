import presidente from './__fixtures__/apuracao-presidente-br.json';
import depfed from './__fixtures__/apuracao-depfed-sp.json';
import presidenteBa from './__fixtures__/apuracao-presidente-ba.json';
import { cargoEstadual, desfechoDe, eleitosDe, finalistasDe, foiEleito, num, parseApuracao, temSegundoTurno, urlApuracao, vaiAo2Turno, type RawUnificado } from './apuracao';
import { diaDeVotacao, noiteDeApuracao, proximaVotacao, turnoMaisRecente } from './calendario';
import { ufDoPonto } from './localizacao';

const at = (iso: string) => new Date(iso);

describe('apuração do TSE', () => {
  it('monta o endereço oficial do arquivo unificado por turno, cargo e UF', () => {
    expect(urlApuracao(1, 'presidente', 'BR')).toBe('https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json');
    expect(urlApuracao(1, 'governador', 'SP')).toBe('https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json');
    expect(urlApuracao(1, 'deputado-distrital', 'df')).toBe('https://resultados.tse.jus.br/oficial/ele2026/6259/dados/df/df-c0008-e006259-u.json');
    expect(urlApuracao(2, 'presidente', 'BR')).toContain('/6258/dados/br/br-c0001-e006258-u.json');
    expect(urlApuracao(2, 'governador', 'MG')).toContain('/6260/dados/mg/mg-c0003-e006260-u.json');
  });

  it('lê números no formato brasileiro', () => {
    expect(num('50,74')).toBeCloseTo(50.74);
    expect(num('18644760')).toBe(18644760);
    expect(num('1.234,5')).toBeCloseTo(1234.5);
    expect(num('')).toBe(0);
  });

  it('normaliza o arquivo de Presidente na ordem oficial, com vices e totais', () => {
    const a = parseApuracao(presidente as unknown as RawUnificado, 'presidente', 'x');
    expect(a.uf).toBe('BR');
    expect(a.turno).toBe(1);
    expect(a.vagas).toBe(1);
    expect(a.secoes.pct).toBeGreaterThan(0);
    expect(a.candidatos.map((c) => c.posicao)).toEqual([...a.candidatos.map((c) => c.posicao)].sort((x, y) => x - y));
    const primeiro = a.candidatos[0];
    expect(primeiro.sq).toMatch(/^\d{12}$/);
    expect(primeiro.vices.length).toBe(1);
    expect(a.votos.validos).toBeGreaterThan(0);
    expect(a.bancadas).toEqual([]);
  });

  it('ordena pelos votos da UF, não pelo seq nacional do TSE', () => {
    const raw = presidenteBa as unknown as RawUnificado;
    const seqs = raw.carg[0].agr.flatMap((a) => a.par.flatMap((p) => p.cand ?? [])).map((c) => [c.nmu, Number(c.seq), num(c.vap)] as const);
    const a = parseApuracao(raw, 'presidente', 'x');
    expect(a.uf).toBe('BA');
    expect(a.candidatos.map((c) => c.votos)).toEqual([...a.candidatos.map((c) => c.votos)].sort((x, y) => y - x));
    expect(a.candidatos.map((c) => c.posicao)).toEqual(a.candidatos.map((_, i) => i + 1));
    // o arquivo real da BA tem o líder com seq ≠ 1 (é isso que o teste protege)
    const lider = seqs.reduce((m, x) => (x[2] > m[2] ? x : m));
    expect(lider[1]).not.toBe(1);
    expect(a.candidatos[0].nomeUrna).toBe(lider[0]);
  });

  it('usa o horário de Brasília (dg/hg), não o fuso local da UF (dt/ht)', () => {
    const raw = { ...(presidenteBa as unknown as RawUnificado), dg: '04/10/2026', hg: '18:49:44', dt: '04/10/2026', ht: '16:49:05' };
    expect(parseApuracao(raw, 'presidente', 'x').atualizado).toBe('04/10/2026 18:49:44');
  });

  it('reconhece os finalistas confirmados pelo TSE, em ordem alfabética', () => {
    expect(vaiAo2Turno('2º turno')).toBe(true);
    expect(vaiAo2Turno('2° Turno')).toBe(true);
    expect(vaiAo2Turno('Eleito')).toBe(false);
    expect(vaiAo2Turno('Não eleito')).toBe(false);
    expect(vaiAo2Turno(null)).toBe(false);
    const a = parseApuracao(presidenteBa as unknown as RawUnificado, 'presidente', 'x');
    expect(finalistasDe(a)).toEqual([]); // parcial: ninguém marcado ainda
    const [x, y] = a.candidatos;
    const conf = { ...a, candidatos: a.candidatos.map((c) => (c === x || c === y ? { ...c, situacao: '2º turno' } : c)) };
    const f = finalistasDe(conf);
    expect(f.map((c) => c.sq).sort()).toEqual([x.sq, y.sq].sort());
    expect(f.map((c) => c.nomeUrna)).toEqual([...f.map((c) => c.nomeUrna)].sort((p, q) => p.localeCompare(q, 'pt-BR')));
    expect(finalistasDe({ ...conf, turno: 2 })).toEqual([]);
  });

  it('reconhece quem o TSE já declarou eleito', () => {
    expect(foiEleito({ eleito: true, situacao: null })).toBe(true);
    expect(foiEleito({ eleito: false, situacao: 'Eleito' })).toBe(true);
    expect(foiEleito({ eleito: false, situacao: 'Eleito por QP' })).toBe(true);
    expect(foiEleito({ eleito: false, situacao: 'Eleita por média' })).toBe(true);
    expect(foiEleito({ eleito: false, situacao: 'Não eleito' })).toBe(false);
    expect(foiEleito({ eleito: false, situacao: 'Suplente' })).toBe(false);
    expect(foiEleito({ eleito: false, situacao: '2º turno' })).toBe(false);
    // O TSE publica e = s também para quem vai ao 2º turno (AC, DF, ES, TO em 04/10/2026).
    expect(foiEleito({ eleito: true, situacao: '2º turno' })).toBe(false);
    const a = parseApuracao(presidenteBa as unknown as RawUnificado, 'presidente', 'x');
    expect(eleitosDe(a)).toEqual([]);
    expect(eleitosDe({ ...a, candidatos: a.candidatos.map((c, i) => (i === 0 ? { ...c, eleito: true } : c)) }).map((c) => c.sq)).toEqual([a.candidatos[0].sq]);
  });

  it('traz vagas por partido/federação nos cargos proporcionais', () => {
    const a = parseApuracao(depfed as unknown as RawUnificado, 'deputado-federal', 'x');
    expect(a.vagas).toBe(70);
    expect(a.bancadas.length).toBeGreaterThan(0);
    expect(a.bancadas[0].vagas).toBeGreaterThanOrEqual(a.bancadas.at(-1)!.vagas);
  });

  it('sabe quais cargos podem ter 2º turno e qual é o cargo estadual do DF', () => {
    expect(temSegundoTurno('presidente')).toBe(true);
    expect(temSegundoTurno('governador')).toBe(true);
    expect(temSegundoTurno('senador')).toBe(false);
    expect(temSegundoTurno('deputado-federal')).toBe(false);
    expect(cargoEstadual('DF')).toBe('deputado-distrital');
    expect(cargoEstadual('sp')).toBe('deputado-estadual');
  });
});

describe('calendário da divulgação', () => {
  it('abre a apuração só a partir das 17h de Brasília no dia da votação', () => {
    expect(noiteDeApuracao(at('2026-10-04T16:59:00-03:00'))).toBeNull();
    expect(noiteDeApuracao(at('2026-10-04T17:00:00-03:00'))).toBe(1);
    expect(noiteDeApuracao(at('2026-10-04T23:30:00-03:00'))).toBe(1);
    // madrugada seguinte ainda é a noite da apuração; de manhã, não
    expect(noiteDeApuracao(at('2026-10-05T02:00:00-03:00'))).toBe(1);
    expect(noiteDeApuracao(at('2026-10-05T09:00:00-03:00'))).toBeNull();
    expect(noiteDeApuracao(at('2026-10-15T20:00:00-03:00'))).toBeNull();
    expect(noiteDeApuracao(at('2026-10-25T18:00:00-03:00'))).toBe(2);
    // independe do fuso do aparelho: 21h UTC = 18h em Brasília
    expect(noiteDeApuracao(at('2026-10-04T21:00:00Z'))).toBe(1);
  });

  it('sabe qual turno mostrar e qual a próxima votação', () => {
    expect(turnoMaisRecente(at('2026-10-01T12:00:00-03:00'))).toBeNull();
    expect(turnoMaisRecente(at('2026-10-10T12:00:00-03:00'))).toBe(1);
    expect(turnoMaisRecente(at('2026-10-26T12:00:00-03:00'))).toBe(2);
    expect(proximaVotacao(at('2026-10-04T10:00:00-03:00'))?.turno).toBe(1);
    expect(proximaVotacao(at('2026-10-04T18:00:00-03:00'))?.turno).toBe(2);
    expect(proximaVotacao(at('2026-10-26T12:00:00-03:00'))).toBeNull();
    expect(diaDeVotacao(at('2026-10-04T09:00:00-03:00'))).toBe(1);
    expect(diaDeVotacao(at('2026-10-05T01:00:00Z'))).toBe(1); // 22h do dia 4 em Brasília
    expect(diaDeVotacao(at('2026-10-06T12:00:00-03:00'))).toBeNull();
  });
});

describe('UF pela posição (malha do IBGE, no aparelho)', () => {
  it.each([
    [-23.5505, -46.6333, 'SP'], // São Paulo
    [-15.7939, -47.8828, 'DF'], // Brasília
    [-3.119, -60.0217, 'AM'], // Manaus
    [-22.9068, -43.1729, 'RJ'], // Rio de Janeiro (litoral)
    [-30.0346, -51.2177, 'RS'], // Porto Alegre
    [-8.0476, -34.877, 'PE'], // Recife (litoral)
    [-16.6869, -49.2648, 'GO'], // Goiânia
    [-9.9747, -67.81, 'AC'], // Rio Branco
    [-2.5307, -44.3068, 'MA'], // São Luís (ilha)
  ])('(%f, %f) → %s', (lat, lon, uf) => {
    expect(ufDoPonto(lat, lon)).toBe(uf);
  });

  it('fora do Brasil não chuta UF', () => {
    expect(ufDoPonto(38.7223, -9.1393)).toBeNull(); // Lisboa
    expect(ufDoPonto(-34.6037, -58.3816)).toBeNull(); // Buenos Aires
  });
});

describe('desfecho da candidatura (rótulos Eleito / 2º turno)', () => {
  it('nada definido: sem rótulo', () => {
    expect(desfechoDe([])).toBeNull();
    expect(desfechoDe([{ turno: 1, situacao: null, eleito: false }])).toBeNull();
    expect(desfechoDe([{ turno: 1, situacao: 'Suplente', eleito: 0 }])).toBeNull();
    expect(desfechoDe([{ turno: 1, situacao: 'Não eleito', eleito: 0 }])).toBeNull();
  });
  it('eleito no 1º turno (inclusive por QP/média)', () => {
    expect(desfechoDe([{ turno: 1, situacao: 'Eleito', eleito: true }])).toEqual({ tipo: 'eleito', turno: 1 });
    expect(desfechoDe([{ turno: 1, situacao: 'Eleito por QP', eleito: 0 }])).toEqual({ tipo: 'eleito', turno: 1 });
  });
  it('vai ao 2º turno, e depois eleito ou não no 2º turno', () => {
    const t1 = { turno: 1, situacao: '2º turno', eleito: true };
    expect(desfechoDe([t1])).toEqual({ tipo: 'segundo-turno', turno: 1, encerrado: false });
    expect(desfechoDe([t1, { turno: 2, situacao: null, eleito: false }])).toEqual({ tipo: 'segundo-turno', turno: 1, encerrado: false });
    expect(desfechoDe([t1, { turno: 2, situacao: 'Eleito', eleito: true }])).toEqual({ tipo: 'eleito', turno: 2 });
    expect(desfechoDe([t1, { turno: 2, situacao: 'Não eleito', eleito: false }])).toEqual({ tipo: 'segundo-turno', turno: 1, encerrado: true });
  });
});
