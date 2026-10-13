import { useState } from 'react';
import { Button, type ButtonProps } from '@mui/material';
import ImageRounded from '@mui/icons-material/ImageRounded';
import { useCartaoDaPagina, type MontarCartao } from './cartaoPagina';
import { DialogoCompartilhar } from './DialogoCompartilhar';

/**
 * Botão "Compartilhar imagem": abre o diálogo de compartilhar com o cartão desta candidatura,
 * parlamentar ou comparação. Com `daPagina`, o mesmo cartão vale para o botão "compartilhar" do
 * topo enquanto a página estiver aberta. `montar` só roda quando a pessoa abre a prévia.
 */
export function BotaoCompartilharImagem({
  montar,
  texto,
  rotulo = 'Compartilhar imagem',
  daPagina = false,
  ...botao
}: {
  montar: MontarCartao;
  /** Texto enviado junto com a imagem; o padrão cita os nomes e o assunto do cartão. */
  texto?: string;
  rotulo?: string;
  /** Usar este cartão também no botão "compartilhar" do topo da página. */
  daPagina?: boolean;
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  const [aberto, setAberto] = useState(false);
  useCartaoDaPagina(montar, texto, daPagina);
  return (
    <>
      <Button variant="outlined" startIcon={<ImageRounded />} {...botao} onClick={() => setAberto(true)}>
        {rotulo}
      </Button>
      <DialogoCompartilhar aberto={aberto} fechar={() => setAberto(false)} montar={montar} texto={texto} />
    </>
  );
}
