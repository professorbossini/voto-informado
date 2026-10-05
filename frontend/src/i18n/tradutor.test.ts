import { aplicarIdioma, traduzir } from './tradutor';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('tradutor da interface', () => {
  afterEach(async () => {
    await aplicarIdioma('pt-BR');
    document.body.innerHTML = '';
  });

  it('traduz textos exatos e com partes variáveis, preservando os espaços das bordas', async () => {
    await aplicarIdioma('en', { 'Resultados': 'Results', '{0} cadeiras': '{0} seats', 'Adicionar {0} à comparação': 'Add {0} to the comparison' });
    expect(traduzir('Resultados')).toBe('Results');
    expect(traduzir('  Resultados ')).toBe('  Results ');
    expect(traduzir('94 cadeiras')).toBe('94 seats');
    expect(traduzir('Adicionar Lula à comparação')).toBe('Add Lula to the comparison');
    expect(traduzir('LUIZ INÁCIO')).toBeNull(); // dado oficial: fica como publicado
  });

  it('troca o DOM, acompanha mudanças e volta ao português', async () => {
    document.body.innerHTML = '<main><h1>Resultados</h1><button aria-label="Resultados">x</button><p translate="no">Resultados</p></main>';
    await aplicarIdioma('en', { 'Resultados': 'Results', 'Partidos': 'Parties' });
    expect(document.querySelector('h1')!.textContent).toBe('Results');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Results');
    expect(document.querySelector('p')!.textContent).toBe('Resultados'); // translate="no"
    // o React escreve texto novo (em português) → traduzido de novo
    document.querySelector('h1')!.firstChild!.nodeValue = 'Partidos';
    await tick();
    expect(document.querySelector('h1')!.textContent).toBe('Parties');
    // nó novo
    const s = document.createElement('span');
    s.textContent = 'Resultados';
    document.querySelector('main')!.appendChild(s);
    await tick();
    expect(s.textContent).toBe('Results');
    await aplicarIdioma('pt-BR');
    expect(document.querySelector('h1')!.textContent).toBe('Partidos');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Resultados');
    expect(s.textContent).toBe('Resultados');
  });
});

describe('padrões curtos', () => {
  afterEach(async () => {
    await aplicarIdioma('pt-BR');
  });
  it('"{0}º turno" não engole uma frase que só termina igual', async () => {
    await aplicarIdioma('en', { '{0}º turno': 'Round {0}', '{0} cadeiras': '{0} seats' });
    expect(traduzir('2º turno')).toBe('Round 2');
    expect(traduzir('Os 2 finalistas à Presidência no 2º turno')).toBeNull();
    expect(traduzir('513 cadeiras')).toBe('513 seats');
  });
});
