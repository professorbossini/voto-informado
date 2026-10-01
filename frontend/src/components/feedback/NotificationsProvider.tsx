import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert, Slide, Snackbar, type AlertColor } from '@mui/material';
import { NotificationsContext, type Notify } from './notificationsContext';

interface Notification {
  key: number;
  message: ReactNode;
  severity?: AlertColor;
}

/** Queue-based snackbars. Call `useNotify()(message, severity?)` from anywhere. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Notification[]>([]);
  const [open, setOpen] = useState(true);
  const current = queue[0];

  const notify = useCallback<Notify>((message, severity) => {
    setQueue((q) => [...q, { key: Date.now() + Math.random(), message, severity }]);
    setOpen(true);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={Boolean(current) && open}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && setOpen(false)}
        slots={{ transition: Slide }}
        slotProps={{
          transition: {
            onExited: () => {
              setQueue((q) => q.slice(1));
              setOpen(true);
            },
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88, md: 24 } }}
      >
        {current?.severity ? (
          <Alert
            severity={current.severity}
            variant="filled"
            onClose={() => setOpen(false)}
            sx={{ borderRadius: 3, alignItems: 'center', fontWeight: 500 }}
          >
            {current.message}
          </Alert>
        ) : (
          <Alert
            icon={false}
            onClose={() => setOpen(false)}
            sx={{
              borderRadius: 3,
              bgcolor: '#1C1433',
              color: '#F4F1FB',
              border: 0,
              alignItems: 'center',
            }}
          >
            {current?.message}
          </Alert>
        )}
      </Snackbar>
    </NotificationsContext.Provider>
  );
}
