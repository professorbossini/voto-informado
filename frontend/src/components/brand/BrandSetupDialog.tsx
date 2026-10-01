import type { ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import LinkRounded from '@mui/icons-material/LinkRounded';
import TextFieldsRounded from '@mui/icons-material/TextFieldsRounded';
import { brand } from '@/config/brand';
import { useNotify } from '@/components/feedback/notificationsContext';
import { monoFontFamily } from '@/theme/theme';

function Snippet({ children }: { children: string }) {
  const notify = useNotify();
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        bgcolor: 'background.subtle',
        borderRadius: 2,
        pl: 1.5,
        pr: 0.5,
        py: 0.5,
        mt: 1,
      }}
    >
      <Box
        component="code"
        sx={{
          fontFamily: monoFontFamily,
          fontSize: '0.8125rem',
          flex: 1,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Box>
      <Tooltip title="Copiar">
        <IconButton
          size="small"
          aria-label="Copiar"
          onClick={() => {
            void navigator.clipboard?.writeText(children);
            notify('Copiado!');
          }}
        >
          <ContentCopyRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function Step({
  icon,
  title,
  status,
  children,
}: {
  icon: ReactNode;
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={2}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 3,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.container',
          color: 'primary.onContainer',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {status}
        </Stack>
        {children}
      </Box>
    </Stack>
  );
}

const done = (label: string) => <Chip size="small" variant="soft" color="lime" label={label} />;
const pending = <Chip size="small" variant="soft" label="não definido" />;

/** Explains how to replace the placeholders with your own logo and name. */
export function BrandSetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Personalize sua marca</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          O logo e o nome do seu app aparecem aqui assim que forem configurados. Escolha como
          fornecer o logo: <strong>arquivo numa pasta</strong> ou <strong>link</strong>. A tela
          carrega sozinha.
        </Typography>
        <Stack spacing={3}>
          <Step
            icon={<FolderOutlined />}
            title="Logo por arquivo"
            status={
              brand.logoSource === 'folder' ? done('em uso') : brand.logoSource ? null : pending
            }
          >
            <Typography variant="body2" color="text.secondary">
              Salve o arquivo como <code>logo.svg</code> (ou .png, .webp, .jpg) na pasta abaixo. Ele
              é detectado automaticamente e também vira o favicon.
            </Typography>
            <Snippet>src/brand/logo.svg</Snippet>
          </Step>
          <Step
            icon={<LinkRounded />}
            title="Logo por link"
            status={brand.logoSource === 'url' ? done('em uso') : null}
          >
            <Typography variant="body2" color="text.secondary">
              Ou aponte para uma imagem hospedada (tem prioridade sobre a pasta):
            </Typography>
            <Snippet>VITE_APP_LOGO_URL=https://seu-site.com/logo.svg</Snippet>
          </Step>
          <Step
            icon={<TextFieldsRounded />}
            title="Nome do app"
            status={brand.name ? done(brand.name) : pending}
          >
            <Typography variant="body2" color="text.secondary">
              Defina no arquivo <code>.env</code>:
            </Typography>
            <Snippet>VITE_APP_NAME=Meu App</Snippet>
          </Step>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          O Vite reinicia sozinho quando o <code>.env</code> muda. Se não atualizar, pare e rode{' '}
          <code>npm run dev</code> de novo. Detalhes em <code>src/brand/README.md</code>.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>
          Entendi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
