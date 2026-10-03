// Gera as artes da loja a partir dos prints em ./prints (1080×2160, tirados do build do app).
// Uso: Chrome com --remote-debugging-port=9334 aberto, depois `node loja/fontes/gerar-artes.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, '..', 'play');

const PRINTS = [
  ['01-lista', 'Todas as candidaturas, com os mesmos campos', 'Ordem alfabética, sem destaque para ninguém'],
  ['02-mapa', 'Escolha seu estado no mapa', 'Presidência, governo, Senado e deputados'],
  ['03-cola', 'Monte sua cola na ordem da urna', 'Fica só no seu celular. Imprima ou salve em PDF'],
  ['04-simulador', 'Treine o voto antes de 4 de outubro', 'Simulador educativo com os números reais'],
  ['05-numeros', 'A eleição em números', 'Gênero, idade, instrução e bens, direto do TSE'],
  ['06-gastos', 'Gastos de mandato', 'Cota parlamentar de deputados e senadores'],
  ['07-sobre', 'Neutro e com fonte oficial', 'Sem opinião, sem anúncios, sem recomendação de voto'],
];

const fonte = `@font-face{font-family:GSF;src:url(data:font/woff2;base64,${readFileSync(join(AQUI, 'google-sans-flex.woff2')).toString('base64')}) format('woff2');font-weight:100 1000;}`;
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const fundo = 'radial-gradient(120% 80% at 20% 0%, #7446CC 0%, #5B2DB0 45%, #2A1263 100%)';

const tela = (titulo, sub, print) => `<!doctype html><html><head><meta charset="utf-8"><style>${fonte}
*{margin:0;box-sizing:border-box} body{width:1080px;height:1920px;overflow:hidden;background:${fundo};font-family:GSF,sans-serif;color:#fff;position:relative}
.h{position:absolute;left:84px;right:84px;top:104px;height:340px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.t{font-size:76px;line-height:1.08;font-weight:700;letter-spacing:-1.5px;font-variation-settings:'ROND' 100}
.s{font-size:40px;line-height:1.25;color:#D9F57A;font-weight:500}
.f{position:absolute;left:50%;transform:translateX(-50%);top:480px;width:820px;height:1640px;border-radius:64px;background:#120B22;padding:22px;box-shadow:0 40px 90px rgba(10,0,40,.55),0 0 0 2px rgba(255,255,255,.08) inset}
.f img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:44px;display:block}
.b{position:absolute;bottom:0;left:0;right:0;height:120px;background:linear-gradient(transparent,rgba(26,8,64,.35))}
</style></head><body><div class="h"><div class="t">${titulo}</div><div class="s">${sub}</div></div><div class="f"><img src="${print}"></div><div class="b"></div></body></html>`;

const destaque = (print) => `<!doctype html><html><head><meta charset="utf-8"><style>${fonte}
*{margin:0;box-sizing:border-box} body{width:1024px;height:500px;overflow:hidden;background:${fundo};font-family:GSF,sans-serif;color:#fff;position:relative}
.i{position:absolute;left:64px;top:92px;width:104px;height:104px;border-radius:26px;box-shadow:0 12px 30px rgba(10,0,40,.4)}
.n{position:absolute;left:64px;top:222px;font-size:62px;font-weight:700;letter-spacing:-1.2px;font-variation-settings:'ROND' 100}
.d{position:absolute;left:64px;top:308px;width:520px;font-size:27px;line-height:1.3;color:#E9E2FA}
.d b{color:#D9F57A;font-weight:600}
.f{position:absolute;right:70px;top:46px;width:300px;height:600px;border-radius:36px;background:#120B22;padding:10px;transform:rotate(-6deg);box-shadow:0 30px 60px rgba(10,0,40,.55)}
.f img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:27px}
</style></head><body><img class="i" src="${img(join(AQUI, 'icone-1024.png'))}"><div class="n">Voto Informado</div>
<div class="d"><b>Eleições 2026</b> com dados oficiais do TSE, da Câmara e do Senado. Sem opinião e sem recomendação de voto.</div>
<div class="f"><img src="${print}"></div></body></html>`;

async function capturar(html, w, h, arquivo) {
  const tab = await (await fetch('http://localhost:9334/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const my = ++id;
    const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', on); resolve(m.result); } };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const { frameId } = await send('Page.getFrameTree').then((r) => r.frameTree.frame).then((f) => ({ frameId: f.id }));
  await send('Page.setDocumentContent', { frameId, html });
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)))', awaitPromise: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  writeFileSync(arquivo, Buffer.from(data, 'base64'));
  ws.close();
  await fetch(`http://localhost:9334/json/close/${tab.id}`);
  console.log('✓', arquivo);
}

for (const [nome, titulo, sub] of PRINTS) {
  await capturar(tela(titulo, sub, img(join(AQUI, 'prints', `${nome}.png`))), 1080, 1920, join(SAIDA, 'prints', `${nome}.png`));
}
await capturar(destaque(img(join(AQUI, 'prints', '02-mapa.png'))), 1024, 500, join(SAIDA, 'imagem-destaque-1024x500.png'));
process.exit(0);
