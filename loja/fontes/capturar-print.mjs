// Captura um print do app (build --mode app) como num celular de 360×720 a 3x (1080×2160).
// Pré-requisitos: cd frontend && npm run app:build && npx vite preview --mode app --outDir dist-app --port 4180
// e o Chrome aberto com --headless=new --remote-debugging-port=9334. Os prints em loja/fontes/prints vieram daqui.
const [, , rota, out, modo = 'light', scrollY = '0', prep = '', H = '720', DPR = '3'] = process.argv;
const base = 'http://localhost:4180';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: Number(H), deviceScaleFactor: Number(DPR), mobile: true });
await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0 Mobile Safari/537.36' });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: modo }] });
await send('Page.enable');
await send('Page.navigate', { url: base + '/sobre' });
await sleep(1500);
await ev(`localStorage.setItem('mui-mode', '${modo}'); ${prep}; 1`);
await send('Page.navigate', { url: base + rota });
// espera rede ociosa e imagens
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const r = await ev(`document.querySelectorAll('.MuiSkeleton-root').length === 0 && [...document.images].every(i => i.complete) && document.readyState === 'complete'`);
  if (r.result.value && i > 3) break;
}
await ev(`(${/^[0-9]+$/.test(scrollY) ? 'window.scrollTo(0,' + scrollY + ')' : scrollY}); 1`);
await sleep(1200);
const { data } = await send('Page.captureScreenshot', { format: 'png' });
(await import('node:fs')).writeFileSync(out, Buffer.from(data, 'base64'));
await fetch(`http://localhost:9334/json/close/${tab.id}`);
console.log('ok', out);
process.exit(0);
