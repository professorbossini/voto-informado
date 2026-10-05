import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { RouterProvider } from 'react-router';
import { AuthProvider, type AuthAdapter } from '@/auth';
import { NotificationsProvider } from '@/components/feedback/NotificationsProvider';
import { MetaProvider } from '@/data/MetaProvider';
import { NativeBridge } from '@/native/NativeBridge';
import { router } from '@/router';
import { useLocalState } from '@/data/localStore';
import { criarTema, TEMA_PADRAO } from '@/theme/temas';

export function App({ adapter }: { adapter: AuthAdapter }) {
  // Tema escolhido no menu Aparência (fica no aparelho; com login, sincronizado).
  const [tema] = useLocalState<string>('vi:tema', TEMA_PADRAO);
  return (
    <ThemeProvider theme={criarTema(tema)} defaultMode="system">
      <CssBaseline enableColorScheme />
      <NativeBridge />
      <AuthProvider adapter={adapter}>
        <NotificationsProvider>
          <MetaProvider>
            <RouterProvider router={router} />
          </MetaProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
