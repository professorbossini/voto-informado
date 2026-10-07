import { useState } from 'react';
import { Button, Snackbar, Tooltip } from '@mui/material';
import NotificationsActiveRounded from '@mui/icons-material/NotificationsActiveRounded';
import NotificationAddRounded from '@mui/icons-material/NotificationAddRounded';
import { useLocalState } from '@/data/localStore';
import { inscricaoAtual, inscricaoPush, postar, pushSuportado } from './push';

/**
 * "Seguir": avisa neste aparelho quando houver novidade (notícia nova, votação) de um parlamentar,
 * partido ou ministro. A lista fica no aparelho (e no perfil, com login, criptografada); no servidor
 * de avisos fica só o endereço de entrega do navegador e os códigos de quem é acompanhado.
 */
export function BotaoSeguir({ alvo, nome }: { alvo: string; nome: string }) {
  const [lista, setLista] = useLocalState<string[]>('vi:seguindo', []);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (!pushSuportado()) return null;
  const segue = lista.includes(alvo);

  const alternar = async () => {
    setOcupado(true);
    const nova = segue ? lista.filter((a) => a !== alvo) : [...lista, alvo].slice(-100);
    try {
      if (nova.length) {
        const sub = segue ? await inscricaoAtual() : await inscricaoPush();
        if (!sub) {
          setAviso('Para seguir, permita as notificações deste site no navegador.');
          return;
        }
        const r = await postar('/seguir', { ...sub.toJSON(), alvos: nova });
        if (!r.ok) throw new Error(String(r.status));
      } else {
        const sub = await inscricaoAtual();
        if (sub) await postar('/cancelar', { endpoint: sub.endpoint, so: 'seguindo' });
      }
      setLista(nova);
      setAviso(segue ? `Você deixou de seguir ${nome}.` : `Pronto: o aviso chega neste aparelho quando houver novidade sobre ${nome}.`);
    } catch {
      setAviso('Não foi possível atualizar agora. Tente de novo em instantes.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Tooltip title={segue ? 'Parar de receber avisos' : 'Receber aviso de notícias e votações neste aparelho'}>
        <span>
          <Button
            size="small"
            variant={segue ? 'contained' : 'tonal'}
            startIcon={segue ? <NotificationsActiveRounded /> : <NotificationAddRounded />}
            onClick={() => void alternar()}
            disabled={ocupado}
            aria-pressed={segue}
          >
            {segue ? 'Seguindo' : 'Seguir'}
          </Button>
        </span>
      </Tooltip>
      <Snackbar open={aviso != null} autoHideDuration={5000} onClose={() => setAviso(null)} message={aviso} />
    </>
  );
}
