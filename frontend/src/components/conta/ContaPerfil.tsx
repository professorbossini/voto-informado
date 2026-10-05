import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LockRounded from '@mui/icons-material/LockRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded';
import KeyRounded from '@mui/icons-material/KeyRounded';
import CloudDoneRounded from '@mui/icons-material/CloudDoneRounded';
import { Link as RouterLink } from 'react-router';
import { useAuth } from '@/auth';
import { GoogleIcon } from '@/components/GoogleIcon';
import { UserAvatar } from '@/components/UserAvatar';
import { useNotify } from '@/components/feedback/notificationsContext';
import { Sincronizador, type EstadoSync } from '@/data/sync/perfil';

const CONSENT_KEY = 'vi:consentimento-login';

function Consentimento({ aberto, onFechar, onAceitar }: { aberto: boolean; onFechar: () => void; onAceitar: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <DialogTitle>Entrar com Google (opcional)</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography>Entrar serve só para guardar as suas escolhas e encontrá-las em outro aparelho. Todo o site continua aberto sem login.</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 } }}>
            <li>
              <b>Login:</b> o Google informa seu nome, e-mail e foto ao serviço de login (Google Firebase).
            </li>
            <li>
              <b>Suas escolhas</b> (candidaturas que você acompanha, cola, comparação, estado, tema e idioma) são <b>criptografadas no seu aparelho</b> com uma
              frase que só você conhece, antes de ir para o servidor. <b>Ninguém consegue ler</b>, nem o responsável pelo site.
            </li>
            <li>Se você esquecer a frase, as escolhas guardadas no servidor não podem ser recuperadas (as do aparelho continuam).</li>
            <li>Você pode apagar sua conta e todos os seus dados quando quiser, no menu da conta.</li>
          </Box>
          <FormControlLabel
            control={<Checkbox checked={ok} onChange={(e) => setOk(e.target.checked)} />}
            label={
              <Typography variant="body2">
                Li e concordo com esse tratamento, incluindo o das minhas escolhas de candidaturas (dado pessoal sensível, LGPD art. 11, I), conforme a{' '}
                <Link component={RouterLink} to="/privacidade" target="_blank">
                  Política de Privacidade
                </Link>
                .
              </Typography>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" startIcon={<GoogleIcon />} disabled={!ok} onClick={onAceitar}>
          Continuar com Google
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Frase({
  modo,
  aberto,
  onFechar,
  onCriar,
  onDesbloquear,
  onRecomecar,
}: {
  modo: 'criar' | 'pedir';
  aberto: boolean;
  onFechar: () => void;
  onCriar: (frase: string) => Promise<void>;
  onDesbloquear: (frase: string) => Promise<boolean>;
  onRecomecar: () => void;
}) {
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const curta = f1.length > 0 && f1.length < 8;
  const enviar = async () => {
    setErro(null);
    setOcupado(true);
    try {
      if (modo === 'criar') await onCriar(f1);
      else if (!(await onDesbloquear(f1))) setErro('Frase incorreta. Confira e tente de novo.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir agora.');
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockRounded color="primary" /> {modo === 'criar' ? 'Crie sua frase de sincronização' : 'Digite sua frase de sincronização'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {modo === 'criar'
              ? 'Ela criptografa suas escolhas antes de saírem deste aparelho. Use pelo menos 8 caracteres e guarde-a: sem ela, ninguém (nem você) consegue abrir o que ficou no servidor.'
              : 'Neste aparelho, digite a frase que você criou para abrir suas escolhas guardadas.'}
          </Typography>
          <TextField label="Frase" type="password" autoFocus value={f1} onChange={(e) => setF1(e.target.value)} error={curta} helperText={curta ? 'Pelo menos 8 caracteres' : ' '} />
          {modo === 'criar' && (
            <TextField label="Repita a frase" type="password" value={f2} onChange={(e) => setF2(e.target.value)} error={f2.length > 0 && f2 !== f1} helperText={f2.length > 0 && f2 !== f1 ? 'As frases não conferem' : ' '} />
          )}
          {erro && <Alert severity="error">{erro}</Alert>}
          {modo === 'pedir' && (
            <Typography variant="caption" color="text.secondary">
              Esqueceu?{' '}
              <Link component="button" type="button" onClick={onRecomecar}>
                Começar de novo
              </Link>{' '}
              (apaga as escolhas guardadas no servidor e cria uma frase nova com as deste aparelho).
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Agora não</Button>
        <Button variant="contained" disabled={ocupado || f1.length < 8 || (modo === 'criar' && f1 !== f2)} onClick={() => void enviar()} startIcon={ocupado ? <CircularProgress size={16} /> : undefined}>
          {modo === 'criar' ? 'Criar e sincronizar' : 'Abrir minhas escolhas'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Canto superior direito de todas as páginas: "Entrar" (login opcional com Google) ou o menu
 * da conta. Com login, as escolhas do aparelho são sincronizadas criptografadas (data/sync).
 */
export function ContaPerfil() {
  const { status, user, signInWithGoogle, signOut } = useAuth();
  const notify = useNotify();
  const [consent, setConsent] = useState(false);
  const [estado, setEstado] = useState<EstadoSync>({ fase: 'desligado' });
  const [fraseAberta, setFraseAberta] = useState(true);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const sync = useRef<Sincronizador | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const s = new Sincronizador(user.id, (e) => {
      setEstado(e);
      if (e.fase === 'criar-frase' || e.fase === 'pedir-frase') setFraseAberta(true);
    });
    sync.current = s;
    void s.iniciar();
    return () => {
      s.encerrar();
      sync.current = null;
      setEstado({ fase: 'desligado' });
    };
  }, [status, user]);

  const entrar = async () => {
    setConsent(false);
    try {
      localStorage.setItem(CONSENT_KEY, new Date().toISOString());
    } catch {
      /* sem armazenamento: o consentimento vale só nesta sessão */
    }
    try {
      await signInWithGoogle();
    } catch {
      notify('Não foi possível entrar agora. Tente de novo.');
    }
  };

  const sair = async () => {
    setMenu(null);
    await sync.current?.sair();
    await signOut();
    notify('Você saiu. Suas escolhas continuam neste aparelho.');
  };

  const apagar = async () => {
    setMenu(null);
    if (!window.confirm('Apagar sua conta e todas as escolhas guardadas no servidor? Isso não pode ser desfeito. (As escolhas deste aparelho continuam.)')) return;
    try {
      await sync.current?.apagarTudo();
      const { getAuth, deleteUser } = await import('firebase/auth');
      const u = getAuth().currentUser;
      if (u) await deleteUser(u);
      notify('Conta e dados apagados.');
    } catch {
      notify('Para apagar a conta, entre de novo e repita a operação (o Google pede um login recente).');
      await signOut();
    }
  };

  if (status === 'loading') return <CircularProgress size={20} sx={{ mx: 1 }} />;

  if (status !== 'authenticated') {
    return (
      <>
        <Tooltip title="Entrar com Google (opcional) para guardar suas escolhas">
          <Button onClick={() => setConsent(true)} variant="tonal" size="small" startIcon={<GoogleIcon />} sx={{ whiteSpace: 'nowrap', minWidth: 0, px: { xs: 1, sm: 1.5 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Entrar
            </Box>
          </Button>
        </Tooltip>
        <Consentimento aberto={consent} onFechar={() => setConsent(false)} onAceitar={() => void entrar()} />
      </>
    );
  }

  const consentimentoEm = (() => {
    try {
      return localStorage.getItem(CONSENT_KEY) ?? new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  })();

  return (
    <>
      <IconButton onClick={(e) => setMenu(e.currentTarget)} aria-label="Abrir menu da conta" aria-haspopup="menu" sx={{ p: 0.5 }}>
        <UserAvatar user={user} sx={{ width: 34, height: 34 }} />
      </IconButton>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { minWidth: 280, maxWidth: 340 } } }}>
        <Stack direction="row" spacing={1.5} sx={{ px: 1.5, py: 1.25, alignItems: 'center' }}>
          <UserAvatar user={user} sx={{ width: 40, height: 40 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {user?.name ?? 'Conta'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {user?.email}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            {estado.fase === 'ativo' ? <CloudDoneRounded fontSize="small" color="success" /> : <LockRounded fontSize="small" color="action" />}
            <Typography variant="caption" color="text.secondary">
              {estado.fase === 'ativo'
                ? 'Escolhas sincronizadas e criptografadas.'
                : estado.fase === 'carregando'
                  ? 'Abrindo suas escolhas…'
                  : estado.fase === 'erro'
                    ? 'Sincronização com problema; tentaremos de novo.'
                    : 'Sincronização pendente: falta a frase neste aparelho.'}
            </Typography>
          </Stack>
        </Box>
        <Divider />
        {(estado.fase === 'pedir-frase' || estado.fase === 'criar-frase') && (
          <MenuItem
            onClick={() => {
              setMenu(null);
              setFraseAberta(true);
            }}
          >
            <ListItemIcon>
              <KeyRounded fontSize="small" />
            </ListItemIcon>
            {estado.fase === 'criar-frase' ? 'Criar frase e sincronizar' : 'Digitar a frase neste aparelho'}
          </MenuItem>
        )}
        <MenuItem onClick={() => void apagar()}>
          <ListItemIcon>
            <DeleteForeverRounded fontSize="small" />
          </ListItemIcon>
          Apagar minha conta e meus dados
        </MenuItem>
        <MenuItem onClick={() => void sair()}>
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
      {(estado.fase === 'criar-frase' || estado.fase === 'pedir-frase') && (
        <Frase
          modo={estado.fase === 'criar-frase' ? 'criar' : 'pedir'}
          aberto={fraseAberta}
          onFechar={() => setFraseAberta(false)}
          onCriar={async (f) => {
            await sync.current?.criar(f, consentimentoEm);
            notify('Pronto: suas escolhas agora ficam salvas no seu perfil, criptografadas.');
          }}
          onDesbloquear={async (f) => {
            const ok = (await sync.current?.desbloquear(f)) ?? false;
            if (ok) notify('Suas escolhas foram abertas neste aparelho.');
            return ok;
          }}
          onRecomecar={() => {
            if (!window.confirm('Apagar as escolhas guardadas no servidor e criar uma frase nova com as deste aparelho?')) return;
            void sync.current?.apagarTudo().then(() => setEstado({ fase: 'criar-frase' }));
          }}
        />
      )}
    </>
  );
}
