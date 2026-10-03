"""Gera loja/kit-google-play.html a partir de textos-loja.json.

Uso: python3 loja/fontes/gerar-kit.py
Edite os textos no JSON (a fonte da verdade) e rode de novo.
"""
import html
import json
from pathlib import Path

AQUI = Path(__file__).parent
d = json.loads((AQUI / "textos-loja.json").read_text(encoding="utf-8"))

LIMITES = {"titulo": 30, "descricao_curta": 80, "descricao_completa": 4000, "novidades": 500}
for chave, limite in LIMITES.items():
    assert len(d[chave]) <= limite, f"{chave}: {len(d[chave])} caracteres (limite {limite})"


def campo(rotulo, valor, limite=None, dica=""):
    cont = f'<span class="cont">{len(valor)}/{limite}</span>' if limite else ""
    if "\n" in valor or len(valor) > 90:
        el = f'<textarea readonly rows="{min(42, valor.count(chr(10)) + 3)}">{html.escape(valor)}</textarea>'
    else:
        el = f'<input readonly value="{html.escape(valor, quote=True)}">'
    dica = f'<p class="dica">{dica}</p>' if dica else ""
    return f'<div class="campo"><div class="rot"><label>{rotulo}</label>{cont}<button class="copiar">Copiar</button></div>{el}{dica}</div>'


def tabela(linhas):
    corpo = ""
    for pergunta, resposta, nota in linhas:
        nota = f'<br><span class="dica">{nota}</span>' if nota else ""
        corpo += f"<tr><td>{pergunta}</td><td><strong>{resposta}</strong>{nota}</td></tr>"
    return f"<table><thead><tr><th>Pergunta no Play Console</th><th>Resposta</th></tr></thead><tbody>{corpo}</tbody></table>"


PRINTS = ["01-lista", "02-mapa", "03-cola", "04-simulador", "05-numeros", "06-gastos", "07-sobre"]
galeria = "".join(f'<figure><img src="play/prints/{n}.png" alt=""><figcaption>{n}.png</figcaption></figure>' for n in PRINTS)

conteudo = tabela([
    ("Política de Privacidade (URL)", d["privacidade_url"], "Precisa estar no ar antes do envio: rode <code>make publicar</code> (passo 1 do guia)."),
    ("Acesso ao app", "Todas as funcionalidades estão disponíveis sem acesso especial", "Não há login."),
    ("Anúncios: o app contém anúncios?", "Não", ""),
    ("Classificação do conteúdo: categoria", "Referência, notícias ou educação", ""),
    ("Classificação: violência, sexo, linguagem imprópria, drogas, jogos de azar, terror", "Não, para todas", ""),
    ("Classificação: usuários interagem ou trocam conteúdo entre si?", "Não", "O app só exibe dados públicos; “Compartilhar” usa a tela do próprio sistema."),
    ("Classificação: compartilha a localização do usuário?", "Não", ""),
    ("Classificação: permite comprar produtos digitais?", "Não", ""),
    ("Classificação: é um navegador ou mecanismo de pesquisa?", "Não", "Links externos abrem no navegador do sistema."),
    ("Resultado esperado", "Livre (ClassInd L) · PEGI 3 · Everyone", ""),
    ("Público-alvo: faixas etárias", "16 a 17 anos e 18 anos ou mais", "Voto facultativo a partir dos 16. Não marque faixas abaixo de 13 (isso aciona o programa Famílias)."),
    ("O app pode atrair crianças sem querer?", "Não", ""),
    ("App de notícias?", "Não", "Ele exibe dados oficiais estruturados, não publica notícias."),
    ("ID de publicidade: o app usa?", "Não", "Conferido no manifesto final: a única permissão é INTERNET."),
    ("Apps governamentais: desenvolvido por um governo ou em nome dele?", "Não", "O aviso de “não oficial” já está na descrição e no rodapé do app, como pede a política de Declarações enganosas."),
    ("Recursos financeiros, saúde, VPN", "Nenhum / não se aplica", ""),
])

seguranca = tabela([
    ("O app coleta ou compartilha algum dos tipos de dados do usuário exigidos?", "Não",
     "Gera o selo “Nenhum dado coletado”. O que o app guarda (cola, comparação, tema) fica só no aparelho e nunca é enviado; pela definição do Google, isso não é coleta."),
    ("Todos os dados são criptografados em trânsito?", "(só aparece se a resposta acima for Sim)", "Se aparecer: Sim, toda a comunicação é HTTPS."),
    ("O app permite criar conta?", "Não", "Por isso não é preciso informar URL de exclusão de conta."),
])

dica_desc = "Inclui o aviso de app não oficial e os links das fontes oficiais, exigidos pela política do Google Play para apps com informações de governo."
dica_cat = "Tipo: App. Evite “Notícias e revistas”: essa categoria exige a declaração de app de notícias."
dica_email = "Fica público na loja. Se preferir outro e-mail, troque aqui e em frontend/src/config/legal.ts (Política de Privacidade)."

kit = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kit Google Play</title>
<style>
:root{{--bg:#fbfafe;--card:#fff;--tx:#1d1530;--mut:#5d5670;--pri:#5B2DB0;--on:#fff;--lin:#e4def2;--ok:#2f6b16;--chip:#efe9fb}}
@media (prefers-color-scheme:dark){{:root{{--bg:#140e26;--card:#1d1633;--tx:#efeaf9;--mut:#b4acc8;--pri:#c7b3f5;--on:#1d1633;--lin:#352b52;--ok:#b5e36a;--chip:#2a2148}}}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,sans-serif}}
main{{max-width:980px;margin:0 auto;padding:24px 16px 80px}}
h1{{font-size:30px;margin:8px 0 4px}} h2{{font-size:21px;margin:40px 0 12px;padding-top:16px;border-top:1px solid var(--lin)}}
a{{color:var(--pri)}} .sub{{color:var(--mut);margin:0 0 16px}}
nav{{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}} nav a{{background:var(--chip);padding:6px 12px;border-radius:99px;text-decoration:none;font-size:14px;font-weight:600}}
.campo{{background:var(--card);border:1px solid var(--lin);border-radius:14px;padding:12px 14px;margin:10px 0}}
.rot{{display:flex;align-items:center;gap:10px;margin-bottom:6px}} label{{font-weight:600;margin-right:auto}} .cont{{color:var(--mut);font-size:13px}}
input,textarea{{width:100%;border:1px solid var(--lin);border-radius:10px;padding:10px;background:var(--bg);color:var(--tx);font:15px/1.45 system-ui,sans-serif;resize:vertical}}
button.copiar{{border:0;background:var(--pri);color:var(--on);font-weight:600;border-radius:99px;padding:6px 14px;cursor:pointer}}
button.copiar.ok{{background:var(--ok)}}
.dica{{color:var(--mut);font-size:13.5px;margin:6px 0 0}}
.tab{{overflow-x:auto}} table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--lin);font-size:15px}}
th,td{{text-align:left;padding:10px 12px;border-bottom:1px solid var(--lin);vertical-align:top}} th{{background:var(--chip)}} td:first-child{{width:45%}}
.galeria{{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-top:12px}}
figure{{margin:0}} figure img{{width:100%;border-radius:10px;border:1px solid var(--lin)}} figcaption{{font-size:12px;color:var(--mut)}}
.imgs{{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}} .imgs img{{max-width:100%;height:auto;border-radius:12px;border:1px solid var(--lin)}}
code{{background:var(--chip);padding:1px 6px;border-radius:6px;font-size:14px;word-break:break-all}}
.aviso{{background:var(--chip);border-radius:14px;padding:12px 16px}}
</style></head><body><main>
<h1>Kit Google Play · Voto Informado</h1>
<p class="sub">Tudo o que o Play Console pede, pronto para copiar, na ordem do <a href="README.md">guia de publicação</a>. Textos em pt-BR com os limites de caracteres conferidos.</p>
<nav><a href="#arquivos">Arquivos</a><a href="#ficha">Ficha da loja</a><a href="#contato">Contato e links</a><a href="#conteudo">Conteúdo do app</a><a href="#seguranca">Segurança dos dados</a><a href="#versao">Versão</a></nav>

<h2 id="arquivos">1. Arquivos para enviar</h2>
<ul>
<li><strong>Pacote do app:</strong> <code>frontend/android/app/build/outputs/bundle/release/app-release.aab</code> (gerado por <code>make app-release</code>)</li>
<li><strong>Ícone 512×512:</strong> <code>loja/play/icone-512.png</code></li>
<li><strong>Imagem de destaque 1024×500:</strong> <code>loja/play/imagem-destaque-1024x500.png</code></li>
<li><strong>Capturas de tela do telefone:</strong> <code>loja/play/prints/</code> (envie na ordem dos números). Versões sem moldura em <code>loja/play/prints-sem-moldura/</code></li>
</ul>
<div class="imgs"><img src="play/icone-512.png" width="128" alt="Ícone"><img src="play/imagem-destaque-1024x500.png" width="512" alt="Imagem de destaque"></div>
<div class="galeria">{galeria}</div>
<p class="dica">Os prints não destacam nenhuma candidatura: a única tela com pessoas é a lista completa em ordem alfabética, a mesma regra do app.</p>

<h2 id="ficha">2. Ficha principal da loja</h2>
{campo("Nome do app", d["titulo"], 30)}
{campo("Descrição curta", d["descricao_curta"], 80)}
{campo("Descrição completa", d["descricao_completa"], 4000, dica_desc)}
{campo("Categoria", "Educação", None, dica_cat)}

<h2 id="contato">3. Detalhes de contato e links</h2>
{campo("E-mail", d["email"], None, dica_email)}
{campo("Site", d["site"])}
{campo("Política de Privacidade (URL)", d["privacidade_url"])}
{campo("Termos de Uso (URL, para referência)", d["termos_url"])}

<h2 id="conteudo">4. Conteúdo do app (menu Política → Conteúdo do app)</h2>
<div class="tab">{conteudo}</div>

<h2 id="seguranca">5. Segurança dos dados</h2>
<div class="tab">{seguranca}</div>

<h2 id="versao">6. Versão de produção</h2>
{campo("Nome da versão", "1.0.0 (1)")}
{campo("Notas da versão (pt-BR)", d["novidades"], 500)}
{campo("Países e regiões", "Brasil")}
<p class="aviso"><strong>Dica:</strong> ative a <em>Publicação gerenciada</em> (Visão geral da publicação). Mesmo aprovado, o app só entra no ar quando você clicar em “Publicar”. Assim ele não estreia em 4/10, dia da votação.</p>
</main>
<script>
document.querySelectorAll('button.copiar').forEach((b) => b.addEventListener('click', async () => {{
  const el = b.closest('.campo').querySelector('input,textarea');
  try {{ await navigator.clipboard.writeText(el.value); }} catch {{ el.select(); document.execCommand('copy'); }}
  b.textContent = 'Copiado'; b.classList.add('ok');
  setTimeout(() => {{ b.textContent = 'Copiar'; b.classList.remove('ok'); }}, 1500);
}}));
</script></body></html>
"""
(AQUI.parent / "kit-google-play.html").write_text(kit, encoding="utf-8")
print("✓ loja/kit-google-play.html")
