import qrcode from 'qrcode-generator';

/**
 * QR code do endereço da página, para quem vê o cartão numa tela (TV, outro celular, impresso)
 * abrir a página oficial com a câmera. Gerado no aparelho (biblioteca qrcode-generator, sem rede).
 */

/** Matriz do QR (true = módulo escuro). Correção "M": aguenta ~15% de dano e fica pouco denso. */
export function matrizQr(texto: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/**
 * Desenha o QR no quadrado (x, y, lado), já com a margem branca obrigatória (4 módulos) dentro do
 * lado. Módulos alinhados a pixels inteiros, para a leitura não falhar depois de comprimida.
 */
export function desenharQr(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, lado: number, cor = '#000000', fundo = '#FFFFFF') {
  const m = matrizQr(texto);
  const n = m.length;
  const total = n + 8;
  const cel = Math.max(1, Math.floor(lado / total));
  const usado = cel * total;
  const x0 = Math.round(x + (lado - usado) / 2);
  const y0 = Math.round(y + (lado - usado) / 2);
  ctx.fillStyle = fundo;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(lado), Math.round(lado));
  ctx.fillStyle = cor;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) ctx.fillRect(x0 + (c + 4) * cel, y0 + (r + 4) * cel, cel, cel);
}
