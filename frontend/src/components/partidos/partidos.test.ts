import type { ExecutivoEleito, Plenario } from '@/data/types';
import { montarPartidos, slugPartido } from './partidos';

const membro = (id: string, nome: string, partido: string, uf = 'SP') => ({ id, nome, partido, uf, foto: null, perfil: true });
const exec = (cargo: ExecutivoEleito['cargo'], uf: string, nome: string, partido: string, deixou = false): ExecutivoEleito => ({
  cargo, uf, nome_urna: nome, partido, partido_2022: partido, partido_2026: null, partido_origem: 'eleição de 2022',
  sq_2022: `${uf}-${nome}`, sq_2026: null, candidatura_2026: deixou ? 'senador' : null, foto: null, deixou_cargo: deixou,
});

describe('partidos', () => {
  it('gera endereços estáveis e sem acento', () => {
    expect(slugPartido('UNIÃO')).toBe('uniao');
    expect(slugPartido('PCdoB')).toBe('pcdob');
    expect(slugPartido('MISSÃO')).toBe('missao');
    expect(slugPartido('S/Partido')).toBe('sem-partido');
  });

  it('agrupa Câmara, Senado e Executivo por partido, em ordem alfabética, separando quem deixou o cargo', () => {
    const pl: Plenario = {
      camara: { legislatura: 57, coletado_em: null, membros: [membro('c2', 'Zé', 'PT'), membro('c1', 'Ana', 'PT'), membro('c3', 'Bia', 'PL')], presidente: { ...membro('c3', 'Bia', 'PL'), desde: '2025-02-01' } },
      senado: { legislatura: 57, coletado_em: null, membros: [membro('s1', 'Caio', 'MDB', 'RJ')], presidente: null },
      partidos: { PT: { nome: 'PARTIDO DOS TRABALHADORES', logo: 'plenario/logos/pt.svg' } },
    };
    const ps = montarPartidos(pl, [exec('presidente', 'BR', 'LULA', 'PT'), exec('governador', 'AC', 'FULANO', 'PP', true)]);
    expect(ps.map((p) => p.sigla)).toEqual(['MDB', 'PL', 'PP', 'PT']);
    const pt = ps.find((p) => p.sigla === 'PT')!;
    expect(pt.deputados.map((m) => m.nome)).toEqual(['Ana', 'Zé']);
    expect(pt.executivo.map((e) => e.cargo)).toEqual(['presidente']);
    expect(pt.logo).toBe('plenario/logos/pt.svg');
    expect(pt.total).toBe(3);
    expect(ps.find((p) => p.sigla === 'PL')!.presideCamara?.nome).toBe('Bia');
    const pp = ps.find((p) => p.sigla === 'PP')!;
    expect(pp.executivo).toEqual([]);
    expect(pp.deixaram.map((e) => e.nome_urna)).toEqual(['FULANO']);
  });
});
