import { cifrar, decifrar, derivarChave, novoSal } from './cripto';

describe('criptografia das escolhas', () => {
  it('a frase certa abre, a errada não, e o texto cifrado não revela o conteúdo', async () => {
    const sal = novoSal();
    const chave = await derivarChave('minha frase secreta', sal);
    const dados = { valores: { 'vi:acompanhar': '[{"sq":"280002542548","nome":"LULA"}]' }, em: '2026-10-05T00:00:00Z' };
    const { cifra, iv } = await cifrar(chave, dados);
    expect(cifra).not.toContain('LULA');
    expect(atob(cifra)).not.toContain('LULA');
    expect(await decifrar(chave, cifra, iv)).toEqual(dados);
    const errada = await derivarChave('outra frase qualquer', sal);
    await expect(decifrar(errada, cifra, iv)).rejects.toBeTruthy();
    // mesma frase, outro sal → outra chave
    const outroSal = await derivarChave('minha frase secreta', novoSal());
    await expect(decifrar(outroSal, cifra, iv)).rejects.toBeTruthy();
  }, 30_000);
});
