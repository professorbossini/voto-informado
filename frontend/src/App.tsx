import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { RouterProvider } from 'react-router';
import { AuthProvider, type AuthAdapter } from '@/auth';
import { NotificationsProvider } from '@/components/feedback/NotificationsProvider';
import { MetaProvider } from '@/data/MetaProvider';
import { router } from '@/router';
import { theme } from '@/theme';

export function App({ adapter }: { adapter: AuthAdapter }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
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
