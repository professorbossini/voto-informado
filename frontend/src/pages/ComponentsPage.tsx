import { useState, type ReactNode } from 'react';
import {
  Alert,
  AlertTitle,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { FormField } from '@/components/form/FormField';
import { useNotify } from '@/components/feedback/notificationsContext';
import { duration, easing } from '@/theme/motion';
import { PageHeader } from './PageHeader';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="overline" color="text.secondary" component="h2">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

const SWATCHES = [
  { name: 'primary', label: 'Primary' },
  { name: 'lime', label: 'Lime' },
  { name: 'info', label: 'Info' },
  { name: 'success', label: 'Success' },
  { name: 'error', label: 'Error' },
  { name: 'neutral', label: 'Neutral' },
] as const;

const CURVES = ['standard', 'emphasizedDecelerate', 'springFast'] as const;

function MotionDemo() {
  const [on, setOn] = useState(false);
  return (
    <Stack spacing={1.25}>
      {CURVES.map((curve) => (
        <Stack key={curve} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ width: 150, fontFamily: 'monospace' }}
          >
            {curve}
          </Typography>
          <Box
            sx={{
              flex: 1,
              height: 28,
              borderRadius: 99,
              bgcolor: 'background.subtle',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                left: on ? 'calc(100% - 24px)' : '4px',
                width: 20,
                height: 20,
                borderRadius: '50%',
                bgcolor: curve === 'springFast' ? 'lime.main' : 'primary.main',
                transition: `left ${duration.long2}ms ${easing[curve]}`,
              }}
            />
          </Box>
        </Stack>
      ))}
      <Button
        size="small"
        variant="tonal"
        onClick={() => setOn((v) => !v)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Animar
      </Button>
    </Stack>
  );
}

export function ComponentsPage() {
  const notify = useNotify();
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState('week');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fakeSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      notify('Alterações salvas.', 'success');
    }, 1200);
  };

  return (
    <>
      <PageHeader
        title="Componentes"
        subtitle="Kit do design system: referência para montar qualquer tela do app."
      />
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={4}>
            <Section title="Botões">
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={fakeSave}
                  disabled={loading}
                  sx={{ minWidth: 88 }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Salvar'}
                </Button>
                <Button variant="outlined">Cancelar</Button>
                <Button variant="contained" color="lime" startIcon={<AutoAwesomeRounded />}>
                  Experimente o Pro
                </Button>
                <Button variant="text">Saiba mais</Button>
                <Button variant="tonal">Tonal</Button>
                <Tooltip title="Adicionar">
                  <IconButton
                    aria-label="Adicionar"
                    sx={{
                      bgcolor: 'primary.container',
                      color: 'primary.onContainer',
                      borderRadius: 2.5,
                      '&:hover': { bgcolor: 'primary.container' },
                    }}
                  >
                    <AddRounded />
                  </IconButton>
                </Tooltip>
                <Button variant="contained" disabled>
                  Desabilitado
                </Button>
              </Stack>
            </Section>

            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Campos">
                  <Stack spacing={2}>
                    <FormField label="Nome do projeto" placeholder="Nome do projeto" />
                    <FormField
                      label="Projeto selecionado"
                      defaultValue="App de finanças"
                      focused
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <CheckRounded fontSize="small" color="primary" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    <FormField
                      label="E-mail"
                      defaultValue="ana@exemplo"
                      error
                      helperText="Digite um e-mail válido."
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <ErrorOutlineRounded fontSize="small" color="error" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>
                </Section>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Seleção">
                  <Stack>
                    <FormControlLabel
                      control={<Checkbox defaultChecked />}
                      label="Lembrar de mim"
                    />
                    <FormControlLabel control={<Checkbox />} label="Receber novidades" />
                    <RadioGroup defaultValue="monthly" name="plan">
                      <FormControlLabel value="monthly" control={<Radio />} label="Plano mensal" />
                      <FormControlLabel value="yearly" control={<Radio />} label="Plano anual" />
                    </RadioGroup>
                    <FormControlLabel
                      control={<Switch defaultChecked />}
                      label="Notificações"
                      sx={{ ml: -0.5 }}
                    />
                    <FormControlLabel
                      control={<Switch />}
                      label="Modo compacto"
                      sx={{ ml: -0.5 }}
                    />
                  </Stack>
                </Section>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Abas e segmentado">
                  <Tabs
                    value={tab}
                    onChange={(_, v: number) => setTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Tab label="Visão geral" />
                    <Tab label="Atividade" />
                    <Tab label="Arquivos" />
                  </Tabs>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={period}
                    onChange={(_, v: string | null) => v && setPeriod(v)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    <ToggleButton value="week">Semana</ToggleButton>
                    <ToggleButton value="month">Mês</ToggleButton>
                    <ToggleButton value="year">Ano</ToggleButton>
                  </ToggleButtonGroup>
                </Section>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Badges e avatares">
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <Chip variant="soft" color="lime" label="Novo" />
                    <Chip color="primary" label="Pro" />
                    <Chip variant="soft" color="info" label="Em andamento" />
                    <Chip variant="soft" color="success" label="Concluído" />
                    <Chip variant="soft" label="Rascunho" />
                    <Chip
                      variant="outlined"
                      label="Outlined"
                      onDelete={() => notify('Chip removido')}
                    />
                  </Stack>
                  <AvatarGroup
                    max={4}
                    total={7}
                    sx={{ justifyContent: 'flex-end', alignSelf: 'flex-start' }}
                  >
                    <Avatar sx={{ bgcolor: '#6B3CC9', color: '#FFFFFF' }}>AL</Avatar>
                    <Avatar sx={{ bgcolor: 'lime.main', color: '#2A1263' }}>RM</Avatar>
                    <Avatar sx={{ bgcolor: 'info.container', color: 'info.onContainer' }}>
                      TS
                    </Avatar>
                  </AvatarGroup>
                </Section>
              </Grid>
            </Grid>

            <Section title="Alertas">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Alert severity="success" icon={<CheckCircleOutlineRounded />}>
                    <AlertTitle>Projeto publicado</AlertTitle>
                    Já está disponível para a equipe.
                  </Alert>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Alert severity="info" icon={<InfoOutlined />}>
                    <AlertTitle>Nova versão disponível</AlertTitle>
                    Atualize para ver os novos recursos.
                  </Alert>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Alert severity="warning">
                    <AlertTitle>Armazenamento quase cheio</AlertTitle>
                    Você usou 92% do espaço disponível.
                  </Alert>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Alert severity="error">
                    <AlertTitle>Falha no pagamento</AlertTitle>
                    Verifique os dados do cartão.
                  </Alert>
                </Grid>
              </Grid>
            </Section>

            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Feedback e overlays">
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                    <Button variant="outlined" onClick={() => notify('Mensagem simples')}>
                      Snackbar
                    </Button>
                    <Button variant="outlined" onClick={() => notify('Deu tudo certo!', 'success')}>
                      Snackbar sucesso
                    </Button>
                    <Button variant="outlined" onClick={() => setDialogOpen(true)}>
                      Dialog
                    </Button>
                  </Stack>
                  <Stack spacing={1.5} sx={{ pt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={64}
                      aria-label="Exemplo de progresso"
                    />
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      color="lime"
                      aria-label="Exemplo concluído"
                    />
                    <LinearProgress aria-label="Carregando" />
                  </Stack>
                </Section>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Movimento (Material 3)">
                  <MotionDemo />
                </Section>
              </Grid>
            </Grid>

            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Tipografia: Google Sans Flex">
                  <Typography variant="h2">Display</Typography>
                  <Typography variant="h4">Headline</Typography>
                  <Typography variant="h6">Title</Typography>
                  <Typography>Body: texto corrido confortável para leitura.</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supporting text em tamanho menor.
                  </Typography>
                  <Typography
                    component="code"
                    variant="body2"
                    sx={{ fontFamily: '"Google Sans Code", monospace' }}
                  >
                    const code = &apos;Google Sans Code&apos;;
                  </Typography>
                </Section>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Section title="Cores">
                  <Grid container spacing={1.5}>
                    {SWATCHES.map((s) => (
                      <Grid key={s.name} size={{ xs: 6, sm: 4 }}>
                        <Box
                          sx={{
                            borderRadius: 3,
                            overflow: 'hidden',
                            border: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Box sx={{ height: 44, bgcolor: `${s.name}.main` }} />
                          <Box sx={{ height: 24, bgcolor: `${s.name}.container` }} />
                          <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5 }}>
                            {s.label}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Section>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir projeto?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta ação não pode ser desfeita. Todos os arquivos do projeto serão removidos.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setDialogOpen(false);
              notify('Projeto excluído.', 'error');
            }}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
